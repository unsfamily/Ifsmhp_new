import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { normalizeError } from '../api/client';
import { galleryService, type CategoryInput, type GalleryPolicy, type PhotoPatch } from '../services/galleryService';
import type { GalleryCategory, GalleryFilters, GalleryPhoto } from '../types/gallery';

function useGalleryData(admin: boolean, enabled: boolean, identity: string) {
  const [snapshot, setSnapshot] = useState<{ identity: string; categories: GalleryCategory[]; photos: GalleryPhoto[] }>({ identity: '', categories: [], photos: [] });
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [filters, setPhotoFilters] = useState({ categoryId: 'all', search: '' });
  const [policy, setPolicy] = useState<GalleryPolicy | null>(null);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    if (!enabled) { setSnapshot({ identity: '', categories: [], photos: [] }); setPolicy(null); setLoading(false); return; }
    setLoading(true); setError('');
    setSnapshot(previous => ({ identity, categories: previous.identity === identity ? previous.categories : [], photos: [] }));
    const update = (patch: Partial<typeof snapshot>) => { if (!controller.signal.aborted) setSnapshot(previous => ({ ...previous, ...patch, identity })); };
    try {
      await Promise.all([
        galleryService.categories(admin, controller.signal, categories => update({ categories })),
        galleryService.photos(admin, admin ? filters : {}, controller.signal, photos => update({ photos })),
        admin ? galleryService.options(controller.signal).then(value => { if (!controller.signal.aborted) setPolicy(value); }) : Promise.resolve(),
      ]);
    } catch (failure) { if (!controller.signal.aborted) setError(normalizeError(failure).message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [admin, enabled, identity, filters]);
  useEffect(() => { void refresh(); return () => active.current?.abort(); }, [refresh]);
  useEffect(() => { const focus = () => { void refresh(); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [refresh]);
  const categories = enabled && snapshot.identity === identity ? snapshot.categories : [];
  const photos = enabled && snapshot.identity === identity ? snapshot.photos : [];
  const getCategoryPhotos = (id: string, options?: { onlyPublished?: boolean }) => photos.filter(p => p.categoryId === id && (!options?.onlyPublished || p.published));
  const applyFilters = (query: GalleryFilters) => {
    const grouped = categories.filter(c => (!query.onlyPublished || c.published) && (query.categoryId === 'all' || c.id === query.categoryId)).map(category => ({ category, photos: getCategoryPhotos(category.id, { onlyPublished: query.onlyPublished }) })).filter(g => g.photos.length);
    return { groupedByCategory: grouped, flatPhotos: grouped.flatMap(g => g.photos) };
  };
  return { categories, photos, loading, error, refresh, policy, filters, setPhotoFilters, getCategoryPhotos, applyFilters };
}
function useGalleryStore() {
  const { user } = useAuth(); const { pathname } = useLocation();
  const adminEnabled = user?.role === 'ADMIN' && pathname.startsWith('/admin/gallery');
  const publicEnabled = pathname === '/' || pathname === '/gallery' || pathname.startsWith('/dashboard/gallery');
  const publicData = useGalleryData(false, publicEnabled, 'public');
  const adminData = useGalleryData(true, adminEnabled, user?.id ?? '');
  const publicRefresh = useRef(publicData.refresh); publicRefresh.current = publicData.refresh;
  const adminRefresh = useRef(adminData.refresh); adminRefresh.current = adminData.refresh;
  const changed = useCallback(async () => { await Promise.all([adminRefresh.current(), publicRefresh.current()]); }, []);
  const write = async <T,>(operation: Promise<T>) => { const result = await operation; await changed(); return result; };
  return { publicData, adminData: {
    ...adminData,
    createCategory: (input: CategoryInput) => write(galleryService.createCategory(input)),
    updateCategory: (id: string, patch: Partial<CategoryInput>) => write(galleryService.updateCategory(id, patch)),
    deleteCategory: (id: string) => write(galleryService.remove('categories', id)),
    toggleCategoryPublished: (id: string) => write(galleryService.updateCategory(id, { published: !adminData.categories.find(c => c.id === id)?.published })),
    reorderCategory: (id: string, direction: -1 | 1) => write(galleryService.reorder('categories', id, direction)),
    updatePhoto: (id: string, patch: PhotoPatch) => write(galleryService.updatePhoto(id, patch)),
    deletePhoto: (id: string) => write(galleryService.remove('photos', id)),
    togglePhotoPublished: (id: string) => write(galleryService.updatePhoto(id, { published: !adminData.photos.find(p => p.id === id)?.published })),
    movePhoto: (id: string, categoryId: string) => write(galleryService.updatePhoto(id, { categoryId })),
    reorderPhoto: (id: string, direction: -1 | 1) => write(galleryService.reorder('photos', id, direction)),
    uploadPhoto: useCallback(async (file: File, categoryId: string, signal: AbortSignal, progress: (percent: number) => void) => {
      const result = await galleryService.upload(file, categoryId, signal, progress); await changed(); return result;
    }, [changed]),
  } };
}
const GalleryContext = createContext<ReturnType<typeof useGalleryStore> | null>(null);
export function GalleryProvider({ children }: { children: ReactNode }) { const value = useGalleryStore(); return <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>; }
export function useGallery() { const context = useContext(GalleryContext); if (!context) throw new Error('GalleryProvider is required'); return context.publicData; }
export function useAdminGallery() { const context = useContext(GalleryContext); if (!context) throw new Error('GalleryProvider is required'); return context.adminData; }
