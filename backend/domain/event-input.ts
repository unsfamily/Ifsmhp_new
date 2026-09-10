// Pure domain module shared with the browser. No server configuration or I/O.
import { DateTime, IANAZone } from 'luxon';
import { z } from 'zod';

export const EVENT_TAGS = ['Symposium', 'Workshop', 'Town Hall', 'Lecture', 'Moral Support', 'Grants', 'Publications', 'Wellness', 'Chapter', 'Networking', 'SAB', 'Training'];
export const TIMEZONES = ['UTC', 'Europe/London', 'Europe/Stockholm', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];
export const normalizeTimezone = (value: string) => value.replace(/\s+\([^)]*\)$/, '').trim();
const text = (max: number) => z.string().trim().max(max).default('');
export const eventFields = z.object({
  title: z.string().trim().min(6, 'Title must be at least 6 characters.').max(140),
  shortDescription: text(300), longDescription: text(50000),
  date: z.string().default(''), timeStart: z.string().default(''), timeEnd: z.string().default(''),
  timezone: z.string().transform(normalizeTimezone).default('UTC'),
  location: text(500), organizer: text(191), organizerEmail: text(191),
  format: z.enum(['Virtual', 'Hybrid', 'In-Person']).default('Virtual'),
  audience: z.enum(['All Members', 'CRO Invite', 'Public']).default('All Members'),
  capacity: z.number().int().min(0).max(100000).nullable().default(null),
  externalUrl: text(2048), coverFileId: z.string().min(1).nullable().default(null),
  speakers: z.array(z.string().trim().max(191)).max(50).default([]).transform(v => v.filter(Boolean)),
  tags: z.array(z.string().trim().min(1).max(80)).default([]).transform(v => [...new Set(v)]).refine(v => v.length <= 5, 'Select at most five tags.'),
  registrationRequired: z.boolean().default(true), waitlistEnabled: z.boolean().default(true),
  recordingProvided: z.boolean().default(false), featured: z.boolean().default(false),
  sendReminder: z.boolean().default(true), reminderDays: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7)]).default(1),
  status: z.enum(['DRAFT', 'PUBLISHED', 'PAST', 'CANCELLED']).default('DRAFT'),
  scheduledPublishDate: z.string().default(''),
}).strict();

export type EventInput = z.infer<typeof eventFields>;
export function localDateTime(date: string, time: string, zone: string) {
  return DateTime.fromISO(`${date}T${time}`, { zone: normalizeTimezone(zone) });
}
export function eventSchema(now = new Date(), allowOverdueSchedule = false) {
  return eventFields.superRefine((f, ctx) => {
    const error = (field: keyof EventInput, message: string) => ctx.addIssue({ code: 'custom', path: [field], message });
    const complete = f.status === 'PUBLISHED' || f.status === 'PAST' || Boolean(f.scheduledPublishDate);
    if (complete) {
      for (const field of ['date', 'timeStart', 'timeEnd', 'location', 'organizer', 'organizerEmail'] as const) {
        if (!f[field]) error(field, 'This field is required before publishing.');
      }
      if (f.shortDescription.length < 20) error('shortDescription', 'Short description must be at least 20 characters.');
      if (f.longDescription.length < 50) error('longDescription', 'Long description must be at least 50 characters.');
    }
    if (!IANAZone.isValidZone(f.timezone) && f.timezone !== 'UTC') error('timezone', 'Select a valid timezone.');
    if (f.date && (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || !DateTime.fromISO(f.date).isValid)) error('date', 'Enter a valid date.');
    for (const field of ['timeStart', 'timeEnd'] as const) {
      if (f[field] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(f[field])) error(field, 'Enter a valid time.');
      if (f.date && f[field]) {
        const dt = localDateTime(f.date, f[field], f.timezone);
        if (!dt.isValid || dt.toFormat('yyyy-MM-dd HH:mm') !== `${f.date} ${f[field]}`) error(field, 'This time does not exist in the selected timezone.');
        else if (dt.getPossibleOffsets().length > 1) error(field, 'This time occurs twice during a clock change. Choose an unambiguous time.');
      }
    }
    if (f.timeStart && f.timeEnd && f.timeStart >= f.timeEnd) error('timeEnd', 'End time must be after start time.');
    if (f.organizerEmail && !z.string().email().safeParse(f.organizerEmail).success) error('organizerEmail', 'Enter a valid email address.');
    if (f.externalUrl && (!z.string().url().safeParse(f.externalUrl).success || !/^https?:\/\//i.test(f.externalUrl))) error('externalUrl', 'Enter a valid HTTP or HTTPS URL.');
    if (f.scheduledPublishDate) {
      const dt = DateTime.fromISO(f.scheduledPublishDate, { zone: f.timezone });
      const start = localDateTime(f.date, f.timeStart, f.timezone);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(f.scheduledPublishDate) || !dt.isValid || dt.toFormat("yyyy-MM-dd'T'HH:mm") !== f.scheduledPublishDate || dt.getPossibleOffsets().length > 1) error('scheduledPublishDate', 'Enter an unambiguous publication date and time.');
      else if ((!allowOverdueSchedule && dt.toMillis() <= now.getTime()) || (start.isValid && dt >= start)) error('scheduledPublishDate', 'Schedule publication in the future and before the event starts.');
      if (f.status !== 'DRAFT') error('scheduledPublishDate', 'Only drafts can have a publication schedule.');
    }
  });
}
