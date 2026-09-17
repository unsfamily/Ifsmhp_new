import { z } from 'zod';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { paginationQuerySchema, buildPaginatedResult, toSkipTake } from '../utils/pagination';

export const notificationQuery = paginationQuerySchema.extend({ status: z.enum(['All', 'UNREAD', 'READ']).default('All'), announcement: z.string().max(191).optional() });
export async function listNotifications(userId: string, raw: unknown) {
  const query = notificationQuery.parse(raw);
  const asOf = new Date();
  const where = { userId, status: query.status === 'All' ? { in: ['UNREAD', 'READ'] as ('UNREAD' | 'READ')[] } : query.status,
    ...(query.announcement ? { announcementDelivery: { announcementId: query.announcement, purpose: 'BROADCAST', channel: 'IN_APP', status: 'SENT' } } : {}) };
  const [items, total, unread] = await prisma.$transaction([
    prisma.notification.findMany({ where, select: { id: true, title: true, body: true, type: true, status: true, link: true, createdAt: true, readAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...toSkipTake(query) }),
    prisma.notification.count({ where }), prisma.notification.count({ where: { userId, status: 'UNREAD' } }),
  ]);
  return { ...buildPaginatedResult(items.map(item => ({ ...item, body: item.body.slice(0, 180) })), total, query), unread, asOf };
}
export async function notificationDetail(userId: string, id: string) {
  const row = await prisma.notification.findFirst({ where: { id, userId, status: { not: 'ARCHIVED' } }, include: { announcementDelivery: { include: { announcement: { select: { senderAsCRO: true } } } } } });
  if (!row) throw ApiError.notFound('Notification not found');
  const { announcementDelivery, ...data } = row;
  return { ...data, sender: announcementDelivery ? announcementDelivery.announcement.senderAsCRO ? 'CRO Office' : 'Communications team' : null };
}
export async function readNotifications(userId: string, id?: string, through?: string) {
  const now = new Date();
  return prisma.$transaction(async tx => {
    if (id && !await tx.notification.findFirst({ where: { id, userId, status: { not: 'ARCHIVED' } } })) throw ApiError.notFound('Notification not found');
    const where = { userId, status: 'UNREAD' as const, ...(id ? { id } : { createdAt: { lte: new Date(through!) } }) };
    const rows = await tx.notification.findMany({ where, select: { announcementDeliveryId: true } });
    const updated = await tx.notification.updateMany({ where, data: { status: 'READ', readAt: now } });
    await tx.announcementDelivery.updateMany({ where: { id: { in: rows.flatMap(row => row.announcementDeliveryId ? [row.announcementDeliveryId] : []) }, recipientUserId: userId, channel: 'IN_APP', purpose: 'BROADCAST', openedAt: null }, data: { openedAt: now } });
    if (updated.count) {
      const actor = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
      await tx.auditLog.create({ data: { actorId: userId, actorLabel: userId, actorRole: actor.role, action: 'NotificationsRead', entity: id ? `Notification ${id}` : 'Notifications', severity: 'INFO', description: `${updated.count} notifications marked read.` } });
    }
    return { read: updated.count };
  });
}
