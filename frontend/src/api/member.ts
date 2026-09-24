import { apiClient } from './client';
import type { ConversationDetail, ConversationsResult, MessageExtras } from './messaging';
import type { PublicationBase, PublicationDecision } from './publications';

export type * from './messaging';

interface Envelope<T> {
  success: true;
  data: T;
}

export interface MemberCredentialDocument {
  id: string;
  title: string;
  type: string;
  fileId: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  fileSize: string;
  uploadedAt: string;
}

export interface MemberProfileData {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  memberId: string | null;
  professionalTitle: string | null;
  professionalType: string;
  institution: string;
  country: string | null;
  biography: string | null;
  status: string;
  applicationStatus: string | null;
  approvedAt: string | null;
  websiteUrl: string | null;
  scholarUrl: string | null;
  orcid: string | null;
  education: Array<{
    id: string; degree: string; institution: string; field: string | null;
    startYear: string | null; endYear: string | null; detail: string | null;
  }>;
  researchInterests: string[];
  stats: { projects: number; publications: number; supportRequests: number };
  publications: Array<{
    id: string; title: string; venue: string | null; publishedAt: string | null; doi: string | null;
    fileId: string | null; fileName: string | null; mimeType: string | null;
  }>;
  credentials: MemberCredentialDocument[];
}

export type MemberProfileUpdate = Pick<MemberProfileData, 'websiteUrl' | 'scholarUrl' | 'orcid'> & { phone: string };

/** Display labels produced by the API's `projectStatusLabel` map — not the enum. */
export type ProjectStatusLabel =
  | 'Draft' | 'Submitted' | 'Under Review'
  | 'Approved' | 'Rejected' | 'Published' | 'Archived';

export type SupportKindLabel = 'Moral' | 'Official' | 'Funding';

export interface MemberProject {
  id: string;
  title: string;
  category: string;
  status: ProjectStatusLabel;
  support: SupportKindLabel[];
  submitted: string | null;
  updated: string;
  views: number;
  priority: string;
  description: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface MemberProjectFile {
  id: string;
  name: string;
  kind: string;
  size: number;
}

export interface MemberProjectHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
}

export interface MemberProjectResourceLink {
  id: string;
  url: string;
  label: string | null;
}

export interface MemberProjectDetail extends MemberProject {
  timeline: string | null;
  fromDate: string | null;
  toDate: string | null;
  budget: string | null;
  files: MemberProjectFile[];
  resourceLinks: MemberProjectResourceLink[];
  history: MemberProjectHistoryEntry[];
}

/** Shape returned by POST /files/upload. */
export interface UploadedFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ProjectResourceLinkInput {
  url: string;
  label?: string;
}

export interface MemberProjectUpdate {
  title: string;
  category: string;
  description: string;
  fromDate: string;
  toDate: string;
  budget: string;
  supportTypes: string[];
  submit: boolean;
}

export type MemberProjectCreate = Pick<MemberProjectUpdate, 'title' | 'category' | 'description' | 'fromDate' | 'toDate'> &
  Partial<Pick<MemberProjectUpdate, 'budget' | 'supportTypes' | 'submit'>> & {
    fileIds?: string[];
    resourceLinks?: ProjectResourceLinkInput[];
  };

/**
 * Publication types live in `./publications`, which both this module and the
 * admin client import. Re-exported here so existing member-side imports keep
 * working unchanged.
 */
export type { PublicationStatusLabel, PublicationFile, PublicationDecision } from './publications';
export { manuscriptOf, PUBLICATION_CATEGORIES } from './publications';

/** A publication as its own author sees it. */
export interface MemberPublication extends PublicationBase {
  /** The most recent editorial decision, or null until an editor has acted. */
  decisionNote: PublicationDecision | null;
}

export interface MemberPublicationStats {
  total: number;
  published: number;
  views: number;
  downloads: number;
  /** Signed % change in views, last 30 days vs the 30 before. Null with no prior window. */
  readershipTrend: number | null;
}

export type MemberPublicationsResult = Paginated<MemberPublication> & { stats: MemberPublicationStats };

/** The payload POST /members/me/publications accepts. */
export interface NewPublication {
  title: string;
  category: string;
  researchType: string;
  venue: string;
  authors: string;
  correspondingAuthor: string;
  correspondingEmail: string;
  orcid?: string;
  abstract: string;
  keywords: string;
  funding?: string;
  conflicts: string;
  ethicsApproval?: string;
  coverLetter?: string;
  manuscriptFileId: string;
  supplementaryFileId?: string;
  confirmOriginal: true;
  confirmPolicy: true;
}

/**
 * Mirrors the server's `DISCUSSION_TITLE_MIN` / `_MAX`. The form enforces the
 * same bounds so a title that would be refused can never be submitted.
 */
export const DISCUSSION_TITLE_MIN = 8;
export const DISCUSSION_TITLE_MAX = 220;

/** Where the caller stands with another member, from their point of view. */
export type ConnectionStatus = 'none' | 'requested' | 'connected';

/**
 * One row of the member directory. Connections are keyed on `id` (the profile),
 * direct messages on `userId` — the two id spaces are not interchangeable.
 */
export interface CommunityMember {
  id: string;
  userId: string;
  name: string;
  title: string;
  institution: string;
  country: string | null;
  type: string;
  interests: string[];
  projects: number;
  pubs: number;
  connectionStatus: ConnectionStatus;
}

export interface CommunityGroup {
  id: string;
  name: string;
  members: number;
  tag: string;
  joined: boolean;
}

export interface CommunityThread {
  id: string;
  title: string;
  replies: number;
  lastPost: string;
  category: string;
  author: string;
}

export interface CommunityStats {
  totalMembers: number;
  countries: number;
  groups: number;
  /** Members who signed in within the last 15 minutes — the closest thing to presence. */
  online: number;
}

export interface CommunityResult {
  members: Paginated<CommunityMember>;
  groups: CommunityGroup[];
  threads: CommunityThread[];
  stats: CommunityStats;
}

export interface CommunityReply {
  id: string;
  body: string;
  author: string;
  at: string;
  mine: boolean;
}

export interface CommunityThreadDetail {
  id: string;
  title: string;
  category: string;
  author: string;
  lastPost: string;
  replies: CommunityReply[];
}

export interface DirectMessage {
  id: string;
  body: string;
  author: string;
  at: string;
  mine: boolean;
}

export interface DirectConversation {
  peer: { id: string; fullName: string };
  /** Null until the first message starts the thread. */
  conversationId: string | null;
  messages: DirectMessage[];
}

/**
 * One file exchanged in a conversation. The Document Exchange page is fed
 * entirely by message attachments, so this is a flattened view of them.
 */
export interface MemberDocument {
  /** The FileObject id — what the download route takes. */
  id: string;
  name: string;
  type: string;
  size: number;
  sender: string;
  direction: 'incoming' | 'outgoing';
  date: string;
  /** The body of the message it arrived on. */
  note: string;
}

/** Members may only edit or delete a project the CRO has not picked up yet. */
export const MEMBER_EDITABLE_STATUSES: ProjectStatusLabel[] = ['Draft', 'Submitted'];
export function isMemberEditable(status: ProjectStatusLabel) {
  return MEMBER_EDITABLE_STATUSES.includes(status);
}

export const memberApi = {
  dashboard: async () => (await apiClient.get<Envelope<unknown>>('/members/me/dashboard')).data.data,
  profile: async () => (await apiClient.get<Envelope<MemberProfileData>>('/members/me/profile')).data.data,
  updateProfile: async (payload: Partial<MemberProfileUpdate>) =>
    (await apiClient.patch<Envelope<MemberProfileData>>('/members/me/profile', payload)).data.data,
  projects: async (params?: Record<string, unknown>) =>
    (await apiClient.get<Envelope<Paginated<MemberProject>>>('/members/me/projects', { params })).data.data,
  /** The detail route nests its payload one level deeper than the list route. */
  project: async (id: string) =>
    (await apiClient.get<Envelope<{ project: MemberProjectDetail }>>(`/members/me/projects/${id}`)).data.data.project,
  createProject: async (payload: MemberProjectCreate) => (await apiClient.post<Envelope<MemberProject>>('/members/me/projects', payload)).data.data,
  /** Uploads one file and returns its id, for attaching to a project on submit. */
  uploadFile: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return (await apiClient.post<Envelope<UploadedFile>>('/files/upload', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data.data;
  },
  updateProject: async (id: string, payload: Partial<MemberProjectUpdate>) =>
    (await apiClient.patch<Envelope<MemberProject>>(`/members/me/projects/${id}`, payload)).data.data,
  deleteProject: async (id: string) =>
    (await apiClient.delete<Envelope<{ id: string }>>(`/members/me/projects/${id}`)).data.data,
  support: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/members/me/support', { params })).data.data,
  createSupport: async (payload: unknown) => (await apiClient.post<Envelope<unknown>>('/members/me/support', payload)).data.data,
  publications: async (params?: Record<string, unknown>) =>
    (await apiClient.get<Envelope<MemberPublicationsResult>>('/members/me/publications', { params })).data.data,
  createPublication: async (payload: NewPublication) =>
    (await apiClient.post<Envelope<MemberPublication>>('/members/me/publications', payload)).data.data,
  conversations: async (params?: Record<string, unknown>) =>
    (await apiClient.get<Envelope<ConversationsResult>>('/members/me/conversations', { params })).data.data,
  conversation: async (id: string) =>
    (await apiClient.get<Envelope<ConversationDetail>>(`/members/me/conversations/${id}`)).data.data,
  createConversation: async (payload: { subject: string; category: string; body: string } & MessageExtras) =>
    (await apiClient.post<Envelope<{ id: string; subject: string; category: string }>>('/members/me/conversations', payload)).data.data,
  sendMessage: async (conversationId: string, body: string, extras: MessageExtras = {}) =>
    (await apiClient.post<Envelope<unknown>>(`/members/me/conversations/${conversationId}/messages`, { body, ...extras })).data.data,
  markConversationRead: async (conversationId: string) =>
    (await apiClient.post<Envelope<{ ok: boolean }>>(`/members/me/conversations/${conversationId}/read`, {})).data.data,
  documents: async (params?: Record<string, unknown>) =>
    (await apiClient.get<Envelope<Paginated<MemberDocument>>>('/members/me/documents', { params })).data.data,
  community: async (params?: Record<string, unknown>) =>
    (await apiClient.get<Envelope<CommunityResult>>('/members/me/community', { params })).data.data,
  /** Sends a request, or accepts one the other member already sent. */
  connect: async (profileId: string) =>
    (await apiClient.post<Envelope<{ status: ConnectionStatus }>>('/members/me/community/connections', { profileId })).data.data,
  /** Cancels a pending request or removes an existing connection, either direction. */
  disconnect: async (profileId: string) =>
    (await apiClient.delete<Envelope<{ status: ConnectionStatus }>>(`/members/me/community/connections/${profileId}`)).data.data,
  joinGroup: async (groupId: string) =>
    (await apiClient.post<Envelope<{ joined: boolean }>>(`/members/me/community/groups/${groupId}/join`, {})).data.data,
  leaveGroup: async (groupId: string) =>
    (await apiClient.delete<Envelope<{ joined: boolean }>>(`/members/me/community/groups/${groupId}/join`)).data.data,
  createThread: async (title: string) =>
    (await apiClient.post<Envelope<{ id: string }>>('/members/me/community/threads', { title })).data.data,
  thread: async (threadId: string) =>
    (await apiClient.get<Envelope<CommunityThreadDetail>>(`/members/me/community/threads/${threadId}`)).data.data,
  replyToThread: async (threadId: string, body: string) =>
    (await apiClient.post<Envelope<CommunityThreadDetail>>(`/members/me/community/threads/${threadId}/replies`, { body })).data.data,
  /** The direct thread with one member; `conversationId` is null before the first send. */
  directMessages: async (memberUserId: string) =>
    (await apiClient.get<Envelope<DirectConversation>>(`/members/me/community/messages/${memberUserId}`)).data.data,
  sendDirectMessage: async (memberUserId: string, body: string) =>
    (await apiClient.post<Envelope<DirectConversation>>(`/members/me/community/messages/${memberUserId}`, { body })).data.data,
};
