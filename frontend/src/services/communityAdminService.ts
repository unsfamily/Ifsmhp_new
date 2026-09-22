import { apiClient } from '../api/client';
import type {
  CommunityOptions, Community, CommunityConversation, CommunityDashboardData, CommunityMember,
  CommunityMessage, CommunityPayload, CommunityReport, CommunityRole, ModerationAction,
  CommunityStatus, MembershipStatus, PaginatedCommunityResult, QueryParams,
} from '../types/community';

interface Envelope<T> { success: true; data: T; }
const data = <T>(response: { data: Envelope<T> }) => response.data.data;

function communityBody(payload: CommunityPayload): FormData | Omit<CommunityPayload, 'image' | 'banner'> {
  const { image, banner, ...fields } = payload;
  if (!image && !banner) return fields;
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => body.append(key, value));
  if (image) body.append('image', image);
  if (banner) body.append('banner', banner);
  return body;
}

export const communityAdminService = {
  async getOptions() { return data(await apiClient.get<Envelope<CommunityOptions>>('/admin/community/options')); },
  async getDashboardStats() { return data(await apiClient.get<Envelope<CommunityDashboardData>>('/admin/community/dashboard')); },
  async getCommunities(params: QueryParams = {}) { return data(await apiClient.get<Envelope<PaginatedCommunityResult<Community>>>('/admin/community/communities', { params })); },
  async getCommunity(id: string) { return data(await apiClient.get<Envelope<Community>>(`/admin/community/communities/${id}`)); },
  async createCommunity(payload: CommunityPayload) { const body = communityBody(payload); return data(await apiClient.post<Envelope<Community>>('/admin/community/communities', body, body instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)); },
  async updateCommunity(id: string, payload: CommunityPayload) { const body = communityBody(payload); return data(await apiClient.patch<Envelope<Community>>(`/admin/community/communities/${id}`, body, body instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)); },
  async deleteCommunity(id: string) { return data(await apiClient.delete<Envelope<null>>(`/admin/community/communities/${id}`)); },
  async updateCommunityStatus(id: string, status: CommunityStatus) { return data(await apiClient.patch<Envelope<Community>>(`/admin/community/communities/${id}/status`, { status })); },

  async getMembers(params: QueryParams = {}) { return data(await apiClient.get<Envelope<PaginatedCommunityResult<CommunityMember>>>('/admin/community/members', { params })); },
  async getMember(id: string) { return data(await apiClient.get<Envelope<CommunityMember>>(`/admin/community/members/${id}`)); },
  async updateMemberStatus(id: string, status: MembershipStatus, reason?: string) { return data(await apiClient.patch<Envelope<CommunityMember>>(`/admin/community/members/${id}/status`, { status, reason })); },
  async updateMemberRole(id: string, role: CommunityRole) { return data(await apiClient.patch<Envelope<CommunityMember>>(`/admin/community/members/${id}/role`, { role })); },
  async removeMember(id: string, reason: string) { return data(await apiClient.delete<Envelope<null>>(`/admin/community/members/${id}`, { data: { reason } })); },

  async getConversations(params: QueryParams = {}) { return data(await apiClient.get<Envelope<PaginatedCommunityResult<CommunityConversation>>>('/admin/community/conversations', { params })); },
  async getConversationMessages(conversationId: string, params: QueryParams = {}) { return data(await apiClient.get<Envelope<PaginatedCommunityResult<CommunityMessage>>>(`/admin/community/conversations/${conversationId}/messages`, { params })); },
  async sendAdminMessage(conversationId: string, payload: { content: string; replyToId?: string; attachments?: File[] }) {
    const body = new FormData(); body.append('content', payload.content);
    if (payload.replyToId) body.append('replyToId', payload.replyToId);
    payload.attachments?.forEach((file) => body.append('attachments', file));
    return data(await apiClient.post<Envelope<CommunityMessage>>(`/admin/community/conversations/${conversationId}/messages`, body, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
  async updateConversation(conversationId: string, payload: { isLocked?: boolean }) { return data(await apiClient.patch<Envelope<CommunityConversation>>(`/admin/community/conversations/${conversationId}`, payload)); },
  async updateMessage(messageId: string, payload: { isPinned?: boolean; isHidden?: boolean; isRead?: boolean; content?: string }) { return data(await apiClient.patch<Envelope<CommunityMessage>>(`/admin/community/messages/${messageId}`, payload)); },
  async deleteMessage(messageId: string) { return data(await apiClient.delete<Envelope<null>>(`/admin/community/messages/${messageId}`)); },

  async getReports(params: QueryParams = {}) { return data(await apiClient.get<Envelope<PaginatedCommunityResult<CommunityReport>>>('/admin/community/reports', { params })); },
  async getReport(id: string) { return data(await apiClient.get<Envelope<CommunityReport>>(`/admin/community/reports/${id}`)); },
  async updateReport(id: string, payload: { status?: CommunityReport['status']; resolutionNotes?: string }) { return data(await apiClient.patch<Envelope<CommunityReport>>(`/admin/community/reports/${id}`, payload)); },
  async createModerationAction(reportId: string, payload: { action: ModerationAction; notes: string }) { return data(await apiClient.post<Envelope<CommunityReport>>(`/admin/community/reports/${reportId}/actions`, payload)); },
};
