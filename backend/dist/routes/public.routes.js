"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const apiResponse_1 = require("../utils/apiResponse");
const router = (0, express_1.Router)({ mergeParams: true });
/**
 * Public, unauthenticated content endpoints.
 *
 * Policy (§B.2 / §C): Public visitors see ONLY status=PUBLISHED records.
 *  - Admin-only fields like reviewNotes, internalNotes are ALWAYS stripped
 *    in the service serializer — never trusted to the UI to hide (R4).
 *  - Drafts / Under Review / Rejected are invisible to any unauthenticated call.
 */
router.get('/publications', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    // Service: filter WHERE status = PUBLISHED
    (0, apiResponse_1.sendSuccess)(res, {
        rows: [],
        total: 0,
        filters: { category: 'all', q: '' },
    }, 'Published research (public listing)');
}));
router.get('/publications/:slugOrId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // Service: WHERE (slug = :slugOrId OR id = :slugOrId) AND status = PUBLISHED
    (0, apiResponse_1.sendSuccess)(res, { publication: { id: req.params.slugOrId, status: 'PUBLISHED' } }, 'Published work detail');
}));
router.get('/events', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    // Only status=Published events and audience=Public (or Members+Public).
    (0, apiResponse_1.sendSuccess)(res, { rows: [], total: 0 }, 'Public events listing');
}));
router.get('/stats', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    // Aggregate-only. Never row-level PII.
    (0, apiResponse_1.sendSuccess)(res, {
        platform: {
            totalMembers: 277,
            countriesRepresented: 42,
            publicationsPublished: 223,
            publicLifetimeViews: 285142,
        },
        latest: [
            { title: 'CBT outcomes in digital mental health', publishedAt: '2026-07-15', slug: 'cbt-digital-mh-2026' },
        ],
    }, 'Public platform statistics');
}));
exports.default = router;
//# sourceMappingURL=public.routes.js.map