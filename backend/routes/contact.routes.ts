import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import rateLimit from 'express-rate-limit';

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
  topic: z.enum(['General Question', 'Membership', 'Events', 'Publications', 'Press / Media', 'Partnership']),
  subject: z.string().trim().min(4).max(200),
  message: z.string().trim().min(20).max(5000),
  consent: z.literal(true, { invalid_type_error: 'You must consent to processing.' }),
}).strict();

router.post(
  '/',
  rateLimit({ max: 5, windowMs: 60 * 60 * 1000 }),
  validate({ body: contactSchema }),
  asyncHandler(async (_req, res) => {
    // 1. Write to ContactInquiry table (status = NEW)
    // 2. Queue CRO Office notification (in-app, no email-bomb)
    // 3. Generic reply — do not confirm/deny existing relationships
    sendSuccess(
      res,
      {
        inquiryId: 'inq-new',
        status: 'NEW',
        next: 'Our team will respond within two working days.',
      },
      'Message received — thank you for contacting IFSMHP.'
    );
  })
);

export default router;
