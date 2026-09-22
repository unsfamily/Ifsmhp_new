import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config';

/**
 * Rate limiters (spec §43). Tightened per-route limiters for authentication
 * and the contact form are added in Milestones 5 and 7; this is the global
 * baseline.
 *
 * Disabled under NODE_ENV=test so suites are not throttled.
 */
const skip = () => env.isTest;
const isGallery = (req: Request) => /^\/api\/v1\/(?:admin|public)\/gallery(?:\/|$)/.test(req.path);
const isCommunity = (req: Request) => /^\/api\/v1\/(?:admin\/)?community(?:\/|$)/.test(req.path);

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: req => skip() || isCommunity(req) || isGallery(req),
  message: { success: false, message: 'Too many requests, please try again later', errors: [] },
});

// Community panels revalidate access and paged data while open. Give these
// authenticated reads their own budget without relaxing unrelated endpoints.
export const communityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 2400, standardHeaders: 'draft-7', legacyHeaders: false,
  skip: req => skip() || !isCommunity(req),
  message: { success: false, message: 'Too many Community requests. Please try again later.', errors: [] },
});

// Each photo has its own revocable image request. Keep large gallery reads
// from exhausting the unrelated API budget while retaining a bounded limit.
export const galleryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 2400, standardHeaders: 'draft-7', legacyHeaders: false,
  skip: req => skip() || !isGallery(req),
  message: { success: false, message: 'Too many gallery requests. Please try again later.', errors: [] },
});
