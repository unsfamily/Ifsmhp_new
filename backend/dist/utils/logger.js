"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const config_1 = require("../config");
const LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = config_1.env.isProduction ? 'info' : 'debug';
/**
 * Minimal structured logger. Deliberately dependency-free for now; swap for
 * pino at Milestone 16 if structured log shipping is required.
 *
 * Never log passwords, tokens or file contents (spec §38).
 */
function log(level, message, meta) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL])
        return;
    const entry = { timestamp: new Date().toISOString(), level, message, ...meta };
    const line = config_1.env.isProduction ? JSON.stringify(entry) : `[${level.toUpperCase()}] ${message}`;
    if (level === 'error')
        console.error(line, config_1.env.isProduction ? '' : (meta ?? ''));
    else if (level === 'warn')
        console.warn(line, config_1.env.isProduction ? '' : (meta ?? ''));
    else
        console.log(line, config_1.env.isProduction ? '' : (meta ?? ''));
}
exports.logger = {
    debug: (message, meta) => log('debug', message, meta),
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
};
//# sourceMappingURL=logger.js.map