import { effectiveSettings } from './settings.service';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config';
import { ApiError } from '../utils/ApiError';
import { hashPassword, verifyPassword } from '../utils/security';
import { securityAudit, writeAudit } from './audit.service';
import { designations, preferenceDefaults, updateProfileBody, passwordBody } from '../domain/admin-profile';
import { buildPaginatedResult, paginationQuerySchema, toSkipTake } from '../utils/pagination';


export async function lockAdmin(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
  const user = await tx.user.findFirst({ where: { id: userId, role: 'ADMIN', status: 'ACTIVE', deletedAt: null } });
  if (!user) throw new ApiError(401, 'An active administrator account is required.');
  return user;
}
export async function getProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { adminProfile: true } });
  const p = user.adminProfile;
  const profile = { firstName: p?.firstName ?? '', lastName: p?.lastName ?? '', displayName: p?.displayName ?? '', designation: p?.designation ?? '', jobTitle: p?.jobTitle ?? '', workEmail: p?.workEmail ?? '', phone: p?.phone ?? '', institution: p?.institution ?? '', country: p?.country ?? '', timezone: p?.timezone ?? 'UTC', orcid: p?.orcid ?? '', website: p?.website ?? '', bio: p?.bio ?? '' };
  return { profile, preferences: { appNewMember: p?.appNewMember ?? true, supportUrgent: p?.supportUrgent ?? true, supportAll: p?.supportAll ?? false, inquiryNew: p?.inquiryNew ?? false }, revision: p?.revision ?? 0, avatarFileId: p?.avatarFileId ?? null,
    account: { id: user.id, fullName: user.fullName, loginEmail: user.email, role: user.role, status: user.status },
    defaults: preferenceDefaults, policy: { avatarMaxBytes: env.ADMIN_AVATAR_MAX_UPLOAD_MB * 1024 * 1024, avatarFormats: ['image/jpeg', 'image/png', 'image/webp'], passwordMinCharacters: 14, passwordMaxBytes: 72, bioMaxLength: 600, timezones: [...new Set(['UTC', 'Asia/Kolkata', ...Intl.supportedValuesOf('timeZone')])].sort(), designations },
    capabilities: { mfa: false, apiTokens: false, supportedPreferences: Object.keys(preferenceDefaults), emailConfigured: env.mailConfigured, emailWorkerEnabled: env.ADMIN_EMAIL_WORKER_ENABLED } };
}
export async function updateProfile(userId: string, input: z.infer<typeof updateProfileBody>) {
  await prisma.$transaction(async tx => {
    const user = await lockAdmin(tx, userId);
    const previous = await tx.adminProfile.findUnique({ where: { userId } });
    if ((previous?.revision ?? 0) !== input.expectedRevision) throw ApiError.conflict('Profile changed in another session. Refresh and review before saving.');
    const data = { ...input.profile, ...input.preferences };
    const changed = Object.keys(data).filter(key => {
      const old = previous ? previous[key as keyof typeof previous] : key in preferenceDefaults ? preferenceDefaults[key as keyof typeof preferenceDefaults] : key === 'timezone' ? 'UTC' : '';
      return (old ?? '') !== data[key as keyof typeof data];
    });
    const fullName = input.profile ? [input.profile.firstName, input.profile.lastName].filter(Boolean).join(' ') : user.fullName;
    if (!changed.length && fullName === user.fullName) return;
    await tx.adminProfile.upsert({ where: { userId }, create: { userId, ...data, revision: 1 }, update: { ...data, revision: { increment: 1 } } });
    if (fullName !== user.fullName) await tx.user.update({ where: { id: userId }, data: { fullName } });
    for (const [action, keys] of [['AdminProfileUpdated', changed.filter(k => !(k in preferenceDefaults))], ['AdminPreferencesUpdated', changed.filter(k => k in preferenceDefaults)]] as const) {
      if (keys.length) await writeAudit({ actorId: userId, action, entity: `User ${userId}`, metadata: { changedFields: keys } }, tx);
    }
  });
  return getProfile(userId);
}
export async function changePassword(userId: string, sessionId: string, input: z.infer<typeof passwordBody>) {
  const nextHash = await hashPassword(input.password);
  await prisma.$transaction(async tx => {
    const user = await lockAdmin(tx, userId);
    if (!user.passwordHash || !await verifyPassword(input.currentPassword, user.passwordHash)) throw new ApiError(422, 'Current password is incorrect.', [{ field: 'currentPassword', message: 'Current password is incorrect.' }]);
    if (await verifyPassword(input.password, user.passwordHash)) throw ApiError.unprocessable('Choose a different password.');
    const now = new Date();
    await tx.user.update({ where: { id: userId }, data: { passwordHash: nextHash, passwordChangedAt: now } });
    await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
    await tx.session.updateMany({ where: { userId, id: { not: sessionId }, revokedAt: null }, data: { revokedAt: now } });
    await writeAudit({ actorId: userId, action: 'AdminPasswordChanged', entity: `User ${userId}`, metadata: { changedFields: ['password'] } }, tx);
  }).catch(async error => {
    if (error instanceof ApiError && error.statusCode === 422) await securityAudit({ actorId: userId, action: 'AdminPasswordChangeFailed', entity: `User ${userId}`, outcome: 'DENIED' });
    throw error;
  });
  return { changed: true };
}
export async function sessions(userId: string, currentId: string, raw: unknown) {
  const q = paginationQuerySchema.parse(raw), where = { userId, revokedAt: null, expiresAt: { gt: new Date() } };
  const total = await prisma.session.count({ where }); q.page = Math.min(q.page, Math.max(1, Math.ceil(total / q.limit)));
  const rows = await prisma.session.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...toSkipTake(q), select: { id: true, createdAt: true, expiresAt: true, ipAddress: true, userAgent: true } });
  return buildPaginatedResult(rows.map(s => ({ ...s, userAgent: s.userAgent?.slice(0, 512) ?? null, current: s.id === currentId })), total, q);
}
export async function revokeSessions(userId: string, currentId: string, id?: string) {
  return prisma.$transaction(async tx => {
    await lockAdmin(tx, userId);
    if (id && !await tx.session.findFirst({ where: { id, userId } })) throw ApiError.notFound('Session not found.');
    const result = await tx.session.updateMany({ where: { userId, ...(id ? { id } : { id: { not: currentId } }), revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
    if (result.count) await writeAudit({ actorId: userId, action: 'AdminSessionsRevoked', entity: `User ${userId}`, metadata: { count: result.count } }, tx);
    return { revoked: result.count, signedOut: id === currentId };
  });
}
export async function overview(userId: string) {
  const { review } = await effectiveSettings();
  const [user, activeSessions, activity, approvals, membership, publications, publicationSla, support, supportSla, inquiries] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordChangedAt: true, lastLoginAt: true } }),
    prisma.session.count({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.auditLog.findMany({ where: { actorId: userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 6, select: { id: true, createdAt: true, action: true, entity: true, severity: true, description: true } }),
    recentApprovals(userId),
    prisma.membershipApplication.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] }, user: { deletedAt: null } } }),
    prisma.publication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.publication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }, submittedAt: { lte: new Date(Date.now() - review.publicationDays * 86400000) } } }),
    prisma.supportRequest.count({ where: { assignedAdminId: userId, status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
    prisma.supportRequest.count({ where: { assignedAdminId: userId, status: { in: ['PENDING', 'UNDER_REVIEW'] }, createdAt: { lte: new Date(Date.now() - review.supportDays * 86400000) } } }),
    prisma.contactInquiry.count({ where: { status: { in: ['NEW', 'ASSIGNED'] } } }),
  ]);
  return { security: { ...user, activeSessions }, activity, approvals, queues: [
    { name: 'Membership Applications · Shared', open: membership, slaBreach: null, link: '/admin/members/pending' },
    { name: 'Publication Review · Shared', open: publications, slaBreach: publicationSla, link: '/admin/publications' },
    { name: 'Support Requests · Assigned to you', open: support, slaBreach: supportSla, link: '/admin/support' },
    { name: 'Inquiries · Shared', open: inquiries, slaBreach: null, link: '/admin/inquiries' },
  ] };
}

async function recentApprovals(userId: string) {
  const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
  const [memberships, projects, publications, support] = await Promise.all([
    prisma.applicationStatusHistory.findMany({ where: { actorId: userId, toStatus: 'APPROVED' }, orderBy, take: 3, include: { application: { include: { user: { select: { fullName: true } } } } } }),
    prisma.projectStatusHistory.findMany({ where: { actorId: userId, toStatus: 'APPROVED' }, orderBy, take: 3, include: { project: { select: { title: true } } } }),
    prisma.publicationStatusHistory.findMany({ where: { actorId: userId, toStatus: 'APPROVED' }, orderBy, take: 3, include: { publication: { select: { title: true } } } }),
    prisma.supportRequestHistory.findMany({ where: { actorId: userId, toStatus: 'APPROVED', OR: [{ fromStatus: null }, { fromStatus: { not: 'APPROVED' } }] }, orderBy, take: 3, include: { request: { select: { subject: true } } } }),
  ]);
  return [
    ...memberships.map(r => ({ id: r.id, createdAt: r.createdAt, action: 'Membership', entity: r.application.user.fullName })),
    ...projects.map(r => ({ id: r.id, createdAt: r.createdAt, action: 'Project', entity: r.project.title })),
    ...publications.map(r => ({ id: r.id, createdAt: r.createdAt, action: 'Publication', entity: r.publication.title })),
    ...support.map(r => ({ id: r.id, createdAt: r.createdAt, action: 'Support Request', entity: r.request.subject })),
  ].sort((a, b) => +b.createdAt - +a.createdAt || b.id.localeCompare(a.id)).slice(0, 3);
}
