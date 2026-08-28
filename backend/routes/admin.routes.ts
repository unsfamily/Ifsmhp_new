import { Router } from 'express';
import { z } from 'zod';
import type { ProjectStatus, PublicationStatus, SupportStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import * as service from '../services/platform.service';

const router = Router({ mergeParams: true });

const idParams = z.object({ id: z.string().min(1) });
const noteBody = z.object({
  reviewNotes: z.string().max(4000).optional(),
  reason: z.string().max(4000).optional(),
  comment: z.string().max(4000).optional(),
  response: z.string().max(4000).optional(),
});
const messageBody = z.object({ body: z.string().min(1).max(8000) });
const inquiryReplyBody = z.object({ text: z.string().min(1).max(8000) });
const eventBody = z.object({
  title: z.string().min(2),
  slug: z.string().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  date: z.coerce.date(),
  timeStart: z.string().default('09:00'),
  timeEnd: z.string().default('10:00'),
  timezone: z.string().default('UTC'),
  location: z.string().default('Online'),
  format: z.string().default('Virtual'),
  audience: z.string().default('All Members'),
  capacity: z.coerce.number().int().positive().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'PAST', 'CANCELLED']).default('DRAFT'),
});
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

router.get('/projects', asyncHandler(async (req, res) => {
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
router.post('/projects/:id/reject', validate({ params: idParams, body: noteBody }), transitionProject('REJECTED', 'Project rejected'));
router.patch('/projects/:id/status', validate({ params: idParams, body: noteBody.extend({ status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED']) }) }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.transitionProject(req.params.id!, req.user!.id, req.body.status, req.body.reviewNotes), 'Project status updated');
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
    sendSuccess(res, await service.transitionSupport(req.params.id!, req.user!.id, next, req.body?.response ?? req.body?.reason), message);
  });

router.post('/support/:id/approve', validate({ params: idParams, body: noteBody }), transitionSupport('APPROVED', 'Support approved'));
router.post('/support/:id/reject', validate({ params: idParams, body: noteBody }), transitionSupport('REJECTED', 'Support declined'));
router.post('/support/:id/complete', validate({ params: idParams, body: noteBody }), transitionSupport('COMPLETED', 'Support resolved'));

router.get('/conversations', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminConversations(req), 'Conversations list');
}));

router.get('/conversations/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminConversationDetail(req.params.id!), 'Conversation detail');
}));

router.post('/conversations/:id/messages', validate({ params: idParams, body: messageBody }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.postMemberMessage(req.user!.id, req.params.id!, req.body.body), 'CRO reply posted');
}));

router.get('/events', asyncHandler(async (req, res) => {
  sendSuccess(res, await service.adminEvents(req), 'Events list');
}));

router.post('/events', validate({ body: eventBody }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.upsertEvent(req.body), 'Event created', 201);
}));

router.get('/events/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.eventDetail(req.params.id!), 'Event detail');
}));

router.patch('/events/:id', validate({ params: idParams, body: eventBody.partial() }), asyncHandler(async (req, res) => {
  sendSuccess(res, await service.upsertEvent(req.body, req.params.id!), 'Event updated');
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
