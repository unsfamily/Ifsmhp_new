"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../middleware/validate");
const asyncHandler_1 = require("../utils/asyncHandler");
const ApiError_1 = require("../utils/ApiError");
const apiResponse_1 = require("../utils/apiResponse");
const auth_1 = require("../middleware/auth");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const router = (0, express_1.Router)({ mergeParams: true });
/**
 * Auth routes — Public (rate-limited), except /me which requires auth.
 *
 * Per architecture §I, authentication tokens:
 *  - Are NEVER stored in localStorage. Cookies only (httpOnly, Secure in prod).
 *  - Access tokens: short-lived. Refresh tokens: rotated, stored server-side.
 *  - Refresh rotation with reuse-detection on compromise.
 *
 * Scaffolded: endpoints that respond with standard envelope (§40).
 * Milestone 5 replaces these with real User/Prisma-backed auth.
 */
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    remember: zod_1.z.boolean().optional(),
}).strict();
const registerSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2).max(120),
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(12, 'Password must be at least 12 characters'),
    type: zod_1.z.enum(['scientist', 'professional']),
    agreeTerms: zod_1.z.literal(true, { invalid_type_error: 'You must agree to the terms' }),
}).strict();
router.post('/login', (0, express_rate_limit_1.default)({ max: 20, windowMs: 15 * 60 * 1000 }), (0, validate_1.validate)({ body: loginSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email } = req.body;
    // Milestone 5: verify credential, issue tokens, set cookies.
    if (email === 'fail@example.com') {
        throw new ApiError_1.ApiError(401, 'Invalid email or password', [
            { field: 'email', message: 'Check your email and password.' },
            { field: 'password', message: 'Check your email and password.' },
        ]);
    }
    (0, apiResponse_1.sendSuccess)(res, {
        userId: 'test-user-001',
        role: 'ADMIN',
        memberId: 'IFSMHP-2024-000142',
        // NOTE: Access token in response body for convenience during Milestone 2.
        // Milestone 5 uses httpOnly cookies exclusively.
        accessToken: 'placeholder-milestone5',
    }, 'Logged in successfully');
}));
router.post('/register', (0, express_rate_limit_1.default)({ max: 10, windowMs: 30 * 60 * 1000 }), (0, validate_1.validate)({ body: registerSchema }), (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    // Milestone 6: transactional User + MembershipApplication create.
    (0, apiResponse_1.sendSuccess)(res, {
        userId: 'app-new',
        status: 'PENDING',
        nextStep: 'Complete membership application and upload credential documents.',
    }, 'Registration accepted — please complete your membership application');
}));
router.post('/logout', (0, express_rate_limit_1.default)({ max: 30, windowMs: 15 * 60 * 1000 }), (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    // Milestone 5: invalidate refresh + clear cookie.
    (0, apiResponse_1.sendSuccess)(res, { loggedOut: true }, 'Logged out');
}));
router.post('/refresh', (0, express_rate_limit_1.default)({ max: 30, windowMs: 15 * 60 * 1000 }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const refresh = req.header('X-Refresh-Token') ?? req.cookies?.refreshToken;
    if (!refresh) {
        return (0, apiResponse_1.sendFailure)(res, 401, 'Missing refresh token', [
            { field: 'refresh', message: 'No active session.' },
        ]);
    }
    (0, apiResponse_1.sendSuccess)(res, { accessToken: 'placeholder-milestone5', expiresIn: 900 }, 'Token refreshed');
}));
/**
 * GET /me — current session introspection. Requires valid access token.
 * Frontend uses this on hard refresh / route guard to restore role/status
 * instead of trusting localStorage.
 */
router.get('/me', auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    (0, apiResponse_1.sendSuccess)(res, {
        id: req.user?.id,
        role: req.user?.role,
        status: req.user?.status,
        memberId: req.user?.memberId ?? null,
    }, 'Current session');
}));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map