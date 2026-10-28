import { apiClient } from './client';

interface Envelope<T> {
  success: true;
  data: T;
}

export interface HomeCarouselSlide {
  id: string;
  altText: string;
  displayOrder: number;
  imageUrl: string;
  published?: boolean;
  name?: string;
}

export const homeCarouselApi = {
  list: async () => (await apiClient.get<Envelope<{ items: HomeCarouselSlide[] }>>('/admin/home-carousel')).data.data.items,
  upload: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return (await apiClient.post<Envelope<HomeCarouselSlide>>('/admin/home-carousel', body)).data.data;
  },
  update: async (id: string, patch: { altText?: string; published?: boolean }) =>
    (await apiClient.patch<Envelope<HomeCarouselSlide>>(`/admin/home-carousel/${id}`, patch)).data.data,
  reorder: async (id: string, direction: -1 | 1) =>
    (await apiClient.post<Envelope<{ items: HomeCarouselSlide[] }>>(`/admin/home-carousel/${id}/reorder`, { direction })).data.data.items,
  remove: async (id: string) => (await apiClient.delete<Envelope<{ removed: boolean }>>(`/admin/home-carousel/${id}`)).data.data,
};
