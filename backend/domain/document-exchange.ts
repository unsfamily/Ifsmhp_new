import { DateTime, IANAZone } from 'luxon';
import { z } from 'zod';

export const DOCUMENT_MIME_TYPES = [
  'application/pdf', 'application/msword', 'image/jpeg', 'image/png', 'image/webp',
  'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
export const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'txt', 'csv', 'xlsx', 'ppt', 'pptx'];
export function documentKind(mime: string) {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.includes('word')) return 'DOC';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') return 'SHEET';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'SLIDES';
  return 'FILE';
}
export function isLegacyVideoUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return ['youtube.com', 'youtu.be', 'vimeo.com'].some(h => host === h || host.endsWith(`.${h}`)) || /\.(mp4|webm|mov)$/i.test(url.pathname);
  } catch { return false; }
}
const requestId = z.string().uuid();
const url = z.string().trim().max(2048).url().refine(v => {
  try { const parsed = new URL(v); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password; }
  catch { return false; }
}, 'Use an HTTP or HTTPS link without embedded credentials.');
export const exchangeSendBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('document'), clientRequestId: requestId, fileIds: z.array(z.string().min(1)).min(1).max(5), note: z.string().trim().max(10000).default('') }).strict(),
  z.object({ type: z.literal('message'), clientRequestId: requestId, body: z.string().trim().min(1, 'Write a message.').max(10000) }).strict(),
  z.object({ type: z.literal('video'), clientRequestId: requestId, url }).strict(),
  z.object({ type: z.literal('meeting'), clientRequestId: requestId, subject: z.string().trim().min(3).max(200), dateTime: z.string(), timezone: z.string().max(100) }).strict(),
]);
export const exchangeSendSchema = exchangeSendBody.superRefine((input, ctx) => {
  if (input.type !== 'meeting') return;
  const invalid = (field: string, message: string) => ctx.addIssue({ code: 'custom', path: [field], message });
  if (input.timezone !== 'UTC' && !IANAZone.isValidZone(input.timezone)) invalid('timezone', 'Select a valid timezone.');
  const date = DateTime.fromISO(input.dateTime, { zone: input.timezone });
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.dateTime) || !date.isValid || date.toFormat("yyyy-MM-dd'T'HH:mm") !== input.dateTime || date.getPossibleOffsets().length > 1) invalid('dateTime', 'Choose a valid, unambiguous local time.');
  else if (date.toMillis() <= Date.now()) invalid('dateTime', 'Choose a future meeting time.');
});
export type ExchangeSend = z.infer<typeof exchangeSendSchema>;
