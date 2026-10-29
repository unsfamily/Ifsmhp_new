import { apiClient } from './client';

interface Envelope<T> {
  success: true;
  data: T;
}

export type AwardMediaType = 'image' | 'video';

export interface AwardEventMediaItem {
  id: string;
  mediaType: AwardMediaType;
  width: number | null;
  height: number | null;
  displayOrder: number;
  mediaUrl: string;
  published?: boolean;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export const awardEventMediaApi = {
  listPublic: async (type?: AwardMediaType) =>
    (await apiClient.get<Envelope<{ items: AwardEventMediaItem[] }>>('/public/award-event-media', { params: type ? { type } : undefined })).data.data.items,
  list: async (type?: AwardMediaType) =>
    (await apiClient.get<Envelope<{ items: AwardEventMediaItem[] }>>('/admin/award-event-media', { params: type ? { type } : undefined })).data.data.items,
  upload: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return (await apiClient.post<Envelope<AwardEventMediaItem>>('/admin/award-event-media', body)).data.data;
  },
  update: async (id: string, patch: { published: boolean }) =>
    (await apiClient.patch<Envelope<AwardEventMediaItem>>(`/admin/award-event-media/${id}`, patch)).data.data,
  reorder: async (id: string, direction: -1 | 1) =>
    (await apiClient.post<Envelope<{ items: AwardEventMediaItem[] }>>(`/admin/award-event-media/${id}/reorder`, { direction })).data.data.items,
  remove: async (id: string) => (await apiClient.delete<Envelope<{ removed: boolean }>>(`/admin/award-event-media/${id}`)).data.data,
};
