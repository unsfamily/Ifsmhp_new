import { securityAudit } from '../services/audit.service';
import { sendFailure } from '../utils/apiResponse';
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { requireAuth } from '../middleware/auth';
import rateLimit from 'express-rate-limit';
import * as authService from '../services/auth.service';

const router = Router({ mergeParams: true });

/**
 * Auth routes — Public (rate-limited), except /me which requires auth.
 *
 * Members and applicants authenticate with a one-time code emailed to them:
 * POST /otp/request then POST /otp/verify, for both registration and login.
 * POST /login remains for administrators, who keep password sign-in.
 *
 * Per architecture §I, authentication tokens:
 *  - Access tokens: short-lived. Refresh tokens: rotated, stored server-side.
 *  - Refresh rotation with reuse-detection on compromise.
 */

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  remember: z.boolean().optional(),
}).strict();

const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email('Invalid email format'),
  professionalType: z.string().min(2).max(120),
  institution: z.string().min(2).max(200),
  credentials: z.string().min(10).max(5000),
  education: z.string().min(10).max(5000),
  researchInterests: z.string().min(10).max(5000),
  country: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  documents: z.array(z.object({
    kind: z.enum(['CV', 'CREDENTIAL']),
    fileId: z.string().min(1),
    claimToken: z.string().min(20),
  }).strict()).min(2, 'Upload both required documents'),
  agreeTerms: z.literal(true, { invalid_type_error: 'You must agree to the terms' }),
}).strict();

/**
 * OTP request accepts either a login (email alone) or a registration draft.
 * The discriminated union means a REGISTER request is fully validated up front,
 * so an invalid application can never reach the point of sending an email.
 */
const otpRequestSchema = z.discriminatedUnion('purpose', [
  z.object({ purpose: z.literal('LOGIN'), email: z.string().email('Enter a valid email address') }).strict(),
  registerSchema.extend({ purpose: z.literal('REGISTER') }).strict(),
]);

/** Resend needs only the address — the draft is already on the live OTP row. */
const otpResendSchema = z.object({
  purpose: z.enum(['REGISTER', 'LOGIN']),
  email: z.string().email('Enter a valid email address'),
}).strict();

const otpVerifySchema = z.object({
  purpose: z.enum(['REGISTER', 'LOGIN']),
  email: z.string().email('Enter a valid email address'),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
}).strict();

// Coarse per-IP backstop. The tight controls are per email address, in
// otp.service.ts — a 60s resend cooldown, a cap on resends, and a cap on wrong
// attempts — and those a rotating IP cannot bypass.
//
// Kept deliberately looser than the per-email limits because an IP is a poor
// identifier: an institution behind NAT shares one egress address across every
// member, so a tight per-IP cap locks out real colleagues before it meaningfully
// slows an attacker, who can just rotate addresses.
const authLimiter = (options: { max: number; windowMs: number }) => rateLimit({ ...options, handler: async (req, res) => {
  await securityAudit({ action: 'AuthenticationThrottled', actorRole: 'UNAUTHENTICATED', entity: 'Authentication', outcome: 'DENIED', ipAddress: req.ip, userAgent: req.get('user-agent') });
  sendFailure(res, 429, 'Too many requests, please try again later.');
} });
const otpRequestLimiter = authLimiter({ max: 20, windowMs: 15 * 60 * 1000 });
const otpVerifyLimiter = authLimiter({ max: 30, windowMs: 15 * 60 * 1000 });

const forgotSchema = z.object({ email: z.string().email() }).strict();
const resetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
}).strict();

router.post(
  '/login',
  authLimiter({ max: 20, windowMs: 15 * 60 * 1000 }),
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const data = await authService.login(req.body, req, res);
    sendSuccess(res, data, 'Logged in successfully');
  })
);

/** First send. REGISTER carries the full application, validated before any email goes out. */
router.post(
  '/otp/request',
  otpRequestLimiter,
  validate({ body: otpRequestSchema }),
  asyncHandler(async (req, res) => {
    const data =
      req.body.purpose === 'REGISTER'
        ? await authService.requestRegistrationOtp(req.body, req)
        : await authService.requestLoginOtp(req.body.email, req);
    sendSuccess(res, data, 'Verification code sent');
  })
);

/**
 * Resend for an attempt already under way, addressed by email alone so it still
 * works after the page has been refreshed and the form is empty.
 */
router.post(
  '/otp/resend',
  otpRequestLimiter,
  validate({ body: otpResendSchema }),
  asyncHandler(async (req, res) => {
    const data = await authService.resendOtp(req.body.email, req.body.purpose, req);
    sendSuccess(res, data, 'Verification code sent');
  })
);

router.post(
  '/otp/verify',
  otpVerifyLimiter,
  validate({ body: otpVerifySchema }),
  asyncHandler(async (req, res) => {
    const { email, code, purpose } = req.body;
    if (purpose === 'REGISTER') {
      const data = await authService.verifyRegistrationOtp(email, code, req, res);
      sendSuccess(res, data, 'Application submitted successfully', 201);
      return;
    }
    const data = await authService.verifyLoginOtp(email, code, req, res);
    sendSuccess(res, data, 'Logged in successfully');
  })
);

router.post(
  '/logout',
  authLimiter({ max: 30, windowMs: 15 * 60 * 1000 }),
  asyncHandler(async (req, res) => {
    const data = await authService.logout(req, res);
    sendSuccess(res, data, 'Logged out');
  })
);

router.post(
  '/refresh',
  authLimiter({ max: 30, windowMs: 15 * 60 * 1000 }),
  asyncHandler(async (req, res) => {
    const data = await authService.refresh(req, res);
    sendSuccess(res, data, 'Token refreshed');
  })
);

router.post(
  '/forgot-password',
  authLimiter({ max: 5, windowMs: 60 * 60 * 1000 }),
  validate({ body: forgotSchema }),
  asyncHandler(async (req, res) => {
    const data = await authService.forgotPassword(req.body.email);
    sendSuccess(res, data, 'If the email exists, reset instructions will be sent.');
  })
);

router.post(
  '/reset-password',
  authLimiter({ max: 10, windowMs: 60 * 60 * 1000 }),
  validate({ body: resetSchema }),
  asyncHandler(async (req, res) => {
    const data = await authService.resetPassword(req.body.token, req.body.password);
    sendSuccess(res, data, 'Password reset successfully');
  })
);

/**
 * GET /me — current session introspection. Requires valid access token.
 * Frontend uses this on hard refresh / route guard to restore role/status
 * instead of trusting localStorage.
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = await authService.me(req.user!.id);
    sendSuccess(res, data, 'Current session');
  })
);

export default router;
