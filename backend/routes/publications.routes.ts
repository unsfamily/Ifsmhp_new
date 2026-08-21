import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { requireAuth, ensureOwnershipOrAdmin } from '../middleware/auth';

const router = Router({ mergeParams: true });

/**
 * Publications — MIXED scope:
 *   GET  /                    → Public listing (PUBLISHED only).
 *   GET  /:id                 → Public detail if PUBLISHED; member/admin can view their own (via header/auth).
 *   POST /                    → Protected — members submit their own publications.
 *
 * Milestone 12 handles full workflow (DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → PUBLISHED).
 */

router.get('/', asyncHandler(async (_req, res) => {
  sendSuccess(res, { rows: [], total: 0 }, 'Public publications');
}));

router.get('/:id', asyncHandler(async (req, res) => {
  sendSuccess(res, { publication: { id: req.params.id } }, 'Publication');
}));

/**
 * Submit new publication (MEMBER only — submitter becomes owner).
 * Admin workflows live in /admin/publications, not here.
 */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    ensureOwnershipOrAdmin(req, req.user!.id, 'Publication owner bypass');
    sendSuccess(
      res,
      { id: 'pub-new', createdBy: req.user?.id, status: 'SUBMITTED' },
      'Publication submitted — now in CRO review queue.'
    );
  })
);

export default router;
