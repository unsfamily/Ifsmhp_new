import { apiClient } from './client';
import type { Page } from './announcements';
export interface MemberAnnouncement {
  id: string; subject: string; body: string; sender: string; sentAt: string | null; expiresAt: string | null;
  status: 'READ' | 'UNREAD'; readAt: string | null;
}
const root = '/members/me/announcements';
export const memberAnnouncementsApi = {
  list: async (params: { page: number; limit: number; q?: string; status?: string }) => (await apiClient.get<{ data: Page<MemberAnnouncement> & { unread: number } }>(root, { params })).data.data,
  detail: async (id: string) => (await apiClient.get<{ data: MemberAnnouncement }>(`${root}/${id}`)).data.data,
  setRead: async (id: string, read: boolean) => {
    const result = (await apiClient.post<{ data: MemberAnnouncement }>(`${root}/${id}/${read ? 'read' : 'unread'}`)).data.data;
    window.dispatchEvent(new Event('notifications-read'));
    return result;
  },
};
