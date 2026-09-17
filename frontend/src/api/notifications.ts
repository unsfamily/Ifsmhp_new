import { apiClient } from './client';
import type { Page } from './announcements';
export interface NotificationItem { id: string; title: string; body: string; type: string; status: 'UNREAD' | 'READ'; link: string | null; createdAt: string; readAt: string | null; sender?: string | null }
export const notificationsApi = {
  list: async (params: { page: number; limit: number; status?: string; announcement?: string }) => (await apiClient.get<{ data: Page<NotificationItem> & { unread: number; asOf: string } }>('/notifications', { params })).data.data,
  detail: async (id: string) => (await apiClient.get<{ data: NotificationItem }>(`/notifications/${id}`)).data.data,
  read: async (id: string) => { await apiClient.post(`/notifications/${id}/read`); window.dispatchEvent(new Event('notifications-read')); },
  readAll: async (through: string) => { await apiClient.post('/notifications/read-all', { through }); window.dispatchEvent(new Event('notifications-read')); },
  preference: async (token: string) => (await apiClient.get<{ data: { emailEnabled: boolean } }>('/announcements/unsubscribe', { params: { token } })).data.data,
  unsubscribe: async (token: string) => (await apiClient.post<{ data: { emailEnabled: boolean } }>('/announcements/unsubscribe', { token })).data.data,
};
