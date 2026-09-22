import { sha256 } from '../utils/security';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResult, toSkipTake } from '../utils/pagination';
import * as input from '../domain/community';
import { activeMembership, audit, locked, moderatorScope, type Actor, type DB } from './community-access.service';
import { assertMemberTarget, communities, members } from './community.service';
import { conversations, messageDto, messageInclude } from './community-chat.service';

const reportInclude = (actor: Actor) => ({ community: { select: { name: true } }, reporter: { select: { fullName: true } },
  reportedMember: { include: { user: { select: { fullName: true, role: true, id: true, email: true, status: true, deletedAt: true } }, community: { select: { name: true } } } },
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
      actions.push('WARN_MEMBER');
      if (row.reportedMember.status === 'ACTIVE') actions.push('SUSPEND_MEMBER');
      if (row.reportedMember.status !== 'BLOCKED') actions.push('BLOCK_MEMBER');
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 403) throw error;
    }
  }
  if (row.status !== 'RESOLVED') actions.push('RESOLVE_REPORT');
  if (row.status !== 'DISMISSED') actions.push('DISMISS_REPORT');
  if (row.status === 'RESOLVED' || row.status === 'DISMISSED') actions.push('REOPEN_REPORT');
  return actions;
}
// Ignore presence/read activity; include every content/restriction state used by decisions.
function targetVersion(row: ReportRow) {
  const message = row.reportedMessage, member = row.reportedMember;
  return sha256(JSON.stringify({ message: message && { id: message.id, content: message.content, updatedAt: message.updatedAt,
    author: { fullName: message.sender.fullName, role: message.sender.role }, conversation: { id: message.conversation.id, title: message.conversation.title }, hidden: message.isHidden, deletedAt: message.deletedAt, attachments: message.attachments.map(a => a.id).sort() },
    member: member && { id: member.id, status: member.status, role: member.role, removedAt: member.removedAt, user: member.user } }));
}
function dto(row: ReportRow, actor: Actor) {
  return { id: row.id, communityId: row.communityId, communityName: row.community.name, reporterId: row.reporterId, reporterName: row.reporter.fullName,
    reportedMemberId: row.reportedMemberId ?? undefined, reportedMemberName: row.reportedMessage?.sender.fullName ?? row.reportedMember?.user.fullName,
    reportedMessage: row.reportedMessage ? messageDto(row.reportedMessage, true) : undefined, reason: row.reason, notes: row.notes ?? undefined,
    status: row.status, assignedAdminName: row.assignedAdmin?.fullName, resolutionNotes: row.resolutionNotes ?? undefined, createdAt: row.createdAt, updatedAt: row.updatedAt,
    targetMemberState: row.reportedMember ? row.reportedMember.removedAt ? 'REMOVED' : `${row.reportedMember.role} · ${row.reportedMember.status}` : undefined,
    revision: row.revision, targetVersion: targetVersion(row), evidence: row.evidence,
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
  return prisma.$transaction(async db => {
    const total = await db.communityReport.count({ where });
    q.page = Math.min(q.page, Math.max(1, Math.ceil(total / q.limit)));
    const rows = await db.communityReport.findMany({ where, include: reportInclude(actor), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...toSkipTake(q) });
    return buildPaginatedResult(rows.map(row => dto(row, actor)), total, q);
  });
}
export async function createReport(actor: Actor, id: string, raw: unknown, kind: 'message' | 'member') {
  const body = input.reportBody.parse(raw);
  const requestHash = sha256(JSON.stringify({ kind, id, ...body }));
  const receiptKey = { reporterId: actor.id, submissionId: body.submissionId };
  const previous = await prisma.communityReportSubmission.findUnique({ where: { reporterId_submissionId: receiptKey }, include: { report: true } });
  const message = kind === 'message' ? await prisma.communityMessage.findUnique({ where: { id }, include: { conversation: true } }) : null;
  const member = kind === 'member' ? await prisma.communityMembership.findUnique({ where: { id } }) : null;
  const communityId = previous?.report.communityId ?? message?.conversation.communityId ?? member?.communityId;
  if (!communityId || (kind === 'member' && communityId !== body.communityId)) throw ApiError.notFound('Reported content not found');
  return locked(actor, communityId, 'member', async db => {
    const replay = await db.communityReportSubmission.findUnique({ where: { reporterId_submissionId: receiptKey }, include: { report: true } });
    if (replay) {
      if (replay.requestHash !== requestHash) throw ApiError.conflict('This submission ID was already used for a different report.');
      return { reportId: replay.reportId, status: replay.report.status, created: replay.created, duplicate: !replay.created };
    }
    const current = message ? await db.communityMessage.findFirst({ where: { id, deletedAt: null, isHidden: false }, include: {
      sender: { select: { id: true, fullName: true } }, conversation: true, attachments: { include: { file: true }, orderBy: { id: 'asc' } },
    } }) : null;
    if (message && !current) throw ApiError.notFound('Message not found');
    const target = await db.communityMembership.findFirst({ where: { communityId, ...(member ? { id: member.id, ...activeMembership } : { userId: current!.senderId }) }, include: { user: { select: { id: true, fullName: true, role: true } } } });
    if (member && !target) throw ApiError.notFound('Reported member not found');
    if ((current?.senderId ?? target?.userId) === actor.id) throw ApiError.unprocessable('Select another community member.');
    let report = await db.communityReport.findFirst({ where: { communityId, reporterId: actor.id, ...(current ? { reportedMessageId: current.id } : { reportedMemberId: target!.id, reportedMessageId: null }), status: { in: ['OPEN', 'UNDER_REVIEW'] } } });
    const created = !report;
    if (!report) {
      const attachments = current?.attachments.filter(a => !a.file.deletedAt) ?? [];
      const evidence = { kind, capturedAt: new Date().toISOString(),
        message: current ? { id: current.id, content: current.content, author: current.sender, conversation: { id: current.conversation.id, title: current.conversation.title }, replyToId: current.replyToId, createdAt: current.createdAt, updatedAt: current.updatedAt } : null,
        member: target ? { id: target.id, user: target.user, status: target.status, role: target.role, joinedAt: target.joinedAt, removedAt: target.removedAt } : null,
        attachments: attachments.map(a => ({ id: a.id, fileName: a.file.originalName, fileType: a.file.mimeType, fileSize: a.file.sizeBytes, checksum: a.file.checksum })),
      };
      report = await db.communityReport.create({ data: { communityId, reporterId: actor.id, reportedMemberId: target?.id, reportedMessageId: current?.id, reason: body.reason, notes: body.notes,
        evidence: JSON.parse(JSON.stringify(evidence)) as Prisma.InputJsonValue,
        evidenceFiles: { create: attachments.map(a => ({ attachmentId: a.id, fileId: a.fileId })) },
      } });
      await audit(db, actor, 'Reported', report.id);
    }
    await db.communityReportSubmission.create({ data: { ...receiptKey, requestHash, reportId: report.id, created } });
    return { reportId: report.id, status: report.status, created, duplicate: !created };
  }).catch(error => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw ApiError.conflict('This submission ID was already used. Retry the original request or start a new submission.');
    throw error;
  });
}

export async function evidenceFile(actor: Actor, id: string, attachmentId: string) {
  const evidence = await prisma.communityReportEvidence.findFirst({ where: { reportId: id, attachmentId, report: { community: moderatorScope(actor) } }, include: { file: true } });
  if (!evidence || evidence.file.purgedAt) throw ApiError.notFound('Report evidence not found');
  return evidence.file;
}

export async function updateReport(actor: Actor, id: string, raw: unknown, moderation = false) {
  const body = moderation ? input.moderationBody.parse(raw) : input.reportPatch.parse(raw);
  const original = await prisma.communityReport.findUnique({ where: { id } });
  if (!original) throw ApiError.notFound('Report not found');
  const requestHash = sha256(JSON.stringify({ moderation, ...body }));
  return locked(actor, original.communityId, 'manage', async db => {
    const row = await db.communityReport.findUniqueOrThrow({ where: { id }, include: reportInclude(actor) });
    const receipt = await db.communityReportOperation.findUnique({ where: { reportId_operationId: { reportId: id, operationId: body.operationId } } });
    if (receipt) {
      if (receipt.actorId !== actor.id || receipt.requestHash !== requestHash) throw ApiError.conflict('This operation ID was already used for a different decision.');
      return dto(row, actor);
    }
    if (row.revision !== body.expectedRevision || targetVersion(row) !== body.expectedTargetVersion) throw ApiError.conflict('This report or its target changed. Review the latest state before applying your decision.');
    const action: input.ModerationAction | 'REPORT_UNDER_REVIEW' = 'action' in body ? body.action :
      body.status === 'OPEN' ? 'REOPEN_REPORT' : body.status === 'RESOLVED' ? 'RESOLVE_REPORT' : body.status === 'DISMISSED' ? 'DISMISS_REPORT' : 'REPORT_UNDER_REVIEW';
    const notes = 'notes' in body ? body.notes : body.resolutionNotes ?? (action === 'REOPEN_REPORT' ? 'Report reopened.' : 'Review started.');
    if (action === 'REPORT_UNDER_REVIEW' ? !['OPEN', 'UNDER_REVIEW'].includes(row.status) : !availableActions(actor, row).includes(action)) throw ApiError.conflict('This moderation action is no longer available. Review the report and choose an available action.');
    await db.communityReportOperation.create({ data: { reportId: id, operationId: body.operationId, actorId: actor.id, requestHash } });
    if (action === 'REPORT_UNDER_REVIEW' && row.status === 'UNDER_REVIEW') return dto(row, actor);
    let status = row.status;
    let resolutionNotes: string | null | undefined;
    if (action === 'RESOLVE_REPORT' || action === 'DISMISS_REPORT') { status = action === 'RESOLVE_REPORT' ? 'RESOLVED' : 'DISMISSED'; resolutionNotes = notes; }
    else if (action === 'REOPEN_REPORT') { status = 'OPEN'; resolutionNotes = null; }
    else {
      if (row.status === 'OPEN') status = 'UNDER_REVIEW';
      if (action === 'HIDE_CONTENT' || action === 'RESTORE_CONTENT') {
        await db.communityMessage.update({ where: { id: row.reportedMessage!.id }, data: { isHidden: action === 'HIDE_CONTENT' } });
      } else if (action === 'WARN_MEMBER') {
        await db.notification.create({ data: { userId: row.reportedMember!.userId, title: 'Community moderation warning', body: notes, type: 'community', link: '/dashboard/community' } });
      } else if (action === 'SUSPEND_MEMBER' || action === 'BLOCK_MEMBER') {
        await db.communityMembership.update({ where: { id: row.reportedMember!.id }, data: { status: action === 'SUSPEND_MEMBER' ? 'SUSPENDED' : 'BLOCKED', reason: notes } });
      }
    }
    await db.communityReport.update({ where: { id }, data: { revision: { increment: 1 }, status, assignedAdminId: actor.id, ...(resolutionNotes !== undefined ? { resolutionNotes } : {}), actionHistory: { create: { actorId: actor.id, action, notes } } } });
    await audit(db, actor, action, id, { status: { before: row.status, after: status }, assignedAdminId: { before: row.assignedAdminId, after: actor.id }, ...(action === 'HIDE_CONTENT' || action === 'RESTORE_CONTENT' ? { isHidden: { before: row.reportedMessage!.isHidden, after: action === 'HIDE_CONTENT' } } : {}) });
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
