import type { Request } from 'express';
import { Prisma, type SupportRequest, type SupportStatus, type SupportKind } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { paginationQuerySchema, buildPaginatedResult, toSkipTake } from '../utils/pagination';

export const statusLabels: Record<SupportStatus, string> = {
  PENDING: 'Pending', UNDER_REVIEW: 'Under Review', APPROVED: 'Approved', REJECTED: 'Rejected', COMPLETED: 'Completed',
};
const memberLabels: Record<SupportStatus, string> = { ...statusLabels, PENDING: 'Open', UNDER_REVIEW: 'In Review', COMPLETED: 'Closed' };
const statuses = ['All', 'Pending', 'Open', 'Under Review', 'In Review', 'Approved', 'Rejected', 'Completed', 'Closed'] as const;
const priorities = ['Standard', 'High', 'Urgent', 'Low'] as const;
const kinds = ['Moral', 'Official', 'Funding', 'Moral Support', 'Official Support', 'Funding Support'] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((s) => {
  const parsed = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === s;
}, 'Enter a valid date');
export const listQuery = paginationQuerySchema.extend({
  status: z.enum(statuses).default('All'), q: z.string().trim().max(220).default(''),
  supportType: z.enum(['All', ...kinds]).default('All'), priority: z.enum(['All', ...priorities]).default('All'),
  member: z.string().trim().max(220).default(''), submittedDate: date.optional(),
});
export const createBody = z.object({
  projectId: z.string().min(1).nullable().optional(), subject: z.string().trim().min(4).max(220),
  description: z.string().trim().min(10).max(10000), priority: z.enum(['Standard', 'High', 'Urgent']).default('Standard'),
  types: z.array(z.enum(kinds)).min(1, 'Select at least one support type').max(6), requiredBy: date.nullable().optional(),
}).strict();
export const decisionBody = z.object({
  response: z.string().trim().max(4000).optional(), reason: z.string().trim().max(4000).optional(),
  reviewNotes: z.string().trim().max(4000).optional(), expectedUpdatedAt: z.string().datetime().optional(),
}).strict();
export const updateBody = z.object({
  assignedAdminId: z.string().min(1).nullable().optional(), priority: z.enum(priorities).optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
}).strict().refine((v) => v.assignedAdminId !== undefined || v.priority !== undefined, 'Provide an assignment or priority');
const kindOf = (label: string) => label.replace(' Support', '').toUpperCase() as SupportKind;
const typeLabel = (kind: string) => kind.charAt(0) + kind.slice(1).toLowerCase();
async function transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(operation);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new ApiError(409, 'Request changed. Refresh and try again.');
    }
    throw error;
  }
}
const include = {
  types: true, project: true, assignee: { select: { id: true, fullName: true } },
  requester: { select: { id: true, fullName: true, memberProfile: { select: { memberId: true, institution: true } } } },
} satisfies Prisma.SupportRequestInclude;
type Row = Prisma.SupportRequestGetPayload<{ include: typeof include }>;
function serialize(row: Row, admin: boolean) {
  return {
    id: row.id, subject: row.subject, project: row.project?.title ?? 'Not project-linked', projectId: row.projectId,
    type: row.types.map((t) => typeLabel(t.kind)), supportType: row.types[0] ? `${typeLabel(row.types[0].kind)} Support` : null,
    submitted: row.createdAt, lastUpdate: row.updatedAt, status: (admin ? statusLabels : memberLabels)[row.status],
    statusCode: row.status, priority: row.priority, queueDays: Math.max(0, Math.floor((Date.now() - row.createdAt.getTime()) / 86400000)),
    member: row.requester.fullName, memberId: row.requester.memberProfile?.memberId ?? null,
    ...(admin ? { requesterId: row.requesterId, assignedAdminId: row.assignedAdminId, assignedAdmin: row.assignee?.fullName ?? row.assignedAdmin ?? 'Unassigned' } : {}),
    conversationId: row.conversationId,
  };
}

async function statistics(userId?: string) {
  const rows = await prisma.supportRequest.findMany({
    where: userId ? { requesterId: userId } : {},
    select: {
      id: true, createdAt: true, status: true, priority: true, types: { select: { kind: true } },
      histories: { select: { toStatus: true, fromStatus: true, createdAt: true } },
      conversation: { select: { messages: { where: { internal: false, senderRole: 'ADMIN' }, orderBy: { createdAt: 'asc' }, take: 1, select: { createdAt: true } } } },
    },
  });
  const now = Date.now();
  const open = rows.filter((r) => ['PENDING', 'UNDER_REVIEW'].includes(r.status));
  const responseTimes = rows.flatMap((r) => r.conversation?.messages[0] ? [Math.max(0, r.conversation.messages[0].createdAt.getTime() - r.createdAt.getTime()) / 86400000] : []);
  const closed = rows.flatMap((r) => {
    const h = r.histories.find((h) => h.toStatus === 'COMPLETED' && h.fromStatus !== h.toStatus && h.createdAt.getTime() >= now - 30 * 86400000);
    return h ? [(h.createdAt.getTime() - r.createdAt.getTime()) / 86400000] : [];
  });
  const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return {
    total: rows.length, open: open.length, urgent: open.filter((r) => r.priority === 'Urgent').length,
    overSla: open.filter((r) => now - r.createdAt.getTime() >= 5 * 86400000).length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    funding: rows.filter((r) => r.types.some((t) => t.kind === 'FUNDING')).length,
    approvedWeek: rows.filter((r) => r.histories.some((h) => h.toStatus === 'APPROVED' && h.fromStatus !== h.toStatus && h.createdAt.getTime() >= now - 7 * 86400000)).length,
    triagedWeek: rows.filter((r) => r.histories.some((h) => h.fromStatus === 'PENDING' && h.toStatus !== 'PENDING' && h.createdAt.getTime() >= now - 7 * 86400000)).length,
    closedMonth: closed.length, avgResolutionDays: mean(closed), avgResponseDays: mean(responseTimes),
  };
}

export async function listSupport(req: Request, userId?: string) {
  const query = listQuery.parse(req.query);
  const status = Object.keys(statusLabels).find((s) => statusLabels[s as SupportStatus] === query.status || memberLabels[s as SupportStatus] === query.status) as SupportStatus | undefined;
  const where: Prisma.SupportRequestWhereInput = {
    ...(userId ? { requesterId: userId } : {}), ...(status ? { status } : {}),
    ...(query.priority !== 'All' ? { priority: query.priority } : {}),
    ...(query.supportType !== 'All' ? { types: { some: { kind: kindOf(query.supportType) } } } : {}),
    ...(query.member ? { requester: { OR: [{ fullName: { contains: query.member } }, { memberProfile: { memberId: { contains: query.member } } }] } } : {}),
    ...(query.q ? { OR: [{ id: { contains: query.q } }, { subject: { contains: query.q } }, { project: { title: { contains: query.q } } }] } : {}),
    ...(query.submittedDate ? { createdAt: { gte: new Date(`${query.submittedDate}T00:00:00Z`), lt: new Date(Date.parse(`${query.submittedDate}T00:00:00Z`) + 86400000) } } : {}),
  };
  const [rows, total, stats] = await Promise.all([
    prisma.supportRequest.findMany({ where, include: { ...include, conversation: { include: {
      messages: { where: userId ? { internal: false } : {}, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
      _count: { select: { messages: { where: userId ? { internal: false } : {} } } },
    } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], ...toSkipTake(query) }),
    prisma.supportRequest.count({ where }), statistics(userId),
  ]);
  return { ...buildPaginatedResult(rows.map((row) => ({
    ...serialize(row, !userId), messages: row.conversation?._count.messages ?? 0,
    lastMessage: row.conversation?.messages[0]?.body ?? row.adminResponse ?? row.description,
  })), total, query), stats };
}

async function attachConversation(tx: Prisma.TransactionClient, row: SupportRequest) {
  if (row.conversationId) return row.conversationId;
  const requester = await tx.user.findUniqueOrThrow({ where: { id: row.requesterId } });
  const admins = await tx.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null }, select: { id: true } });
  const conversation = await tx.conversation.create({ data: {
    subject: row.subject, category: 'Support Request', priority: row.priority,
    status: statusLabels[row.status], assignee: row.assignedAdmin,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    participants: { create: [{ userId: row.requesterId, roleLabel: 'Member' }, ...admins.filter((a) => a.id !== row.requesterId).map((a) => ({ userId: a.id, roleLabel: 'CRO Office' }))] },
    linkedRecords: { create: { label: 'Support Request', recordId: row.id, name: row.subject } },
    messages: { create: { senderId: row.requesterId, senderName: requester.fullName, senderRole: requester.role, body: row.description, createdAt: row.createdAt } },
  } });
  const claimed = await tx.supportRequest.updateMany({ where: { id: row.id, conversationId: null }, data: { conversationId: conversation.id, updatedAt: row.updatedAt } });
  if (!claimed.count) throw new ApiError(409, 'Request changed. Refresh and try again.');
  return conversation.id;
}

async function notify(tx: Prisma.TransactionClient, userId: string, id: string, title: string, body: string, admin = false) {
  await tx.notification.create({ data: { userId, title, body, type: 'support', link: `${admin ? '/admin' : '/dashboard'}/support/${id}` } });
}

async function audit(tx: Prisma.TransactionClient, actorId: string, id: string, action: string, description: string) {
  const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
  await tx.auditLog.create({ data: { actorId, actorLabel: actor.fullName, actorRole: actor.role, action, entity: `SupportRequest ${id}`, severity: 'INFO', description } });
}

export async function createSupport(userId: string, input: z.infer<typeof createBody>) {
  const row = await transaction(async (tx) => {
    if (input.projectId && !await tx.project.findFirst({ where: { id: input.projectId, ownerId: userId, deletedAt: null } })) throw ApiError.notFound('Project not found');
    const row = await tx.supportRequest.create({ data: {
      requesterId: userId, projectId: input.projectId ?? null, subject: input.subject, description: input.description,
      priority: input.priority, requiredBy: input.requiredBy ? new Date(`${input.requiredBy}T00:00:00Z`) : null,
      types: { create: [...new Set(input.types.map(kindOf))].map((kind) => ({ kind })) },
      histories: { create: { toStatus: 'PENDING', actorId: userId, note: 'Support request submitted', internal: false } },
    } });
    await attachConversation(tx, row);
    await audit(tx, userId, row.id, 'SupportRequestCreated', 'Support request submitted');
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    for (const admin of admins) await notify(tx, admin.id, row.id, 'New support request', row.subject, true);
    await notify(tx, userId, row.id, 'Support request received', row.subject);
    return row;
  });
  return supportDetail(row.id, userId);
}

export async function supportDetail(id: string, userId?: string) {
  const row = await prisma.supportRequest.findFirst({ where: { id, ...(userId ? { requesterId: userId } : {}) }, include: {
    ...include, histories: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    conversation: { include: { messages: { where: userId ? { internal: false } : {}, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: {
      attachments: { where: { file: { deletedAt: null } }, include: { file: true } }, sharedLinks: true,
    } } } },
  } });
  if (!row) throw ApiError.notFound('Support request not found');
  const actors = userId ? [] : await prisma.user.findMany({ where: { id: { in: row.histories.flatMap((h) => h.actorId ? [h.actorId] : []) } }, select: { id: true, fullName: true } });
  const messages = row.conversation?.messages.map((m) => ({
    id: m.id, who: m.senderRole === 'ADMIN' ? 'admin' : m.senderRole === 'SYSTEM' ? 'system' : 'member',
    name: m.senderName, at: m.createdAt, text: m.body, internal: m.internal,
    attachments: m.attachments.map((a) => ({ id: a.fileId, attachmentId: a.id, name: a.file.originalName, size: a.file.sizeBytes, type: a.file.mimeType })),
    links: m.sharedLinks.filter((l) => /^https?:\/\//i.test(l.url)).map((l) => ({ id: l.id, url: l.url, label: l.label })),
  })) ?? [];
  const previous = !userId ? await prisma.supportRequest.groupBy({ by: ['status'], where: { requesterId: row.requesterId, id: { not: row.id } }, _count: true }) : [];
  return {
    ...serialize(row, !userId), description: row.description, requiredBy: row.requiredBy, adminResponse: row.adminResponse,
    institution: row.requester.memberProfile?.institution ?? null,
    messages, attachments: messages.flatMap((m) => m.attachments.map((a) => ({ ...a, internal: m.internal }))).filter((a, i, all) => all.findIndex((b) => b.id === a.id) === i),
    history: row.histories.filter((h) => !userId || !h.internal || h.fromStatus !== h.toStatus).map((h) => ({ id: h.id, at: h.createdAt, from: h.fromStatus ? (userId ? memberLabels : statusLabels)[h.fromStatus] : null,
      to: (userId ? memberLabels : statusLabels)[h.toStatus],
      ...(!userId ? { by: actors.find((a) => a.id === h.actorId)?.fullName ?? 'System', internal: h.internal } : {}),
      note: userId && h.internal ? null : h.note,
    })),
    linked: row.project && !row.project.deletedAt ? [{ label: 'Project', id: row.project.id, name: row.project.title }] : [],
    ...(!userId ? { memberSummary: { previous: previous.reduce((a, b) => a + b._count, 0), approved: previous.find((p) => p.status === 'APPROVED')?._count ?? 0, rejected: previous.find((p) => p.status === 'REJECTED')?._count ?? 0 } } : {}),
  };
}

export async function conversationForSupport(id: string, userId?: string) {
  return transaction(async (tx) => {
    const row = await tx.supportRequest.findFirst({ where: { id, ...(userId ? { requesterId: userId } : {}) } });
    if (!row) throw ApiError.notFound('Support request not found');
    return attachConversation(tx, row);
  });
}

export async function assignableAdmins() {
  return prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } });
}

export async function updateSupport(id: string, actorId: string, input: z.infer<typeof updateBody>) {
  await transaction(async (tx) => {
    const row = await tx.supportRequest.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound('Support request not found');
    const assignee = input.assignedAdminId ? await tx.user.findFirst({ where: { id: input.assignedAdminId, role: 'ADMIN', status: 'ACTIVE', deletedAt: null } }) : null;
    if (input.assignedAdminId && !assignee) throw new ApiError(422, 'Choose an active administrator', [{ field: 'assignedAdminId', message: 'Administrator is unavailable' }]);
    const conversationId = await attachConversation(tx, row);
    const result = await tx.supportRequest.updateMany({ where: { id, updatedAt: input.expectedUpdatedAt ? new Date(input.expectedUpdatedAt) : row.updatedAt }, data: {
      priority: input.priority, ...(input.assignedAdminId !== undefined ? { assignedAdminId: input.assignedAdminId, assignedAdmin: assignee?.fullName ?? null } : {}),
    } });
    if (!result.count) throw new ApiError(409, 'Request changed. Refresh before updating.');
    const note = [input.priority ? `Priority: ${input.priority}` : '', input.assignedAdminId !== undefined ? `Assigned to: ${assignee?.fullName ?? 'Unassigned'}` : ''].filter(Boolean).join('. ');
    await tx.conversation.update({ where: { id: conversationId }, data: { priority: input.priority, ...(input.assignedAdminId !== undefined ? { assignee: assignee?.fullName ?? null } : {}) } });
    await tx.supportRequestHistory.create({ data: { requestId: id, fromStatus: row.status, toStatus: row.status, actorId, note, internal: true } });
    await audit(tx, actorId, id, 'SupportRequestUpdated', note);
    if (assignee) {
      await tx.conversationParticipant.upsert({ where: { conversationId_userId: { conversationId, userId: assignee.id } }, create: { conversationId, userId: assignee.id, roleLabel: 'CRO Office' }, update: {} });
      await notify(tx, assignee.id, id, 'Support request assigned', row.subject, true);
    }
    if (input.priority && input.priority !== row.priority) await notify(tx, row.requesterId, id, 'Support priority updated', input.priority);
  });
  return supportDetail(id);
}

export async function transitionSupport(id: string, actorId: string, next: SupportStatus, response?: string, expectedUpdatedAt?: string) {
  const note = response?.trim() ?? '';
  if (['UNDER_REVIEW', 'REJECTED', 'COMPLETED'].includes(next) && !note) throw new ApiError(422, 'Notes are required for this action', [{ field: 'response', message: 'Enter decision notes' }]);
  const allowed: Record<SupportStatus, SupportStatus[]> = { PENDING: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'], UNDER_REVIEW: ['APPROVED', 'REJECTED'], APPROVED: ['COMPLETED'], REJECTED: [], COMPLETED: [] };
  await transaction(async (tx) => {
    const row = await tx.supportRequest.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound('Support request not found');
    if (!allowed[row.status].includes(next)) throw new ApiError(409, 'This status change is no longer available. Refresh the request.');
    const conversationId = await attachConversation(tx, row);
    const internal = next === 'UNDER_REVIEW';
    const body = note || `Support request ${statusLabels[next].toLowerCase()}.`;
    const result = await tx.supportRequest.updateMany({ where: { id, status: row.status, updatedAt: expectedUpdatedAt ? new Date(expectedUpdatedAt) : row.updatedAt }, data: { status: next, ...(!internal ? { adminResponse: body } : {}) } });
    if (!result.count) throw new ApiError(409, 'Request changed. Refresh before deciding.');
    await tx.supportRequestHistory.create({ data: { requestId: id, fromStatus: row.status, toStatus: next, actorId, note: body, internal } });
    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
    await tx.message.create({ data: { conversationId, senderId: actorId, senderName: actor.fullName, senderRole: 'ADMIN', body, internal } });
    await tx.conversation.update({ where: { id: conversationId }, data: { status: statusLabels[next], updatedAt: new Date() } });
    await audit(tx, actorId, id, 'SupportRequestStatusChanged', body);
    await notify(tx, row.requesterId, id, `Support request: ${memberLabels[next]}`, internal ? 'Your request is being reviewed.' : body);
  });
  return { ok: true, to: statusLabels[next] };
}

export async function backfillSupportConversations() {
  const rows = await prisma.supportRequest.findMany({ where: { conversationId: null }, select: { id: true } });
  let linked = 0;
  for (const { id } of rows) {
    await conversationForSupport(id);
    linked += 1;
  }
  return { linked };
}
