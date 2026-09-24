import { apiClient } from '../api/client';
export interface AdminProfileFields { firstName: string; lastName: string; displayName: string; designation: string; jobTitle: string; workEmail: string; phone: string; institution: string; country: string; timezone: string; orcid: string; website: string; bio: string; }
export interface AdminPreferences { appNewMember: boolean; supportUrgent: boolean; supportAll: boolean; inquiryNew: boolean; }
export interface AdminProfileData {
  profile: AdminProfileFields; preferences: AdminPreferences; defaults: AdminPreferences; revision: number; avatarFileId: string | null;
  account: { id: string; fullName: string; loginEmail: string; role: string; status: string };
  policy: { avatarMaxBytes: number; avatarFormats: string[]; passwordMinCharacters: number; passwordMaxBytes: number; bioMaxLength: number; timezones: string[]; designations: string[] };
  capabilities: { mfa: boolean; apiTokens: boolean; supportedPreferences: string[]; emailConfigured: boolean; emailWorkerEnabled: boolean };
}
export interface AdminOverview {
  security: { passwordChangedAt: string | null; lastLoginAt: string | null; activeSessions: number };
  activity: { id: string; createdAt: string; action: string; entity: string; severity: string; description: string }[];
  approvals: { id: string; createdAt: string; action: string; entity: string }[];
  queues: { name: string; open: number; slaBreach: number | null; link: string }[];
}
export interface AdminSessionPage { items: { id: string; createdAt: string; expiresAt: string; ipAddress: string | null; userAgent: string | null; current: boolean }[]; pagination: { page: number; pages: number; total: number }; }
interface Envelope<T> { data: T; }
export const adminProfileService = {
  async get(signal?: AbortSignal) { return (await apiClient.get<Envelope<AdminProfileData>>('/admin/profile', { signal })).data.data; },
  async overview(signal?: AbortSignal) { return (await apiClient.get<Envelope<AdminOverview>>('/admin/profile/overview', { signal })).data.data; },
  async save(body: { expectedRevision: number; profile?: AdminProfileFields; preferences?: AdminPreferences }, signal?: AbortSignal) { return (await apiClient.patch<Envelope<AdminProfileData>>('/admin/profile', body, { signal })).data.data; },
  async avatar(file: File, expectedRevision: number, signal?: AbortSignal) { const body = new FormData(); body.append('file', file); body.append('expectedRevision', String(expectedRevision)); return (await apiClient.post<Envelope<AdminProfileData>>('/admin/profile/avatar', body, { headers: { 'Content-Type': 'multipart/form-data' }, signal, timeout: 120000 })).data.data; },
  async image(signal?: AbortSignal) { return (await apiClient.get<Blob>('/admin/profile/avatar', { signal, responseType: 'blob' })).data; },
  async password(body: { currentPassword: string; password: string; confirmation: string }, signal?: AbortSignal) { await apiClient.post('/admin/profile/password', body, { signal }); },
  async sessions(page: number, signal?: AbortSignal) { return (await apiClient.get<Envelope<AdminSessionPage>>('/admin/profile/sessions', { params: { page, limit: 10 }, signal })).data.data; },
  async revoke(id?: string, signal?: AbortSignal) { const response = id ? await apiClient.delete<Envelope<{ signedOut: boolean }>>(`/admin/profile/sessions/${id}`, { signal }) : await apiClient.post<Envelope<{ signedOut: boolean }>>('/admin/profile/sessions/revoke-others', {}, { signal }); return response.data.data; },
};
