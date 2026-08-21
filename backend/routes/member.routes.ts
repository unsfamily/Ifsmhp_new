import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import {
  requireAuth,
  requireRole,
  requireMembershipStatus,
} from '../middleware/auth';

const router = Router({ mergeParams: true });

/**
 * Member-scoped routes — dashboard, own projects, publications, messages, etc.
 *
 * Authorization model (architecture §B):
 *  - Every endpoint: requireAuth + requireRole(MEMBER) (ADMIN allowed via bypass)
 *  - Object scoped endpoints (/:id): service-layer uses `ensureOwnershipOrAdmin`.
 *  - "Not found" and "not yours" both return 404 (R5).
 *
 * This file is the structural scaffold; Milestone 8-11 implement real logic.
 */

router.use(requireAuth, requireRole('MEMBER'), requireMembershipStatus('ACTIVE'));

/** Dashboard summary */
router.get(
  '/me/dashboard',
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      {
        member: {
          id: req.user?.id,
          memberId: req.user?.memberId,
          role: req.user?.role,
        },
        stats: {
          projects: { total: 3, approved: 1, inReview: 1, draft: 1 },
          publications: { total: 5, published: 4, inReview: 1 },
          supportTickets: { open: 2, resolved: 4 },
          unreadMessages: 3,
        },
        queue: {
          projectIds: ['pa-own-1'],
          supportIds: ['sr-own-1', 'sr-own-2'],
        },
      },
      'Member dashboard'
    );
  })
);

/** Own projects (members always see ONLY their own list) */
router.get(
  '/me/projects',
  asyncHandler(async (_req, res) => {
    // Service layer: filter WHERE ownerId = req.user.id
    sendSuccess(res, { rows: [], total: 0 }, 'My projects');
  })
);

router.get(
  '/me/projects/:projectId',
  asyncHandler(async (req, res) => {
    // 1. Load record by projectId (throw 404 if missing)
    // 2. ensureOwnershipOrAdmin(req, record.ownerId, 'Project')
    sendSuccess(res, { project: { id: req.params.projectId } }, 'Project detail');
  })
);

/** Own publications — members see their own draft/submitted work */
router.get('/me/publications', asyncHandler(async (_req, res) => sendSuccess(res, { rows: [] }, 'My publications')));

/** Own messages / conversations */
router.get(
  '/me/conversations',
  asyncHandler(async (_req, res) => sendSuccess(res, { rows: [], total: 0, unread: 3 }, 'My conversations'))
);
router.post(
  '/me/conversations/:id/messages',
  asyncHandler(async (req, res) => sendSuccess(res, { sent: true, actor: req.user?.id }, 'Message sent'))
);

/** Support Requests (Members own their tickets) */
router.get(
  '/me/support',
  asyncHandler(async (_req, res) => sendSuccess(res, { rows: [] }, 'My support requests'))
);
router.post(
  '/me/support',
  asyncHandler(async (req, res) => sendSuccess(res, { id: 'sr-new', created: true, actor: req.user?.id }, 'Support request created'))
);

/** Document Exchange — members only access their own authorized documents */
router.get(
  '/me/documents',
  asyncHandler(async (req, res) => {
    // §B.3 rule R3 — downloads authorize the PARENT not the file
    sendSuccess(res, { rows: [], actor: req.user?.id }, 'My documents');
  })
);

/** Own profile — member editable fields only (admin-only fields never exposed via serializers) */
router.get('/me/profile', asyncHandler(async (req, res) => sendSuccess(res, { profile: null, actor: req.user?.id }, 'My profile')));
router.patch('/me/profile', asyncHandler(async (req, res) => sendSuccess(res, { updated: true, actor: req.user?.id }, 'Profile updated')));

export default router;
