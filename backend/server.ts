import { createApp } from './app';
import { env } from './config';
import { logger } from './utils/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`IFSMHP API listening on port ${env.PORT}`, {
    environment: env.NODE_ENV,
    allowedOrigins: env.allowedOrigins,
  });
});

/** Graceful shutdown so in-flight requests finish before the process exits. */
function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Failsafe: do not hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
