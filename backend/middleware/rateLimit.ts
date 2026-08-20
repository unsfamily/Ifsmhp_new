import rateLimit from 'express-rate-limit';
import { env } from '../config';

/**
 * Rate limiters (spec §43). Tightened per-route limiters for authentication
 * and the contact form are added in Milestones 5 and 7; this is the global
 * baseline.
 *
 * Disabled under NODE_ENV=test so suites are not throttled.
 */
const skip = () => env.isTest;

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { success: false, message: 'Too many requests, please try again later', errors: [] },
});
