import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

// Existing action names are retained. Modules are explicit classifications, not UI substring filters.
export const auditModules = ['AUTHENTICATION', 'USER', 'MEMBERSHIP', 'PROJECT', 'PUBLICATION', 'GALLERY', 'COMMUNITY', 'SUPPORT', 'INQUIRY', 'MESSAGE', 'DOCUMENT', 'EVENT', 'ANNOUNCEMENT', 'REPORT', 'NOTIFICATION', 'SETTINGS', 'SYSTEM', 'OTHER'] as const;
const groups: Record<string, string[]> = {
  AUTHENTICATION: ['LoginSucceeded', 'LoginFailed', 'Logout', 'PasswordReset', 'PasswordResetFailed', 'AuthenticationThrottled', 'AccessDenied'],
  USER: ['UserProfileUpdated'],
  MEMBERSHIP: ['MembershipApplicationSubmitted', 'MembershipReviewStarted', 'MembershipApproved', 'MembershipRejected', 'MemberIdIssued', 'MembershipApprovalEmailResent', 'MembershipApprovalEmailOutcome'],
  PROJECT: ['ProjectCreated', 'ProjectUpdated', 'ProjectSubmitted', 'ProjectDeleted', 'ProjectStatusChanged'],
  PUBLICATION: ['PublicationSubmitted', 'PublicationUNDER_REVIEW', 'PublicationSUBMITTED', 'PublicationAPPROVED', 'PublicationREJECTED', 'PublicationPUBLISHED'],
  GALLERY: ['GalleryCollectionCreated', 'GalleryCollectionUpdated', 'GalleryCollectionDeleted', 'GalleryPhotoUploaded', 'GalleryPhotoUpdated', 'GalleryPhotoDeleted', 'GalleryReordered'],
  COMMUNITY: ['CommunityCreated', 'CommunityUpdated', 'CommunityDeleted', 'CommunityStatusChanged', 'CommunityJoined', 'CommunityJoinCancelled', 'CommunityLeft', 'CommunityMembershipstatus', 'CommunityMembershiprole', 'CommunityMembershipremove', 'CommunityMessageSent', 'CommunityMessageUpdated', 'CommunityMessageDeleted', 'CommunityMessageRead', 'CommunityMessageUnread', 'CommunityConversationLocked', 'CommunityConversationUnlocked', 'CommunityReported', 'CommunityREPORT_UNDER_REVIEW', 'CommunityHIDE_CONTENT', 'CommunityRESTORE_CONTENT', 'CommunityWARN_MEMBER', 'CommunitySUSPEND_MEMBER', 'CommunityBLOCK_MEMBER', 'CommunityRESOLVE_REPORT', 'CommunityDISMISS_REPORT', 'CommunityREOPEN_REPORT', 'CommunityEvidenceAccessGranted', 'CommunityConnectionRequested', 'CommunityConnectionAccepted', 'CommunityConnectionRemoved', 'CommunityGroupJoined', 'CommunityGroupLeft', 'CommunityThreadCreated', 'CommunityReplyCreated'],
  SUPPORT: ['SupportRequestCreated', 'SupportRequestUpdated', 'SupportRequestStatusChanged', 'SupportInternalNoteAdded', 'SupportReplySent'],
  INQUIRY: ['InquiryCreated', 'InquiryReplied', 'InquiryStatusChanged'],
  MESSAGE: ['ConversationCreated', 'MessageSent'],
  DOCUMENT: ['FileUploaded', 'FileUploadRemoved', 'FileAccessGranted', 'CredentialAccessGranted', 'DocumentExchangeSent'],
  EVENT: ['EventCreated', 'EventUpdated', 'EventPublished', 'EventCancelled', 'EventDeleted', 'EventScheduledPublished', 'EventDeliveryOutcome'],
  ANNOUNCEMENT: ['AnnouncementSaved', 'Announcementpreview', 'Announcementretry', 'Announcementsend', 'Announcementschedule', 'Announcementcancel', 'Announcementdelete', 'AnnouncementSignOff', 'AnnouncementExpired', 'AnnouncementDispatchStarted', 'AnnouncementDeliveryUpdated', 'AnnouncementRead', 'AnnouncementUnread', 'AnnouncementEmailUnsubscribed'],
  REPORT: ['ReportGenerated', 'ReportExported', 'AuditLogExported'],
  NOTIFICATION: ['NotificationsRead', 'NotificationsUnread'], SYSTEM: ['SeedCreated'], SETTINGS: [], OTHER: [],
};
export const eventRegistry = Object.entries(groups).flatMap(([module, actions]) => actions.map(action => ({ action, module })));
export function classifyAction(action: string): string {
  const exact = eventRegistry.find(e => e.action === action);
  if (exact) return exact.module;
  const prefixes: [RegExp, string][] = [[/^Community/, 'COMMUNITY'], [/^Gallery/, 'GALLERY'], [/^Membership|^MemberId/, 'MEMBERSHIP'], [/^Publication/, 'PUBLICATION'], [/^Project/, 'PROJECT'], [/^Support/, 'SUPPORT'], [/^Inquiry/, 'INQUIRY'], [/^Announcement|^Broadcast/, 'ANNOUNCEMENT'], [/^Event/, 'EVENT'], [/^Notification/, 'NOTIFICATION'], [/^Credential|^File|^Document/, 'DOCUMENT'], [/^Report|^AuditLog/, 'REPORT'], [/^User/, 'USER'], [/^Conversation|^Message/, 'MESSAGE'], [/^Login|^Password|^Authentication/, 'AUTHENTICATION']];
  return prefixes.find(([pattern]) => pattern.test(action))?.[1] ?? 'OTHER';
}
export function eventSeverity(action: string): 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER' {
  if (/reject|block|loginfailed|passwordresetfailed|throttled/i.test(action)) return 'DANGER';
  if (/accessgranted|accessdenied|suspend|warn|role|delete|cancel|hide_content|membershipremove/i.test(action)) return 'WARNING';
  if (/approv|publish|complet|resolv|loginsucceeded|deliveryoutcome|memberidissued/i.test(action)) return 'SUCCESS';
  return 'INFO';
}
const filter = z.preprocess(v => v === '' || v === 'All' ? undefined : v, z.string().trim().min(1).max(191).optional());
const date = z.preprocess(v => v === '' ? undefined : v, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Invalid date.').optional());
export const auditQuery = paginationQuerySchema.extend({ search: z.string().trim().max(200).default(''), actorRole: filter, module: filter, action: filter, severity: z.preprocess(v => v === '' || v === 'All' ? undefined : v, z.enum(['INFO', 'SUCCESS', 'WARNING', 'DANGER']).optional()), from: date, to: date, sort: z.enum(['newest', 'oldest']).default('newest') }).strict().refine(v => !v.from || !v.to || v.from <= v.to, { path: ['to'], message: 'End date must not precede start date.' });
export type AuditQuery = z.infer<typeof auditQuery>;
