import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import {
  requireAuth,
  requireRole,
  requireMembershipStatus,
} from '../middleware/auth';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import * as service from '../services/platform.service';

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

const projectSchema = z.object({
  title: z.string().min(4).max(220),
  category: z.string().min(2).max(120),
  description: z.string().min(20).max(15000),
  timeline: z.string().max(200).optional(),
  budget: z.string().max(120).optional(),
  supportTypes: z.array(z.string()).default([]),
  submit: z.boolean().default(true),
}).strict();

const supportSchema = z.object({
  projectId: z.string().optional(),
  subject: z.string().min(4).max(220),
  description: z.string().min(10).max(10000),
  priority: z.string().max(40).optional(),
  types: z.array(z.string()).min(1),
  requiredBy: z.string().optional(),
}).strict();

const messageSchema = z.object({
  body: z.string().min(1).max(10000),
}).strict();

/** Dashboard summary */
router.get(
  '/me/dashboard',
  asyncHandler(async (req, res) => {
    const data = await service.memberDashboard(req.user!.id);
    sendSuccess(res, data, 'Member dashboard');
  })
);

/** Own projects (members always see ONLY their own list) */
router.get(
  '/me/projects',
  asyncHandler(async (req, res) => {
    const data = await service.memberProjects(req.user!.id, req);
    sendSuccess(res, data, 'My projects');
  })
);

router.post(
  '/me/projects',
  validate({ body: projectSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.createProject(req.user!.id, req.body);
    sendSuccess(res, data, 'Project saved', 201);
  })
);

router.get(
  '/me/projects/:projectId',
  asyncHandler(async (req, res) => {
    const data = await service.memberProjectDetail(req.user!.id, req.params.projectId!);
    sendSuccess(res, { project: data }, 'Project detail');
  })
);

/** Own publications — members see their own draft/submitted work */
router.get('/me/publications', asyncHandler(async (req, res) => sendSuccess(res, await service.memberPublications(req.user!.id, req), 'My publications')));

/** Own messages / conversations */
router.get(
  '/me/conversations',
  asyncHandler(async (req, res) => sendSuccess(res, await service.memberConversations(req.user!.id, req), 'My conversations'))
);
router.post(
  '/me/conversations/:id/messages',
  validate({ body: messageSchema }),
  asyncHandler(async (req, res) => sendSuccess(res, await service.postMemberMessage(req.user!.id, req.params.id!, req.body.body), 'Message sent'))
);

/** Support Requests (Members own their tickets) */
router.get(
  '/me/support',
  asyncHandler(async (req, res) => sendSuccess(res, await service.memberSupport(req.user!.id, req), 'My support requests'))
);
router.post(
  '/me/support',
  validate({ body: supportSchema }),
  asyncHandler(async (req, res) => sendSuccess(res, await service.createSupport(req.user!.id, req.body), 'Support request created', 201))
);

/** Document Exchange — members only access their own authorized documents */
router.get(
  '/me/documents',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.memberDocuments(req.user!.id, req), 'My documents');
  })
);

/** Own profile — member editable fields only (admin-only fields never exposed via serializers) */
router.get('/me/profile', asyncHandler(async (req, res) => sendSuccess(res, await service.memberProfile(req.user!.id), 'My profile')));
router.patch('/me/profile', asyncHandler(async (req, res) => sendSuccess(res, { updated: true, actor: req.user?.id }, 'Profile updated')));

router.get('/me/community', asyncHandler(async (req, res) => sendSuccess(res, await service.memberCommunity(req), 'Member community')));

export default router;
