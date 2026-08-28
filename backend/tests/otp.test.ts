import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mail is stubbed so tests never open an SMTP connection. The spy also lets us
// read back the generated code, which is the only place it is ever exposed.
const sentCodes: string[] = [];
/** Set to make the next send throw, standing in for a broken transport. */
let failNextSend: Error | null = null;
vi.mock('../services/mail.service', () => ({
  sendOtpEmail: vi.fn(async (_email: string, code: string) => {
    if (failNextSend) {
      const err = failNextSend;
      failNextSend = null;
      throw err;
    }
    sentCodes.push(code);
  }),
  verifyTransport: vi.fn(async () => undefined),
}));

import { prisma } from '../config/database';
import { env } from '../config';
import { requestOtp, resendOtp, verifyOtp, normalizeEmail } from '../services/otp.service';
import { ApiError } from '../utils/ApiError';
import { sha256 } from '../utils/security';

const EMAIL = 'otp-test@example.test';

async function wipe() {
  await prisma.emailOtp.deleteMany({ where: { email: normalizeEmail(EMAIL) } });
}

/** Backdates lastSentAt so a resend is allowed without waiting out the cooldown. */
async function clearCooldown() {
  await prisma.emailOtp.updateMany({
    where: { email: normalizeEmail(EMAIL) },
    data: { lastSentAt: new Date(Date.now() - (env.OTP_RESEND_COOLDOWN_SECONDS + 5) * 1000) },
  });
}

beforeEach(async () => {
  sentCodes.length = 0;
  failNextSend = null;
  await wipe();
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe('OTP issuance', () => {
  it('emails a 6-digit code and never stores it in plaintext', async () => {
    await requestOtp(EMAIL, 'LOGIN');
    const code = sentCodes.at(-1)!;

    expect(code).toMatch(/^\d{6}$/);

    const row = await prisma.emailOtp.findFirstOrThrow({ where: { email: EMAIL } });
    expect(row.codeHash).not.toContain(code);
    expect(row.codeHash).toBe(sha256(`LOGIN:${EMAIL}:${code}`));
  });

  it('normalizes the address so casing and padding cannot fork the record', async () => {
    await requestOtp('  OTP-Test@Example.Test  ', 'LOGIN');
    const row = await prisma.emailOtp.findFirstOrThrow({ where: { email: EMAIL } });
    expect(row.email).toBe(EMAIL);
  });

  it('refuses a resend inside the cooldown window, with a machine-readable deadline', async () => {
    await requestOtp(EMAIL, 'LOGIN');

    const failure = await requestOtp(EMAIL, 'LOGIN').catch((e: ApiError) => e);
    expect(failure).toBeInstanceOf(ApiError);
    const err = failure as ApiError;
    expect(err.statusCode).toBe(429);
    // The client re-syncs its countdown from these rather than parsing prose,
    // which is what kept the visible timer and the refusal in agreement.
    expect(err.meta?.reason).toBe('cooldown');
    expect(Number(err.meta?.retryAfterSeconds)).toBeGreaterThan(0);
    expect(new Date(String(err.meta?.resendAfterAt)).getTime()).toBeGreaterThan(Date.now());
  });

  it('reports an absolute resend deadline consistent with the configured cooldown', async () => {
    const before = Date.now();
    const result = await requestOtp(EMAIL, 'LOGIN');
    const gap = (result.resendAfterAt.getTime() - before) / 1000;

    expect(result.resendAfterSeconds).toBe(env.OTP_RESEND_COOLDOWN_SECONDS);
    expect(gap).toBeGreaterThan(env.OTP_RESEND_COOLDOWN_SECONDS - 5);
    expect(gap).toBeLessThanOrEqual(env.OTP_RESEND_COOLDOWN_SECONDS + 5);
  });

  it('leaves no code and no cooldown when delivery fails', async () => {
    failNextSend = new Error('smtp is down');

    await expect(requestOtp(EMAIL, 'LOGIN')).rejects.toThrow('smtp is down');

    // The row must be rolled back: otherwise the address sits in a 60s cooldown
    // for a code that was never delivered.
    expect(await prisma.emailOtp.count({ where: { email: EMAIL } })).toBe(0);
    // ...and an immediate retry is accepted rather than refused.
    await expect(requestOtp(EMAIL, 'LOGIN')).resolves.toMatchObject({ email: EMAIL });
  });

  it('supersedes the previous code so only one is ever live', async () => {
    await requestOtp(EMAIL, 'LOGIN');
    const first = sentCodes.at(-1)!;
    await clearCooldown();
    await requestOtp(EMAIL, 'LOGIN');

    await expect(verifyOtp(EMAIL, 'LOGIN', first)).rejects.toMatchObject({ statusCode: 422 });
    await expect(verifyOtp(EMAIL, 'LOGIN', sentCodes.at(-1)!)).resolves.toMatchObject({ email: EMAIL });
  });
});

describe('OTP resend', () => {
  it('reuses the stored registration draft, so it works with no form to resubmit', async () => {
    const payload = { email: EMAIL, fullName: 'Test Applicant', institution: 'Test Institute' };
    await requestOtp(EMAIL, 'REGISTER', { payload });
    await clearCooldown();

    // Address only — this is the call a page makes after being refreshed.
    await resendOtp(EMAIL, 'REGISTER');

    const verified = await verifyOtp(EMAIL, 'REGISTER', sentCodes.at(-1)!);
    expect(verified.payload).toMatchObject(payload);
  });

  it('supersedes the previous code', async () => {
    await requestOtp(EMAIL, 'LOGIN');
    const first = sentCodes.at(-1)!;
    await clearCooldown();
    await resendOtp(EMAIL, 'LOGIN');

    await expect(verifyOtp(EMAIL, 'LOGIN', first)).rejects.toMatchObject({ statusCode: 422 });
    await expect(verifyOtp(EMAIL, 'LOGIN', sentCodes.at(-1)!)).resolves.toMatchObject({ email: EMAIL });
  });

  it('refuses when nothing is in progress', async () => {
    await expect(resendOtp(EMAIL, 'LOGIN')).rejects.toMatchObject({ statusCode: 410 });
  });

  it('honours the cooldown', async () => {
    await requestOtp(EMAIL, 'LOGIN');
    await expect(resendOtp(EMAIL, 'LOGIN')).rejects.toMatchObject({ statusCode: 429 });
  });

  it('stops at the resend limit and says which limit was hit', async () => {
    await requestOtp(EMAIL, 'LOGIN');

    let lastError: ApiError | null = null;
    for (let i = 0; i < env.OTP_MAX_RESENDS + 1; i++) {
      await clearCooldown();
      const outcome = await resendOtp(EMAIL, 'LOGIN').catch((e: ApiError) => e);
      if (outcome instanceof ApiError) {
        lastError = outcome;
        break;
      }
    }

    expect(lastError?.statusCode).toBe(429);
    // Distinct from the attempt limit so the UI can word the two differently.
    expect(lastError?.meta?.reason).toBe('resend-limit');
  });
});

describe('OTP verification', () => {
  it('accepts the correct code once, then rejects the reuse', async () => {
    await requestOtp(EMAIL, 'LOGIN');
    const code = sentCodes.at(-1)!;

    await expect(verifyOtp(EMAIL, 'LOGIN', code)).resolves.toMatchObject({ email: EMAIL });
    // Consumed: a replay must not open a second session.
    await expect(verifyOtp(EMAIL, 'LOGIN', code)).rejects.toMatchObject({ statusCode: 410 });
  });

  it('will not accept a REGISTER code on the LOGIN flow', async () => {
    await requestOtp(EMAIL, 'REGISTER', { payload: { email: EMAIL } });
    const code = sentCodes.at(-1)!;
    await expect(verifyOtp(EMAIL, 'LOGIN', code)).rejects.toMatchObject({ statusCode: 410 });
  });

  it('counts wrong attempts and burns the code on the limit', async () => {
    await requestOtp(EMAIL, 'LOGIN');
    const code = sentCodes.at(-1)!;
    const wrong = code === '000000' ? '111111' : '000000';

    for (let attempt = 1; attempt < env.OTP_MAX_ATTEMPTS; attempt++) {
      await expect(verifyOtp(EMAIL, 'LOGIN', wrong)).rejects.toMatchObject({ statusCode: 422 });
    }
    const row = await prisma.emailOtp.findFirstOrThrow({ where: { email: EMAIL } });
    expect(row.attempts).toBe(env.OTP_MAX_ATTEMPTS - 1);

    // The final wrong attempt trips the limit...
    await expect(verifyOtp(EMAIL, 'LOGIN', wrong)).rejects.toMatchObject({
      statusCode: 429,
      meta: { reason: 'attempt-limit' },
    });
    // ...and the now-burned code no longer works even when correct.
    await expect(verifyOtp(EMAIL, 'LOGIN', code)).rejects.toMatchObject({ statusCode: 410 });
  });

  it('reports an expired code as expired rather than incorrect', async () => {
    await requestOtp(EMAIL, 'LOGIN');
    const code = sentCodes.at(-1)!;
    await prisma.emailOtp.updateMany({
      where: { email: EMAIL },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    // 410 is what lets the UI offer a resend instead of a dead error.
    await expect(verifyOtp(EMAIL, 'LOGIN', code)).rejects.toMatchObject({ statusCode: 410 });
  });

  it('returns the stored registration draft on success', async () => {
    const payload = { email: EMAIL, fullName: 'Test Applicant' };
    await requestOtp(EMAIL, 'REGISTER', { payload });
    const result = await verifyOtp(EMAIL, 'REGISTER', sentCodes.at(-1)!);
    expect(result.payload).toMatchObject(payload);
  });
});
