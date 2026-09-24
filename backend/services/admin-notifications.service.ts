import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, AdminProfile } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config';
import { logger } from '../utils/logger';
import { writeAudit } from './audit.service';
import { sendAdminNotificationEmail } from './mail.service';
import { purgeAvatars } from './admin-avatar.service';

type Notice = { key: string; category: 'APPLICATION' | 'INQUIRY' | 'SUPPORT'; entityId: string; title: string; link: string; priority?: string; assignedAdminId?: string | null; actorId?: string; allAdmins?: boolean };
export function wantsAdminEmail(profile: Pick<AdminProfile, 'appNewMember' | 'inquiryNew' | 'supportAll' | 'supportUrgent'> | null, category: string, priority?: string | null) {
  if (category === 'APPLICATION') return profile?.appNewMember ?? true;
  if (category === 'INQUIRY') return profile?.inquiryNew ?? false;
  return (profile?.supportAll ?? false) || ((profile?.supportUrgent ?? true) && ['High', 'Urgent'].includes(priority ?? ''));
}
/** Called in the originating business transaction. No email or request content is stored here. */
export async function notifyAdmins(tx: Prisma.TransactionClient, notice: Notice) {
  const admins = await tx.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null, ...(notice.actorId ? { NOT: { id: notice.actorId } } : {}), ...(!notice.allAdmins && notice.assignedAdminId ? { id: notice.assignedAdminId } : {}) }, include: { adminProfile: true } });
  for (const admin of admins) {
    const key = createHash('sha256').update(`${notice.key}:${admin.id}`).digest('hex');
    // The job is also the durable deduplication receipt for the in-app notice.
    const created = await tx.adminEmailJob.createMany({ data: [{ key, userId: admin.id, category: notice.category, priority: notice.priority, entityId: notice.entityId, title: notice.title, link: notice.link, status: wantsAdminEmail(admin.adminProfile, notice.category, notice.priority) ? 'QUEUED' : 'SUPPRESSED' }], skipDuplicates: true });
    if (created.count) await tx.notification.create({ data: { userId: admin.id, type: notice.category.toLowerCase(), title: notice.title, body: 'Open the linked record to review this update.', link: notice.link } });
  }
}
export async function processAdminEmailJobs(now = new Date()) {
  await prisma.adminEmailJob.updateMany({ where: { status: 'PROCESSING', lockedAt: { lt: new Date(now.getTime() - 300000) } }, data: { status: 'QUEUED', lockedAt: null, claimToken: null } });
  const jobs = await prisma.adminEmailJob.findMany({ where: { status: { in: ['QUEUED', 'UNCONFIGURED'] }, dueAt: { lte: now } }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: 100 });
  for (const job of jobs) {
    const claimToken = randomUUID();
    if (!(await prisma.adminEmailJob.updateMany({ where: { id: job.id, status: { in: ['QUEUED', 'UNCONFIGURED'] }, dueAt: { lte: now } }, data: { status: 'PROCESSING', claimToken, lockedAt: now } })).count) continue;
    let status = 'SENT', error: string | null = null;
    try {
      const user = await prisma.user.findFirst({ where: { id: job.userId, role: 'ADMIN', status: 'ACTIVE', deletedAt: null }, include: { adminProfile: true } });
      if (!user || !wantsAdminEmail(user.adminProfile, job.category, job.priority)) status = 'SUPPRESSED';
      else if (!await sendAdminNotificationEmail({ to: user.email, title: job.title, link: job.link, key: job.key })) { status = 'UNCONFIGURED'; error = 'SMTP is not configured. No email was sent.'; }
    } catch { status = job.attempts + 1 >= 5 ? 'FAILED' : 'QUEUED'; error = 'Email delivery failed. Check SMTP and worker logs.'; }
    await prisma.$transaction(async tx => {
      const updated = await tx.adminEmailJob.updateMany({ where: { id: job.id, claimToken }, data: { status, error, attempts: { increment: status === 'UNCONFIGURED' ? 0 : 1 }, sentAt: status === 'SENT' ? now : null, lockedAt: null, claimToken: null, dueAt: new Date(now.getTime() + (status === 'UNCONFIGURED' ? 60000 : [1, 5, 15, 60][Math.min(job.attempts, 3)]! * 60000)) } });
      if (updated.count && ['SENT', 'FAILED', 'SUPPRESSED'].includes(status)) await writeAudit({ action: 'AdminEmailDeliveryOutcome', source: 'Admin notification worker', entity: `AdminEmailJob ${job.id}`, outcome: status === 'SENT' ? 'SUCCEEDED' : 'FAILED', metadata: { jobId: job.id, reasonCode: status, channel: 'EMAIL' }, deduplicationKey: `admin-email:${job.id}:${status}` }, tx);
    });
  }
}
export function startAdminNotificationWorker() {
  let running: Promise<void> | null = null;
  const tick = () => {
    if (!running) running = (async () => { await purgeAvatars(); if (env.ADMIN_EMAIL_WORKER_ENABLED) await processAdminEmailJobs(); })().catch(error => logger.error('Admin notification worker failed', { error: String(error) })).finally(() => { running = null; });
  };
  tick(); const timer = setInterval(tick, 60000); timer.unref();
  return async () => { clearInterval(timer); await running; };
}
