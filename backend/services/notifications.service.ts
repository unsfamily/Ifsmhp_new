import { writeAudit } from './audit.service';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { paginationQuerySchema, buildPaginatedResult, toSkipTake } from '../utils/pagination';
import { announcementScope, setAnnouncementRead } from './member-announcements.service';

export const notificationQuery = paginationQuerySchema.extend({ status: z.enum(['All', 'UNREAD', 'READ']).default('All'), announcement: z.string().max(191).optional() });
async function scope(userId: string, db: Prisma.TransactionClient = prisma): Promise<Prisma.NotificationWhereInput> {
  return { userId, status: { not: 'ARCHIVED' }, OR: [
    { announcementId: null, announcementDeliveryId: null, type: { not: 'announcement' } },
    { announcement: await announcementScope(userId, db) },
  ] };
}
const select = { id: true, title: true, body: true, type: true, status: true, link: true, createdAt: true, readAt: true, announcementId: true } satisfies Prisma.NotificationSelect;
export async function listNotifications(userId: string, raw: unknown) {
  const query = notificationQuery.parse(raw);
  const asOf = new Date();
  const visible = await scope(userId);
  const where: Prisma.NotificationWhereInput = { AND: [visible, ...(query.status !== 'All' ? [{ status: query.status }] : []), ...(query.announcement ? [{ announcementId: query.announcement }] : [])] };
  const total = await prisma.notification.count({ where });
  query.page = Math.min(query.page, Math.max(1, Math.ceil(total / query.limit)));
  const [items, unread] = await prisma.$transaction([
    prisma.notification.findMany({ where, select, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...toSkipTake(query) }),
    prisma.notification.count({ where: { AND: [visible, { status: 'UNREAD' }] } }),
  ]);
  return { ...buildPaginatedResult(items.map(item => ({ ...item, body: item.body.slice(0, 180) })), total, query), unread, asOf };
}
export async function notificationDetail(userId: string, id: string) {
  const row = await prisma.notification.findFirst({ where: { AND: [{ id }, await scope(userId)] }, select: { ...select, announcement: { select: { senderAsCRO: true } } } });
  if (!row) throw ApiError.notFound('Notification not found');
  const { announcement, ...data } = row;
  return { ...data, sender: announcement ? announcement.senderAsCRO ? 'CRO Office' : 'Communications team' : null };
}
export async function unreadNotification(userId: string, id: string) {
  const row = await notificationDetail(userId, id);
  if (row.announcementId) await setAnnouncementRead(userId, row.announcementId, false);
  else await prisma.$transaction(async tx => {
    const result = await tx.notification.updateMany({ where: { id, userId, status: 'READ' }, data: { status: 'UNREAD', readAt: null } });
    if (result.count) await log(tx, userId, id, 'NotificationsUnread', 'Notification marked unread.');
  });
  return { unread: true };
}
async function log(tx: Prisma.TransactionClient, userId: string, id: string | undefined, action: string, description: string, count = 1) {
  const actor = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
  await writeAudit({ actorId: userId, actorLabel: userId, actorRole: actor.role, action, entity: id ? `Notification ${id}` : 'Notifications', severity: 'INFO', description, changes: { status: { before: action === 'NotificationsRead' ? 'UNREAD' : 'READ', after: action === 'NotificationsRead' ? 'READ' : 'UNREAD' } }, metadata: { count } }, tx);
}
export async function readNotifications(userId: string, id?: string, through?: string) {
  return prisma.$transaction(async tx => {
    // Lock parents in stable order so read-all cannot race a deletion/dispatch.
    const parents = await tx.notification.findMany({ where: { userId, ...(id ? { id } : { createdAt: { lte: new Date(through!) } }), announcementId: { not: null } }, select: { announcementId: true }, distinct: ['announcementId'], orderBy: { announcementId: 'asc' } });
    for (const row of parents) await tx.$queryRaw`SELECT id FROM Announcement WHERE id = ${row.announcementId} FOR UPDATE`;
    const visible = await scope(userId, tx);
    if (id && !await tx.notification.findFirst({ where: { AND: [{ id }, visible] } })) throw ApiError.notFound('Notification not found');
    const where: Prisma.NotificationWhereInput = { AND: [visible, { status: 'UNREAD', ...(id ? { id } : { createdAt: { lte: new Date(through!) } }) }] };
    const rows = await tx.notification.findMany({ where, select: { announcementDeliveryId: true } });
    const now = new Date();
    const updated = await tx.notification.updateMany({ where, data: { status: 'READ', readAt: now } });
    await tx.announcementDelivery.updateMany({ where: { id: { in: rows.flatMap(row => row.announcementDeliveryId ? [row.announcementDeliveryId] : []) }, recipientUserId: userId, channel: 'IN_APP', purpose: 'BROADCAST', openedAt: null }, data: { openedAt: now } });
    if (updated.count) await log(tx, userId, id, 'NotificationsRead', `${updated.count} notifications marked read.`, updated.count);
    return { read: updated.count };
  });
}
