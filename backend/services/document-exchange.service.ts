import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config';
import { ApiError } from '../utils/ApiError';
import { assertSafePath } from '../utils/fileStorage';
import { buildPaginatedResult, paginationQuerySchema, toSkipTake } from '../utils/pagination';
import { DOCUMENT_EXTENSIONS, DOCUMENT_MIME_TYPES, documentKind, exchangeSendSchema, type ExchangeSend } from '../domain/document-exchange';

export const documentsQuery = paginationQuerySchema.extend({
  q: z.string().trim().max(220).default(''),
  type: z.enum(['All', 'PDF', 'DOC', 'SHEET', 'SLIDES', 'IMAGE', 'FILE']).default('All'),
  direction: z.enum(['all', 'incoming', 'outgoing']).default('all'),
  opened: z.enum(['all', 'opened', 'unopened']).default('all'),
});
export const itemsQuery = paginationQuerySchema.extend({ type: z.enum(['messages', 'videos', 'announcements']) });
const conversations = (userId: string): Prisma.ConversationWhereInput => ({ kind: 'CRO', participants: { some: { userId } } });
const messages = (userId: string): Prisma.MessageWhereInput => ({ internal: false, conversation: conversations(userId) });
const incoming = (userId: string): Prisma.MessageWhereInput => ({ OR: [{ senderId: { not: userId } }, { senderId: null }] });
const opened = (userId: string): Prisma.MessageAttachmentWhereInput => ({ OR: [
  { message: { senderId: userId }, opens: { some: { user: { role: 'ADMIN' }, userId: { not: userId } } } },
  { message: incoming(userId), opens: { some: { userId } } },
] });
const attachments = (userId: string): Prisma.MessageAttachmentWhereInput => ({ file: { deletedAt: null }, message: messages(userId) });

async function announcementScope(userId: string): Promise<Prisma.AnnouncementWhereInput> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  return { status: 'SENT', sentAt: { lte: new Date() }, OR: [
    { audience: { in: ['All Members', 'Members Only'] } },
    { deliveries: { some: { OR: [{ recipientUserId: userId }, { recipientEmail: user.email }] } } },
  ] };
}

export async function summary(userId: string) {
  const announcementWhere = await announcementScope(userId);
  const [exchange, documents, unreadDocuments, threads, videos, announcements] = await prisma.$transaction([
    prisma.documentExchange.findUnique({ where: { memberId: userId } }),
    prisma.messageAttachment.count({ where: attachments(userId) }),
    prisma.messageAttachment.count({ where: { AND: [attachments(userId), { message: incoming(userId) }, { NOT: opened(userId) }] } }),
    prisma.conversation.count({ where: conversations(userId) }),
    prisma.sharedLink.count({ where: { kind: 'VIDEO', message: messages(userId) } }),
    prisma.announcement.count({ where: announcementWhere }),
  ]);
  return { conversationId: exchange?.conversationId ?? null, counts: { documents, messages: threads, videos, announcements }, unreadDocuments,
    upload: { maxBytes: env.MAX_UPLOAD_MB * 1024 * 1024, maxFiles: 5, mimeTypes: DOCUMENT_MIME_TYPES, extensions: DOCUMENT_EXTENSIONS } };
}

export async function listDocuments(userId: string, raw: unknown) {
  const query = documentsQuery.parse(raw);
  const where: Prisma.MessageAttachmentWhereInput = { AND: [
    attachments(userId),
    ...(query.q ? [{ OR: [{ file: { originalName: { contains: query.q } } }, { message: { body: { contains: query.q } } }] }] : []),
    ...(query.type !== 'All' ? [{ file: { mimeType: { in: DOCUMENT_MIME_TYPES.filter(m => documentKind(m) === query.type) } } }] : []),
    ...(query.direction === 'outgoing' ? [{ message: { senderId: userId } }] : query.direction === 'incoming' ? [{ message: incoming(userId) }] : []),
    ...(query.opened === 'opened' ? [opened(userId)] : query.opened === 'unopened' ? [{ NOT: opened(userId) }] : []),
  ] };
  const [rows, total] = await prisma.$transaction([
    prisma.messageAttachment.findMany({ where, include: { file: true, message: true, opens: { include: { user: { select: { role: true } } }, orderBy: { openedAt: 'asc' } } },
      orderBy: [{ message: { createdAt: 'desc' } }, { id: 'desc' }], ...toSkipTake(query) }),
    prisma.messageAttachment.count({ where }),
  ]);
  return buildPaginatedResult(rows.map(row => {
    const outgoing = row.message.senderId === userId;
    const receipt = row.opens.find(o => outgoing ? o.user.role === 'ADMIN' && o.userId !== userId : o.userId === userId);
    return { id: row.fileId, attachmentId: row.id, conversationId: row.message.conversationId, name: row.file.originalName, type: row.file.mimeType,
      size: row.file.sizeBytes, sender: row.message.senderName, direction: outgoing ? 'outgoing' : 'incoming', date: row.message.createdAt,
      note: row.message.body, openedAt: receipt?.openedAt ?? null, opened: !!receipt };
  }), total, query);
}

export async function listItems(userId: string, raw: unknown) {
  const query = itemsQuery.parse(raw);
  if (query.type === 'announcements') {
    const where = await announcementScope(userId);
    const [rows, total] = await prisma.$transaction([
      prisma.announcement.findMany({ where, select: { id: true, subject: true, body: true, sentAt: true }, orderBy: [{ sentAt: 'desc' }, { id: 'desc' }], ...toSkipTake(query) }),
      prisma.announcement.count({ where }),
    ]);
    return buildPaginatedResult(rows, total, query);
  }
  if (query.type === 'videos') {
    const where = { kind: 'VIDEO', message: messages(userId) };
    const [rows, total] = await prisma.$transaction([
      prisma.sharedLink.findMany({ where, include: { message: true }, orderBy: [{ message: { createdAt: 'desc' } }, { id: 'desc' }], ...toSkipTake(query) }),
      prisma.sharedLink.count({ where }),
    ]);
    return buildPaginatedResult(rows.map(l => ({ id: l.id, url: l.url, label: l.label, sender: l.message.senderName, date: l.message.createdAt,
      direction: l.message.senderId === userId ? 'outgoing' : 'incoming', conversationId: l.message.conversationId })), total, query);
  }
  const where = conversations(userId);
  const [rows, total] = await prisma.$transaction([
    prisma.conversation.findMany({ where, include: { participants: { where: { userId } }, messages: { where: { internal: false }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 }, _count: { select: { messages: { where: { internal: false } } } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], ...toSkipTake(query) }),
    prisma.conversation.count({ where }),
  ]);
  const unread = rows.length ? await prisma.message.groupBy({ by: ['conversationId'], where: { internal: false, ...incoming(userId), AND: [{ OR: rows.map(row => ({ conversationId: row.id, ...(row.participants[0]?.lastReadAt ? { createdAt: { gt: row.participants[0].lastReadAt } } : {}) })) }] }, _count: true }) : [];
  return buildPaginatedResult(rows.map(row => ({ id: row.id, subject: row.subject, status: row.status, lastActivity: row.messages[0]?.createdAt ?? row.createdAt,
    lastPreview: row.messages[0]?.body ?? '', totalMessages: row._count.messages, unreadCount: unread.find(u => u.conversationId === row.id)?._count ?? 0 })), total, query);
}

async function verifyFiles(tx: Prisma.TransactionClient, userId: string, ids: string[]) {
  if (new Set(ids).size !== ids.length) throw ApiError.unprocessable('Select each file only once.');
  const files = await tx.fileObject.findMany({ where: { id: { in: ids }, uploaderId: userId, deletedAt: null, visibility: 'PRIVATE' } });
  if (files.length !== ids.length) throw ApiError.notFound('Uploaded document not found');
  const { fileTypeFromFile } = await import('file-type');
  for (const file of files) {
    if (!DOCUMENT_MIME_TYPES.includes(file.mimeType) || file.sizeBytes < 1 || file.sizeBytes > env.MAX_UPLOAD_MB * 1024 * 1024) throw ApiError.unprocessable('Unsupported document or file size.');
    const bytes = await fs.readFile(assertSafePath(file.storageKey)).catch(() => { throw ApiError.notFound('Uploaded document not found'); });
    if (bytes.length !== file.sizeBytes || crypto.createHash('sha256').update(bytes).digest('hex') !== file.checksum) throw ApiError.unprocessable('Document contents changed. Upload the file again.');
    const mime = (await fileTypeFromFile(assertSafePath(file.storageKey)))?.mime;
    const text = ['text/plain', 'text/csv'].includes(file.mimeType) && !bytes.includes(0) && !mime;
    const legacyOffice = ['application/msword', 'application/vnd.ms-powerpoint'].includes(file.mimeType) && mime === 'application/x-cfb';
    if (!text && mime !== file.mimeType && !legacyOffice) throw ApiError.unprocessable('Document contents do not match its type.');
  }
}

export async function send(userId: string, input: ExchangeSend) {
  // Serialize first sends and retries for this member, including on multiple API processes.
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findFirst({ where: { id: userId, role: 'MEMBER', status: 'ACTIVE', deletedAt: null } });
    if (!user) throw ApiError.forbidden('An active membership is required.');
    const existing = await tx.message.findUnique({ where: { senderId_clientRequestId: { senderId: userId, clientRequestId: input.clientRequestId } } });
    if (existing) return { conversationId: existing.conversationId, messageId: existing.id, replayed: true };
    exchangeSendSchema.parse(input);
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    if (!admins.length) throw new ApiError(503, 'CRO delivery is temporarily unavailable. Please retry.', [], { retryable: true });
    if (input.type === 'document') await verifyFiles(tx, userId, input.fileIds);
    let exchange = await tx.documentExchange.findUnique({ where: { memberId: userId } });
    if (!exchange) {
      const thread = await tx.conversation.create({ data: { subject: 'Document Exchange', category: 'Document Exchange', kind: 'CRO', participants: { create: { userId, roleLabel: 'Member' } } } });
      exchange = await tx.documentExchange.create({ data: { memberId: userId, conversationId: thread.id } });
    }
    const conversationId = exchange.conversationId;
    for (const admin of admins) await tx.conversationParticipant.upsert({ where: { conversationId_userId: { conversationId, userId: admin.id } }, create: { conversationId, userId: admin.id, roleLabel: 'CRO Office' }, update: {} });
    const body = input.type === 'message' ? input.body : input.type === 'document' ? input.note || 'Shared documents' : input.type === 'video' ? 'Shared video link' : input.subject;
    const message = await tx.message.create({ data: {
      conversationId, senderId: userId, senderName: user.fullName, senderRole: user.role, body, clientRequestId: input.clientRequestId,
      ...(input.type === 'document' ? { attachments: { create: input.fileIds.map(fileId => ({ fileId })) } } : {}),
      ...(input.type === 'video' ? { sharedLinks: { create: { url: input.url, kind: 'VIDEO' } } } : {}),
      ...(input.type === 'meeting' ? { meetingRequestedAt: DateTime.fromISO(input.dateTime, { zone: input.timezone }).toUTC().toJSDate(), meetingTimezone: input.timezone } : {}),
    } });
    await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: message.createdAt } });
    await tx.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: message.createdAt } });
    await tx.notification.createMany({ data: admins.map(a => ({ userId: a.id, title: 'Document Exchange', body: `${user.fullName}: ${body.slice(0, 200)}`, type: 'message', link: `/admin/messages/${conversationId}` })) });
    return { conversationId, messageId: message.id, replayed: false };
  }, { timeout: 30000 });
}

export async function recordOpening(attachmentId: string, userId: string, action: 'preview' | 'download') {
  await prisma.attachmentOpen.upsert({ where: { attachmentId_userId: { attachmentId, userId } }, create: { attachmentId, userId, action }, update: {} });
}
