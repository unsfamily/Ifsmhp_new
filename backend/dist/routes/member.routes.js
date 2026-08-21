"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const apiResponse_1 = require("../utils/apiResponse");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)({ mergeParams: true });
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
router.use(auth_1.requireAuth, (0, auth_1.requireRole)('MEMBER'), (0, auth_1.requireMembershipStatus)('ACTIVE'));
/** Dashboard summary */
router.get('/me/dashboard', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    (0, apiResponse_1.sendSuccess)(res, {
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
    }, 'Member dashboard');
}));
/** Own projects (members always see ONLY their own list) */
router.get('/me/projects', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    // Service layer: filter WHERE ownerId = req.user.id
    (0, apiResponse_1.sendSuccess)(res, { rows: [], total: 0 }, 'My projects');
}));
router.get('/me/projects/:projectId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // 1. Load record by projectId (throw 404 if missing)
    // 2. ensureOwnershipOrAdmin(req, record.ownerId, 'Project')
    (0, apiResponse_1.sendSuccess)(res, { project: { id: req.params.projectId } }, 'Project detail');
}));
/** Own publications — members see their own draft/submitted work */
router.get('/me/publications', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { rows: [] }, 'My publications')));
/** Own messages / conversations */
router.get('/me/conversations', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { rows: [], total: 0, unread: 3 }, 'My conversations')));
router.post('/me/conversations/:id/messages', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { sent: true, actor: req.user?.id }, 'Message sent')));
/** Support Requests (Members own their tickets) */
router.get('/me/support', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { rows: [] }, 'My support requests')));
router.post('/me/support', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { id: 'sr-new', created: true, actor: req.user?.id }, 'Support request created')));
/** Document Exchange — members only access their own authorized documents */
router.get('/me/documents', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // §B.3 rule R3 — downloads authorize the PARENT not the file
    (0, apiResponse_1.sendSuccess)(res, { rows: [], actor: req.user?.id }, 'My documents');
}));
/** Own profile — member editable fields only (admin-only fields never exposed via serializers) */
router.get('/me/profile', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { profile: null, actor: req.user?.id }, 'My profile')));
router.patch('/me/profile', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { updated: true, actor: req.user?.id }, 'Profile updated')));
exports.default = router;
//# sourceMappingURL=member.routes.js.map