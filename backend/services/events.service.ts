import { effectiveSettings } from './settings.service';
import { changesBetween, writeAudit } from './audit.service';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { eventFields, eventSchema, localDateTime, type EventInput } from '../domain/event-input';
import { reconcileEventJobs } from './event-jobs.service';

export const eventQuery = z.object({
  tab: z.enum(['upcoming', 'past', 'drafts']).default('upcoming'),
  q: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export const cancelBody = z.object({ reason: z.string().trim().max(4000).default(''), emailAttendees: z.boolean().default(true) }).strict();
const include = {
  tags: true, speakers: { orderBy: { sort: 'asc' as const } },
  coverFile: { select: { id: true, originalName: true, mimeType: true, deletedAt: true } },
  _count: { select: { registrations: { where: { status: 'Registered' } }, resources: true } },
} satisfies Prisma.EventInclude;
type Record = Prisma.EventGetPayload<{ include: typeof include }>;

function serialize(e: Record) {
  const { _count, ...rest } = e;
  return {
    ...rest, date: e.date?.toISOString().slice(0, 10) ?? '',
    scheduledPublishDate: e.scheduledPublishAt ? DateTime.fromJSDate(e.scheduledPublishAt).setZone(e.timezone).toFormat("yyyy-MM-dd'T'HH:mm") : '',
    speakers: e.speakers.map(s => s.name), tags: e.tags.map(t => t.name),
    coverFile: e.coverFile && !e.coverFile.deletedAt ? { id: e.coverFile.id, name: e.coverFile.originalName, mimeType: e.coverFile.mimeType } : null,
    attendees: _count.registrations, resourceCount: _count.resources,
    displayStatus: e.status === 'PUBLISHED' && e.endsAt && e.endsAt <= new Date() ? 'PAST' : e.status,
  };
}
export async function adminEventDetail(id: string) {
  const event = await prisma.event.findFirst({ where: { id, deletedAt: null }, include });
  if (!event) throw ApiError.notFound('Event not found');
  const delivery = await prisma.eventJob.groupBy({ by: ['status'], where: { eventId: id }, _count: { _all: true } });
  const failures = await prisma.eventJob.findMany({ where: { eventId: id, status: { in: ['FAILED', 'UNCONFIGURED'] } }, select: { id: true, kind: true, error: true }, take: 10, orderBy: { updatedAt: 'desc' } });
  return { ...serialize(event), delivery: delivery.map(v => ({ status: v.status, count: v._count._all })), failures };
}

export async function listEvents(query: z.infer<typeof eventQuery>) {
  const now = new Date();
  const views: { [K in typeof query.tab]: Prisma.EventWhereInput } = {
    upcoming: { status: 'PUBLISHED', OR: [{ endsAt: { gt: now } }, { endsAt: null, date: { gte: now } }] },
    past: { OR: [{ status: { in: ['PAST', 'CANCELLED'] } }, { status: 'PUBLISHED', endsAt: { lte: now } }, { status: 'PUBLISHED', endsAt: null, date: { lt: now } }] },
    drafts: { status: 'DRAFT' },
  };
  const where = { deletedAt: null, ...views[query.tab], ...(query.q ? { title: { contains: query.q } } : {}) };
  const [total, upcoming, past, drafts, rsvps, resources, next] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.count({ where: { deletedAt: null, ...views.upcoming } }),
    prisma.event.count({ where: { deletedAt: null, ...views.past } }),
    prisma.event.count({ where: { deletedAt: null, ...views.drafts } }),
    prisma.eventRegistration.count({ where: { status: 'Registered', event: { deletedAt: null } } }),
    prisma.eventResource.count({ where: { event: { deletedAt: null, ...views.past } } }),
    prisma.event.findFirst({ where: { deletedAt: null, ...views.upcoming }, orderBy: { startsAt: 'asc' }, select: { title: true, date: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(pages, query.page);
  const rows = await prisma.event.findMany({ where, include, skip: (page - 1) * query.limit, take: query.limit,
    orderBy: query.tab === 'drafts' ? [{ updatedAt: 'desc' }, { id: 'asc' }] : [{ date: query.tab === 'past' ? 'desc' : 'asc' }, { timeStart: 'asc' }, { id: 'asc' }],
  });
  return { items: rows.map(serialize), pagination: { page, limit: query.limit, total, pages }, counts: { upcoming, past, drafts, rsvps, resources }, next };
}

function recordInput(e: Record) {
  const row = serialize(e);
  return Object.fromEntries(Object.keys(eventFields.shape).map(key => [key, row[key as keyof typeof row] ?? undefined]));
}

export async function saveEvent(actorId: string, raw: unknown, id?: string) {
  const patch = eventFields.partial().parse(raw);
  const eventId = await prisma.$transaction(async tx => {
    const old = id ? await tx.event.findFirst({ where: { id, deletedAt: null }, include }) : null;
    if (id && !old) throw ApiError.notFound('Event not found');
    if (patch.status === 'CANCELLED' && old?.status !== 'CANCELLED') throw ApiError.unprocessable('Use the cancellation action.');
    const defaults = await effectiveSettings(tx);
    const f = eventSchema().parse({ ...(old ? recordInput(old) : { timezone: defaults.general.timezone, ...defaults.events }), ...patch });
    if (f.coverFileId && f.coverFileId !== old?.coverFileId) {
      const file = await tx.fileObject.findFirst({ where: { id: f.coverFileId, deletedAt: null, avatarManaged: false, uploaderId: actorId, mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] } } });
      if (!file) throw ApiError.unprocessable('Invalid cover image.', [{ field: 'coverFileId', message: 'Upload a JPEG, PNG or WebP image from this account.' }]);
    }
    if (old && JSON.stringify(recordInput(old)) === JSON.stringify(f)) return old.id;
    const { speakers, tags, scheduledPublishDate, ...fields } = f;
    const start = f.date && f.timeStart ? localDateTime(f.date, f.timeStart, f.timezone).toJSDate() : null;
    const end = f.date && f.timeEnd ? localDateTime(f.date, f.timeEnd, f.timezone).toJSDate() : null;
    const data = { ...fields, date: f.date ? new Date(`${f.date}T00:00:00Z`) : null, startsAt: start, endsAt: end,
      scheduledPublishAt: scheduledPublishDate ? DateTime.fromISO(scheduledPublishDate, { zone: f.timezone }).toJSDate() : null,
      externalUrl: f.externalUrl || null,
    };
    let savedId: string;
    if (old) {
      const updated = await tx.event.updateMany({ where: { id: old.id, revision: old.revision, deletedAt: null }, data: { ...data, revision: { increment: 1 } } });
      if (!updated.count) throw ApiError.conflict('Event changed while saving. Reload and try again.');
      savedId = old.id;
      await tx.eventSpeaker.deleteMany({ where: { eventId: savedId } });
      await tx.eventTag.deleteMany({ where: { eventId: savedId } });
    } else {
      const slug = `${f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'event'}-${randomUUID().slice(0, 12)}`;
      savedId = (await tx.event.create({ data: { ...data, slug, creatorId: actorId } })).id;
    }
    if (speakers.length) await tx.eventSpeaker.createMany({ data: speakers.map((name, sort) => ({ eventId: savedId, name, sort })) });
    if (tags.length) await tx.eventTag.createMany({ data: tags.map(name => ({ eventId: savedId, name })) });
    await reconcileEventJobs(tx, savedId);
    await writeAudit({ actorId, action: !old ? 'EventCreated' : old.status !== f.status && f.status === 'PUBLISHED' ? 'EventPublished' : 'EventUpdated', entity: `Event ${savedId}`, changes: changesBetween(old, data), metadata: { changedFields: Object.keys(patch) } }, tx);
    return savedId;
  });
  return adminEventDetail(eventId);
}

export async function publishEvent(actorId: string, id: string) {
  return saveEvent(actorId, { status: 'PUBLISHED', scheduledPublishDate: '' } satisfies Partial<EventInput>, id);
}
export async function cancelEvent(id: string, input: z.infer<typeof cancelBody>, actorId: string) {
  await prisma.$transaction(async tx => {
    const result = await tx.event.updateMany({ where: { id, deletedAt: null, status: 'PUBLISHED' }, data: { status: 'CANCELLED', featured: false, scheduledPublishAt: null, cancellationReason: input.reason, revision: { increment: 1 } } });
    if (!result.count) {
      const old = await tx.event.findFirst({ where: { id, deletedAt: null } });
      if (!old) throw ApiError.notFound('Event not found');
      if (old.status === 'CANCELLED') return;
      throw ApiError.conflict('Only published events can be cancelled.');
    }
    await reconcileEventJobs(tx, id, input.emailAttendees);
    await writeAudit({ actorId, action: 'EventCancelled', entity: `Event ${id}`, changes: { status: { before: 'PUBLISHED', after: 'CANCELLED' } } }, tx);
  });
  return adminEventDetail(id);
}
export async function deleteEvent(id: string, actorId: string) {
  await prisma.$transaction(async tx => {
    const result = await tx.event.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date(), featured: false, scheduledPublishAt: null, revision: { increment: 1 } } });
    if (!result.count) throw ApiError.notFound('Event not found');
    await tx.eventJob.updateMany({ where: { eventId: id, status: { not: 'SENT' } }, data: { status: 'CANCELLED', claimToken: null, lockedAt: null } });
    await writeAudit({ actorId, action: 'EventDeleted', entity: `Event ${id}` }, tx);
  });
  return { deleted: true };
}
