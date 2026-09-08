import { apiClient } from './client';
import type { ProjectStatusLabel, SupportKindLabel } from './member';

export type { ProjectStatusLabel, SupportKindLabel };

interface Envelope<T> {
  success: true;
  data: T;
}

export type ApplicationStatusLabel = 'Pending' | 'Under Review' | 'Approved' | 'Rejected';
/** The account lifecycle — distinct from the application status above. */
export type AccountStatusLabel = 'Pending' | 'Active' | 'Rejected' | 'Suspended' | 'Deactivated';
export type ApplicationPriority = 'Standard' | 'High' | 'Urgent';

/** One row of the membership queue, as returned by `GET /admin/members`. */
export interface AdminMemberRow {
  /** Application id when one exists, else the user id. Accepted by every /members/:id action. */
  id: string;
  userId: string;
  name: string;
  email: string;
  memberId: string | null;
  professionalType: string;
  professionalTitle: string | null;
  institution: string;
  country: string;
  registrationDate: string;
  submittedAt: string | null;
  /** Application status — what the review queue filters on. */
  status: ApplicationStatusLabel;
  /** Account status — what the members directory filters on. */
  accountStatus: AccountStatusLabel;
  approvedAt: string | null;
  approvalEmailSentAt: string | null;
  approvalEmailError: string | null;
  priority: ApplicationPriority;
  applicationId?: string;
  /** Days the application has been waiting, computed server-side. */
  slaDays: number;
  highestDegree: string | null;
}

export interface ApproveResult {
  issued: boolean;
  memberId: string;
  /** False when the member was approved but could not be notified. */
  emailSent: boolean;
  emailError?: string;
}

export interface AdminMembersResult {
  items: AdminMemberRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
  /** Whole-queue totals, so the summary tiles do not describe only the current page. */
  counts: { pending: number; underReview: number; urgent: number; approvedToday: number; inQueue: number };
  /** Account-lifecycle totals across the whole directory. */
  accountCounts: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
    deactivated: number;
    rejected: number;
  };
  /** Professional types actually present in the data, for the filter options. */
  professionalTypes: string[];
}

export interface AdminMemberDetail {
  id: string;
  applicationId: string;
  fullName: string;
  email: string;
  phone: string | null;
  professionalTitle: string | null;
  professionalType: string;
  institution: string;
  country: string | null;
  biography: string | null;
  researchInterests: string[];
  education: { id: string; degree: string; institution: string; field?: string | null; endYear?: string | null; detail?: string | null }[];
  credentials: {
    id: string;
    title: string;
    issuer: string | null;
    year: string | null;
    type: string;
    fileName: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    fileSize: string;
    uploadedAt: string;
    fileId: string | null;
  }[];
  credentialsText: string;
  educationText: string;
  researchText: string;
  submittedAt: string;
  status: ApplicationStatusLabel;
  statusValue: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  reviewNotes: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  approvalEmailSentAt: string | null;
  approvalEmailError: string | null;
  approvalEmailAttempts: number;
  slaDays: number;
  statusHistory: { id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }[];
  memberId: string | null;
}

/** Raw enum values the transition endpoints expect, unlike the display labels used for filtering. */
export type ProjectStatusValue =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';

/** One row of the project review queue, as returned by `GET /admin/projects`. */
export interface AdminProjectRow {
  id: string;
  title: string;
  category: string;
  status: ProjectStatusLabel;
  support: SupportKindLabel[];
  /** ISO timestamp, or null while the project is still a draft. */
  submitted: string | null;
  updated: string;
  views: number;
  priority: string;
  description: string;
  member?: string;
  memberId?: string | null;
  /** Days the project has waited since submission — drives the SLA colouring. */
  queueDays: number;
}

/** Standing KPIs for the queue, computed over every live project rather than the filtered page. */
export interface AdminProjectCounts {
  total: number;
  inReview: number;
  approved: number;
  published: number;
  slaBreach: number;
  urgent: number;
}

export interface AdminProjectsResult {
  items: AdminProjectRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
  counts: AdminProjectCounts;
  /** Distinct categories actually present in the data, for the filter dropdown. */
  categories: string[];
}

export interface AdminProjectHistoryEntry {
  id: string;
  from: ProjectStatusLabel | null;
  to: ProjectStatusLabel;
  note: string | null;
  actor: string;
  at: string;
}

export interface AdminProjectFile {
  id: string;
  name: string;
  kind: string;
  size: number;
}

export interface AdminProjectDetail extends AdminProjectRow {
  timeline: string | null;
  budget: string | null;
  files: AdminProjectFile[];
  resourceLinks: { id: string; url: string; label: string | null }[];
  history: AdminProjectHistoryEntry[];
  linkedSupport: { id: string; status: string } | null;
}

const get = async (url: string, params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>(url, { params })).data.data;
const post = async (url: string, payload?: unknown) => (await apiClient.post<Envelope<unknown>>(url, payload ?? {})).data.data;
const patch = async (url: string, payload?: unknown) => (await apiClient.patch<Envelope<unknown>>(url, payload ?? {})).data.data;

export const adminApi = {
  stats: () => get('/admin/stats'),
  members: (params?: Record<string, unknown>) => get('/admin/members', params) as Promise<AdminMembersResult>,
  member: (id: string) => get(`/admin/members/${id}`) as Promise<AdminMemberDetail>,
  reviewMember: (id: string, reviewNotes?: string) => post(`/admin/members/${id}/review`, { reviewNotes }),
  approveMember: (id: string, reviewNotes?: string) =>
    post(`/admin/members/${id}/approve`, { reviewNotes }) as Promise<ApproveResult>,
  /** Retries a failed acknowledgement. Refused once one has been sent. */
  resendApprovalEmail: (id: string) =>
    post(`/admin/members/${id}/resend-approval-email`) as Promise<{ emailSent: boolean; emailError?: string }>,
  rejectMember: (id: string, reason: string) => post(`/admin/members/${id}/reject`, { reason }),
  projects: (params?: Record<string, unknown>) => get('/admin/projects', params) as Promise<AdminProjectsResult>,
  project: (id: string) => get(`/admin/projects/${id}`) as Promise<AdminProjectDetail>,
  /** Any move in the state machine. Takes the raw enum value, not the display label. */
  transitionProject: (id: string, status: ProjectStatusValue, reviewNotes?: string) =>
    patch(`/admin/projects/${id}/status`, { status, reviewNotes }),
  approveProject: (id: string, reviewNotes?: string) => post(`/admin/projects/${id}/approve`, { reviewNotes }),
  /** Notes are mandatory — the server refuses a rejection under 10 characters. */
  rejectProject: (id: string, reviewNotes: string) => post(`/admin/projects/${id}/reject`, { reviewNotes }),
  publications: (params?: Record<string, unknown>) => get('/admin/publications', params),
  publication: (id: string) => get(`/admin/publications/${id}`),
  publishPublication: (id: string) => post(`/admin/publications/${id}/publish`),
  support: (params?: Record<string, unknown>) => get('/admin/support', params),
  completeSupport: (id: string, response?: string) => post(`/admin/support/${id}/complete`, { response }),
  conversations: (params?: Record<string, unknown>) => get('/admin/conversations', params),
  conversation: (id: string) => get(`/admin/conversations/${id}`),
  sendMessage: (id: string, body: string) => post(`/admin/conversations/${id}/messages`, { body }),
  events: (params?: Record<string, unknown>) => get('/admin/events', params),
  createEvent: (payload: unknown) => post('/admin/events', payload),
  updateEvent: (id: string, payload: unknown) => patch(`/admin/events/${id}`, payload),
  inquiries: (params?: Record<string, unknown>) => get('/admin/inquiries', params),
  replyInquiry: (id: string, text: string) => post(`/admin/inquiries/${id}/reply`, { text }),
  announcements: (params?: Record<string, unknown>) => get('/admin/announcements', params),
  createAnnouncement: (payload: unknown) => post('/admin/announcements', payload),
  gallery: (params?: Record<string, unknown>) => get('/admin/gallery', params),
  auditLog: (params?: Record<string, unknown>) => get('/admin/audit-log', params),
  reports: () => get('/admin/reports'),
  settings: () => get('/admin/settings'),
};
