"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const apiResponse_1 = require("../utils/apiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
const ApiError_1 = require("../utils/ApiError");
const router = (0, express_1.Router)({ mergeParams: true });
/**
 * Admin routes — Chief Research Officer / Administrator only.
 *
 * ALL routes:
 *  1. requireAuth         (bearer token or test header in dev)
 *  2. requireRole(ADMIN)  (rejects MEMBER/APPLICANT with 403)
 *
 * This is the structural scaffold. Milestone 3 replaces mock responses below with
 * service/Prisma-backed implementations.
 *
 * Security / authorization rules applied:
 *  - Frontend route protection alone is NEVER sufficient (§E.1) — this is the real gate.
 *  - Object-level ownership / scope checks live in the service layer, not here.
 *  - All state transitions create AuditLog entries (service layer, §I.17).
 *  - "Not found" and "not yours" both return 404 to avoid enumeration leaks (§B.3 R5).
 */
router.use(auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'));
/**
 * 1. Dashboard / Platform Statistics
 *    GET /api/v1/admin/stats
 */
router.get('/stats', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    (0, apiResponse_1.sendSuccess)(res, {
        totalMembers: 277,
        newMembersThisWeek: 14,
        activeProjects: 142,
        publicationsQueue: 12,
        openSupportTickets: 23,
        messagesAwaitingReply: 5,
        upcomingEvents: 4,
        newInquiries: 5,
        slaBreachCount: { membership: 1, projects: 2, support: 3, publications: 4 },
        reviewBacklog: {
            membershipPending: 8,
            projectsInReview: 14,
            publicationsInReview: 12,
            supportOpen: 23,
        },
        rollingThirtyDay: {
            approvals: { members: 14, projects: 18, publications: 27, support: 43 },
            publicViews: 21847,
            supportResponseHours: 2.4,
            membershipApprovalDays: 3.1,
        },
    }, 'CRO dashboard statistics loaded');
}));
/**
 * 2. Membership Applications & Members Management
 */
router.get('/members', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const status = req.query.status ?? 'all';
    const q = req.query.q?.toLowerCase();
    let rows = [
        { id: 'mr1', name: 'Dr. Anika Kapoor', institution: 'AIIMS Delhi', country: 'India', type: 'Professional', status: 'PENDING', appliedAt: '2026-08-17', credentials: 4, memberId: null },
        { id: 'mr2', name: 'Prof. Henrik Lindberg', institution: 'Karolinska', country: 'Sweden', type: 'Scientist', status: 'PENDING', appliedAt: '2026-08-18', credentials: 6, memberId: null },
        { id: 'mr3', name: 'Dr. Maya Fernández', institution: 'UCH', country: 'Chile', type: 'Professional', status: 'UNDER_REVIEW', appliedAt: '2026-08-19', credentials: 5, memberId: null },
        { id: 'm1', name: 'Dr. Sarah Chen', institution: 'Stanford', country: 'USA', type: 'Scientist', status: 'ACTIVE', appliedAt: '2024-03-12', credentials: 5, memberId: 'IFSMHP-2024-000142' },
        { id: 'm2', name: 'Prof. Rajiv Mehta', institution: 'NIMHANS', country: 'India', type: 'Professional', status: 'ACTIVE', appliedAt: '2024-01-05', credentials: 6, memberId: 'IFSMHP-2024-000078' },
    ];
    if (status !== 'all')
        rows = rows.filter((m) => m.status === status);
    if (q)
        rows = rows.filter((m) => m.name.toLowerCase().includes(q) || m.institution.toLowerCase().includes(q));
    (0, apiResponse_1.sendSuccess)(res, { rows, total: rows.length, filters: { status, q } }, 'Member list');
}));
router.get('/members/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (req.params.id === 'missing') {
        throw new ApiError_1.ApiError(404, 'Member application not found');
    }
    (0, apiResponse_1.sendSuccess)(res, {
        application: {
            id: req.params.id,
            name: 'Dr. Anika Kapoor',
            role: 'Clinical Psychologist',
            email: 'anika.kapoor@example.com',
            institution: 'AIIMS Delhi',
            country: 'India',
            type: 'Professional',
            status: 'PENDING',
            appliedAt: '2026-08-17',
            biography: '15 years of clinical practice…',
            education: [{ degree: 'MD (Psychiatry)', institution: 'AIIMS Delhi', year: '2014' }],
            researchInterests: ['Adolescent Mental Health', 'CBT'],
            memberIdProjection: 'IFSMHP-2026-000278',
        },
        credentials: [
            { id: 'c1', name: 'MBBS.pdf', kind: 'DEGREE', size: 2516582, url: null },
            { id: 'c2', name: 'MD.pdf', kind: 'POSTGRAD', size: 1887436, url: null },
        ],
    }, 'Member application details');
}));
/**
 * Membership state transitions — explicit action endpoints (not PATCH status)
 * so illegal transitions are unrepresentable at the routing layer (§H Workflows).
 */
router.post('/members/:id/approve', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const reviewNotes = req.body?.reviewNotes;
    const adminUserId = req.user?.id ?? 'unknown-admin';
    // In Milestone 3, this is a TRANSACTION:
    //   1. SELECT ... FOR UPDATE on the per-year sequence counter
    //   2. Issue Member ID (IFSMHP-YYYY-NNNNNN)
    //   3. UPDATE User (role=MEMBER status=ACTIVE memberId=… applicationId=…)
    //   4. INSERT MembershipApproval
    //   5. INSERT AuditLog (actor=adminUserId, action=MembershipApproved, entity=…, changes=…)
    //   6. Queue welcome email notification
    (0, apiResponse_1.sendSuccess)(res, {
        issued: true,
        memberId: 'IFSMHP-2026-000278',
        notificationQueued: true,
        auditEntry: { actor: adminUserId, reviewNotes },
    }, 'Membership approved and permanent ID issued');
}));
router.post('/members/:id/reject', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const reason = req.body?.reason;
    if (!reason || reason.trim().length < 10) {
        throw new ApiError_1.ApiError(422, 'Rejection reason is required', [
            { field: 'reason', message: 'Provide a specific reason (at least 10 characters) visible to the applicant.' },
        ]);
    }
    (0, apiResponse_1.sendSuccess)(res, { status: 'REJECTED', reason }, 'Application rejected');
}));
/**
 * Stream credential document — authorizes the parent record, not the file row.
 * Per §B.3 rule R3: "download endpoint authorizes the PARENT record, not the file row".
 * Implementation in Milestone 3.
 */
router.get('/members/:applicationId/credentials/:documentId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // TODO: service.authorizeAndStreamCredential(req.user.id, req.params.applicationId, req.params.documentId)
    //  — reject 404 if applicationId/credentialId pair doesn't match (no existence leak)
    //  — write AuditLog (I.17) because admin access to credentials is always logged
    (0, apiResponse_1.sendSuccess)(res, { willStream: true, credential: req.params.documentId }, 'Credential stream endpoint (placeholder)');
}));
/**
 * 3. Projects Review Workflow
 */
router.get('/projects', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { rows: [] }, 'Projects list (scaffold)')));
router.get('/projects/:id', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { project: null }, 'Project detail (scaffold)')));
router.post('/projects/:id/approve', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { ok: true, actor: req.user?.id }, 'Project approved')));
router.post('/projects/:id/reject', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { ok: true, actor: req.user?.id, reason: req.body?.reason ?? '' }, 'Project rejected — returned to DRAFT for edits')));
/**
 * 4. Publications Review + Approve → Publish two-step (§C.5)
 */
router.get('/publications', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { rows: [] }, 'Publications list')));
router.get('/publications/:id', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { publication: null }, 'Publication detail')));
router.post('/publications/:id/approve', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { ok: true, actor: req.user?.id, to: 'APPROVED' }, 'Publication approved — internal only, not yet public')));
router.post('/publications/:id/reject', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { ok: true, actor: req.user?.id, to: 'REJECTED' }, 'Publication rejected')));
router.post('/publications/:id/publish', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { ok: true, actor: req.user?.id, to: 'PUBLISHED', slugGenerated: true }, 'Publication published — NOW PUBLIC')));
router.post('/publications/:id/unpublish', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { ok: true, actor: req.user?.id, to: 'APPROVED' }, 'Publication removed from public listing (manuscript retained)')));
/**
 * 5. Support Request Review Workflow
 */
router.get('/support', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { rows: [] }, 'Support tickets')));
router.get('/support/:id', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { ticket: null }, 'Support detail')));
router.post('/support/:id/approve', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { ok: true, actor: req.user?.id }, 'Support approved')));
router.post('/support/:id/reject', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { ok: true, actor: req.user?.id, reason: req.body?.reason }, 'Support declined')));
router.post('/support/:id/complete', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { ok: true, actor: req.user?.id }, 'Support resolved / completed')));
/**
 * 6. Member Messages / Conversations
 *    Admins view all conversations, post official CRO replies, escalate to SAB.
 */
router.get('/conversations', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { rows: [] }, 'Conversations list')));
router.get('/conversations/:id', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { conversation: null }, 'Conversation detail')));
router.post('/conversations/:id/messages', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { ok: true, sent: true, actor: req.user?.id, as: 'CRO Office' }, 'CRO reply posted')));
router.post('/conversations/:id/close', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { ok: true, actor: req.user?.id }, 'Conversation closed')));
/**
 * 7. Events CRUD
 */
router.get('/events', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { rows: [] }, 'Events list')));
router.post('/events', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { eventId: 'ev-new', created: true, actor: req.user?.id }, 'Event created')));
router.get('/events/:id', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { event: null }, 'Event detail')));
router.patch('/events/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { updated: true, actor: req.user?.id }, 'Event updated')));
router.delete('/events/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { deleted: true, actor: req.user?.id }, 'Event removed')));
/**
 * 8. Public Contact Inquiries
 */
router.get('/inquiries', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { rows: [] }, 'Inquiries list')));
router.post('/inquiries/:id/reply', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { ok: true, actor: req.user?.id }, 'Inquiry reply sent')));
router.post('/inquiries/:id/close', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { closed: true, actor: req.user?.id }, 'Inquiry closed')));
router.post('/inquiries/:id/spam', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { marked: 'SPAM', actor: req.user?.id }, 'Marked as spam / not actioned')));
/**
 * 9. Platform-wide Announcements
 */
router.get('/announcements', (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, apiResponse_1.sendSuccess)(res, { rows: [] }, 'Announcements list')));
router.post('/announcements', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { id: 'ann-new', scheduled: true, actor: req.user?.id }, 'Announcement scheduled')));
router.post('/announcements/:id/send', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { sent: true, actor: req.user?.id }, 'Announcement dispatched')));
router.post('/announcements/:id/cancel', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { cancelled: true, actor: req.user?.id }, 'Announcement cancelled')));
/**
 * 10. Audit Logs — always ADMIN-only, immutable append-only.
 *     §I.17: EVERY admin state transition is a row here.
 */
router.get('/audit-log', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 50)));
    const offset = Math.max(0, Number(req.query.offset ?? 0));
    (0, apiResponse_1.sendSuccess)(res, {
        rows: [],
        pagination: { limit, offset, total: 2138 },
        filters: {
            actor: req.query.actor ?? 'all',
            action: req.query.action ?? 'all',
            severity: req.query.severity ?? 'all',
        },
    }, 'Audit log page');
}));
/**
 * 11. Reports & Analytics
 */
router.get('/reports/:reportKey/run', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const validReports = new Set(['membership-monthly', 'review-sla', 'funding', 'support', 'engagement', 'content', 'events', 'messages']);
    if (!req.params.reportKey || !validReports.has(req.params.reportKey)) {
        throw new ApiError_1.ApiError(404, 'Unknown report key');
    }
    (0, apiResponse_1.sendSuccess)(res, { reportKey: req.params.reportKey, generated: true, rows: [] }, 'Report generated (scaffold)');
}));
router.get('/reports/:reportKey/download', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const format = req.query.format ?? 'xlsx';
    (0, apiResponse_1.sendSuccess)(res, { reportKey: req.params.reportKey, format, downloadTokenIssued: true }, `Report download link issued (${format})`);
}));
/**
 * 12. Credentials & IDs — Administrative Issue / Revoke
 */
router.post('/awards/issue-member-id', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, apiResponse_1.sendSuccess)(res, { memberId: 'IFSMHP-2026-000279', actor: req.user?.id }, 'Member ID issued (admin override)')));
exports.default = router;
//# sourceMappingURL=admin.routes.js.map