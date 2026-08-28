import { apiClient } from './client';

interface Envelope<T> {
  success: true;
  data: T;
}

export const publicApi = {
  stats: async () => (await apiClient.get<Envelope<unknown>>('/public/stats')).data.data,
  publications: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/public/publications', { params })).data.data,
  publication: async (id: string) => (await apiClient.get<Envelope<unknown>>(`/public/publications/${id}`)).data.data,
  productReviews: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/public/product-reviews', { params })).data.data,
  events: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/public/events', { params })).data.data,
  event: async (id: string) => (await apiClient.get<Envelope<unknown>>(`/public/events/${id}`)).data.data,
  gallery: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/public/gallery', { params })).data.data,
  contact: async (payload: unknown) => (await apiClient.post<Envelope<unknown>>('/contact', payload)).data.data,
};
