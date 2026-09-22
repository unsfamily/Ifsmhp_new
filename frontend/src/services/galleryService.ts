import { apiClient } from '../api/client';
import type { GalleryCategory, GalleryPhoto } from '../types/gallery';
interface Envelope<T> { data: T }
interface Page<T> { items: T[]; pagination: { pages: number; total: number } }
export interface GalleryPolicy { maxBytes: number; mimeTypes: string[]; extensions: string[] }
export type CategoryInput = Pick<GalleryCategory, 'name' | 'description' | 'published' | 'displayOrder'>;
export type PhotoPatch = Partial<Pick<GalleryPhoto, 'title' | 'caption' | 'altText' | 'published' | 'displayOrder' | 'categoryId'>>;
const root = '/admin/gallery';
async function all<T>(url: string, params: Record<string, unknown>, signal: AbortSignal, progress: (items: T[]) => void) {
  let items: T[] = [];
  for (let page = 1; ; page++) {
    const { data } = await apiClient.get<Envelope<Page<T>>>(url, { params: { ...params, page, limit: 100 }, signal });
    items = [...items, ...data.data.items]; progress(items);
    if (page >= data.data.pagination.pages) return items;
  }
}
export const galleryService = {
  categories: (admin: boolean, signal: AbortSignal, progress: (items: GalleryCategory[]) => void) => all<GalleryCategory>(`/${admin ? 'admin' : 'public'}/gallery/categories`, {}, signal, progress),
  photos: (admin: boolean, params: Record<string, unknown>, signal: AbortSignal, progress: (items: GalleryPhoto[]) => void) => all<GalleryPhoto>(`/${admin ? 'admin' : 'public'}/gallery/photos`, params, signal, progress),
  options: async (signal: AbortSignal) => (await apiClient.get<Envelope<GalleryPolicy>>(`${root}/options`, { signal })).data.data,
  createCategory: async (body: CategoryInput) => (await apiClient.post<Envelope<GalleryCategory>>(`${root}/categories`, body)).data.data,
  updateCategory: async (id: string, body: Partial<CategoryInput>) => (await apiClient.patch<Envelope<GalleryCategory>>(`${root}/categories/${id}`, body)).data.data,
  updatePhoto: async (id: string, body: PhotoPatch) => (await apiClient.patch<Envelope<GalleryPhoto>>(`${root}/photos/${id}`, body)).data.data,
  remove: async (kind: 'categories' | 'photos', id: string) => { await apiClient.delete(`${root}/${kind}/${id}`); },
  reorder: async (kind: 'categories' | 'photos', id: string, direction: -1 | 1) => { await apiClient.post(`${root}/${kind}/${id}/reorder`, { direction }); },
  upload: async (file: File, categoryId: string, signal: AbortSignal, progress: (percent: number) => void) => {
    const body = new FormData(); body.append('file', file); body.append('categoryId', categoryId);
    return (await apiClient.post<Envelope<GalleryPhoto>>(`${root}/photos`, body, { headers: { 'Content-Type': 'multipart/form-data' }, signal, timeout: 600000, onUploadProgress: event => progress(Math.min(99, Math.round(event.loaded / (event.total || file.size) * 100))) })).data.data;
  },
};
