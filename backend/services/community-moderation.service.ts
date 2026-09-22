import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResult, toSkipTake } from '../utils/pagination';
import * as input from '../domain/community';
import { activeMembership, audit, locked, moderatorScope, type Actor, type DB } from './community-access.service';
import { assertMemberTarget, communities, members } from './community.service';
import { conversations, messageDto, messageInclude } from './community-chat.service';

const reportInclude = (actor: Actor) => ({ community: { select: { name: true } }, reporter: { select: { fullName: true } },
  reportedMember: { include: { user: { select: { fullName: true, role: true, id: true, email: true } }, community: { select: { name: true } } } },
  reportedMessage: { include: messageInclude(actor) }, assignedAdmin: { select: { fullName: true } },
  actionHistory: { include: { actor: { select: { fullName: true } } }, orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
}) satisfies Prisma.CommunityReportInclude;
type ReportRow = Prisma.CommunityReportGetPayload<{ include: ReturnType<typeof reportInclude> }>;
function availableActions(actor: Actor, row: ReportRow): input.ModerationAction[] {
  const actions: input.ModerationAction[] = [];
  if (row.reportedMessage && !row.reportedMessage.deletedAt) actions.push(row.reportedMessage.isHidden ? 'RESTORE_CONTENT' : 'HIDE_CONTENT');
  if (row.reportedMember && !row.reportedMember.removedAt) {
    try {
      assertMemberTarget(actor, row.reportedMember);
      actions.push('WARN_MEMBER', 'SUSPEND_MEMBER', 'BLOCK_MEMBER');
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 403) throw error;
    }
  }
  return [...actions, 'RESOLVE_REPORT', 'DISMISS_REPORT'];
}
function dto(row: ReportRow, actor: Actor) {
  return { id: row.id, communityId: row.communityId, communityName: row.community.name, reporterId: row.reporterId, reporterName: row.reporter.fullName,
    reportedMemberId: row.reportedMemberId ?? undefined, reportedMemberName: row.reportedMessage?.sender.fullName ?? row.reportedMember?.user.fullName,
    reportedMessage: row.reportedMessage ? messageDto(row.reportedMessage, true) : undefined, reason: row.reason, notes: row.notes ?? undefined,
    status: row.status, assignedAdminName: row.assignedAdmin?.fullName, resolutionNotes: row.resolutionNotes ?? undefined, createdAt: row.createdAt, updatedAt: row.updatedAt,
    availableActions: availableActions(actor, row),
    actionHistory: row.actionHistory.map(a => ({ id: a.id, action: a.action, notes: a.notes, adminName: a.actor.fullName, createdAt: a.createdAt })),
  };
}
export async function reportDetail(actor: Actor, id: string, db: DB = prisma) {
  const row = await db.communityReport.findFirst({ where: { id, community: moderatorScope(actor) }, include: reportInclude(actor) });
  if (!row) throw ApiError.notFound('Report not found');
  return dto(row, actor);
}
export async function reports(actor: Actor, raw: unknown) {
  const q = input.communityQuery.parse(raw);
  const where: Prisma.CommunityReportWhereInput = { community: moderatorScope(actor), ...(q.communityId ? { communityId: q.communityId } : {}),
    ...(q.status ? { status: input.reportStatus.parse(q.status) } : {}), ...(q.dateFrom ? { createdAt: { gte: new Date(`${q.dateFrom}T00:00:00.000Z`) } } : {}),
    ...(q.search ? { OR: [{ reason: { contains: q.search } }, { reporter: { fullName: { contains: q.search } } }, { reportedMember: { user: { fullName: { contains: q.search } } } }, { reportedMessage: { sender: { fullName: { contains: q.search } } } }] } : {}),
  };
  const total = await prisma.communityReport.count({ where });
  q.page = Math.min(q.page, Math.max(1, Math.ceil(total / q.limit)));
  const rows = await prisma.communityReport.findMany({ where, include: reportInclude(actor), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...toSkipTake(q) });
  return buildPaginatedResult(rows.map(row => dto(row, actor)), total, q);
}
export async function createReport(actor: Actor, id: string, raw: unknown, kind: 'message' | 'member') {
  const body = input.reportBody.parse(raw);
  const message = kind === 'message' ? await prisma.communityMessage.findUnique({ where: { id }, include: { conversation: true } }) : null;
  const member = kind === 'member' ? await prisma.communityMembership.findUnique({ where: { id } }) : null;
  const communityId = message?.conversation.communityId ?? member?.communityId;
  if (!communityId || (kind === 'member' && communityId !== body.communityId)) throw ApiError.notFound('Reported content not found');
  return locked(actor, communityId, 'member', async db => {
    const current = message ? await db.communityMessage.findFirst({ where: { id, deletedAt: null, isHidden: false } }) : null;
    if (message && !current) throw ApiError.notFound('Message not found');
    const target = await db.communityMembership.findFirst({ where: { communityId, ...(member ? { id: member.id, ...activeMembership } : { userId: current!.senderId }) } });
    if (member && !target) throw ApiError.notFound('Reported member not found');
    if ((current?.senderId ?? target?.userId) === actor.id) throw ApiError.unprocessable('Select another community member.');
    // The community lock makes duplicate report submission idempotent.
    const existing = await db.communityReport.findFirst({ where: { communityId, reporterId: actor.id, ...(current ? { reportedMessageId: current.id } : { reportedMemberId: target!.id, reportedMessageId: null }), status: { in: ['OPEN', 'UNDER_REVIEW'] } } });
    if (!existing) {
      const report = await db.communityReport.create({ data: { communityId, reporterId: actor.id, reportedMemberId: target?.id, reportedMessageId: current?.id, reason: body.reason, notes: body.notes } });
      await audit(db, actor, 'Reported', report.id);
    }
    return null;
  });
}
export async function updateReport(actor: Actor, id: string, raw: unknown, moderation = false) {
  const body = moderation ? input.moderationBody.parse(raw) : input.reportPatch.parse(raw);
  const original = await prisma.communityReport.findUnique({ where: { id } });
  if (!original) throw ApiError.notFound('Report not found');
  return locked(actor, original.communityId, 'manage', async db => {
    const row = await db.communityReport.findUniqueOrThrow({ where: { id }, include: reportInclude(actor) });
    let status = row.status;
    let resolutionNotes: string | null | undefined;
    let action: string;
    let notes: string;
    if ('action' in body) {
      action = body.action; notes = body.notes;
      if (!availableActions(actor, row).includes(body.action)) throw ApiError.conflict('This moderation action is no longer available. Refresh the report and choose an available action.');
      if (action === 'RESOLVE_REPORT' || action === 'DISMISS_REPORT') { status = action === 'RESOLVE_REPORT' ? 'RESOLVED' : 'DISMISSED'; resolutionNotes = notes; }
      else if (action === 'HIDE_CONTENT' || action === 'RESTORE_CONTENT') {
        if (!row.reportedMessage || row.reportedMessage.deletedAt) throw ApiError.conflict('The reported message is unavailable.');
        await db.communityMessage.update({ where: { id: row.reportedMessage.id }, data: { isHidden: action === 'HIDE_CONTENT' } });
      } else {
        if (!row.reportedMember || row.reportedMember.removedAt) throw ApiError.conflict('The reported membership is unavailable.');
        assertMemberTarget(actor, row.reportedMember);
        if (action === 'WARN_MEMBER') await db.notification.create({ data: { userId: row.reportedMember.userId, title: 'Community moderation warning', body: notes, type: 'community', link: '/dashboard/community' } });
        else await db.communityMembership.update({ where: { id: row.reportedMember.id }, data: { status: action === 'SUSPEND_MEMBER' ? 'SUSPENDED' : 'BLOCKED', reason: notes } });
      }
    } else {
      if (body.status === 'UNDER_REVIEW' && row.status === 'UNDER_REVIEW') return dto(row, actor);
      status = body.status;
      resolutionNotes = status === 'OPEN' || status === 'UNDER_REVIEW' ? null : body.resolutionNotes;
      action = `REPORT_${status}`;
      notes = body.resolutionNotes ?? (status === 'OPEN' ? 'Report reopened.' : 'Review started.');
    }
    await db.communityReport.update({ where: { id }, data: { status, assignedAdminId: actor.id, ...(resolutionNotes !== undefined ? { resolutionNotes } : {}), actionHistory: { create: { actorId: actor.id, action, notes } } } });
    await audit(db, actor, action, id, { notes });
    return reportDetail(actor, id, db);
  });
}
export async function dashboard(actor: Actor) {
  const scope = moderatorScope(actor);
  const [totalCommunities, activeCommunities, totalMembers, pendingRequests, totalMessages, unreadMessages, openReports, suspendedMembers, recentCommunities, pendingMembers, recentConversations, recentReports] = await Promise.all([
    prisma.community.count({ where: scope }), prisma.community.count({ where: { AND: [scope, { status: 'ACTIVE' }] } }),
    prisma.communityMembership.count({ where: { community: scope, ...activeMembership } }),
    prisma.communityMembership.count({ where: { community: scope, status: 'PENDING', removedAt: null } }),
    prisma.communityMessage.count({ where: { conversation: { community: scope }, deletedAt: null } }),
    prisma.communityMessage.count({ where: { conversation: { community: scope }, deletedAt: null, senderId: { not: actor.id }, reads: { none: { userId: actor.id } } } }),
    prisma.communityReport.count({ where: { community: scope, status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    prisma.communityMembership.count({ where: { community: scope, status: { in: ['SUSPENDED', 'BLOCKED'] }, removedAt: null } }),
    communities(actor, { limit: 5 }, true), members(actor, { limit: 5, status: 'PENDING' }), conversations(actor, { limit: 5 }, true), prisma.communityReport.findMany({ where: { community: scope, status: { in: ['OPEN', 'UNDER_REVIEW'] } }, include: reportInclude(actor), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5 }),
  ]);
  return { stats: { totalCommunities, activeCommunities, totalMembers, pendingRequests, totalMessages, unreadMessages, openReports, suspendedMembers },
    recentCommunities: recentCommunities.items, pendingMembers: pendingMembers.items, recentConversations: recentConversations.items, reports: recentReports.map(row => dto(row, actor)) };
}
