import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { sendSuccess, sendFailure } from '../utils/apiResponse';
import { requireAuth } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router({ mergeParams: true });

/**
 * Auth routes — Public (rate-limited), except /me which requires auth.
 *
 * Per architecture §I, authentication tokens:
 *  - Are NEVER stored in localStorage. Cookies only (httpOnly, Secure in prod).
 *  - Access tokens: short-lived. Refresh tokens: rotated, stored server-side.
 *  - Refresh rotation with reuse-detection on compromise.
 *
 * Scaffolded: endpoints that respond with standard envelope (§40).
 * Milestone 5 replaces these with real User/Prisma-backed auth.
 */

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  remember: z.boolean().optional(),
}).strict();

const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email('Invalid email format'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  type: z.enum(['scientist', 'professional']),
  agreeTerms: z.literal(true, { invalid_type_error: 'You must agree to the terms' }),
}).strict();

router.post(
  '/login',
  rateLimit({ max: 20, windowMs: 15 * 60 * 1000 }),
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    // Milestone 5: verify credential, issue tokens, set cookies.
    if (email === 'fail@example.com') {
      throw new ApiError(401, 'Invalid email or password', [
        { field: 'email', message: 'Check your email and password.' },
        { field: 'password', message: 'Check your email and password.' },
      ]);
    }
    sendSuccess(
      res,
      {
        userId: 'test-user-001',
        role: 'ADMIN',
        memberId: 'IFSMHP-2024-000142',
        // NOTE: Access token in response body for convenience during Milestone 2.
        // Milestone 5 uses httpOnly cookies exclusively.
        accessToken: 'placeholder-milestone5',
      },
      'Logged in successfully'
    );
  })
);

router.post(
  '/register',
  rateLimit({ max: 10, windowMs: 30 * 60 * 1000 }),
  validate({ body: registerSchema }),
  asyncHandler(async (_req, res) => {
    // Milestone 6: transactional User + MembershipApplication create.
    sendSuccess(
      res,
      {
        userId: 'app-new',
        status: 'PENDING',
        nextStep: 'Complete membership application and upload credential documents.',
      },
      'Registration accepted — please complete your membership application'
    );
  })
);

router.post(
  '/logout',
  rateLimit({ max: 30, windowMs: 15 * 60 * 1000 }),
  asyncHandler(async (_req, res) => {
    // Milestone 5: invalidate refresh + clear cookie.
    sendSuccess(res, { loggedOut: true }, 'Logged out');
  })
);

router.post(
  '/refresh',
  rateLimit({ max: 30, windowMs: 15 * 60 * 1000 }),
  asyncHandler(async (req, res) => {
    const refresh = req.header('X-Refresh-Token') ?? req.cookies?.refreshToken;
    if (!refresh) {
      return sendFailure(res, 401, 'Missing refresh token', [
        { field: 'refresh', message: 'No active session.' },
      ]);
    }
    sendSuccess(res, { accessToken: 'placeholder-milestone5', expiresIn: 900 }, 'Token refreshed');
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
    sendSuccess(
      res,
      {
        id: req.user?.id,
        role: req.user?.role,
        status: req.user?.status,
        memberId: req.user?.memberId ?? null,
      },
      'Current session'
    );
  })
);

export default router;
