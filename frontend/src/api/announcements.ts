import { apiClient } from './client';
import type { AnnouncementInput } from '../../../backend/domain/announcement-input';
export { announcementSchema, ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_CHANNELS, ANNOUNCEMENT_STATUSES } from '../../../backend/domain/announcement-input';
export type { AnnouncementInput } from '../../../backend/domain/announcement-input';
export type Audience = AnnouncementInput['audience'] | 'All';
export type Status = 'All' | 'Draft' | 'Scheduled' | 'Sending' | 'Sent' | 'Cancelled' | 'Partial' | 'Failed' | 'Suppressed';
export type Channel = AnnouncementInput['channel'];
export interface Page<T> { items: T[]; pagination: { page: number; limit: number; total: number; pages: number } }
export interface Announcement extends AnnouncementInput {
  id: string; revision: number; status: Exclude<Status, 'All'>; author: string; managed: boolean;
  preview: string; createdAt: string; updatedAt: string; sentAt: string | null; scheduledFor: string | null; dispatchStartedAt: string | null;
  recipients: number; delivery: { status: string; channel: string; count: number }[];
  previewDelivery: { status: string; channel: string; count: number }[]; previewReady: boolean; signedOff: boolean;
}
export interface Delivery { id: string; recipientEmail: string | null; recipientUserId: string | null; channel: string; purpose: string; revision: number | null; status: string; attempts: number; deliveredAt: string | null; openedAt: string | null; error: string | null }
export interface AnnouncementOptions { audiences: { name: string; total: number; email: number; inApp: number; available: boolean }[]; smtpConfigured: boolean; sabRecipients: number; workerEnabled: boolean }
export type AnnouncementAction = 'preview' | 'sign-off' | 'send' | 'schedule' | 'cancel' | 'retry';
const root = '/admin/announcements';
export const announcementApi = {
  list: async (params: { page: number; limit: number; q: string; audience: Audience; status: Status }) => (await apiClient.get<{ data: Page<Announcement> & { counts: Record<Status, number>; stats: { monthSent: number; delivered: number; inAppReadRate: number | null } } }>(root, { params })).data.data,
  options: async () => (await apiClient.get<{ data: AnnouncementOptions }>(`${root}/options`)).data.data,
  detail: async (id: string) => (await apiClient.get<{ data: Announcement }>(`${root}/${id}`)).data.data,
  save: async (input: AnnouncementInput, requestId: string, current?: { id: string; revision: number } | null) => {
    const data = { ...input, requestId, ...(current ? { expectedRevision: current.revision } : {}) };
    return (await (current ? apiClient.patch<{ data: Announcement }>(`${root}/${current.id}`, data) : apiClient.post<{ data: Announcement }>(root, data))).data.data;
  },
  act: async (row: Pick<Announcement, 'id' | 'revision'>, action: AnnouncementAction, requestId: string, confirmed?: boolean) => (await apiClient.post<{ data: Announcement }>(`${root}/${row.id}/${action}`, { requestId, expectedRevision: row.revision, ...(confirmed ? { confirmed } : {}) })).data.data,
  deliveries: async (id: string, params: { page: number; limit: number; channel: string; purpose: string }) => (await apiClient.get<{ data: Page<Delivery> }>(`${root}/${id}/deliveries`, { params })).data.data,
};
