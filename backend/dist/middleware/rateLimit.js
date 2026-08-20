"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = require("../config");
/**
 * Rate limiters (spec §43). Tightened per-route limiters for authentication
 * and the contact form are added in Milestones 5 and 7; this is the global
 * baseline.
 *
 * Disabled under NODE_ENV=test so suites are not throttled.
 */
const skip = () => config_1.env.isTest;
exports.globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip,
    message: { success: false, message: 'Too many requests, please try again later', errors: [] },
});
//# sourceMappingURL=rateLimit.js.map