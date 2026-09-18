import type { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { paginationQuerySchema, toSkipTake, buildPaginatedResult } from '../utils/pagination';
import { normalizeTimezone } from '../domain/event-input';

const visible: Prisma.EventWhereInput = { deletedAt: null, status: { in: ['PUBLISHED', 'PAST'] }, audience: { in: ['Public', 'All Members'] } };
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => DateTime.fromISO(v).isValid, 'Invalid calendar date.');
export const publicEventQuery = paginationQuerySchema.extend({ tab: z.enum(['all', 'upcoming', 'past']).default('all'), date: dateSchema.optional(), q: z.string().trim().max(200).default('') });
const calendarQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).refine(v => DateTime.fromISO(`${v}-01`).isValid, 'Invalid calendar month.') });
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const eventTypes = ['Symposium', 'Webinar', 'Workshop', 'Conference', 'Town Hall', 'Lecture', 'Training', 'Networking'];
const select = {
  slug: true, title: true, date: true, timeStart: true, timeEnd: true, timezone: true, startsAt: true, endsAt: true,
  location: true, format: true, shortDescription: true, longDescription: true, organizer: true, organizerEmail: true,
  capacity: true, externalUrl: true, registrationRequired: true, recordingProvided: true, status: true, featured: true, updatedAt: true,
  speakers: { select: { name: true }, orderBy: [{ sort: 'asc' }, { id: 'asc' }] },
  tags: { select: { name: true }, orderBy: { id: 'asc' } },
  resources: { select: { id: true, kind: true, title: true, url: true }, orderBy: { id: 'asc' } },
  coverFile: { select: { id: true, originalName: true, mimeType: true, deletedAt: true } },
  _count: { select: { registrations: { where: { status: 'Registered' } } } },
} satisfies Prisma.EventSelect;
type EventRow = Prisma.EventGetPayload<{ select: typeof select }>;
export function safeEventUrl(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function endTime(row: { endsAt: Date | null; date: Date | null; timeEnd: string; timezone: string }) {
  if (row.endsAt) return row.endsAt.getTime();
  if (!row.date) return null;
  const end = DateTime.fromISO(`${row.date.toISOString().slice(0, 10)}T${row.timeEnd || '23:59'}`, { zone: normalizeTimezone(row.timezone) });
  return end.isValid ? end.toMillis() : null;
}
function serialize(row: EventRow, now: Date, full = false) {
  const tags = row.tags.map(t => t.name);
  const type = tags.find(t => eventTypes.includes(t)) ?? 'Event';
  const end = endTime(row);
  const cover = row.coverFile && !row.coverFile.deletedAt && imageTypes.includes(row.coverFile.mimeType) ? row.coverFile : null;
  return {
    id: row.slug, slug: row.slug, title: row.title, date: row.date?.toISOString().slice(0, 10) ?? null,
    time: `${row.timeStart} - ${row.timeEnd} ${normalizeTimezone(row.timezone)}`, timeStart: row.timeStart, timeEnd: row.timeEnd,
    timezone: normalizeTimezone(row.timezone), startsAt: row.startsAt, endsAt: row.endsAt,
    location: row.location, format: row.format, type, category: tags.filter(t => t !== type).join(', ') || row.format, tags,
    description: row.shortDescription, ...(full ? { longDescription: row.longDescription, organizer: row.organizer, organizerEmail: row.organizerEmail } : {}),
    speakers: row.speakers.map(s => s.name), seats: row.capacity, attendees: row._count.registrations, status: row.status,
    past: row.status === 'PAST' || (end !== null && end <= now.getTime()), featured: row.featured,
    registrationRequired: row.registrationRequired, externalUrl: safeEventUrl(row.externalUrl), recordingProvided: row.recordingProvided,
    resources: row.resources.map(r => ({ id: r.id, title: r.title, kind: r.kind.toLowerCase(), url: safeEventUrl(r.url) })),
    cover: cover ? { name: cover.originalName, url: `/public/events/${encodeURIComponent(row.slug)}/cover?v=${encodeURIComponent(`${cover.id}-${row.updatedAt.getTime()}`)}` } : null,
  };
}
async function timeFilter(tab: 'all' | 'upcoming' | 'past', now: Date): Promise<Prisma.EventWhereInput> {
  if (tab === 'all') return {};
  // Pre-migration records can lack UTC timestamps. Resolve only that legacy subset
  // in its event timezone before applying database pagination to the combined set.
  const legacy = await prisma.event.findMany({ where: { AND: [visible, { status: 'PUBLISHED', endsAt: null }] }, select: { id: true, date: true, endsAt: true, timeEnd: true, timezone: true } });
  const ids = legacy.filter(row => { const end = endTime(row); return end !== null && (tab === 'past' ? end <= now.getTime() : end > now.getTime()); }).map(row => row.id);
  return tab === 'past'
    ? { OR: [{ status: 'PAST' }, { status: 'PUBLISHED', endsAt: { lte: now } }, { id: { in: ids } }] }
    : { status: 'PUBLISHED', OR: [{ endsAt: { gt: now } }, { id: { in: ids } }] };
}
export async function listPublicEvents(raw: unknown, now = new Date()) {
  const query = publicEventQuery.parse(raw);
  const where: Prisma.EventWhereInput = { AND: [visible, await timeFilter(query.tab, now), ...(query.date ? [{ date: new Date(`${query.date}T00:00:00Z`) }] : []), ...(query.q ? [{ title: { contains: query.q } }] : [])] };
  const total = await prisma.event.count({ where });
  const pagination = { ...query, page: Math.min(query.page, Math.max(1, Math.ceil(total / query.limit))) };
  const rows = await prisma.event.findMany({ where, select, ...toSkipTake(pagination), orderBy: [{ date: query.tab === 'past' ? 'desc' : 'asc' }, { timeStart: 'asc' }, { id: 'asc' }] });
  return buildPaginatedResult(rows.map(row => serialize(row, now)), total, pagination);
}
export async function publicEventDetail(slugOrId: string) {
  const row = await prisma.event.findFirst({ where: { AND: [visible, { OR: [{ slug: slugOrId }, { id: slugOrId }] }] }, select });
  if (!row) throw ApiError.notFound('Event not found');
  return serialize(row, new Date(), true);
}
export async function publicEventCalendar(raw: unknown) {
  const { month } = calendarQuery.parse(raw);
  const start = DateTime.fromISO(`${month}-01`, { zone: 'UTC' });
  const rows = await prisma.event.findMany({ where: { AND: [visible, { date: { gte: start.toJSDate(), lt: start.plus({ months: 1 }).toJSDate() } }] }, select: { date: true, featured: true, tags: { select: { name: true } } } });
  const days = new Map<string, { date: string; count: number; major: boolean }>();
  for (const row of rows) {
    const date = row.date!.toISOString().slice(0, 10);
    const day = days.get(date) ?? { date, count: 0, major: false };
    day.count++; day.major ||= row.featured || row.tags.some(t => t.name === 'Symposium'); days.set(date, day);
  }
  return { month, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}
export async function publicEventCover(slugOrId: string) {
  const event = await prisma.event.findFirst({ where: { AND: [visible, { OR: [{ slug: slugOrId }, { id: slugOrId }] }] }, select: { coverFile: { select: { storageKey: true, originalName: true, mimeType: true, deletedAt: true } } } });
  const file = event?.coverFile;
  if (!file || file.deletedAt || !imageTypes.includes(file.mimeType)) throw ApiError.notFound('Event cover not found');
  return file;
}
