import { z } from 'zod';
import { DateTime, IANAZone } from 'luxon';

export const ANNOUNCEMENT_AUDIENCES = ['All Members', 'Members Only', 'Scientists Track', 'Professionals Track', 'Pending Applicants', 'Newsletter (Public)'] as const;
export const ANNOUNCEMENT_CHANNELS = ['Email + In-App', 'Email', 'In-App Only'] as const;
export const ANNOUNCEMENT_STATUSES = ['All', 'Draft', 'Scheduled', 'Sending', 'Sent', 'Cancelled', 'Partial', 'Failed', 'Suppressed'] as const;
export const announcementFields = z.object({
  subject: z.string().trim().max(220).default(''), body: z.string().trim().max(20000).default(''),
  audience: z.enum(ANNOUNCEMENT_AUDIENCES).default('All Members'), channel: z.enum(ANNOUNCEMENT_CHANNELS).default('Email + In-App'),
  timezone: z.string().max(100).refine(v => v === 'UTC' || IANAZone.isValidZone(v), 'Use an IANA timezone.').default('UTC'),
  scheduledAt: z.string().max(30).default(''), senderAsCRO: z.boolean().default(true),
  appendUnsubscribe: z.boolean().default(true), sendSABPreview: z.boolean().default(false),
}).strict();
export type AnnouncementInput = z.infer<typeof announcementFields>;
export const mutationFields = z.object({ requestId: z.string().uuid(), expectedRevision: z.number().int().positive().optional() }).strict();
export function announcementSchema(mode: 'draft' | 'send' | 'schedule' | 'preview' = 'draft') {
  return announcementFields.superRefine((value, ctx) => {
    const error = (field: keyof AnnouncementInput, message: string) => ctx.addIssue({ code: 'custom', path: [field], message });
    if (!value.subject && !value.body) error('subject', 'Add a subject or message to save a draft.');
    if (value.scheduledAt || mode === 'schedule') {
      const date = DateTime.fromISO(value.scheduledAt, { zone: value.timezone });
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.scheduledAt) || !date.isValid || date.toFormat("yyyy-MM-dd'T'HH:mm") !== value.scheduledAt || date.getPossibleOffsets().length > 1) error('scheduledAt', 'Choose a valid, unambiguous local date and time.');
      else if (mode === 'schedule' && date.toMillis() <= Date.now()) error('scheduledAt', 'Choose a future send time.');
    }
    if (mode === 'draft') return;
    if (!value.subject) error('subject', 'Subject is required.');
    if ((value.channel !== 'In-App Only' || mode === 'preview') && value.subject.length > 80) error('subject', 'Email subjects must be 80 characters or fewer.');
    if (value.body.length < 20) error('body', 'Message body must contain at least 20 characters.');
    if (value.audience === 'Newsletter (Public)') error('audience', 'Public newsletter delivery is not available.');
    if (value.audience === 'Pending Applicants' && value.channel !== 'Email') error('channel', 'Pending applicants receive email only.');
  });
}
