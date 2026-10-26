import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config';
import {
  AWARD_NOMINATION_RATE_LIMIT,
  AWARD_NOMINATION_RATE_WINDOW_MS,
  awardNominationBody,
  awardNominationListQuery,
} from '../domain/award-nomination';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { listAwardNominations, submitAwardNomination } from '../services/award-nomination.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';

const limitedMessage = { success: false, message: 'Too many nomination attempts. Please try again later.', errors: [] };

export const awardNominationLimiter = rateLimit({
  windowMs: AWARD_NOMINATION_RATE_WINDOW_MS,
  limit: AWARD_NOMINATION_RATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: limitedMessage,
});

const publicRouter = Router();

publicRouter.post(
  '/:slug/nominations',
  awardNominationLimiter,
  validate({ params: z.object({ slug: z.string().trim().min(1).max(80) }).strict(), body: awardNominationBody }),
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const data = await submitAwardNomination(req.params.slug ?? '', req.body);
    sendSuccess(res, data, 'Your nomination has been received.');
  }),
);

const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));
adminRouter.get(
  '/',
  validate({ query: awardNominationListQuery }),
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, await listAwardNominations(req.query as unknown as z.infer<typeof awardNominationListQuery>), 'Award nominations');
  }),
);

export const awardNominationPublicRoutes = publicRouter;
export const awardNominationAdminRoutes = adminRouter;
