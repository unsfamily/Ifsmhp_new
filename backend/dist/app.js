"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("./config");
const middleware_1 = require("./middleware");
const routes_1 = __importDefault(require("./routes"));
/**
 * Builds the Express application.
 *
 * Exported separately from the HTTP listener so tests can mount the app with
 * supertest without binding a port.
 *
 * Middleware order matters:
 *   requestId → security headers → CORS → rate limit → body parsers → routes
 *   → 404 → error handler (must be last, and must have four parameters).
 */
function createApp() {
    const app = (0, express_1.default)();
    // Behind a reverse proxy in production; required for correct client IPs in
    // rate limiting. Trust exactly one hop rather than blanket-trusting headers.
    if (config_1.env.isProduction)
        app.set('trust proxy', 1);
    app.disable('x-powered-by');
    app.use(middleware_1.requestId);
    app.use((0, helmet_1.default)({
        // The API serves JSON and file streams only, never HTML, so a strict
        // CSP here costs nothing. The SPA's CSP is configured at the edge.
        contentSecurityPolicy: {
            directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
        },
        crossOriginResourcePolicy: { policy: 'same-site' },
        referrerPolicy: { policy: 'no-referrer' },
    }));
    app.use((0, cors_1.default)({
        origin: config_1.env.allowedOrigins,
        credentials: true, // required for the refresh-token cookie
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['X-Request-Id'],
    }));
    app.use(middleware_1.globalLimiter);
    // Request size limits (spec §43). File uploads use multipart handling with
    // their own, larger limit from Milestone 9 — this cap applies to JSON only.
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
    app.use((0, cookie_parser_1.default)());
    app.use('/api/v1', routes_1.default);
    app.use(middleware_1.notFound);
    app.use(middleware_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map