import { writeAudit } from './audit.service';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResult, paginationQuerySchema, toSkipTake } from '../utils/pagination';
import { scientists, professionals } from './announcements.service';

export const memberAnnouncementQuery = paginationQuerySchema.extend({ q: z.string().trim().max(220).default(''), status: z.enum(['All', 'UNREAD', 'READ']).default('All') });
export async function announcementScope(userId: string, db: Prisma.TransactionClient = prisma, now = new Date()): Promise<Prisma.AnnouncementWhereInput> {
  const user = await db.user.findFirst({ where: { id: userId, role: 'MEMBER', status: 'ACTIVE', deletedAt: null }, select: { email: true, memberProfile: { select: { professionalType: true } } } });
  if (!user) return { id: { in: [] } };
  const audiences = ['All Members', 'Members Only'];
  const profession = user.memberProfile?.professionalType ?? '';
  if (scientists.includes(profession)) audiences.push('Scientists Track');
  if (professionals.includes(profession)) audiences.push('Professionals Track');
  // Prisma relation filters cannot compare revision fields across models.
  const delivered = await db.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT a.id FROM Announcement a JOIN AnnouncementDelivery d ON d.announcementId = a.id
    WHERE d.recipientUserId = ${userId} AND d.purpose = 'BROADCAST' AND d.channel = 'IN_APP'
      AND d.status = 'SENT' AND d.revision = a.revision AND d.deliveredAt <= ${now}`;
  return { AND: [
    { deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    { OR: [
      // No channel filter: an IN_APP delivery is created for every member-audience
      // broadcast (see `channelsFor`), so the receipt itself is the gate — a member
      // sees an announcement because one was delivered to them at the current
      // revision, not because of how the channel was labelled.
      { managed: true, id: { in: delivered.map(row => row.id) }, audience: { in: audiences },
        status: { in: ['SENDING', 'SENT', 'PARTIAL'] }, dispatchStartedAt: { lte: now }, OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] },
      { managed: false, status: 'SENT', sentAt: { lte: now }, OR: [
        { audience: { in: ['All Members', 'Members Only'] } },
        { AND: [{ OR: [{ audience: { in: audiences } }, { audience: { notIn: ['All Members', 'Members Only', 'Scientists Track', 'Professionals Track', 'Pending Applicants', 'Newsletter (Public)'] } }] },
          { deliveries: { some: { purpose: 'BROADCAST', OR: [{ recipientUserId: userId }, { recipientEmail: user.email }] } } }] },
      ] },
    ] },
  ] };
}

const select = (userId: string) => ({
  id: true, subject: true, body: true, senderAsCRO: true, sentAt: true, dispatchStartedAt: true, expiresAt: true,
  notifications: { where: { userId }, select: { status: true, readAt: true }, take: 1 },
}) satisfies Prisma.AnnouncementSelect;
type Row = Prisma.AnnouncementGetPayload<{ select: ReturnType<typeof select> }>;
const serialize = (row: Row, full = false) => ({ id: row.id, subject: row.subject, body: full ? row.body : row.body.slice(0, 180),
  sender: row.senderAsCRO ? 'CRO Office' : 'Communications team', sentAt: row.sentAt ?? row.dispatchStartedAt, expiresAt: row.expiresAt,
  status: row.notifications[0]?.status === 'READ' ? 'READ' : 'UNREAD', readAt: row.notifications[0]?.readAt ?? null });

export async function listMemberAnnouncements(userId: string, raw: unknown) {
  const query = memberAnnouncementQuery.parse(raw);
  const scope = await announcementScope(userId);
  const where: Prisma.AnnouncementWhereInput = { AND: [scope,
    ...(query.q ? [{ OR: [{ subject: { contains: query.q } }, { body: { contains: query.q } }] }] : []),
    ...(query.status === 'READ' ? [{ notifications: { some: { userId, status: 'READ' as const } } }] : query.status === 'UNREAD' ? [{ notifications: { none: { userId, status: 'READ' as const } } }] : []),
  ] };
  const total = await prisma.announcement.count({ where });
  query.page = Math.min(query.page, Math.max(1, Math.ceil(total / query.limit)));
  const [rows, unread] = await prisma.$transaction([
    prisma.announcement.findMany({ where, select: select(userId), orderBy: [{ dispatchStartedAt: 'desc' }, { sentAt: 'desc' }, { id: 'desc' }], ...toSkipTake(query) }),
    prisma.announcement.count({ where: { AND: [scope, { notifications: { none: { userId, status: 'READ' } } }] } }),
  ]);
  return { ...buildPaginatedResult(rows.map(row => serialize(row)), total, query), unread };
}

export async function memberAnnouncementDetail(userId: string, id: string) {
  const row = await prisma.announcement.findFirst({ where: { AND: [{ id }, await announcementScope(userId)] }, select: select(userId) });
  if (!row) throw ApiError.notFound('Announcement not found');
  return serialize(row, true);
}

export async function setAnnouncementRead(userId: string, id: string, read: boolean) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Announcement WHERE id = ${id} FOR UPDATE`;
    const row = await tx.announcement.findFirst({ where: { AND: [{ id }, await announcementScope(userId, tx)] } });
    if (!row) throw ApiError.notFound('Announcement not found');
    const now = new Date();
    const state = { status: read ? 'READ' as const : 'UNREAD' as const, readAt: read ? now : null };
    const previous = await tx.notification.findUnique({ where: { userId_announcementId: { userId, announcementId: id } } });
    if (previous?.status === state.status) return;
    await tx.notification.upsert({ where: { userId_announcementId: { userId, announcementId: id } },
      create: { userId, announcementId: id, title: row.subject, body: row.body, type: 'announcement', link: `/dashboard/notifications?announcement=${id}`, ...state }, update: state });
    if (read) await tx.announcementDelivery.updateMany({ where: { announcementId: id, recipientUserId: userId, revision: row.revision, purpose: 'BROADCAST', channel: 'IN_APP', status: 'SENT', openedAt: null }, data: { openedAt: now } });
    await writeAudit({ actorId: userId, actorLabel: userId, actorRole: 'MEMBER', action: read ? 'AnnouncementRead' : 'AnnouncementUnread', entity: `Announcement ${id}`, changes: { read: { before: previous?.status === 'READ', after: read } }, severity: 'INFO', description: `Announcement marked ${read ? 'read' : 'unread'}.` }, tx);
  });
  return memberAnnouncementDetail(userId, id);
}
