import { writeAudit } from './audit.service';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { sendEventEmail } from './mail.service';

const pending = ['QUEUED', 'PROCESSING', 'UNCONFIGURED', 'FAILED'];
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function reconcileEventJobs(tx: Prisma.TransactionClient, id: string, cancellationEmail = false, now = new Date()) {
  await tx.$queryRaw`SELECT id FROM Event WHERE id = ${id} FOR UPDATE`;
  const e = await tx.event.findUniqueOrThrow({ where: { id }, include: { registrations: { where: { status: 'Registered' } } } });
  const jobs: { kind: string; key: string; dueAt: Date; recipient?: string }[] = [];
  if (!e.deletedAt && e.status === 'DRAFT' && e.scheduledPublishAt) {
    jobs.push({ kind: 'PUBLISH', key: hash(`${id}:publish:${e.scheduledPublishAt.toISOString()}`), dueAt: e.scheduledPublishAt });
  }
  if (!e.deletedAt && ((e.status === 'PUBLISHED' && e.sendReminder && e.startsAt && e.startsAt > now) || cancellationEmail)) {
    const users = await tx.user.findMany({ where: { id: { in: e.registrations.flatMap(r => r.userId ? [r.userId] : []) } }, select: { id: true, email: true } });
    const recipients = new Set(e.registrations.map(r => (r.email || users.find(u => u.id === r.userId)?.email || '').trim().toLowerCase()).filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)));
    for (const recipient of recipients) {
      const kind = cancellationEmail ? 'CANCELLATION' : 'REMINDER';
      const dueAt = cancellationEmail ? now : DateTime.fromJSDate(e.startsAt!).setZone(e.timezone).minus(e.reminderDays === 0 ? { hours: 3 } : { days: e.reminderDays }).toJSDate();
      jobs.push({ kind, recipient, dueAt, key: hash(`${id}:${kind}:${recipient}:${cancellationEmail ? e.revision : `${e.startsAt!.toISOString()}:${e.reminderDays}`}`) });
    }
  }
  // Preserve cancellation notices during later edits to a cancelled event.
  await tx.eventJob.updateMany({ where: { eventId: id, status: { in: pending }, kind: { in: ['PUBLISH', 'REMINDER'] }, key: { notIn: jobs.map(j => j.key) } }, data: { status: 'CANCELLED', lockedAt: null, claimToken: null } });
  for (const job of jobs) {
    await tx.eventJob.upsert({ where: { key: job.key }, create: { eventId: id, ...job }, update: {} });
    await tx.eventJob.updateMany({ where: { key: job.key, status: 'CANCELLED' }, data: { status: 'QUEUED', dueAt: job.dueAt, attempts: 0, error: null } });
  }
}

export async function processEventJobs(now = new Date(), onlyEventId?: string) {
  const scope = onlyEventId ? { eventId: onlyEventId } : {};
  await prisma.eventJob.updateMany({ where: { ...scope, status: 'PROCESSING', lockedAt: { lt: new Date(now.getTime() - 300000) } }, data: { status: 'QUEUED', lockedAt: null, claimToken: null } });
  // Discover newly registered attendees without requiring registration callers to know the outbox.
  const active = await prisma.event.findMany({ where: { ...(onlyEventId ? { id: onlyEventId } : {}), deletedAt: null, OR: [{ status: 'PUBLISHED', sendReminder: true, startsAt: { gt: now } }, { status: 'DRAFT', scheduledPublishAt: { not: null } }] }, select: { id: true } });
  for (const event of active) await prisma.$transaction(tx => reconcileEventJobs(tx, event.id, false, now));
  const due = await prisma.eventJob.findMany({ where: { ...scope, status: { in: ['QUEUED', 'UNCONFIGURED'] }, dueAt: { lte: now } }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: 100 });
  for (const job of due) {
    const claimToken = randomUUID();
    const claim = await prisma.eventJob.updateMany({ where: { id: job.id, status: { in: ['QUEUED', 'UNCONFIGURED'] }, dueAt: { lte: now } }, data: { status: 'PROCESSING', claimToken, lockedAt: now } });
    if (!claim.count) continue;
    try {
      await prisma.$transaction(async tx => {
        // Serialize dispatch with event edits/cancellation; recheck the claim after acquiring the event lock.
        await tx.$queryRaw`SELECT id FROM Event WHERE id = ${job.eventId} FOR UPDATE`;
        const currentJob = await tx.eventJob.findFirst({ where: { id: job.id, claimToken, status: 'PROCESSING' } });
        if (!currentJob) return;
        const e = await tx.event.findUniqueOrThrow({ where: { id: job.eventId } });
        let status = 'SENT';
        let error: string | null = null;
        if (job.kind === 'PUBLISH') {
          if (e.deletedAt || e.status !== 'DRAFT' || !e.scheduledPublishAt || e.scheduledPublishAt > now) status = 'CANCELLED';
          else if (!e.endsAt || e.endsAt <= now) { status = 'FAILED'; error = 'Publication missed: the event has ended.'; await tx.event.update({ where: { id: e.id }, data: { scheduledPublishAt: null } }); }
          else {
            await tx.event.update({ where: { id: e.id }, data: { status: 'PUBLISHED', scheduledPublishAt: null, revision: { increment: 1 } } });
            await writeAudit({ action: 'EventScheduledPublished', source: 'Event worker', entity: `Event ${e.id}`, changes: { status: { before: 'DRAFT', after: 'PUBLISHED' } }, deduplicationKey: `event-publish:${job.id}` }, tx);
            // Mark this job first so reconciliation does not cancel its own claim.
            await tx.eventJob.update({ where: { id: job.id }, data: { status: 'SENT', sentAt: now } });
            await reconcileEventJobs(tx, e.id, false, now);
          }
        } else {
          const valid = !e.deletedAt && (job.kind === 'CANCELLATION' ? e.status === 'CANCELLED' : e.status === 'PUBLISHED' && e.sendReminder && e.startsAt && e.startsAt > now);
          if (!valid) status = 'CANCELLED';
          else {
            const delivered = await sendEventEmail(job.recipient!, e, job.kind === 'CANCELLATION');
            if (!delivered) { status = 'UNCONFIGURED'; error = 'SMTP is not configured. No email was sent.'; }
          }
        }
        if (['SENT', 'FAILED', 'CANCELLED'].includes(status)) await writeAudit({ action: 'EventDeliveryOutcome', source: 'Event worker', entity: `Event ${e.id}`, outcome: status === 'SENT' ? 'SUCCEEDED' : 'FAILED', metadata: { jobId: job.id, channel: job.kind, reasonCode: status }, deduplicationKey: `event-delivery:${job.id}:${status}` }, tx);
        await tx.eventJob.updateMany({ where: { id: job.id, claimToken }, data: { status, error, lockedAt: null, claimToken: null, sentAt: status === 'SENT' ? now : null, ...(status === 'UNCONFIGURED' ? { dueAt: new Date(now.getTime() + 60000) } : {}) } });
      }, { timeout: 30000 });
    } catch (err) {
      const attempts = job.attempts + 1;
      const delay = [1, 5, 15, 60][Math.min(attempts - 1, 3)]! * 60000;
      await prisma.$transaction(async tx => {
        const updated = await tx.eventJob.updateMany({ where: { id: job.id, claimToken }, data: { status: attempts >= 5 ? 'FAILED' : 'QUEUED', attempts, lockedAt: null, claimToken: null, dueAt: new Date(now.getTime() + delay), error: 'Delivery failed. Check the event worker and SMTP configuration.' } });
        if (updated.count && attempts >= 5) await writeAudit({ action: 'EventDeliveryOutcome', source: 'Event worker', entity: `Event ${job.eventId}`, outcome: 'FAILED', metadata: { jobId: job.id, channel: job.kind, reasonCode: 'FAILED' }, deduplicationKey: `event-delivery:${job.id}:FAILED` }, tx);
      });
      logger.error('Event job failed', { jobId: job.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
}

export function startEventWorker() {
  let running: Promise<void> | null = null;
  const tick = () => {
    if (!running) running = processEventJobs().catch(error => logger.error('Event worker failed', { error: String(error) })).finally(() => { running = null; });
  };
  tick();
  const timer = setInterval(tick, 60000);
  timer.unref();
  return async () => { clearInterval(timer); await running; };
}
