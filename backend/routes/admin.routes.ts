import { Router } from 'express';
import { z } from 'zod';
import type { ProjectStatus, PublicationStatus, SupportStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import * as service from '../services/platform.service';
import * as supportService from '../services/support.service';
import * as events from '../services/events.service';
import { eventFields } from '../domain/event-input';

const router = Router({ mergeParams: true });

const idParams = z.object({ id: z.string().min(1) });
const noteBody = z.object({
  reviewNotes: z.string().max(4000).optional(),
  reason: z.string().max(4000).optional(),
  comment: z.string().max(4000).optional(),
  response: z.string().max(4000).optional(),
});
const PROJECT_STATUS_VALUES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED'] as const;
/** Display labels the projects grid filters by, mirroring projectStatusLabel. */
const PROJECT_STATUS_LABELS = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Published', 'Archived'] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/**
 * Validated here because labelToProjectStatus falls back to DRAFT on an
 * unrecognized label — an unchecked typo would quietly return the wrong set.
 */
const projectListQuery = z.object({
  q: z.string().max(200).optional(),
  search: z.string().max(200).optional(),
  status: z.enum(['All', ...PROJECT_STATUS_LABELS]).optional(),
  category: z.string().max(120).optional(),
  priority: z.string().max(40).optional(),
  member: z.string().max(200).optional(),
  submittedFrom: isoDate.optional(),
  submittedTo: isoDate.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** A rejection must explain itself; every other note stays optional. */
const rejectionNote = z.string().trim().min(service.REJECTION_NOTE_MIN, 'Explain the decision in at least 10 characters').max(4000);
const projectRejectBody = z
  .object({ reviewNotes: rejectionNote.optional(), reason: rejectionNote.optional() })
  .refine((value) => Boolean(value.reviewNotes ?? value.reason), {
    path: ['reviewNotes'],
    message: 'Review notes are required when rejecting a project',
  });

const projectStatusBody = noteBody
  .extend({ status: z.enum(PROJECT_STATUS_VALUES) })
  .refine(
    (value) => value.status !== 'REJECTED' || (value.reviewNotes ?? value.reason ?? '').trim().length >= service.REJECTION_NOTE_MIN,
    { path: ['reviewNotes'], message: 'Review notes are required when rejecting a project' },
  );

/**
 * Matches the member-side limit; bodies render as text, never HTML. `.strict()`
 * so an unsupported key is a 422 rather than being silently dropped — this one
 * used to swallow fileIds without a word.
 */
const messageBody = z.object({
  body: z.string().trim().min(1).max(10000),
  /** Admin-only note, never shown to the member. */
  internal: z.boolean().optional(),
  /** Ids from POST /files/upload. Ownership is re-checked in the service. */
  fileIds: z.array(z.string()).max(5, 'Attach no more than 5 files').default([]),
  links: z.array(z.object({
    url: z.string().max(2048).url('Enter a valid URL').refine(
      (value) => /^https?:\/\//i.test(value),
      'Use an HTTP or HTTPS URL',
    ),
    label: z.string().max(200).optional(),
  })).max(5, 'Add no more than 5 links').default([]),
}).strict();
const inquiryReplyBody = z.object({ text: z.string().min(1).max(8000) });
const announcementBody = z.object({
  subject: z.string().min(2).max(220),
  body: z.string().min(2).max(20000),
  audience: z.string().default('All Members'),
  channel: z.string().default('email'),
  scheduleMode: z.enum(['draft', 'now', 'scheduled']).optional(),
  scheduledAt: z.string().optional(),
  appendUnsubscribe: z.boolean().optional(),
});

router.use(requireAuth, requireRole('ADMIN'));

router.get('/stats', asyncHandler(async (_req, res) => {
  sendSuccess(res, await service.adminStats(), 'CRO dashboard statistics loaded');
}));

router.get('/members', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminMembers(req), 'Member list');
}));

router.get('/members/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminMemberDetail(req.params.id!), 'Member application details');
}));

router.post('/members/:id/resend-approval-email', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const data = await service.resendApprovalEmail(req.params.id!, req.user!.id);
  sendSuccess(res, data, data.emailSent ? 'Acknowledgement email sent' : 'Acknowledgement email could not be sent');
}));

router.post('/members/:id/review', validate({ params: idParams, body: noteBody }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.reviewMember(req.params.id!, req.user!.id, req.body.reviewNotes), 'Application moved to review');
}));

router.post('/members/:id/approve', validate({ params: idParams, body: noteBody }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.approveMember(req.params.id!, req.user!.id, req.body.reviewNotes), 'Membership approved and permanent ID issued');
}));

router.post('/members/:id/reject', validate({ params: idParams, body: noteBody.extend({ reason: z.string().min(10).max(4000) }) }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.rejectMember(req.params.id!, req.user!.id, req.body.reason, req.body.reviewNotes), 'Application rejected');
}));

router.get('/projects', validate({ query: projectListQuery }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminProjects(req), 'Projects list');
}));

router.get('/projects/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminProjectDetail(req.params.id!), 'Project detail');
}));

const transitionProject = (next: ProjectStatus, message: string) =>
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.transitionProject(req.params.id!, req.user!.id, next, req.body?.reviewNotes ?? req.body?.reason), message);
  });

router.post('/projects/:id/approve', validate({ params: idParams, body: noteBody }), transitionProject('APPROVED', 'Project approved'));
router.post('/projects/:id/reject', validate({ params: idParams, body: projectRejectBody }), transitionProject('REJECTED', 'Project rejected'));
router.patch('/projects/:id/status', validate({ params: idParams, body: projectStatusBody }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.transitionProject(req.params.id!, req.user!.id, req.body.status, req.body.reviewNotes ?? req.body.reason), 'Project status updated');
}));

router.get('/publications', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminPublications(req), 'Publications list');
}));

router.get('/publications/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminPublicationDetail(req.params.id!), 'Publication detail');
}));

const transitionPublication = (next: PublicationStatus, message: string) =>
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.transitionPublication(req.params.id!, req.user!.id, next, req.body?.comment ?? req.body?.reason), message);
  });

router.post('/publications/:id/approve', validate({ params: idParams, body: noteBody }), transitionPublication('APPROVED', 'Publication approved'));
router.post('/publications/:id/reject', validate({ params: idParams, body: noteBody }), transitionPublication('REJECTED', 'Publication rejected'));
router.post('/publications/:id/publish', validate({ params: idParams, body: noteBody }), transitionPublication('PUBLISHED', 'Publication published'));
router.post('/publications/:id/unpublish', validate({ params: idParams, body: noteBody }), transitionPublication('APPROVED', 'Publication removed from public listing'));

router.get('/support', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminSupport(req), 'Support tickets');
}));

const transitionSupport = (next: SupportStatus, message: string) =>
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.transitionSupport(req.params.id!, req.user!.id, next, req.body?.response ?? req.body?.reason ?? req.body?.reviewNotes, req.body?.expectedUpdatedAt), message);
  });

router.get('/support/assignees', asyncHandler(async (_req, res) => sendSuccess(res, await supportService.assignableAdmins(), 'Administrators')));
router.get('/support/:id', asyncHandler(async (req, res) => sendSuccess(res, await supportService.supportDetail(req.params.id!), 'Support request')));
router.patch('/support/:id', validate({ body: supportService.updateBody }), asyncHandler(async (req, res) => sendSuccess(res, await supportService.updateSupport(req.params.id!, req.user!.id, req.body), 'Request updated')));
router.post('/support/:id/messages', validate({ body: messageBody }), asyncHandler(async (req, res) => {
  const conversationId = await supportService.conversationForSupport(req.params.id!);
  sendSuccess(res, await service.postAdminMessage(req.user!.id, conversationId, req.body), 'Reply sent', 201);
}));
router.post('/support/:id/review', validate({ params: idParams, body: supportService.decisionBody }), transitionSupport('UNDER_REVIEW', 'Review started'));
router.post('/support/:id/approve', validate({ params: idParams, body: supportService.decisionBody }), transitionSupport('APPROVED', 'Support approved'));
router.post('/support/:id/reject', validate({ params: idParams, body: supportService.decisionBody }), transitionSupport('REJECTED', 'Support declined'));
router.post('/support/:id/complete', validate({ params: idParams, body: supportService.decisionBody }), transitionSupport('COMPLETED', 'Support resolved'));

router.get('/conversations', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminConversations(req.user!.id, req), 'Conversations list');
}));

router.get('/conversations/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  // No viewer id: an admin may read any thread, internal notes included.
  sendSuccess(res, await service.adminConversationDetail(req.params.id!), 'Conversation detail');
}));

router.post('/conversations/:id/messages', validate({ params: idParams, body: messageBody }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.postAdminMessage(req.user!.id, req.params.id!, req.body), 'CRO reply posted');
}));

router.post('/conversations/:id/read', validate({ params: idParams }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.markConversationRead(req.user!.id, req.params.id!), 'Conversation marked read');
}));

router.get('/events', validate({ query: events.eventQuery }), asyncHandler(async (req, res) => {
  sendSuccess(res, await events.listEvents(events.eventQuery.parse(req.query)), 'Events list');
}));

router.post('/events', validate({ body: eventFields.partial() }), asyncHandler(async (req, res) => {
  sendSuccess(res, await events.saveEvent(req.user!.id, req.body), 'Event created', 201);
}));

router.get('/events/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  sendSuccess(res, await events.adminEventDetail(req.params.id!), 'Event detail');
}));

router.patch('/events/:id', validate({ params: idParams, body: eventFields.partial() }), asyncHandler(async (req, res) => {
  sendSuccess(res, await events.saveEvent(req.user!.id, req.body, req.params.id!), 'Event updated');
}));

router.post('/events/:id/publish', validate({ params: idParams }), asyncHandler(async (req, res) => {
  sendSuccess(res, await events.publishEvent(req.user!.id, req.params.id!), 'Event published');
}));
router.post('/events/:id/cancel', validate({ params: idParams, body: events.cancelBody }), asyncHandler(async (req, res) => {
  sendSuccess(res, await events.cancelEvent(req.params.id!, req.body), 'Event cancelled');
}));
router.delete('/events/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  sendSuccess(res, await events.deleteEvent(req.params.id!), 'Event deleted');
}));

router.get('/inquiries', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminInquiries(req), 'Inquiries list');
}));

router.post('/inquiries/:id/reply', validate({ params: idParams, body: inquiryReplyBody }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.replyInquiry(req.params.id!, req.user!.id, req.body.text), 'Inquiry reply sent');
}));

router.post('/inquiries/:id/close', validate({ params: idParams, body: noteBody }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.changeInquiryStatus(req.params.id!, req.user!.id, 'CLOSED', req.body?.reason), 'Inquiry closed');
}));

router.post('/inquiries/:id/spam', validate({ params: idParams, body: noteBody }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.changeInquiryStatus(req.params.id!, req.user!.id, 'SPAM', req.body?.reason), 'Marked as spam');
}));

router.get('/announcements', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminAnnouncements(req), 'Announcements list');
}));

router.post('/announcements', validate({ body: announcementBody }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.createAnnouncement(req.user!.id, req.body), 'Announcement saved', 201);
}));

router.get('/gallery', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.gallery(req, true), 'Gallery assets');
}));

router.get('/audit-log', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminAuditLog(req), 'Audit log page');
}));

router.get('/reports', asyncHandler(async (_req, res) => {
  sendSuccess(res, await service.adminReports(), 'Report definitions');
}));

router.get('/reports/:reportKey/run', asyncHandler(async (req, res) => {
  sendSuccess(res, { reportKey: req.params.reportKey, generated: true, rows: [] }, 'Report generated');
}));

router.get('/settings', asyncHandler(async (_req, res) => {
  sendSuccess(res, await service.adminSettings(), 'Platform settings');
}));

export default router;
