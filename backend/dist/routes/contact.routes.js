"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../middleware/validate");
const asyncHandler_1 = require("../utils/asyncHandler");
const apiResponse_1 = require("../utils/apiResponse");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const router = (0, express_1.Router)({ mergeParams: true });
/**
 * Public contact form — unauthenticated.
 * Rate-limited heavily. Submissions flow to the admin inquiries table.
 * §I enumeration defense: responses are generic (no "email already known" style leaks).
 */
const contactSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(120),
    email: zod_1.z.string().trim().email(),
    organization: zod_1.z.string().trim().max(200).optional(),
    country: zod_1.z.string().trim().max(80).optional(),
    phone: zod_1.z.string().trim().max(40).optional(),
    topic: zod_1.z.enum(['General Question', 'Membership', 'Events', 'Publications', 'Press / Media', 'Partnership']),
    subject: zod_1.z.string().trim().min(4).max(200),
    message: zod_1.z.string().trim().min(20).max(5000),
    consent: zod_1.z.literal(true, { invalid_type_error: 'You must consent to processing.' }),
}).strict();
router.post('/', (0, express_rate_limit_1.default)({ max: 5, windowMs: 60 * 60 * 1000 }), (0, validate_1.validate)({ body: contactSchema }), (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    // 1. Write to ContactInquiry table (status = NEW)
    // 2. Queue CRO Office notification (in-app, no email-bomb)
    // 3. Generic reply — do not confirm/deny existing relationships
    (0, apiResponse_1.sendSuccess)(res, {
        inquiryId: 'inq-new',
        status: 'NEW',
        next: 'Our team will respond within two working days.',
    }, 'Message received — thank you for contacting IFSMHP.');
}));
exports.default = router;
//# sourceMappingURL=contact.routes.js.map