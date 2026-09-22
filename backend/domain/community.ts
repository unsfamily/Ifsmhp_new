import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

export const communityStatus = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export const membershipStatus = z.enum(['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'BLOCKED']);
export const reportStatus = z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']);
const text = (max: number) => z.string().trim().min(1, 'This field is required.').max(max);
export const communityBody = z.object({
  name: text(191), slug: text(191).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens.'),
  description: text(10000), category: text(191), visibility: z.enum(['PUBLIC', 'PRIVATE']), status: communityStatus,
}).strict();
export const memberStatusBody = z.object({ status: membershipStatus, reason: text(2000).optional() }).strict().refine(
  v => !['REJECTED', 'SUSPENDED', 'BLOCKED'].includes(v.status) || !!v.reason,
  { path: ['reason'], message: 'A reason is required.' },
);
export const memberRoleBody = z.object({ role: z.enum(['MEMBER', 'MODERATOR']) }).strict();
export const reasonBody = z.object({ reason: text(2000) }).strict();
export const messageBody = z.object({ content: text(10000), replyToId: text(191).optional() }).strict();
export const messagePatch = z.object({ content: text(10000).optional(), isPinned: z.boolean().optional(), isHidden: z.boolean().optional(), isRead: z.boolean().optional() }).strict().refine(v => Object.keys(v).length > 0, 'Choose an update.');
export const reportBody = z.object({ reason: text(191), notes: text(5000).optional(), communityId: text(191).optional() }).strict();
export const reportPatch = z.object({ status: reportStatus, resolutionNotes: text(5000).optional() }).strict().refine(
  v => !['RESOLVED', 'DISMISSED'].includes(v.status) || !!v.resolutionNotes,
  { path: ['resolutionNotes'], message: 'Resolution notes are required.' },
);
export const moderationAction = z.enum(['HIDE_CONTENT', 'RESTORE_CONTENT', 'WARN_MEMBER', 'SUSPEND_MEMBER', 'BLOCK_MEMBER', 'RESOLVE_REPORT', 'DISMISS_REPORT']);
export type ModerationAction = z.infer<typeof moderationAction>;
export const moderationBody = z.object({ action: moderationAction, notes: text(5000) }).strict();
const optionalFilter = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(v => v === '' ? undefined : v, schema.optional());
export const communityQuery = paginationQuerySchema.extend({
  search: z.string().trim().max(220).default(''),
  communityId: optionalFilter(text(191)),
  category: optionalFilter(text(191)),
  visibility: optionalFilter(z.enum(['PUBLIC', 'PRIVATE'])),
  status: optionalFilter(z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'PENDING', 'REJECTED', 'SUSPENDED', 'BLOCKED', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'])),
  role: optionalFilter(z.enum(['MEMBER', 'MODERATOR', 'ADMIN'])),
  sort: z.preprocess(v => v === '' ? undefined : v, z.enum(['createdAt:desc', 'createdAt:asc', 'name:asc', 'memberCount:desc']).default('createdAt:desc')),
  dateFrom: optionalFilter(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Invalid date.')),
  before: optionalFilter(z.string().datetime()),
});
