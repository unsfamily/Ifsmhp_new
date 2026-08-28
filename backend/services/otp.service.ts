import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config';
import { ApiError } from '../utils/ApiError';
import { sha256 } from '../utils/security';
import { sendOtpEmail } from './mail.service';

export type OtpPurpose = 'REGISTER' | 'LOGIN';

/** Normalizes an address so lookups and hashing agree everywhere. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Six digits from a CSPRNG. `crypto.randomInt` is uniform over the range, so
 * this has no modulo bias — and unlike Math.random it is not predictable from
 * previously observed values.
 */
function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Binds the hash to the address and purpose, so a code minted for one flow
 * cannot be replayed against another.
 */
function hashCode(email: string, purpose: OtpPurpose, code: string): string {
  return sha256(`${purpose}:${email}:${code}`);
}

/** Constant-time compare so a wrong code leaks nothing through timing. */
function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function secondsUntil(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
}

/** Best-effort sweep of dead rows; never blocks the caller's request. */
async function purgeExpired(): Promise<void> {
  await prisma.emailOtp
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);
}

export interface RequestOtpResult {
  email: string;
  expiresAt: Date;
  /** Seconds the client must wait before a resend is accepted. */
  resendAfterSeconds: number;
  /**
   * Absolute instant the cooldown ends. The client counts down to this rather
   * than decrementing a number, so the timer stays truthful across a page
   * refresh, a sleeping tab, and clock drift between the two.
   */
  resendAfterAt: Date;
}

/** Guards a fresh send against the per-address cooldown and resend cap. */
async function assertCanSend(existing: { id: string; lastSentAt: Date; resendCount: number } | null) {
  if (!existing) return;

  // Cooldown is keyed on the address, so rotating IPs does not bypass it.
  const nextAllowed = new Date(existing.lastSentAt.getTime() + env.OTP_RESEND_COOLDOWN_SECONDS * 1000);
  if (nextAllowed > new Date()) {
    const retryAfterSeconds = secondsUntil(nextAllowed);
    throw new ApiError(
      429,
      `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
      [{ field: 'code', message: 'Resend cooldown active' }],
      { reason: 'cooldown', retryAfterSeconds, resendAfterAt: nextAllowed.toISOString() },
    );
  }

  if (existing.resendCount + 1 >= env.OTP_MAX_RESENDS) {
    // Burn the row so the next attempt starts a fresh lifecycle rather than
    // letting one address be resent indefinitely.
    await prisma.emailOtp.update({ where: { id: existing.id }, data: { consumedAt: new Date() } });
    throw new ApiError(
      429,
      'Too many codes requested for this email. Please start again in a few minutes.',
      [{ field: 'code', message: 'Resend limit reached' }],
      { reason: 'resend-limit' },
    );
  }
}

/**
 * Creates the code row, sends the email, and rolls the row back if delivery
 * fails.
 *
 * Order matters: writing the row is what starts the cooldown, so committing to
 * it before a successful send would lock the user out for a minute over a code
 * that was never delivered.
 */
async function issueAndSend(
  email: string,
  purpose: OtpPurpose,
  resendCount: number,
  payload: Prisma.InputJsonValue | undefined,
  ipAddress: string | undefined,
): Promise<RequestOtpResult> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000);

  const created = await prisma.$transaction(async (tx) => {
    await tx.emailOtp.updateMany({
      where: { email, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return tx.emailOtp.create({
      data: {
        email,
        purpose,
        codeHash: hashCode(email, purpose, code),
        payload,
        expiresAt,
        resendCount,
        ipAddress: ipAddress ?? null,
      },
    });
  });

  try {
    await sendOtpEmail(email, code, purpose, env.OTP_TTL_MINUTES);
  } catch (error) {
    // Undeliverable: drop the row so the address is not left in cooldown and
    // the user can correct the address and retry immediately.
    await prisma.emailOtp.delete({ where: { id: created.id } }).catch(() => undefined);
    throw error;
  }

  return {
    email,
    expiresAt,
    resendAfterSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    resendAfterAt: new Date(created.lastSentAt.getTime() + env.OTP_RESEND_COOLDOWN_SECONDS * 1000),
  };
}

/**
 * Issues a code, or resends the live one's replacement.
 *
 * Exactly one unconsumed code exists per (email, purpose) at a time: requesting
 * again supersedes the previous code rather than leaving several valid.
 */
export async function requestOtp(
  email: string,
  purpose: OtpPurpose,
  options: { payload?: Prisma.InputJsonValue; ipAddress?: string } = {},
): Promise<RequestOtpResult> {
  const normalized = normalizeEmail(email);
  await purgeExpired();

  const existing = await prisma.emailOtp.findFirst({
    where: { email: normalized, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  await assertCanSend(existing);

  return issueAndSend(
    normalized,
    purpose,
    existing ? existing.resendCount + 1 : 0,
    options.payload,
    options.ipAddress,
  );
}

/**
 * Re-sends the code for an attempt already in progress, identified by address
 * alone.
 *
 * A REGISTER resend cannot require the application again: after a page refresh
 * the form is empty, and the draft is already held on the live OTP row. This
 * reuses that stored payload so the attempt survives a reload.
 */
export async function resendOtp(
  email: string,
  purpose: OtpPurpose,
  options: { ipAddress?: string } = {},
): Promise<RequestOtpResult> {
  const normalized = normalizeEmail(email);
  await purgeExpired();

  const existing = await prisma.emailOtp.findFirst({
    where: { email: normalized, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!existing) {
    throw new ApiError(410, 'That request has expired. Please start again.', [
      { field: 'code', message: 'No code in progress' },
    ], { reason: 'expired' });
  }

  await assertCanSend(existing);

  return issueAndSend(
    normalized,
    purpose,
    existing.resendCount + 1,
    // Prisma types a nullable Json column as `JsonValue | null`; only a real
    // object is a valid input value.
    (existing.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    options.ipAddress,
  );
}

export interface VerifiedOtp {
  email: string;
  payload: Prisma.JsonValue | null;
}

/**
 * Checks a code and consumes it on success.
 *
 * Failure modes are distinguished so the UI can offer a resend for an expired
 * code rather than showing a dead "invalid code" error:
 *  - 410 the code expired or none was issued
 *  - 429 the attempt limit was reached (the code is burned)
 *  - 422 the code is simply wrong
 */
export async function verifyOtp(
  email: string,
  purpose: OtpPurpose,
  code: string,
): Promise<VerifiedOtp> {
  const normalized = normalizeEmail(email);

  const record = await prisma.emailOtp.findFirst({
    where: { email: normalized, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new ApiError(410, 'That code has expired. Request a new one to continue.', [
      { field: 'code', message: 'Code expired' },
    ], { reason: 'expired' });
  }

  if (record.expiresAt <= new Date()) {
    await prisma.emailOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    throw new ApiError(410, 'That code has expired. Request a new one to continue.', [
      { field: 'code', message: 'Code expired' },
    ], { reason: 'expired' });
  }

  if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
    await prisma.emailOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    throw new ApiError(429, 'Too many incorrect attempts. Request a new code to continue.', [
      { field: 'code', message: 'Too many attempts' },
    ], { reason: 'attempt-limit' });
  }

  if (!hashesMatch(record.codeHash, hashCode(normalized, purpose, code))) {
    const attempts = record.attempts + 1;
    const remaining = env.OTP_MAX_ATTEMPTS - attempts;
    await prisma.emailOtp.update({ where: { id: record.id }, data: { attempts } });

    if (remaining <= 0) {
      await prisma.emailOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
      throw new ApiError(429, 'Too many incorrect attempts. Request a new code to continue.', [
        { field: 'code', message: 'Too many attempts' },
      ], { reason: 'attempt-limit' });
    }
    throw new ApiError(
      422,
      `That code is not correct. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      [{ field: 'code', message: 'Incorrect code' }],
      { reason: 'incorrect', attemptsRemaining: remaining },
    );
  }

  await prisma.emailOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return { email: normalized, payload: record.payload };
}
