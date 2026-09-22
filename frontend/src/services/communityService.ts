import { apiClient } from '../api/client';
import type { ReportReceipt, CommunityCapabilities, CommunityUploadPolicy, Community, CommunityConversation, CommunityMember, CommunityMessage, PaginatedCommunityResult, QueryParams } from '../types/community';

interface Envelope<T> { success: true; data: T; }
const data = <T>(response: { data: Envelope<T> }) => response.data.data;

export const communityService = {
  async getCapabilities() { return data(await apiClient.get<Envelope<CommunityCapabilities>>('/community/capabilities')); },
  async getUploadPolicy() { return data(await apiClient.get<Envelope<CommunityUploadPolicy>>('/community/upload-policy')); },
  async getCommunities(params: QueryParams = {}) { return data(await apiClient.get<Envelope<PaginatedCommunityResult<Community>>>('/community/communities', { params })); },
  async getMyCommunities(params: QueryParams = {}) { return data(await apiClient.get<Envelope<PaginatedCommunityResult<Community>>>('/community/communities/mine', { params })); },
  async getCommunity(id: string) { return data(await apiClient.get<Envelope<Community>>(`/community/communities/${id}`)); },
  async joinCommunity(id: string) { return data(await apiClient.post<Envelope<Community>>(`/community/communities/${id}/join`)); },
  async cancelJoinRequest(id: string) { return data(await apiClient.delete<Envelope<Community>>(`/community/communities/${id}/join-request`)); },
  async leaveCommunity(id: string) { return data(await apiClient.delete<Envelope<Community>>(`/community/communities/${id}/membership`)); },
  async getMembers(id: string, params: QueryParams = {}) { return data(await apiClient.get<Envelope<PaginatedCommunityResult<CommunityMember>>>(`/community/communities/${id}/members`, { params })); },
  async getConversations(id: string, params: QueryParams = {}) { return data(await apiClient.get<Envelope<PaginatedCommunityResult<CommunityConversation>>>(`/community/communities/${id}/conversations`, { params })); },
  async getMessages(conversationId: string, params: QueryParams = {}) { return data(await apiClient.get<Envelope<PaginatedCommunityResult<CommunityMessage>>>(`/community/conversations/${conversationId}/messages`, { params })); },
  async sendMessage(conversationId: string, content: string, replyToId?: string, attachments: File[] = []) { const body = new FormData(); body.append('content', content); if (replyToId) body.append('replyToId', replyToId); attachments.forEach((file) => body.append('attachments', file)); return data(await apiClient.post<Envelope<CommunityMessage>>(`/community/conversations/${conversationId}/messages`, body, { headers: { 'Content-Type': 'multipart/form-data' } })); },
  async updateMessage(id: string, content: string) { return data(await apiClient.patch<Envelope<CommunityMessage>>(`/community/messages/${id}`, { content })); },
  async deleteMessage(id: string) { return data(await apiClient.delete<Envelope<null>>(`/community/messages/${id}`)); },
  async reportMessage(id: string, reason: string, submissionId: string, notes?: string) { return data(await apiClient.post<Envelope<ReportReceipt>>(`/community/messages/${id}/report`, { reason, notes, submissionId })); },
  async reportMember(id: string, communityId: string, reason: string, submissionId: string, notes?: string) { return data(await apiClient.post<Envelope<ReportReceipt>>(`/community/members/${id}/report`, { communityId, reason, notes, submissionId })); },
};
