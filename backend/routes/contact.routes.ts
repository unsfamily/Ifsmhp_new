import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import rateLimit from 'express-rate-limit';
import * as service from '../services/platform.service';

const router = Router({ mergeParams: true });

/**
 * Public contact form — unauthenticated.
 * Rate-limited heavily. Submissions flow to the admin inquiries table.
 * §I enumeration defense: responses are generic (no "email already known" style leaks).
 */

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  organization: z.string().trim().max(200).optional(),
  country: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  topic: z.string().trim().min(2).max(80),
  subject: z.string().trim().min(4).max(200),
  message: z.string().trim().min(10).max(5000),
  consent: z.literal(true, { invalid_type_error: 'You must consent to processing.' }).optional(),
}).strict();

router.post(
  '/',
  rateLimit({ max: 5, windowMs: 60 * 60 * 1000 }),
  validate({ body: contactSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.createContactInquiry(req.body);
    sendSuccess(res, data, 'Message received — thank you for contacting IFSMHP.', 201);
  })
);

export default router;
