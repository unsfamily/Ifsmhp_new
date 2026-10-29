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

/** API returns path-only media URLs; resolve them against VITE_API_BASE_URL for <img>/<video>. */
export function awardEventMediaUrl(path: string) {
  if (!path || path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path;
  const base = apiClient.defaults.baseURL ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

const DEFAULT_EVENT_LABEL = 'International Laureates Recognition Conclave';

/** Fallback alt text when uploads have no captions. */
export function awardEventMediaAlt(
  item: Pick<AwardEventMediaItem, 'mediaType'>,
  options?: { index?: number; total?: number; eventLabel?: string },
) {
  const eventLabel = options?.eventLabel?.trim() || DEFAULT_EVENT_LABEL;
  const kind = item.mediaType === 'video' ? 'Video' : 'Photograph';
  if (typeof options?.index === 'number' && typeof options.total === 'number' && options.total > 0) {
    return `${kind} ${options.index + 1} of ${options.total} from the ${eventLabel}`;
  }
  return `${kind} from the ${eventLabel}`;
}

function withResolvedUrls(items: AwardEventMediaItem[]) {
  return items.map(item => ({ ...item, mediaUrl: awardEventMediaUrl(item.mediaUrl) }));
}

export const awardEventMediaApi = {
  listPublic: async (type?: AwardMediaType) =>
    withResolvedUrls((await apiClient.get<Envelope<{ items: AwardEventMediaItem[] }>>('/public/award-event-media', { params: type ? { type } : undefined })).data.data.items),
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
