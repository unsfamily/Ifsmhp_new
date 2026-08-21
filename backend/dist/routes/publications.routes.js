"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const apiResponse_1 = require("../utils/apiResponse");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)({ mergeParams: true });
/**
 * Publications — MIXED scope:
 *   GET  /                    → Public listing (PUBLISHED only).
 *   GET  /:id                 → Public detail if PUBLISHED; member/admin can view their own (via header/auth).
 *   POST /                    → Protected — members submit their own publications.
 *
 * Milestone 12 handles full workflow (DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → PUBLISHED).
 */
router.get('/', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    (0, apiResponse_1.sendSuccess)(res, { rows: [], total: 0 }, 'Public publications');
}));
router.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    (0, apiResponse_1.sendSuccess)(res, { publication: { id: req.params.id } }, 'Publication');
}));
/**
 * Submit new publication (MEMBER only — submitter becomes owner).
 * Admin workflows live in /admin/publications, not here.
 */
router.post('/', auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    (0, auth_1.ensureOwnershipOrAdmin)(req, req.user.id, 'Publication owner bypass');
    (0, apiResponse_1.sendSuccess)(res, { id: 'pub-new', createdBy: req.user?.id, status: 'SUBMITTED' }, 'Publication submitted — now in CRO review queue.');
}));
exports.default = router;
//# sourceMappingURL=publications.routes.js.map