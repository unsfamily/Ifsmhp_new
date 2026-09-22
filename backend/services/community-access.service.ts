import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../middleware/auth';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

export type Actor = AuthenticatedUser;
export type DB = Prisma.TransactionClient;
export const activeMembership = { status: 'ACTIVE', removedAt: null, user: { status: 'ACTIVE', deletedAt: null } } satisfies Prisma.CommunityMembershipWhereInput;
export const moderatorScope = (actor: Actor): Prisma.CommunityWhereInput => actor.role === 'ADMIN' ? { deletedAt: null } : {
  deletedAt: null, status: 'ACTIVE', memberships: { some: { userId: actor.id, ...activeMembership, role: 'MODERATOR' } },
};
export const memberScope: Prisma.CommunityWhereInput = { deletedAt: null, status: 'ACTIVE' };

export async function capabilities(actor: Actor, db: DB = prisma) {
  const communityIds = actor.role === 'MEMBER' ? (await db.communityMembership.findMany({ where: {
    userId: actor.id, ...activeMembership, role: 'MODERATOR', community: memberScope,
  }, select: { communityId: true } })).map(m => m.communityId) : [];
  return { isAdmin: actor.role === 'ADMIN', canModerate: actor.role === 'ADMIN' || communityIds.length > 0, communityIds };
}
export function assertAdmin(actor: Actor) { if (actor.role !== 'ADMIN') throw ApiError.forbidden(); }
export async function access(actor: Actor, communityId: string, mode: 'discover' | 'member' | 'manage', db: DB = prisma) {
  const community = await db.community.findFirst({ where: { id: communityId, ...(mode === 'manage' ? moderatorScope(actor) : memberScope) } });
  if (!community) throw ApiError.notFound('Community not found');
  const membership = await db.communityMembership.findUnique({ where: { communityId_userId: { communityId, userId: actor.id } } });
  if (mode === 'member' && actor.role !== 'ADMIN' && (!membership || membership.removedAt || membership.status !== 'ACTIVE')) throw ApiError.notFound('Community membership required');
  return { community, membership };
}
// Serializes membership/lifecycle changes with content writes. All community mutations
// take this same parent lock, then re-check their authorization inside the transaction.
export async function locked<T>(actor: Actor, communityId: string, mode: 'discover' | 'member' | 'manage', work: (db: DB, context: Awaited<ReturnType<typeof access>>) => Promise<T>) {
  return prisma.$transaction(async db => {
    await db.$queryRaw`SELECT id FROM Community WHERE id = ${communityId} FOR UPDATE`;
    return work(db, await access(actor, communityId, mode, db));
  });
}
export async function audit(db: DB, actor: Actor, action: string, entity: string, changes?: Prisma.InputJsonValue) {
  await db.auditLog.create({ data: { actorId: actor.id, actorLabel: actor.id, actorRole: actor.role, action: `Community${action}`, entity, description: action, changes } });
}
export async function authorizeCommunityFile(actor: Actor, fileId: string, db: DB = prisma) {
  const asset = await db.community.findFirst({ where: { OR: [{ imageId: fileId }, { bannerId: fileId }], ...(actor.role === 'ADMIN' ? { deletedAt: null } : memberScope) } });
  if (asset) return;
  const attachment = await db.communityAttachment.findUnique({ where: { fileId }, include: { message: { include: { conversation: true } } } });
  if (!attachment || attachment.message.deletedAt) throw ApiError.notFound('File not found');
  const id = attachment.message.conversation.communityId;
  const manager = actor.role === 'ADMIN' || !!await db.community.findFirst({ where: { id, ...moderatorScope(actor) } });
  await access(actor, id, manager ? 'manage' : 'member', db);
  if (attachment.message.isHidden && !manager) throw ApiError.notFound('File not found');
}
