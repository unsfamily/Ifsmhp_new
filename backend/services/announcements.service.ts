import { effectiveSettings } from './settings.service';
import { writeAudit, changesBetween } from './audit.service';
import { createHash } from 'node:crypto';
import type { Announcement, AnnouncementStatus, Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config';
import { ApiError } from '../utils/ApiError';
import { paginationQuerySchema, toSkipTake, buildPaginatedResult } from '../utils/pagination';
import { ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_STATUSES, announcementFields, announcementSchema, mutationFields, type AnnouncementInput } from '../domain/announcement-input';

export const createBody = announcementFields.extend({ sendSABPreview: z.boolean().optional() }).merge(mutationFields).strict();
export const updateBody = announcementFields.partial().merge(mutationFields.required()).strict();
export const actionBody = mutationFields.required().extend({ confirmed: z.boolean().optional() }).strict();
export const listQuery = paginationQuerySchema.extend({ q: z.string().trim().max(220).default(''), status: z.enum(ANNOUNCEMENT_STATUSES).default('All'), audience: z.enum(['All', ...ANNOUNCEMENT_AUDIENCES]).default('All') });
export const deliveryQuery = paginationQuerySchema.extend({ channel: z.enum(['All', 'EMAIL', 'IN_APP', 'LEGACY']).default('All'), purpose: z.enum(['All', 'BROADCAST', 'PREVIEW']).default('All') });
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const scientists = ['Research Scholar / Scientist', 'Academic Researcher', 'Doctoral Candidate', 'Scientist', 'Research Scholar'];
export const professionals = ['Psychiatrist', 'Psychologist', 'Counselor', 'Therapist', 'Social Worker', 'Other Mental Health Professional'];
export function recipientWhere(audience: string): Prisma.UserWhereInput {
  if (audience === 'Pending Applicants') return { role: 'APPLICANT', status: 'PENDING', deletedAt: null, membershipApplication: { status: 'PENDING' } };
  if (!['All Members', 'Members Only', 'Scientists Track', 'Professionals Track'].includes(audience)) return { id: { in: [] } };
  return { role: 'MEMBER', status: 'ACTIVE', deletedAt: null, ...(audience === 'Scientists Track' || audience === 'Professionals Track' ? { memberProfile: { professionalType: { in: audience === 'Scientists Track' ? scientists : professionals } } } : {}) };
}
/**
 * Which delivery rows a broadcast produces.
 *
 * Every member-audience announcement gets an IN_APP row whatever the channel,
 * so it always reaches the member Announcements list; the channel decides only
 * whether an email goes out alongside it. `Pending Applicants` is the exception:
 * applicants are `role: 'APPLICANT'`, and `announcementScope` only ever matches
 * active members, so an in-app row for them would never be read (`options()`
 * already reports `inApp: 0` for that audience).
 */
export const channelsFor = (channel: string, audience: string) =>
  audience === 'Pending Applicants' ? ['EMAIL'] : channel === 'In-App Only' ? ['IN_APP'] : ['EMAIL', 'IN_APP'];
export async function options() {
  const audiences = await Promise.all(ANNOUNCEMENT_AUDIENCES.map(async name => {
    const where = recipientWhere(name);
    const [total, email] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.count({ where: { AND: [where, { OR: [{ announcementPreference: null }, { announcementPreference: { emailEnabled: true } }] }] } }),
    ]);
    return { name, total, email, inApp: name === 'Pending Applicants' ? 0 : total, available: name !== 'Newsletter (Public)' };
  }));
  return { audiences, smtpConfigured: env.mailConfigured, sabRecipients: env.SAB_PREVIEW_EMAILS.length, workerEnabled: env.ANNOUNCEMENT_WORKER_ENABLED };
}
export function toInput(row: Announcement): AnnouncementInput {
  return { subject: row.subject, body: row.body, audience: row.audience as AnnouncementInput['audience'], channel: row.channel as AnnouncementInput['channel'], timezone: row.timezone,
    scheduledAt: row.scheduledAt ? DateTime.fromJSDate(row.scheduledAt).setZone(row.timezone).toFormat("yyyy-MM-dd'T'HH:mm") : '', expiresAt: row.expiresAt ? DateTime.fromJSDate(row.expiresAt).setZone(row.timezone).toFormat("yyyy-MM-dd'T'HH:mm") : '', senderAsCRO: row.senderAsCRO, appendUnsubscribe: row.appendUnsubscribe, sendSABPreview: row.sendSABPreview };
}
const label = (status: string) => status.charAt(0) + status.slice(1).toLowerCase();
const include = { author: { select: { fullName: true } } } satisfies Prisma.AnnouncementInclude;
async function serialize(row: Announcement & { author: { fullName: string } | null }) {
  const grouped = await prisma.announcementDelivery.groupBy({ by: ['purpose', 'status', 'channel'], where: { announcementId: row.id, ...(row.managed ? { revision: row.revision } : {}) }, _count: true });
  const preview = grouped.filter(g => g.purpose === 'PREVIEW');
  const deliveries = grouped.filter(g => g.purpose === 'BROADCAST');
  const recipients = await prisma.announcementDelivery.findMany({ where: { announcementId: row.id, purpose: 'BROADCAST' }, distinct: ['recipientUserId', 'recipientEmail'], select: { recipientUserId: true, recipientEmail: true } });
  return { ...toInput(row), id: row.id, revision: row.revision, status: label(row.status), statusCode: row.status, author: row.author?.fullName ?? 'System', managed: row.managed,
    preview: row.body.slice(0, 180), createdAt: row.createdAt, updatedAt: row.updatedAt, sentAt: row.sentAt, scheduledFor: row.scheduledAt, dispatchStartedAt: row.dispatchStartedAt,
    recipients: recipients.length, delivery: deliveries.map(g => ({ status: g.status, channel: g.channel, count: g._count })),
    previewDelivery: preview.map(g => ({ status: g.status, channel: g.channel, count: g._count })),
    previewReady: row.previewRevision === row.revision && preview.length > 0 && preview.every(g => g.status === 'SENT'),
    signedOff: row.signedOffRevision === row.revision, signedOffAt: row.signedOffAt, signedOffBy: row.signedOffBy,
  };
}
export async function detail(id: string, includeDeleted = false) {
  const row = await prisma.announcement.findUnique({ where: { id }, include });
  if (!row || (row.deletedAt && !includeDeleted)) throw ApiError.notFound('Announcement not found');
  return serialize(row);
}
export async function list(raw: unknown) {
  const query = listQuery.parse(raw);
  const where: Prisma.AnnouncementWhereInput = { ...(query.status === 'All' ? {} : { status: query.status.toUpperCase() as AnnouncementStatus }), ...(query.audience === 'All' ? {} : { audience: query.audience }), ...(query.q ? { OR: [{ subject: { contains: query.q } }, { body: { contains: query.q } }] } : {}) };
  const month = new Date(); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);
  where.deletedAt = null;
  const grouped = await prisma.announcement.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } });
  const [rows, total, monthSent, delivered, read, inApp] = await prisma.$transaction([
    prisma.announcement.findMany({ where, include, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], ...toSkipTake(query) }), prisma.announcement.count({ where }),
    prisma.announcement.count({ where: { status: 'SENT', sentAt: { gte: month } } }),
    prisma.announcementDelivery.count({ where: { purpose: 'BROADCAST', status: 'SENT', deliveredAt: { gte: month } } }),
    prisma.announcementDelivery.count({ where: { purpose: 'BROADCAST', channel: 'IN_APP', status: 'SENT', deliveredAt: { gte: month }, openedAt: { not: null } } }),
    prisma.announcementDelivery.count({ where: { purpose: 'BROADCAST', channel: 'IN_APP', status: 'SENT', deliveredAt: { gte: month } } }),
  ]);
  const counts = Object.fromEntries(ANNOUNCEMENT_STATUSES.map(s => [s, s === 'All' ? grouped.reduce((n, g) => n + g._count._all, 0) : grouped.find(g => label(g.status) === s)?._count._all ?? 0]));
  return { ...buildPaginatedResult(await Promise.all(rows.map(serialize)), total, query), counts, stats: { monthSent, delivered, inAppReadRate: inApp ? Math.round(read / inApp * 100) : null } };
}
export async function deliveries(id: string, raw: unknown) {
  if (!await prisma.announcement.findUnique({ where: { id } })) throw ApiError.notFound('Announcement not found');
  const query = deliveryQuery.parse(raw);
  const where = { announcementId: id, ...(query.channel !== 'All' ? { channel: query.channel } : {}), ...(query.purpose !== 'All' ? { purpose: query.purpose } : {}) };
  const [rows, total] = await prisma.$transaction([prisma.announcementDelivery.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...toSkipTake(query), select: { id: true, recipientEmail: true, recipientUserId: true, channel: true, purpose: true, revision: true, status: true, attempts: true, deliveredAt: true, openedAt: true, error: true } }), prisma.announcementDelivery.count({ where })]);
  return buildPaginatedResult(rows, total, query);
}
export async function audit(tx: Prisma.TransactionClient, actorId: string | null, id: string, action: string, description: string, changes?: unknown) {
  const afterStatus = (changes as { status?: { after?: string } } | undefined)?.status?.after;
  await writeAudit({ actorId, outcome: action === 'AnnouncementDeliveryUpdated' && ['FAILED', 'PARTIAL'].includes(afterStatus ?? '') ? 'FAILED' : 'SUCCEEDED', actorLabel: actorId ?? 'Announcement worker', actorRole: actorId ? 'ADMIN' : 'SYSTEM', source: actorId ? undefined : 'Announcement worker', action, entity: `Announcement ${id}`, changes, description }, tx);
}
async function mutation(actorId: string, input: { requestId: string; expectedRevision?: number }, operation: string, id: string | undefined, payload: unknown, work: (tx: Prisma.TransactionClient, row: Announcement | null) => Promise<string>) {
  const fingerprint = hash(JSON.stringify({ operation, id, payload }));
  const result = await prisma.$transaction(async tx => {
    // Actor lock also serializes first creates and idempotent retries across API instances.
    await tx.$queryRaw`SELECT id FROM User WHERE id = ${actorId} FOR UPDATE`;
    const previous = await tx.announcementOperation.findUnique({ where: { actorId_requestId: { actorId, requestId: input.requestId } } });
    if (previous) { if (previous.fingerprint !== fingerprint) throw ApiError.conflict('Request identifier was already used for different changes.'); return previous.announcementId; }
    if (id) await tx.$queryRaw`SELECT id FROM Announcement WHERE id = ${id} FOR UPDATE`;
    const row = id ? await tx.announcement.findUnique({ where: { id } }) : null;
    if (id && !row) throw ApiError.notFound('Announcement not found');
    if (row && row.revision !== input.expectedRevision) throw ApiError.conflict('Announcement changed. Reload it before saving.');
    const announcementId = await work(tx, row);
    await tx.announcementOperation.create({ data: { actorId, requestId: input.requestId, fingerprint, announcementId } });
    const after = await tx.announcement.findUniqueOrThrow({ where: { id: announcementId } });
    if (!row || JSON.stringify(row) !== JSON.stringify(after) || ['preview', 'retry'].includes(operation)) await audit(tx, actorId, announcementId, `Announcement${operation}`, `${operation} recorded.`, changesBetween(row, after));
    return announcementId;
  }, { timeout: 30000 });
  return detail(result, operation === 'delete');
}
export async function save(actorId: string, raw: unknown, id?: string) {
  const parsed = id ? updateBody.parse(raw) : createBody.parse(raw);
  const { requestId, expectedRevision, ...fields } = parsed;
  return mutation(actorId, { requestId, expectedRevision }, 'Saved', id, parsed, async (tx, row) => {
    if (row?.deletedAt) throw ApiError.notFound('Announcement not found');
    if (row?.expiresAt && row.expiresAt <= new Date() && row.dispatchStartedAt) throw ApiError.conflict('Expired broadcasts cannot be republished.');
    if (row && (row.dispatchStartedAt || !['DRAFT', 'SCHEDULED', 'CANCELLED'].includes(row.status))) throw ApiError.conflict('A dispatched announcement cannot be edited.');
    const defaults = await effectiveSettings(tx);
    const value = announcementSchema().parse({ ...(row ? toInput(row) : {}), ...fields, ...(!row && raw && typeof raw === 'object' && !('sendSABPreview' in raw) ? { sendSABPreview: defaults.communications.announcementSignoff } : {}) });
    const scheduledAt = value.scheduledAt ? DateTime.fromISO(value.scheduledAt, { zone: value.timezone }) : null;
    if (scheduledAt && (!scheduledAt.isValid || scheduledAt.toFormat("yyyy-MM-dd'T'HH:mm") !== value.scheduledAt)) throw ApiError.unprocessable('Invalid scheduled time', [{ field: 'scheduledAt', message: 'Choose a valid local date and time.' }]);
    const data = { ...value, scheduledAt: scheduledAt?.toJSDate() ?? null, expiresAt: value.expiresAt ? DateTime.fromISO(value.expiresAt, { zone: value.timezone }).toJSDate() : null, status: 'DRAFT' as const, managed: true };
    if (!row) return (await tx.announcement.create({ data: { ...data, authorId: actorId } })).id;
    if (JSON.stringify(toInput(row)) === JSON.stringify(value) && row.status === 'DRAFT' && row.managed) return row.id;
    await tx.announcementDelivery.updateMany({ where: { announcementId: row.id, purpose: 'PREVIEW', status: { in: ['QUEUED', 'PROCESSING', 'FAILED', 'UNCONFIGURED'] } }, data: { status: 'CANCELLED', claimToken: null, lockedAt: null } });
    await tx.announcement.update({ where: { id: row.id }, data: { ...data, revision: { increment: 1 }, previewRevision: null, signedOffRevision: null, signedOffAt: null, signedOffBy: null } });
    return row.id;
  });
}
export async function act(actorId: string, id: string, action: 'preview' | 'sign-off' | 'send' | 'schedule' | 'cancel' | 'retry' | 'delete', raw: unknown) {
  const input = actionBody.parse(raw);
  return mutation(actorId, input, action === 'sign-off' ? 'SignOff' : action, id, input, async (tx, value) => {
    const row = value!;
    if (row.deletedAt) throw ApiError.notFound('Announcement not found');
    if (action === 'delete') {
      if (!input.confirmed) throw ApiError.unprocessable('Confirm deletion.');
      await tx.announcement.update({ where: { id }, data: { deletedAt: new Date(), scheduledAt: null, revision: { increment: 1 } } });
      await tx.announcementDelivery.updateMany({ where: { announcementId: id, status: { in: ['QUEUED', 'PROCESSING', 'FAILED', 'UNCONFIGURED'] } }, data: { status: 'CANCELLED', claimToken: null, lockedAt: null } });
      return id;
    }
    if (row.expiresAt && row.expiresAt <= new Date()) throw ApiError.conflict('This announcement has expired. Create a new announcement.');
    if (action === 'retry') {
      const result = await tx.announcementDelivery.updateMany({ where: { announcementId: id, revision: row.revision, status: { in: ['FAILED', 'UNCONFIGURED'] } }, data: { status: 'QUEUED', attempts: 0, dueAt: new Date(), error: null, lockedAt: null, claimToken: null } });
      if (!result.count) throw ApiError.conflict('No failed or unconfigured deliveries to retry.');
      if (row.dispatchStartedAt) await tx.announcement.update({ where: { id }, data: { status: 'SENDING', completedAt: null } });
      return id;
    }
    if (row.dispatchStartedAt) throw ApiError.conflict('Dispatch has already started.');
    if (action === 'cancel') {
      if (row.status !== 'SCHEDULED') throw ApiError.conflict('Only scheduled announcements can be cancelled.');
      await tx.announcement.update({ where: { id }, data: { status: 'DRAFT', scheduledAt: null, revision: { increment: 1 }, signedOffRevision: null, signedOffAt: null, signedOffBy: null, previewRevision: null } });
      return id;
    }
    if (!row.managed || !['DRAFT', 'CANCELLED'].includes(row.status)) throw ApiError.conflict('Save this announcement as a draft first.');
    if (action === 'sign-off') {
      if (!input.confirmed) throw ApiError.unprocessable('Confirm that SAB approval has been obtained.');
      const preview = await tx.announcementDelivery.findMany({ where: { announcementId: id, revision: row.revision, purpose: 'PREVIEW' } });
      if (row.previewRevision !== row.revision || !preview.length || preview.some(p => p.status !== 'SENT')) throw ApiError.conflict('All current-revision SAB previews must be delivered first.');
      await tx.announcement.update({ where: { id }, data: { signedOffRevision: row.revision, signedOffAt: new Date(), signedOffBy: actorId } });
      return id;
    }
    announcementSchema(action === 'preview' ? 'preview' : action === 'schedule' ? 'schedule' : 'send').parse(toInput(row));
    if (action === 'preview') {
      if (!env.SAB_PREVIEW_EMAILS.length) throw ApiError.unprocessable('SAB preview recipients are not configured.');
      for (const email of env.SAB_PREVIEW_EMAILS) {
        const key = hash(`${id}:${row.revision}:PREVIEW:EMAIL:${email}`);
        await tx.announcementDelivery.upsert({ where: { key }, create: { key, announcementId: id, recipientEmail: email, channel: 'EMAIL', purpose: 'PREVIEW', revision: row.revision, status: 'QUEUED' }, update: {} });
      }
      await tx.announcement.update({ where: { id }, data: { previewRevision: row.revision } });
      return id;
    }
    if (row.sendSABPreview && row.signedOffRevision !== row.revision) throw ApiError.conflict('Confirm SAB sign-off for this revision before broadcasting.');
    // Only an email-only broadcast can be emptied by email opt-outs; anything that
    // also delivers in-app still reaches every recipient, so the preference filter
    // would wrongly refuse it.
    const emailOnly = !channelsFor(row.channel, row.audience).includes('IN_APP');
    const recipients = await tx.user.count({ where: { AND: [recipientWhere(row.audience), ...(emailOnly ? [{ OR: [{ announcementPreference: null }, { announcementPreference: { emailEnabled: true } }] }] : [])] } });
    if (!recipients) throw ApiError.unprocessable('No eligible recipients for this audience.');
    await tx.announcement.update({ where: { id }, data: { status: 'SCHEDULED', scheduledAt: action === 'send' ? new Date() : row.scheduledAt } });
    return id;
  });
}
