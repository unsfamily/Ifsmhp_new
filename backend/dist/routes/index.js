"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_routes_1 = __importDefault(require("./health.routes"));
const admin_routes_1 = __importDefault(require("./admin.routes"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const member_routes_1 = __importDefault(require("./member.routes"));
const public_routes_1 = __importDefault(require("./public.routes"));
const contact_routes_1 = __importDefault(require("./contact.routes"));
const publications_routes_1 = __importDefault(require("./publications.routes"));
/**
 * API v1 router (spec §39).
 *
 * Authorization hierarchy (also enforced in each route file via middleware):
 *   /health            Public
 *   /public/*          Public (published data only)
 *   /contact           Public (rate-limited)
 *   /auth/*            Public (rate-limited)
 *   /members/*         MEMBER — requireAuth + requireRole(MEMBER) + object ownership
 *   /admin/*           ADMIN  — requireAuth + requireRole(ADMIN) on EVERY endpoint
 *
 * Per architecture §B.3 / §I: "Never rely only on frontend route protection."
 * Route-level middleware here AND service-layer ownership checks combine to
 * form the full authorization boundary.
 */
const router = (0, express_1.Router)();
router.use('/health', health_routes_1.default);
router.use('/public', public_routes_1.default);
router.use('/contact', contact_routes_1.default);
router.use('/publications', publications_routes_1.default);
router.use('/auth', auth_routes_1.default);
router.use('/members', member_routes_1.default);
router.use('/admin', admin_routes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map