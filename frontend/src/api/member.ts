import { apiClient } from './client';

interface Envelope<T> {
  success: true;
  data: T;
}

export const memberApi = {
  dashboard: async () => (await apiClient.get<Envelope<unknown>>('/members/me/dashboard')).data.data,
  profile: async () => (await apiClient.get<Envelope<unknown>>('/members/me/profile')).data.data,
  projects: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/members/me/projects', { params })).data.data,
  createProject: async (payload: unknown) => (await apiClient.post<Envelope<unknown>>('/members/me/projects', payload)).data.data,
  support: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/members/me/support', { params })).data.data,
  createSupport: async (payload: unknown) => (await apiClient.post<Envelope<unknown>>('/members/me/support', payload)).data.data,
  publications: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/members/me/publications', { params })).data.data,
  conversations: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/members/me/conversations', { params })).data.data,
  sendMessage: async (conversationId: string, body: string) => (await apiClient.post<Envelope<unknown>>(`/members/me/conversations/${conversationId}/messages`, { body })).data.data,
  documents: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/members/me/documents', { params })).data.data,
  community: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/members/me/community', { params })).data.data,
};
