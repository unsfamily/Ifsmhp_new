import { createApp } from './app';
import { env } from './config';
import { logger } from './utils/logger';
import { verifyTransport } from './services/mail.service';
import { startEventWorker } from './services/event-jobs.service';

const app = createApp();
const stopEventWorker = startEventWorker();

const server = app.listen(env.PORT, () => {
  logger.info(`IFSMHP API listening on port ${env.PORT}`, {
    environment: env.NODE_ENV,
    allowedOrigins: env.allowedOrigins,
  });
  // Report mail health at boot rather than leaving it to be discovered by a
  // user waiting for a code that cannot be sent. Never blocks startup.
  void verifyTransport();
});

/** Graceful shutdown so in-flight requests finish before the process exits. */
function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down`);
  server.close(async () => {
    await stopEventWorker();
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
