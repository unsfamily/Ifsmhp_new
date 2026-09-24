import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import {
  requireAuth,
  requireRole,
  requireMembershipStatus,
} from '../middleware/auth';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import * as service from '../services/platform.service';
import * as supportService from '../services/support.service';
import * as exchange from '../services/document-exchange.service';
import * as announcements from '../services/member-announcements.service';
import { exchangeSendBody } from '../domain/document-exchange';
import { memberPhoneSchema } from '../domain/member-profile';
import { projectDateFields, validateProjectRange } from '../domain/project-timeline';

const router = Router({ mergeParams: true });

/**
 * Member-scoped routes — dashboard, own projects, publications, messages, etc.
 *
 * Authorization model (architecture §B):
 *  - Every endpoint: requireAuth + requireRole(MEMBER) (ADMIN allowed via bypass)
 *  - Object scoped endpoints (/:id): service-layer uses `ensureOwnershipOrAdmin`.
 *  - "Not found" and "not yours" both return 404 (R5).
 *
 * This file is the structural scaffold; Milestone 8-11 implement real logic.
 */

router.use(requireAuth, requireRole('MEMBER'), requireMembershipStatus('ACTIVE'));
router.get('/me/announcements', asyncHandler(async (req, res) => sendSuccess(res, await announcements.listMemberAnnouncements(req.user!.id, req.query), 'Announcements')));
router.get('/me/announcements/:id', asyncHandler(async (req, res) => sendSuccess(res, await announcements.memberAnnouncementDetail(req.user!.id, req.params.id!), 'Announcement')));
for (const action of ['read', 'unread'] as const) {
  router.post(`/me/announcements/:id/${action}`, asyncHandler(async (req, res) => sendSuccess(res, await announcements.setAnnouncementRead(req.user!.id, req.params.id!, action === 'read'), 'Announcement updated')));
}

const projectFieldsSchema = z.object({
  title: z.string().min(4).max(220),
  category: z.string().min(2).max(120),
  description: z.string().min(20).max(15000),
  ...projectDateFields,
  budget: z.string().max(120).optional(),
  supportTypes: z.array(z.string()).default([]),
  /** Ids from POST /files/upload. Ownership is re-checked in the service. */
  fileIds: z.array(z.string()).max(10, 'Attach no more than 10 files').default([]),
  resourceLinks: z.array(z.object({
    url: z.string().max(2048).url('Enter a valid URL').refine(
      (value) => /^https?:\/\//i.test(value),
      'Use an HTTP or HTTPS URL',
    ),
    label: z.string().max(200).optional(),
  })).max(20, 'Add no more than 20 links').default([]),
  submit: z.boolean().default(true),
}).strict();
const projectSchema = projectFieldsSchema.superRefine(validateProjectRange);

/**
 * Same fields, all optional — members may edit one field at a time.
 * Attachments and links are creation-time only, so they are omitted here rather
 * than accepted and silently ignored.
 */
const projectUpdateSchema = projectFieldsSchema
  .omit({ fileIds: true, resourceLinks: true })
  .partial()
  .strict()
  .superRefine((value, ctx) => {
    if (value.fromDate === undefined && value.toDate === undefined) return;
    if (value.fromDate === undefined) ctx.addIssue({ code: 'custom', path: ['fromDate'], message: 'From Date is required' });
    else if (value.toDate === undefined) ctx.addIssue({ code: 'custom', path: ['toDate'], message: 'To Date is required' });
    else validateProjectRange({ fromDate: value.fromDate, toDate: value.toDate }, ctx);
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), 'Provide at least one field to update');

const supportSchema = supportService.createBody;

/**
 * A manuscript sent through the member "Submit New Paper" form.
 *
 * Mirrors the client-side rules so a member never gets a surprise rejection
 * after a long upload, and the declarations are `literal(true)` rather than
 * booleans — an unticked box has to fail here, not just in the browser.
 */
const publicationSchema = z.object({
  title: z.string().trim().min(4, 'Paper title is required.').max(300),
  category: z.enum(service.PUBLICATION_CATEGORIES, { errorMap: () => ({ message: 'Select a category.' }) }),
  researchType: z.enum(service.PUBLICATION_RESEARCH_TYPES, { errorMap: () => ({ message: 'Select an article type.' }) }),
  venue: z.string().trim().min(2, 'Select a preferred journal.').max(220),
  authors: z.string().trim().min(2, 'Enter all author names.').max(2000),
  correspondingAuthor: z.string().trim().min(2, 'Corresponding author is required.').max(200),
  correspondingEmail: z.string().trim().email('Enter a valid email address.').max(200),
  orcid: z.string().trim().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, 'Enter an ORCID as 0000-0000-0000-0000.').optional(),
  abstract: z.string().trim().min(100, 'Abstract must contain at least 100 characters.').max(4000),
  keywords: z.string().trim().min(2, 'Enter at least three keywords.').max(500),
  funding: z.string().trim().max(4000).optional(),
  conflicts: z.string().trim().min(1, 'Enter a conflict-of-interest statement or "None".').max(4000),
  ethicsApproval: z.string().trim().max(4000).optional(),
  coverLetter: z.string().trim().max(4000).optional(),
  /** Ids from POST /files/upload. Ownership is re-checked in the service. */
  manuscriptFileId: z.string().min(1, 'Upload the manuscript PDF.'),
  supplementaryFileId: z.string().min(1).optional(),
  confirmOriginal: z.literal(true, {
    errorMap: () => ({ message: 'Confirm that this is original work.' }),
  }),
  confirmPolicy: z.literal(true, {
    errorMap: () => ({ message: 'Accept the publication policy.' }),
  }),
}).strict();

/**
 * What may ride along with a message. `.url()` alone accepts ftp: and other
 * schemes, so the refine is the guard against a javascript:/data: URL in a chip
 * the recipient will click.
 */
const messageExtras = {
  /** Ids from POST /files/upload. Ownership is re-checked in the service. */
  fileIds: z.array(z.string()).max(5, 'Attach no more than 5 files').default([]),
  links: z.array(z.object({
    url: z.string().max(2048).url('Enter a valid URL').refine(
      (value) => /^https?:\/\//i.test(value),
      'Use an HTTP or HTTPS URL',
    ),
    label: z.string().max(200).optional(),
  })).max(5, 'Add no more than 5 links').default([]),
};

const messageSchema = z.object({
  body: z.string().trim().min(1).max(10000),
  ...messageExtras,
}).strict();

/** A member opening a new thread with the CRO. */
const newConversationSchema = z.object({
  subject: z.string().trim().min(4).max(220),
  category: z.string().trim().min(2).max(120),
  body: z.string().trim().min(1).max(10000),
  ...messageExtras,
}).strict();

const optionalText = (schema: z.ZodType<string>) => z.preprocess(
  (value) => typeof value === 'string' ? value.trim() || null : value,
  schema.nullable().optional(),
);
const professionalUrl = z.string().max(2048).url('Enter a valid URL').refine(
  (value) => /^https?:\/\//i.test(value),
  'Use an HTTP or HTTPS URL',
);
const profileSchema = z.object({
  phone: memberPhoneSchema.optional(),
  websiteUrl: optionalText(professionalUrl),
  scholarUrl: optionalText(professionalUrl),
  orcid: optionalText(z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, 'Enter an ORCID in the format 0000-0000-0000-0000')),
}).strict().refine((value) => Object.values(value).some((field) => field !== undefined), 'Provide at least one editable field');

/** Dashboard summary */
router.get(
  '/me/dashboard',
  asyncHandler(async (req, res) => {
    const data = await service.memberDashboard(req.user!.id);
    sendSuccess(res, data, 'Member dashboard');
  })
);

/** Own projects (members always see ONLY their own list) */
router.get(
  '/me/projects',
  asyncHandler(async (req, res) => {
    const data = await service.memberProjects(req.user!.id, req);
    sendSuccess(res, data, 'My projects');
  })
);

router.post(
  '/me/projects',
  validate({ body: projectSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.createProject(req.user!.id, req.body);
    sendSuccess(res, data, 'Project saved', 201);
  })
);

router.get(
  '/me/projects/:projectId',
  asyncHandler(async (req, res) => {
    const data = await service.memberProjectDetail(req.user!.id, req.params.projectId!);
    sendSuccess(res, { project: data }, 'Project detail');
  })
);

/**
 * Edit / delete are owner-only and only while the CRO has not started review;
 * both guards live in the service, which 404s on a project that is not yours.
 */
router.patch(
  '/me/projects/:projectId',
  validate({ body: projectUpdateSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.updateMemberProject(req.user!.id, req.params.projectId!, req.body);
    sendSuccess(res, data, 'Project updated');
  })
);

router.delete(
  '/me/projects/:projectId',
  asyncHandler(async (req, res) => {
    const data = await service.deleteMemberProject(req.user!.id, req.params.projectId!);
    sendSuccess(res, data, 'Project deleted');
  })
);

/** Own publications — members see their own draft/submitted work */
router.get('/me/publications', asyncHandler(async (req, res) => sendSuccess(res, await service.memberPublications(req.user!.id, req), 'My publications')));

/**
 * Submit a manuscript. The author is always the caller — there is no ownership
 * field in the body, so a member cannot file a paper under someone else's name.
 */
router.post(
  '/me/publications',
  validate({ body: publicationSchema }),
  asyncHandler(async (req, res) =>
    sendSuccess(res, await service.createPublication(req.user!.id, req.body), 'Paper submitted for review', 201))
);

/** Own messages / conversations */
router.get(
  '/me/conversations',
  asyncHandler(async (req, res) => sendSuccess(res, await service.memberConversations(req.user!.id, req), 'My conversations'))
);
router.get(
  '/me/conversations/:id',
  // Scoped to the caller: a thread they do not take part in reads as 404, and
  // internal CRO notes are filtered out entirely.
  asyncHandler(async (req, res) =>
    sendSuccess(
      res,
      await service.adminConversationDetail(req.params.id!, req.user!.id, { includeInternal: false }),
      'Conversation detail',
    ))
);
router.post(
  '/me/conversations',
  validate({ body: newConversationSchema }),
  asyncHandler(async (req, res) => sendSuccess(res, await service.createMemberConversation(req.user!.id, req.body), 'Conversation started', 201))
);
router.post(
  '/me/conversations/:id/messages',
  validate({ body: messageSchema }),
  asyncHandler(async (req, res) => sendSuccess(res, await service.postMemberMessage(req.user!.id, req.params.id!, req.body), 'Message sent'))
);
router.post(
  '/me/conversations/:id/read',
  asyncHandler(async (req, res) => sendSuccess(res, await service.markConversationRead(req.user!.id, req.params.id!), 'Conversation marked read'))
);

/** Support Requests (Members own their tickets) */
router.get(
  '/me/support',
  asyncHandler(async (req, res) => sendSuccess(res, await service.memberSupport(req.user!.id, req), 'My support requests'))
);
router.post(
  '/me/support',
  validate({ body: supportSchema }),
  asyncHandler(async (req, res) => sendSuccess(res, await service.createSupport(req.user!.id, req.body), 'Support request created', 201))
);

router.get('/me/support/:id', asyncHandler(async (req, res) => {
  sendSuccess(res, await supportService.supportDetail(req.params.id!, req.user!.id), 'Support request');
}));
router.post('/me/support/:id/messages', validate({ body: messageSchema }), asyncHandler(async (req, res) => {
  const conversationId = await supportService.conversationForSupport(req.params.id!, req.user!.id);
  sendSuccess(res, await service.postMemberMessage(req.user!.id, conversationId, req.body), 'Reply sent', 201);
}));

/** Document Exchange — members only access their own authorized documents */
router.get(
  '/me/documents',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await exchange.listDocuments(req.user!.id, req.query), 'My documents');
  })
);

/** Own profile — member editable fields only (admin-only fields never exposed via serializers) */
router.get('/me/document-exchange', asyncHandler(async (req, res) => sendSuccess(res, await exchange.summary(req.user!.id), 'Document Exchange')));
router.get('/me/document-exchange/items', asyncHandler(async (req, res) => sendSuccess(res, await exchange.listItems(req.user!.id, req.query), 'Exchange items')));
router.post('/me/document-exchange/items', validate({ body: exchangeSendBody }), asyncHandler(async (req, res) => sendSuccess(res, await exchange.send(req.user!.id, req.body), 'Sent to CRO', 201)));

router.get('/me/profile', asyncHandler(async (req, res) => sendSuccess(res, await service.memberProfile(req.user!.id), 'My profile')));
router.patch('/me/profile', validate({ body: profileSchema }), asyncHandler(async (req, res) => sendSuccess(res, await service.updateMemberProfile(req.user!.id, req.body), 'Profile updated')));

/**
 * Community — the member directory, interest groups, discussions and
 * member-to-member messages. Everything below is scoped to `req.user!.id`; a
 * member may only ever act as themselves.
 */
const connectionBody = z.object({ profileId: z.string().min(1) }).strict();
const threadBody = z.object({
  // States the rule rather than gesturing at it — a caller that is not the
  // Community form has to be able to act on this message.
  title: z
    .string()
    .trim()
    .min(service.DISCUSSION_TITLE_MIN, `Give the discussion a title of at least ${service.DISCUSSION_TITLE_MIN} characters`)
    .max(service.DISCUSSION_TITLE_MAX, `Keep the title under ${service.DISCUSSION_TITLE_MAX} characters`),
}).strict();
const replyBody = z.object({
  body: z.string().trim().min(1, 'Write a reply before posting').max(10000),
}).strict();
const directMessageBody = z.object({
  body: z.string().trim().min(1, 'Write a message before sending').max(10000),
}).strict();

router.get('/me/community', asyncHandler(async (req, res) => sendSuccess(res, await service.memberCommunity(req.user!.id, req), 'Member community')));

router.post(
  '/me/community/connections',
  validate({ body: connectionBody }),
  asyncHandler(async (req, res) => sendSuccess(res, await service.requestConnection(req.user!.id, req.body.profileId), 'Connection updated'))
);
router.delete(
  '/me/community/connections/:profileId',
  asyncHandler(async (req, res) => sendSuccess(res, await service.removeConnection(req.user!.id, req.params.profileId!), 'Connection removed'))
);

router.post(
  '/me/community/groups/:groupId/join',
  asyncHandler(async (req, res) => sendSuccess(res, await service.joinGroup(req.user!.id, req.params.groupId!), 'Joined group'))
);
router.delete(
  '/me/community/groups/:groupId/join',
  asyncHandler(async (req, res) => sendSuccess(res, await service.leaveGroup(req.user!.id, req.params.groupId!), 'Left group'))
);

router.post(
  '/me/community/threads',
  validate({ body: threadBody }),
  asyncHandler(async (req, res) => sendSuccess(res, await service.createDiscussionThread(req.user!.id, req.body), 'Discussion started', 201))
);
router.get(
  '/me/community/threads/:threadId',
  asyncHandler(async (req, res) => sendSuccess(res, await service.threadDetail(req.user!.id, req.params.threadId!), 'Discussion detail'))
);
router.post(
  '/me/community/threads/:threadId/replies',
  validate({ body: replyBody }),
  asyncHandler(async (req, res) => sendSuccess(res, await service.replyToThread(req.user!.id, req.params.threadId!, req.body.body), 'Reply posted', 201))
);

router.get(
  '/me/community/messages/:memberId',
  asyncHandler(async (req, res) => sendSuccess(res, await service.directConversation(req.user!.id, req.params.memberId!), 'Direct conversation'))
);
router.post(
  '/me/community/messages/:memberId',
  validate({ body: directMessageBody }),
  asyncHandler(async (req, res) => sendSuccess(res, await service.sendDirectMessage(req.user!.id, req.params.memberId!, req.body.body), 'Message sent', 201))
);

export default router;
