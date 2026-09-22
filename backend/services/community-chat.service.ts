import { changesBetween, safeChanges } from './audit.service';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResult, toSkipTake } from '../utils/pagination';
import * as input from '../domain/community';
import { access, audit, locked, moderatorScope, type Actor, type DB } from './community-access.service';
import { fileUrl } from './community.service';
import { saveFiles } from './community-upload.service';

const baseInclude = (actor: Actor) => ({
  sender: { select: { fullName: true, role: true, communityMemberships: { select: { communityId: true, role: true } } } },
  conversation: true, attachments: { include: { file: true } }, reads: { where: { userId: actor.id } },
}) satisfies Prisma.CommunityMessageInclude;
export const messageInclude = (actor: Actor) => ({ ...baseInclude(actor), replyTo: { include: baseInclude(actor) } }) satisfies Prisma.CommunityMessageInclude;
type BaseRow = Prisma.CommunityMessageGetPayload<{ include: ReturnType<typeof baseInclude> }>;
type MessageRow = Prisma.CommunityMessageGetPayload<{ include: ReturnType<typeof messageInclude> }>;
export function messageDto(row: BaseRow | MessageRow, manage: boolean) {
  const content = row.deletedAt ? '' : row.content;
  const basic = (r: BaseRow) => ({
    id: r.id, conversationId: r.conversationId, senderId: r.senderId, senderName: r.sender.fullName,
    senderRole: r.sender.role === 'ADMIN' ? 'ADMIN' : r.sender.communityMemberships.find(m => m.communityId === r.conversation.communityId)?.role ?? 'MEMBER',
    content: r.deletedAt ? '' : r.content, isPinned: r.isPinned, isHidden: r.isHidden, isDeleted: !!r.deletedAt,
    isRead: r.reads.length > 0, createdAt: r.createdAt, updatedAt: r.updatedAt,
    attachments: r.deletedAt ? [] : r.attachments.filter(a => !a.file.deletedAt).map(a => ({ id: a.id, fileName: a.file.originalName, fileUrl: fileUrl(a.fileId), fileType: a.file.mimeType, fileSize: a.file.sizeBytes })),
  });
  const parent = 'replyTo' in row ? row.replyTo : null;
  return { ...basic(row), content, replyTo: parent && (!parent.isHidden || manage) ? basic(parent) : null };
}
const visibleMessages = (manage: boolean): Prisma.CommunityMessageWhereInput => manage ? {} : { isHidden: false };
export async function conversationAccess(actor: Actor, id: string, manage: boolean, db: DB = prisma) {
  const row = await db.communityConversation.findUnique({ where: { id }, include: { community: true } });
  if (!row) throw ApiError.notFound('Conversation not found');
  await access(actor, row.communityId, manage ? 'manage' : 'member', db);
  return row;
}
async function conversationDto(actor: Actor, row: Awaited<ReturnType<typeof conversationAccess>>, manage: boolean, db: DB = prisma) {
  const where = { conversationId: row.id, deletedAt: null, ...visibleMessages(manage) };
  const [messageCount, unreadCount, last] = await Promise.all([
    db.communityMessage.count({ where }),
    db.communityMessage.count({ where: { ...where, senderId: { not: actor.id }, reads: { none: { userId: actor.id } } } }),
    db.communityMessage.findFirst({ where, include: messageInclude(actor), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
  ]);
  return { id: row.id, communityId: row.communityId, communityName: row.community.name, title: row.title, description: row.description ?? undefined,
    isLocked: row.isLocked || row.community.status !== 'ACTIVE', createdAt: row.createdAt, updatedAt: row.updatedAt, messageCount, unreadCount,
    lastMessage: last ? messageDto(last, manage) : undefined,
  };
}
export async function conversations(actor: Actor, raw: unknown, manage = false, communityId?: string) {
  const q = input.communityQuery.parse(raw);
  if (!manage) { if (!communityId) throw ApiError.unprocessable(); await access(actor, communityId, 'member'); }
  const where: Prisma.CommunityConversationWhereInput = { ...(manage ? { community: moderatorScope(actor) } : {}),
    ...(communityId || q.communityId ? { communityId: communityId ?? q.communityId } : {}),
    ...(q.search ? { OR: [{ title: { contains: q.search } }, { community: { name: { contains: q.search } } }] } : {}),
  };
  const total = await prisma.communityConversation.count({ where });
  q.page = Math.min(q.page, Math.max(1, Math.ceil(total / q.limit)));
  const rows = await prisma.communityConversation.findMany({ where, include: { community: true }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], ...toSkipTake(q) });
  return buildPaginatedResult(await Promise.all(rows.map(r => conversationDto(actor, r, manage))), total, q);
}
export async function messages(actor: Actor, id: string, raw: unknown, manage = false) {
  const q = input.communityQuery.parse(raw);
  const conversation = await conversationAccess(actor, id, manage);
  const where: Prisma.CommunityMessageWhereInput = { conversationId: id, ...visibleMessages(manage), ...(q.before ? { createdAt: { lt: new Date(q.before) } } : {}) };
  const [total, rows] = await prisma.$transaction([
    prisma.communityMessage.count({ where }),
    prisma.communityMessage.findMany({ where, include: messageInclude(actor), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...toSkipTake(q) }),
  ]);
  await prisma.communityMembership.updateMany({ where: { communityId: conversation.communityId, userId: actor.id, removedAt: null, status: 'ACTIVE' }, data: { lastActiveAt: new Date() } });
  return buildPaginatedResult(rows.reverse().map(r => messageDto(r, manage)), total, q);
}
export async function send(actor: Actor, id: string, raw: unknown, files: Express.Multer.File[], manage = false) {
  const body = input.messageBody.parse(raw);
  const row = await conversationAccess(actor, id, manage);
  return locked(actor, row.communityId, manage ? 'manage' : 'member', async (db, { community }) => {
    const conversation = await db.communityConversation.findUniqueOrThrow({ where: { id } });
    if (community.status !== 'ACTIVE' || conversation.isLocked) throw ApiError.conflict('This conversation is locked.');
    if (body.replyToId && !await db.communityMessage.findFirst({ where: { id: body.replyToId, conversationId: id, deletedAt: null, isHidden: false } })) throw ApiError.unprocessable('Reply target is unavailable.', [{ field: 'replyToId', message: 'Select a visible message in this conversation.' }]);
    const stored = await saveFiles(db, actor, files);
    const message = await db.communityMessage.create({ data: { ...body, conversationId: id, senderId: actor.id,
      attachments: { create: stored.map(f => ({ fileId: f.id })) }, reads: { create: { userId: actor.id } },
    }, include: messageInclude(actor) });
    await db.communityConversation.update({ where: { id }, data: { updatedAt: new Date() } });
    await db.communityMembership.updateMany({ where: { communityId: row.communityId, userId: actor.id, removedAt: null }, data: { lastActiveAt: new Date() } });
    await audit(db, actor, 'MessageSent', message.id);
    return messageDto(message, manage);
  });
}
export async function changeMessage(actor: Actor, id: string, raw: unknown, manage = false, remove = false) {
  const patch = remove ? {} : manage ? input.messagePatch.parse(raw) : input.messageBody.omit({ replyToId: true }).parse(raw);
  const row = await prisma.communityMessage.findUnique({ where: { id }, include: { conversation: true } });
  if (!row) throw ApiError.notFound('Message not found');
  return locked(actor, row.conversation.communityId, manage ? 'manage' : 'member', async db => {
    const current = await db.communityMessage.findUniqueOrThrow({ where: { id }, include: { conversation: true } });
    if (current.deletedAt || (!manage && (current.senderId !== actor.id || current.isHidden))) throw ApiError.notFound('Message not found');
    if (!manage && current.conversation.isLocked && !remove) throw ApiError.conflict('This conversation is locked.');
    if ('content' in patch && current.senderId !== actor.id) throw ApiError.forbidden('Only the author can edit message text.');
    const { isRead, ...fields } = patch as { isRead?: boolean; content?: string; isPinned?: boolean; isHidden?: boolean };
    if (isRead !== undefined) {
      const read = await db.communityMessageRead.findUnique({ where: { messageId_userId: { messageId: id, userId: actor.id } } });
      if (!!read !== isRead) await audit(db, actor, isRead ? 'MessageRead' : 'MessageUnread', id, { read: { before: !!read, after: isRead } });
      if (isRead) await db.communityMessageRead.upsert({ where: { messageId_userId: { messageId: id, userId: actor.id } }, create: { messageId: id, userId: actor.id }, update: { readAt: new Date() } });
      else await db.communityMessageRead.deleteMany({ where: { messageId: id, userId: actor.id } });
    }
    const message = await db.communityMessage.update({ where: { id }, data: remove ? { deletedAt: new Date(), isPinned: false } : fields, include: messageInclude(actor) });
    if (remove || Object.entries(fields).some(([k, v]) => current[k as keyof typeof current] !== v)) await audit(db, actor, remove ? 'MessageDeleted' : 'MessageUpdated', id, safeChanges(changesBetween(current, message)));
    return remove ? null : messageDto(message, manage);
  });
}
export async function lockConversation(actor: Actor, id: string, isLocked: boolean) {
  const row = await conversationAccess(actor, id, true);
  return locked(actor, row.communityId, 'manage', async db => {
    const before = await db.communityConversation.findUniqueOrThrow({ where: { id } });
    const result = await db.communityConversation.update({ where: { id }, data: { isLocked }, include: { community: true } });
    if (before.isLocked !== isLocked) await audit(db, actor, isLocked ? 'ConversationLocked' : 'ConversationUnlocked', id, { isLocked: { before: before.isLocked, after: isLocked } });
    return conversationDto(actor, result, true, db);
  });
}
