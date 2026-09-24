import { changesBetween, safeChanges } from './audit.service';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResult, toSkipTake } from '../utils/pagination';
import * as input from '../domain/community';
import { access, activeMembership, assertAdmin, audit, locked, memberScope, moderatorScope, type Actor, type DB } from './community-access.service';
import { saveFiles } from './community-upload.service';

export const fileUrl = (id: string) => `/files/${id}/download`;
const communityInclude = (actor: Actor) => ({ createdBy: { select: { fullName: true } }, memberships: { where: { userId: actor.id, removedAt: null } }, _count: { select: { memberships: { where: activeMembership }, conversations: true } } }) satisfies Prisma.CommunityInclude;
type CommunityRow = Prisma.CommunityGetPayload<{ include: ReturnType<typeof communityInclude> }>;
async function communityDto(row: CommunityRow, actor: Actor, manage: boolean, db: DB = prisma) {
  const canRead = manage || actor.role === 'ADMIN' || row.memberships[0]?.status === 'ACTIVE';
  return { id: row.id, name: row.name, slug: row.slug, description: row.description, category: row.category, visibility: row.visibility, status: row.status,
    imageUrl: row.imageId ? fileUrl(row.imageId) : undefined, bannerUrl: row.bannerId ? fileUrl(row.bannerId) : undefined,
    createdById: row.createdById, createdByName: row.createdBy.fullName, createdAt: row.createdAt, updatedAt: row.updatedAt,
    unreadCount: canRead ? await db.communityMessage.count({ where: { conversation: { communityId: row.id }, deletedAt: null, ...(!manage ? { isHidden: false } : {}), senderId: { not: actor.id }, reads: { none: { userId: actor.id } } } }) : undefined,
    memberCount: row._count.memberships, conversationCount: canRead ? row._count.conversations : undefined,
    messageCount: canRead ? await db.communityMessage.count({ where: { conversation: { communityId: row.id }, deletedAt: null, ...(!manage ? { isHidden: false } : {}) } }) : undefined,
    membershipStatus: row.memberships[0]?.status, membershipId: row.memberships[0]?.id,
  };
}
export async function communityDetail(actor: Actor, id: string, manage = false, db: DB = prisma) {
  await access(actor, id, manage ? 'manage' : 'discover', db);
  const row = await db.community.findUniqueOrThrow({ where: { id }, include: communityInclude(actor) });
  return communityDto(row, actor, manage, db);
}
export async function communities(actor: Actor, raw: unknown, manage = false, mine = false) {
  const q = input.communityQuery.parse(raw);
  if (q.status && !['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(q.status)) throw ApiError.unprocessable('Invalid community status.');
  const where: Prisma.CommunityWhereInput = { AND: [manage ? moderatorScope(actor) : memberScope,
    ...(mine ? [{ memberships: { some: { userId: actor.id, removedAt: null } } }] : []),
    ...(q.search ? [{ OR: [{ name: { contains: q.search } }, { description: { contains: q.search } }, { category: { contains: q.search } }] }] : []),
    ...(q.category ? [{ category: q.category }] : []), ...(q.visibility ? [{ visibility: q.visibility }] : []),
    ...(q.status ? [{ status: input.communityStatus.parse(q.status) }] : []),
  ] };
  const total = await prisma.community.count({ where });
  q.page = Math.min(q.page, Math.max(1, Math.ceil(total / q.limit)));
  // Prisma cannot order by a filtered relation count. Sort the candidate IDs by
  // active memberships so pending/blocked records never inflate the displayed sort.
  let ids: string[] | undefined;
  if (q.sort === 'memberCount:desc') {
    const candidates = await prisma.community.findMany({ where, select: { id: true, _count: { select: { memberships: { where: activeMembership } } } } });
    ids = candidates.sort((a, b) => b._count.memberships - a._count.memberships || a.id.localeCompare(b.id)).slice((q.page - 1) * q.limit, q.page * q.limit).map(c => c.id);
  }
  const rows = await prisma.community.findMany({ where: ids ? { id: { in: ids } } : where, include: communityInclude(actor),
    orderBy: q.sort === 'name:asc' ? [{ name: 'asc' }, { id: 'asc' }] : [{ createdAt: q.sort === 'createdAt:asc' ? 'asc' : 'desc' }, { id: 'desc' }], ...(!ids ? toSkipTake(q) : {}),
  });
  if (ids) rows.sort((a, b) => ids!.indexOf(a.id) - ids!.indexOf(b.id));
  return buildPaginatedResult(await Promise.all(rows.map(row => communityDto(row, actor, manage))), total, q);
}
export async function options(actor: Actor, manage = false) {
  const rows = await prisma.community.findMany({ where: manage ? moderatorScope(actor) : memberScope, select: { id: true, name: true, category: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  return { communities: rows.map(({ id, name }) => ({ id, name })), categories: [...new Set(rows.map(r => r.category))].sort() };
}
export async function saveCommunity(actor: Actor, raw: unknown, files: Express.Multer.File[], id?: string) {
  assertAdmin(actor);
  const data = input.communityBody.parse(raw);
  const work = async (db: DB) => {
    const before = id ? await db.community.findUnique({ where: { id } }) : null;
    const stored = await saveFiles(db, actor, files);
    const assets = Object.fromEntries(files.map((f, i) => [`${f.fieldname}Id`, stored[i]!.id]));
    const community = id ? await db.community.update({ where: { id }, data: { ...data, ...assets } }) : await db.community.create({ data: {
      ...data, ...assets, createdById: actor.id, conversations: { create: { title: 'General' } },
      memberships: { create: { userId: actor.id, role: 'ADMIN', status: 'ACTIVE', joinedAt: new Date() } },
    } });
    if (!before || files.length || Object.entries(data).some(([k, v]) => JSON.stringify(before[k as keyof typeof before]) !== JSON.stringify(v))) await audit(db, actor, id ? 'Updated' : 'Created', community.id, safeChanges(changesBetween(before, community)));
    return communityDetail(actor, community.id, true, db);
  };
  try { return id ? await locked(actor, id, 'manage', work) : await prisma.$transaction(work); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'This community slug is already in use.', [{ field: 'slug', message: 'Choose a different slug.' }]);
    throw error;
  }
}
export async function changeCommunity(actor: Actor, id: string, status?: unknown) {
  assertAdmin(actor);
  const next = status === undefined ? undefined : input.communityStatus.parse(status);
  return locked(actor, id, 'manage', async (db, { community }) => {
    if (next === community.status) return communityDetail(actor, id, true, db);
    await db.community.update({ where: { id }, data: next ? { status: next } : { deletedAt: new Date() } });
    await audit(db, actor, next ? 'StatusChanged' : 'Deleted', id, next ? { status: { before: community.status, after: next } } : undefined);
    return next ? communityDetail(actor, id, true, db) : null;
  });
}
export async function membershipAction(actor: Actor, id: string, action: 'join' | 'cancel' | 'leave') {
  if (actor.role !== 'MEMBER') throw ApiError.forbidden('Only members can join or leave communities.');
  return locked(actor, id, 'discover', async (db, { community, membership }) => {
    if (membership && !membership.removedAt && ['REJECTED', 'SUSPENDED', 'BLOCKED'].includes(membership.status)) throw ApiError.forbidden('Your membership does not permit this action.');
    if (action === 'join') {
      if (!membership || membership.removedAt) {
        const status = community.visibility === 'PUBLIC' ? 'ACTIVE' : 'PENDING';
        const data = { status, role: 'MEMBER' as const, removedAt: null, requestedAt: new Date(), joinedAt: status === 'ACTIVE' ? new Date() : null, reason: null } as const;
        await db.communityMembership.upsert({ where: { communityId_userId: { communityId: id, userId: actor.id } }, create: { communityId: id, userId: actor.id, ...data }, update: data });
        await audit(db, actor, 'Joined', id, { status: { before: membership?.status ?? null, after: status } });
      }
    } else {
      if (!membership || membership.removedAt || membership.status !== (action === 'cancel' ? 'PENDING' : 'ACTIVE')) throw ApiError.notFound('Membership not found');
      await db.communityMembership.update({ where: { id: membership.id }, data: { removedAt: new Date(), role: 'MEMBER' } });
      await audit(db, actor, action === 'cancel' ? 'JoinCancelled' : 'Left', id);
    }
    return communityDetail(actor, id, false, db);
  });
}
const memberInclude = { user: { select: { id: true, fullName: true, email: true, role: true } }, community: { select: { name: true } } } satisfies Prisma.CommunityMembershipInclude;
type MemberRow = Prisma.CommunityMembershipGetPayload<{ include: typeof memberInclude }>;
async function memberDto(row: MemberRow, manage: boolean, actor: Actor, db: DB = prisma) {
  const [communitiesJoined, messageCount, reportCount] = await Promise.all([
    db.communityMembership.count({ where: { userId: row.userId, ...activeMembership, community: { AND: [memberScope, ...(manage ? [moderatorScope(actor)] : [])] } } }),
    db.communityMessage.count({ where: { senderId: row.userId, conversation: { communityId: row.communityId }, deletedAt: null, ...(!manage ? { isHidden: false } : {}) } }),
    manage ? db.communityReport.count({ where: { reportedMemberId: row.id } }) : Promise.resolve(undefined),
  ]);
  return { id: row.id, userId: row.userId, communityId: row.communityId, fullName: row.user.fullName, email: manage ? row.user.email : undefined,
    role: row.role, status: row.status, communityName: row.community.name, joinedAt: row.joinedAt ?? undefined, requestedAt: row.requestedAt, lastActiveAt: row.lastActiveAt ?? undefined,
    communitiesJoined: manage ? communitiesJoined : undefined, messageCount, reportCount,
    ...(manage ? { availableStatusActions: availableMemberStatusActions(actor, row) } : {}),
  };
}
export async function members(actor: Actor, raw: unknown, communityId?: string) {
  const q = input.communityQuery.parse(raw);
  if (communityId) await access(actor, communityId, 'member');
  if (q.status && !input.membershipStatus.safeParse(q.status).success) throw ApiError.unprocessable('Invalid membership status.');
  const where: Prisma.CommunityMembershipWhereInput = { removedAt: null,
    ...(communityId ? { communityId, ...activeMembership } : { community: moderatorScope(actor), ...(q.communityId ? { communityId: q.communityId } : {}), ...(q.status ? { status: input.membershipStatus.parse(q.status) } : {}) }),
    ...(q.role ? { role: q.role } : {}), ...(q.search ? { user: { ...(communityId ? { status: 'ACTIVE', deletedAt: null } : {}), OR: [{ fullName: { contains: q.search } }, ...(!communityId ? [{ email: { contains: q.search } }] : [])] } } : {}),
  };
  const total = await prisma.communityMembership.count({ where });
  q.page = Math.min(q.page, Math.max(1, Math.ceil(total / q.limit)));
  const rows = await prisma.communityMembership.findMany({ where, include: memberInclude, orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }], ...toSkipTake(q) });
  return buildPaginatedResult(await Promise.all(rows.map(r => memberDto(r, !communityId, actor))), total, q);
}
export async function memberDetail(actor: Actor, id: string, db: DB = prisma) {
  const row = await db.communityMembership.findFirst({ where: { id, removedAt: null, community: moderatorScope(actor) }, include: memberInclude });
  if (!row) throw ApiError.notFound('Member not found');
  const messages = await db.communityMessage.findMany({ where: { senderId: row.userId, conversation: { communityId: row.communityId }, deletedAt: null }, select: { id: true, content: true, isHidden: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5 });
  return { ...await memberDto(row, true, actor, db), recentActivity: messages.map(m => ({ id: m.id, description: m.isHidden ? 'Hidden message' : m.content, createdAt: m.createdAt })) };
}
export function assertMemberTarget(actor: Actor, target: MemberRow) {
  if (target.user.role === 'ADMIN' || target.role === 'ADMIN' || target.userId === actor.id || (actor.role !== 'ADMIN' && target.role !== 'MEMBER')) throw ApiError.forbidden('This membership is protected.');
}
function availableMemberStatusActions(actor: Actor, target: MemberRow): input.MemberStatusAction[] {
  if (target.removedAt) return [];
  try { assertMemberTarget(actor, target); }
  catch (error) { if (error instanceof ApiError && error.statusCode === 403) return []; throw error; }
  return input.memberStatusTransitions[target.status].map(transition => transition.action);
}
export async function changeMember(actor: Actor, id: string, raw: unknown, kind: 'status' | 'role' | 'remove') {
  const row = await prisma.communityMembership.findUnique({ where: { id }, include: memberInclude });
  if (!row) throw ApiError.notFound('Member not found');
  if (kind === 'role') assertAdmin(actor);
  return locked(actor, row.communityId, 'manage', async db => {
    const target = await db.communityMembership.findUniqueOrThrow({ where: { id }, include: memberInclude });
    if (target.removedAt) throw ApiError.notFound('Member not found');
    assertMemberTarget(actor, target);
    let data: Prisma.CommunityMembershipUpdateInput;
    if (kind === 'role') {
      const body = input.memberRoleBody.parse(raw);
      if (target.status !== 'ACTIVE') throw ApiError.conflict('Only active members can be assigned a role.');
      data = body;
    } else if (kind === 'remove') data = { reason: input.reasonBody.parse(raw).reason, removedAt: new Date(), role: 'MEMBER' };
    else {
      const body = input.memberStatusBody.parse(raw);
      if (body.expectedStatus !== target.status) throw ApiError.conflict('Membership status changed. Refresh and review the current status before confirming another action.');
      const transition = input.memberStatusTransitions[target.status].find(item => item.status === body.status);
      if (!transition || !availableMemberStatusActions(actor, target).includes(transition.action)) throw ApiError.conflict('This status change is not available for the current membership.');
      data = { status: body.status, reason: body.reason || null,
        ...(transition.action === 'APPROVE' ? { joinedAt: target.joinedAt ?? new Date() } : {}) };

    }
    const updated = await db.communityMembership.update({ where: { id }, data });
    if (Object.entries(data).some(([k, v]) => JSON.stringify(target[k as keyof typeof target]) !== JSON.stringify(v))) await audit(db, actor, `Membership${kind}`, id, safeChanges(changesBetween(target, updated)));
    return kind === 'remove' ? null : memberDetail(actor, id, db);
  });
}
