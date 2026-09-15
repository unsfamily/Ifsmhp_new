import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import {
  addDays,
  addHours,
  hashPassword,
  randomToken,
  refreshCookieOptions,
  sha256,
  signAccessToken,
  verifyPassword,
} from '../utils/security';
import { env } from '../config';
import { writeAudit } from './audit.service';
import * as otpService from './otp.service';
import { normalizeEmail } from './otp.service';
import {
  registrationDocumentTitle,
  registrationDocumentType,
  resolveRegistrationDocuments,
  type RegistrationDocumentClaim,
} from './registration-documents.service';

export interface RegisterInput {
  fullName: string;
  email: string;
  professionalType: string;
  institution: string;
  credentials: string;
  education: string;
  researchInterests: string;
  country?: string;
  phone?: string;
  documents: RegistrationDocumentClaim[];
}

export interface LoginInput {
  email: string;
  password: string;
  remember?: boolean;
}

/** Statuses that may never start a session, whatever the credential. */
const BLOCKED_STATUSES = ['REJECTED', 'SUSPENDED', 'DEACTIVATED'];

/**
 * Where a soft-deleted account's address is parked so a new signup can reclaim
 * the real one. `.invalid` is reserved by RFC 2606 and can never be delivered to.
 */
const DELETED_EMAIL_DOMAIN = 'deleted.invalid';

/**
 * The single "no such account" response.
 *
 * Deliberately one factory rather than a message repeated at each call site:
 * the request and verify paths used to word this differently, so a client that
 * matched on the text rendered the second step as something else entirely.
 */
const noSuchAccount = () =>
  new ApiError(404, 'No account found with this email. Register to join IFSMHP.', [
    { field: 'email', message: 'This email is not registered.' },
  ]);

/**
 * Finds a live account by address.
 *
 * Soft-deleted rows read as absent. `requireAuth` already refuses them, so
 * without this the login paths would hand out a code and a session for an
 * account that 401s on its very next request.
 */
async function findLiveUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  return user?.deletedAt ? null : user;
}

/** As `findLiveUser`, with the relations `publicUser` needs to build a session. */
async function findLiveUserForSession(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberProfile: true, membershipApplication: true },
  });
  return user?.deletedAt ? null : user;
}

function jsonPayload(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function publicUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  memberProfile?: { memberId: string | null; professionalType?: string } | null;
  membershipApplication?: { status: string } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    memberId: user.memberProfile?.memberId ?? null,
    professionalType: user.memberProfile?.professionalType ?? null,
    /**
     * The stored application state, so the client can say "under review" only
     * when that is actually true rather than inferring it from the role.
     * Null for users who never applied (administrators).
     */
    applicationStatus: user.membershipApplication?.status ?? null,
  };
}

/**
 * Creates a refresh session and access token for an already-authenticated user.
 *
 * Shared by password login and OTP login so both paths get identical session
 * semantics — rotation, cookie flags and `lastLoginAt` all live in one place.
 */
async function issueSession(
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    status: string;
    memberProfile?: { memberId: string | null } | null;
    membershipApplication?: { status: string } | null;
  },
  req: Request,
  res: Response,
  remember = false,
) {
  const refreshToken = randomToken(48);
  const expiresAt = addDays(new Date(), remember ? 30 : env.REFRESH_TOKEN_TTL_DAYS);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  res.cookie('refreshToken', refreshToken, { ...refreshCookieOptions(), expires: expiresAt });
  return {
    user: publicUser(user),
    accessToken: signAccessToken({ sub: user.id, sessionId: session.id, role: user.role }),
    expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
  };
}

export async function registerApplicant(input: RegisterInput, req: Request) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.deletedAt) {
    throw new ApiError(409, 'An account with this email already exists', [
      { field: 'email', message: 'Use a different email or sign in.' },
    ]);
  }

  const code = `IFSMHP-APP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const interests = input.researchInterests
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);

  const result = await prisma.$transaction(async (tx) => {
    // `email` is UNIQUE, so a soft-deleted row still occupies the address even
    // though every auth path treats it as gone. Park it on a tombstone address
    // instead of deleting it — the row still anchors that person's projects,
    // messages and audit trail through real foreign keys.
    if (existing?.deletedAt) {
      await tx.user.update({
        where: { id: existing.id },
        data: { email: `deleted+${existing.id}@${DELETED_EMAIL_DOMAIN}` },
      });
    }

    const documents = await resolveRegistrationDocuments(input.documents, tx);
    const user = await tx.user.create({
      data: {
        email,
        // Members authenticate by emailed OTP; no password is ever set.
        passwordHash: null,
        fullName: input.fullName.trim(),
        role: 'APPLICANT',
        status: 'PENDING',
      },
    });
    const profile = await tx.memberProfile.create({
      data: {
        userId: user.id,
        professionalTitle: input.professionalType,
        professionalType: input.professionalType,
        institution: input.institution.trim(),
        country: input.country ?? null,
        phone: input.phone ?? null,
        biography: input.credentials,
        interests: {
          create: interests.length > 0 ? interests.map((name) => ({ name })) : [{ name: input.professionalType }],
        },
        education: {
          create: [{ degree: input.education.slice(0, 180), institution: input.institution.trim(), detail: input.education }],
        },
      },
    });
    const application = await tx.membershipApplication.create({
      data: {
        applicationCode: code,
        userId: user.id,
        profileId: profile.id,
        credentialsText: input.credentials,
        educationText: input.education,
        researchText: input.researchInterests,
        histories: { create: { toStatus: 'PENDING', note: 'Application submitted by applicant' } },
      },
    });
    await tx.notification.create({
      data: {
        userId: user.id,
        title: 'Application received',
        body: 'Your IFSMHP membership application is pending review.',
        type: 'membership',
      },
    });
    for (const document of documents) {
      await tx.professionalCredential.create({
        data: {
          profileId: profile.id,
          fileId: document.fileId,
          title: registrationDocumentTitle(document.kind),
          issuer: input.institution.trim(),
          credentialType: registrationDocumentType(document.kind),
        },
      });
      await tx.fileObject.update({
        where: { id: document.fileId },
        data: { uploaderId: user.id },
      });
    }
    return { user, application };
  });

  await writeAudit({
    actorId: result.user.id,
    actorLabel: result.user.email,
    actorRole: 'APPLICANT',
    action: 'MembershipApplicationSubmitted',
    entity: `MembershipApplication ${result.application.id}`,
    severity: 'INFO',
    description: `Membership application ${result.application.applicationCode} submitted.`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return {
    user: publicUser(result.user),
    applicationId: result.application.id,
    applicationCode: result.application.applicationCode,
    status: result.application.status,
  };
}

export async function login(input: LoginInput, req: Request, res: Response) {
  const email = normalizeEmail(input.email);
  const user = await findLiveUserForSession(email);

  // Password sign-in is retained for administrators only. Members and
  // applicants authenticate with an emailed one-time code.
  if (user && user.role !== 'ADMIN') {
    throw new ApiError(400, 'This account signs in with an email code. Request one to continue.', [
      { field: 'email', message: 'Use the email code sign-in.' },
    ]);
  }

  if (!user || !user.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (BLOCKED_STATUSES.includes(user.status)) {
    throw new ApiError(403, 'This account cannot sign in. Contact IFSMHP support.');
  }

  return issueSession(user, req, res, input.remember);
}

/**
 * Step 1 of registration — validate the draft and email a code.
 *
 * No User row is created here. The submitted details are parked on the OTP
 * record until the address is proven, so an unverified signup cannot occupy an
 * email address that someone else may legitimately own.
 */
export async function requestRegistrationOtp(input: RegisterInput, req: Request) {
  const email = normalizeEmail(input.email);

  // Only a live account blocks the address. A soft-deleted one must not hold it
  // hostage: the row is invisible to every auth path, so refusing here would
  // make the address permanently unclaimable by anyone, its owner included.
  const existing = await findLiveUser(email);
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists. Sign in instead.', [
      { field: 'email', message: 'This email is already registered.' },
    ]);
  }
  await resolveRegistrationDocuments(input.documents);

  const { expiresAt, resendAfterSeconds, resendAfterAt } = await otpService.requestOtp(
    email,
    'REGISTER',
    { payload: jsonPayload({ ...input, email }), ipAddress: req.ip },
  );

  return { email, expiresAt, resendAfterSeconds, resendAfterAt };
}

/**
 * Step 1 of login — confirm the address belongs to a member, then email a code.
 *
 * The explicit "not registered" response is account enumeration, requested
 * deliberately for usability; the per-IP rate limit and per-email cooldown on
 * this route are what stop it being cheaply scriptable.
 */
export async function requestLoginOtp(email: string, req: Request) {
  const normalized = normalizeEmail(email);
  const user = await findLiveUser(normalized);

  if (!user) {
    throw noSuchAccount();
  }
  if (user.role === 'ADMIN') {
    throw new ApiError(400, 'Administrator accounts sign in with a password.', [
      { field: 'email', message: 'Use password sign-in for this account.' },
    ]);
  }
  if (BLOCKED_STATUSES.includes(user.status)) {
    throw new ApiError(403, 'This account cannot sign in. Contact IFSMHP support.');
  }

  const { expiresAt, resendAfterSeconds, resendAfterAt } = await otpService.requestOtp(
    normalized,
    'LOGIN',
    { ipAddress: req.ip },
  );

  return { email: normalized, expiresAt, resendAfterSeconds, resendAfterAt };
}

/**
 * Re-sends the code for an attempt already under way.
 *
 * Takes the address alone: after a page refresh the registration form is empty,
 * so requiring the draft again would make resend impossible exactly when it is
 * most needed. The draft is already on the live OTP row.
 */
export async function resendOtp(email: string, purpose: 'REGISTER' | 'LOGIN', req: Request) {
  const normalized = normalizeEmail(email);

  if (purpose === 'LOGIN') {
    const user = await findLiveUser(normalized);
    if (!user) {
      throw noSuchAccount();
    }
    // Mirrors requestLoginOtp: the checks that gate the first code have to gate
    // the resend too, or the resend becomes a way around them.
    if (user.role === 'ADMIN') {
      throw new ApiError(400, 'Administrator accounts sign in with a password.', [
        { field: 'email', message: 'Use password sign-in for this account.' },
      ]);
    }
    if (BLOCKED_STATUSES.includes(user.status)) {
      throw new ApiError(403, 'This account cannot sign in. Contact IFSMHP support.');
    }
  }

  const { expiresAt, resendAfterSeconds, resendAfterAt } = await otpService.resendOtp(
    normalized,
    purpose,
    { ipAddress: req.ip },
  );
  return { email: normalized, expiresAt, resendAfterSeconds, resendAfterAt };
}

/**
 * Step 2 of registration — the code is correct, so build the account.
 *
 * Creates the same APPLICANT/PENDING user, profile and application as before;
 * an administrator still reviews it and `approveMember` issues the member ID.
 * The new applicant is signed in so they can watch their application status.
 */
export async function verifyRegistrationOtp(
  email: string,
  code: string,
  req: Request,
  res: Response,
) {
  const verified = await otpService.verifyOtp(email, 'REGISTER', code);
  const draft = verified.payload as RegisterInput | null;

  if (!draft) {
    throw new ApiError(422, 'That registration could not be found. Please start again.');
  }

  const registration = await registerApplicant({ ...draft, email: verified.email }, req);

  const user = await prisma.user.findUnique({
    where: { id: registration.user.id },
    include: { memberProfile: true, membershipApplication: true },
  });
  const session = await issueSession(user!, req, res);

  return { ...session, ...registration };
}

/** Step 2 of login — the code is correct, so start a session. */
export async function verifyLoginOtp(email: string, code: string, req: Request, res: Response) {
  const verified = await otpService.verifyOtp(email, 'LOGIN', code);

  const user = await findLiveUserForSession(verified.email);
  if (!user) throw noSuchAccount();
  if (BLOCKED_STATUSES.includes(user.status)) {
    throw new ApiError(403, 'This account cannot sign in. Contact IFSMHP support.');
  }

  return issueSession(user, req, res);
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = req.cookies?.refreshToken as string | undefined;
  if (!refreshToken) throw new ApiError(401, 'Missing refresh token');

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(refreshToken) },
    include: { user: { include: { memberProfile: true, membershipApplication: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.deletedAt) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
  if (session.user.status !== 'ACTIVE' && session.user.role !== 'APPLICANT') {
    throw new ApiError(403, 'Account is not active');
  }

  const nextRefresh = randomToken(48);
  const expiresAt = addDays(new Date(), env.REFRESH_TOKEN_TTL_DAYS);
  await prisma.session.update({
    where: { id: session.id },
    data: { tokenHash: sha256(nextRefresh), expiresAt },
  });

  res.cookie('refreshToken', nextRefresh, { ...refreshCookieOptions(), expires: expiresAt });
  return {
    user: publicUser(session.user),
    accessToken: signAccessToken({ sub: session.userId, sessionId: session.id, role: session.user.role }),
    expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
  };
}

export async function logout(req: Request, res: Response) {
  const refreshToken = req.cookies?.refreshToken as string | undefined;
  if (refreshToken) {
    await prisma.session.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.clearCookie('refreshToken', refreshCookieOptions());
  return { loggedOut: true };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { memberProfile: true, membershipApplication: true } });
  if (!user) throw new ApiError(401, 'Invalid or expired credentials');
  // Keyed under `user` so /auth/me matches /auth/login, which also returns the
  // session user at `data.user`. Returning it bare made the client read
  // `data.user` as undefined and treat a valid session as logged out.
  return { user: publicUser(user) };
}

export async function forgotPassword(email: string) {
  const user = await findLiveUser(normalizeEmail(email));
  if (user) {
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(randomToken(32)),
        expiresAt: addHours(new Date(), 1),
      },
    });
  }
  return { accepted: true };
}

export async function resetPassword(token: string, password: string) {
  const tokenHash = sha256(token);
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
    throw new ApiError(422, 'Password reset link is invalid or expired');
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.session.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  return { reset: true };
}
