"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealthReport = getHealthReport;
const config_1 = require("../config");
/**
 * Health/readiness information. Deliberately exposes no build paths, no
 * dependency versions and no configuration values (spec §40).
 */
function getHealthReport() {
    return {
        status: 'ok',
        service: 'ifsmhp-api',
        version: '0.1.0',
        environment: config_1.env.NODE_ENV,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=health.service.js.map