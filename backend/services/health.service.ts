import { env } from '../config';

export interface HealthReport {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

/**
 * Health/readiness information. Deliberately exposes no build paths, no
 * dependency versions and no configuration values (spec §40).
 */
export function getHealthReport(): HealthReport {
  return {
    status: 'ok',
    service: 'ifsmhp-api',
    version: '0.1.0',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
