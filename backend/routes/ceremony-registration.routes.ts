import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config';
import {
  CEREMONY_REGISTRATION_RATE_LIMIT,
  CEREMONY_REGISTRATION_RATE_WINDOW_MS,
  ceremonyRegistrationBody,
  ceremonyRegistrationListQuery,
} from '../domain/ceremony-registration';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { listCeremonyRegistrations, registerCeremonyInterest } from '../services/ceremony-registration.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';

const limitedMessage = { success: false, message: 'Too many registration attempts. Please try again later.', errors: [] };

export const ceremonyRegistrationLimiter = rateLimit({
  windowMs: CEREMONY_REGISTRATION_RATE_WINDOW_MS,
  limit: CEREMONY_REGISTRATION_RATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: limitedMessage,
});

const publicRouter = Router();

publicRouter.post(
  '/:slug/registrations',
  ceremonyRegistrationLimiter,
  validate({ params: z.object({ slug: z.string().trim().min(1).max(80) }).strict(), body: ceremonyRegistrationBody }),
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const data = await registerCeremonyInterest(req.params.slug ?? '', req.body);
    sendSuccess(res, data, 'Your registration of interest has been received.');
  }),
);

const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));
adminRouter.get(
  '/',
  validate({ query: ceremonyRegistrationListQuery }),
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, await listCeremonyRegistrations(req.query as unknown as z.infer<typeof ceremonyRegistrationListQuery>), 'Ceremony registrations');
  }),
);

export const ceremonyPublicRoutes = publicRouter;
export const ceremonyAdminRoutes = adminRouter;
