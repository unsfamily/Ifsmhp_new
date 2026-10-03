import { env } from '../config';
import { logger } from '../utils/logger';
import { runMembershipJobs } from './membership-policy.service';
export function startMembershipWorker() {
  let stopped = false, active: Promise<void> | undefined;
  const tick = () => { if (!stopped && !active) active = runMembershipJobs().catch(error => logger.error('Membership worker failed', { error: String(error) })).finally(() => { active = undefined; }); };
  if (!env.MEMBERSHIP_WORKER_ENABLED || env.isTest) return async () => undefined;
  tick(); const timer = setInterval(tick, 60000); timer.unref();
  return async () => { stopped = true; clearInterval(timer); await active; };
}
