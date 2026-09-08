import { apiClient } from './client';

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

export type MemberProfileUpdate = Pick<MemberProfileData, 'phone' | 'websiteUrl' | 'scholarUrl' | 'orcid'>;

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
  timeline: string;
  budget: string;
  supportTypes: string[];
  submit: boolean;
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
  createProject: async (payload: unknown) => (await apiClient.post<Envelope<unknown>>('/members/me/projects', payload)).data.data,
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
  publications: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/members/me/publications', { params })).data.data,
  conversations: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/members/me/conversations', { params })).data.data,
  sendMessage: async (conversationId: string, body: string) => (await apiClient.post<Envelope<unknown>>(`/members/me/conversations/${conversationId}/messages`, { body })).data.data,
  documents: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/members/me/documents', { params })).data.data,
  community: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/members/me/community', { params })).data.data,
};
