"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const app = (0, app_1.createApp)();
const server = app.listen(config_1.env.PORT, () => {
    logger_1.logger.info(`IFSMHP API listening on port ${config_1.env.PORT}`, {
        environment: config_1.env.NODE_ENV,
        allowedOrigins: config_1.env.allowedOrigins,
    });
});
/** Graceful shutdown so in-flight requests finish before the process exits. */
function shutdown(signal) {
    logger_1.logger.info(`Received ${signal}, shutting down`);
    server.close(() => {
        logger_1.logger.info('HTTP server closed');
        process.exit(0);
    });
    // Failsafe: do not hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
    logger_1.logger.error('Unhandled promise rejection', { reason: String(reason) });
});
//# sourceMappingURL=server.js.map