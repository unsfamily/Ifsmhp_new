import { randomUUID } from 'node:crypto';
import type { AnnouncementStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config';
import { logger } from '../utils/logger';
import { recipientWhere, channelsFor, hash, audit } from './announcements.service';
import { sendAnnouncementEmail } from './mail.service';
import { unsubscribeToken } from './announcement-preferences.service';

async function dispatch(id: string, now: Date) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Announcement WHERE id = ${id} FOR UPDATE`;
    const row = await tx.announcement.findUniqueOrThrow({ where: { id } });
    if (row.deletedAt) return;
    if (row.expiresAt && row.expiresAt <= now) {
      if (row.status === 'SCHEDULED') {
        await tx.announcement.update({ where: { id }, data: { status: 'SUPPRESSED', completedAt: now } });
        await audit(tx, null, id, 'AnnouncementExpired', 'Expired before dispatch; no recipients notified.');
      }
      return;
    }
    if (!row.managed || row.status !== 'SCHEDULED' || !row.scheduledAt || row.scheduledAt > now || row.dispatchStartedAt) return;
    const recipients = await tx.user.findMany({ where: recipientWhere(row.audience), select: { id: true, email: true } });
    const data = recipients.flatMap(user => channelsFor(row.channel, row.audience).map(channel => ({ key: hash(`${id}:${row.revision}:BROADCAST:${channel}:${user.id}`), announcementId: id, recipientUserId: user.id, recipientEmail: user.email, channel, purpose: 'BROADCAST', revision: row.revision, status: 'QUEUED', dueAt: now })));
    if (data.length) await tx.announcementDelivery.createMany({ data, skipDuplicates: true });
    await tx.announcement.update({ where: { id }, data: { dispatchStartedAt: now, status: data.length ? 'SENDING' : 'SUPPRESSED', completedAt: data.length ? null : now } });
    await audit(tx, null, id, 'AnnouncementDispatchStarted', `${recipients.length} recipients resolved at dispatch.`);
  }, { timeout: 30000 });
}

async function complete(id: string, now: Date) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Announcement WHERE id = ${id} FOR UPDATE`;
    const row = await tx.announcement.findUniqueOrThrow({ where: { id } });
    if (!row.managed || !row.dispatchStartedAt || row.deletedAt) return;
    const groups = await tx.announcementDelivery.groupBy({ by: ['status'], where: { announcementId: id, revision: row.revision, purpose: 'BROADCAST' }, _count: true });
    const count = (status: string) => groups.find(g => g.status === status)?._count ?? 0;
    const queued = count('QUEUED') + count('PROCESSING') + count('UNCONFIGURED');
    const status: AnnouncementStatus = queued ? 'SENDING' : count('FAILED') ? count('SENT') ? 'PARTIAL' : 'FAILED' : count('SENT') ? 'SENT' : 'SUPPRESSED';
    if (row.status === status) return;
    await tx.announcement.update({ where: { id }, data: { status, completedAt: queued ? null : now, sentAt: status === 'SENT' ? now : row.sentAt } });
    await audit(tx, null, id, 'AnnouncementDeliveryUpdated', `Broadcast outcome: ${status}.`, { status: { before: row.status, after: status } });
  });
}

export async function processAnnouncementJobs(now = new Date(), onlyId?: string) {
  const scope = onlyId ? { announcementId: onlyId } : {};
  await prisma.announcementDelivery.updateMany({ where: { ...scope, channel: { not: 'LEGACY' }, status: 'PROCESSING', lockedAt: { lt: new Date(now.getTime() - 300000) } }, data: { status: 'QUEUED', claimToken: null, lockedAt: null } });
  const due = await prisma.announcement.findMany({ where: { ...(onlyId ? { id: onlyId } : {}), managed: true, status: 'SCHEDULED', scheduledAt: { lte: now }, dispatchStartedAt: null }, select: { id: true }, orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }], take: 100 });
  for (const row of due) await dispatch(row.id, now);
  const jobs = await prisma.announcementDelivery.findMany({ where: { ...scope, channel: { not: 'LEGACY' }, status: { in: ['QUEUED', 'UNCONFIGURED'] }, dueAt: { lte: now } }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: 100 });
  for (const job of jobs) {
    const token = randomUUID();
    const claimed = await prisma.announcementDelivery.updateMany({ where: { id: job.id, status: { in: ['QUEUED', 'UNCONFIGURED'] }, dueAt: { lte: now } }, data: { status: 'PROCESSING', claimToken: token, lockedAt: now } });
    if (!claimed.count) continue;
    try {
      await prisma.$transaction(async tx => {
        // Serialize a preview send with draft edits and verify the claim after the lock.
        await tx.$queryRaw`SELECT id FROM Announcement WHERE id = ${job.announcementId} FOR UPDATE`;
        const current = await tx.announcementDelivery.findFirst({ where: { id: job.id, claimToken: token, status: 'PROCESSING' } });
        if (!current) return;
        const row = await tx.announcement.findUniqueOrThrow({ where: { id: job.announcementId } });
        let status = 'SENT', error: string | null = null;
        const preview = job.purpose === 'PREVIEW';
        const user = job.recipientUserId ? await tx.user.findFirst({ where: { id: job.recipientUserId, ...recipientWhere(row.audience) }, include: { announcementPreference: true } }) : null;
        if (row.deletedAt || (row.expiresAt && row.expiresAt <= new Date(Math.max(now.getTime(), Date.now()))) || row.revision !== job.revision || (preview ? row.previewRevision !== job.revision || !env.SAB_PREVIEW_EMAILS.includes(job.recipientEmail ?? '') : !row.dispatchStartedAt)) status = 'CANCELLED';
        else if (!preview && (!user || (job.channel === 'EMAIL' && user.announcementPreference?.emailEnabled === false))) status = 'SUPPRESSED';
        else if (job.channel === 'IN_APP' && user) {
          await tx.notification.upsert({ where: { userId_announcementId: { userId: user.id, announcementId: row.id } }, create: { userId: user.id, announcementId: row.id, title: row.subject, body: row.body, type: 'announcement', announcementDeliveryId: job.id, link: `/dashboard/notifications?announcement=${row.id}` }, update: {} });
        } else {
          const web = (env.ANNOUNCEMENT_WEB_URL ?? env.allowedOrigins[0]!).replace(/\/$/, '');
          const unsubscribeUrl = !preview && user && row.appendUnsubscribe ? `${web}/announcements/unsubscribe#token=${unsubscribeToken(user.id)}` : undefined;
          const sent = await sendAnnouncementEmail({ to: user?.email ?? job.recipientEmail!, subject: row.subject, body: row.body, senderAsCRO: row.senderAsCRO, preview, unsubscribeUrl, messageId: `<announcement-${job.key}@ifsmhp.local>` });
          if (!sent) { status = 'UNCONFIGURED'; error = 'SMTP is not configured. No email was sent.'; }
        }
        await tx.announcementDelivery.updateMany({ where: { id: job.id, claimToken: token }, data: { status, error, ...(status === 'SENT' ? { attempts: { increment: 1 }, recipientEmail: user?.email ?? job.recipientEmail } : {}), deliveredAt: status === 'SENT' ? now : null, lockedAt: null, claimToken: null, ...(status === 'UNCONFIGURED' ? { dueAt: new Date(now.getTime() + 60000) } : {}) } });
      }, { timeout: 30000 });
    } catch (error) {
      const attempts = job.attempts + 1;
      await prisma.announcementDelivery.updateMany({ where: { id: job.id, claimToken: token }, data: { status: attempts >= 5 ? 'FAILED' : 'QUEUED', attempts, dueAt: new Date(now.getTime() + [1, 5, 15, 60][Math.min(attempts - 1, 3)]! * 60000), lockedAt: null, claimToken: null, error: 'Email delivery failed. Check SMTP configuration and retry.' } });
      logger.error('Announcement delivery failed', { deliveryId: job.id, error: String(error) });
    }
  }
  const active = await prisma.announcement.findMany({ where: { ...(onlyId ? { id: onlyId } : {}), managed: true, status: 'SENDING', dispatchStartedAt: { not: null } }, select: { id: true } });
  for (const row of active) await complete(row.id, now);
}

export function startAnnouncementWorker() {
  if (!env.ANNOUNCEMENT_WORKER_ENABLED) return async () => undefined;
  let running: Promise<void> | null = null;
  const tick = () => { if (!running) running = processAnnouncementJobs().catch(error => logger.error('Announcement worker failed', { error: String(error) })).finally(() => { running = null; }); };
  tick(); const timer = setInterval(tick, 60000); timer.unref();
  return async () => { clearInterval(timer); await running; };
}
