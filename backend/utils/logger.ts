import { env } from '../config';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: Level = env.isProduction ? 'info' : 'debug';

/**
 * Minimal structured logger. Deliberately dependency-free for now; swap for
 * pino at Milestone 16 if structured log shipping is required.
 *
 * Never log passwords, tokens or file contents (spec §38).
 */
function log(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const entry = { timestamp: new Date().toISOString(), level, message, ...meta };
  const line = env.isProduction ? JSON.stringify(entry) : `[${level.toUpperCase()}] ${message}`;
  if (level === 'error') console.error(line, env.isProduction ? '' : (meta ?? ''));
  else if (level === 'warn') console.warn(line, env.isProduction ? '' : (meta ?? ''));
  else console.log(line, env.isProduction ? '' : (meta ?? ''));
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
};
