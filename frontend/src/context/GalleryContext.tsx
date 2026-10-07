import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { attachmentSessionIdentity, getSessionGeneration, normalizeError, SESSION_CHANGED } from '../api/client';
import { galleryService, type CategoryInput, type SubcategoryInput, type GalleryPolicy, type PhotoPatch, type PhotoUploadMetadata } from '../services/galleryService';
import type { GalleryCategory, GalleryFilters, GalleryPhoto, GallerySubcategory } from '../types/gallery';

type PhotoFilters = { categoryId: string; subcategoryId: string; search: string };
const defaultFilters: PhotoFilters = { categoryId: 'all', subcategoryId: 'all', search: '' };
type GallerySnapshot = {
  identity: string; queryKey: string;
  categories: GalleryCategory[]; subcategories: GallerySubcategory[]; photos: GalleryPhoto[];
  policy: GalleryPolicy | null;
};

function useGalleryData(admin: boolean, enabled: boolean, identity: string) {
  const [snapshot, setSnapshot] = useState<GallerySnapshot | null>(null);
  const [request, setRequest] = useState({ key: '', pending: false, error: '' });
  const [filters, setFilters] = useState(defaultFilters);
  const setPhotoFilters = useCallback((next: PhotoFilters) => setFilters(previous =>
    previous.categoryId === next.categoryId && previous.subcategoryId === next.subcategoryId && previous.search === next.search ? previous : next
  ), []);
  const queryKey = admin ? JSON.stringify(filters) : 'public';
  const requestKey = `${enabled}:${identity}:${queryKey}`;
  const active = useRef<AbortController | null>(null);
  const currentScope = useRef({ enabled, identity, queryKey }); currentScope.current = { enabled, identity, queryKey };
  const refresh = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    // Keep the last administrator snapshot on route changes, but never across sessions.
    if (!enabled) {
      if (!identity || !admin) setSnapshot(null);
      setRequest({ key: requestKey, pending: false, error: '' });
      return;
    }
    const generation = getSessionGeneration();
    const isCurrent = () => !controller.signal.aborted && generation === getSessionGeneration() && currentScope.current.enabled && currentScope.current.identity === identity;
    setRequest({ key: requestKey, pending: true, error: '' });
    try {
      const [subcategories, categories, photos, policy] = await Promise.all([
        galleryService.subcategories(admin, controller.signal, () => undefined),
        galleryService.categories(admin, controller.signal, () => undefined),
        galleryService.photos(admin, admin ? filters : {}, controller.signal, () => undefined),
        admin ? galleryService.options(controller.signal) : Promise.resolve(null),
      ]);
      if (isCurrent()) {
        setSnapshot({ identity, queryKey, categories, subcategories, photos, policy });
        setRequest({ key: requestKey, pending: false, error: '' });
      }
    } catch (failure) {
      if (isCurrent()) {
        const details = normalizeError(failure);
        if (admin && [401, 403].includes(details.status ?? 0)) setSnapshot(null);
        setRequest({ key: requestKey, pending: false, error: details.message });
      }
      controller.abort(); // Discard remaining pages after any failed member of the snapshot.
    }
  }, [admin, enabled, identity, filters, queryKey, requestKey]);
  useEffect(() => { void refresh(); return () => active.current?.abort(); }, [refresh]);
  useEffect(() => {
    if (!enabled) return;
    const focus = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [enabled, refresh]);
  useEffect(() => {
    if (!admin) return;
    const clear = () => { active.current?.abort(); setSnapshot(null); setFilters(defaultFilters); setRequest({ key: '', pending: false, error: '' }); };
    window.addEventListener(SESSION_CHANGED, clear);
    return () => window.removeEventListener(SESSION_CHANGED, clear);
  }, [admin]);
  const applyPhotos = (items: GalleryPhoto[]) => {
    if (!currentScope.current.enabled || currentScope.current.identity !== identity || currentScope.current.queryKey !== queryKey) return;
    active.current?.abort();
    const saved = new Map(items.map(photo => [photo.id, photo]));
    setSnapshot(previous => previous?.identity === identity && previous.queryKey === queryKey ? { ...previous, photos: previous.photos.map(photo => saved.get(photo.id) ?? photo) } : previous);
  };
  const usable = enabled && snapshot?.identity === identity ? snapshot : null;
  const hasLoaded = Boolean(usable);
  const hasPhotosLoaded = Boolean(usable && usable.queryKey === queryKey);
  // Derive pending on entry, before effects run, to avoid a one-frame empty state.
  const loading = enabled && (request.key !== requestKey || request.pending);
  const error = enabled && request.key === requestKey ? request.error : '';
  const categories = usable?.categories ?? [];
  const subcategories = usable?.subcategories ?? [];
  const photos = hasPhotosLoaded ? usable!.photos : [];
  const policy = usable?.policy ?? null;
  const getCategoryPhotos = (id: string, options?: { onlyPublished?: boolean }) => photos.filter(p => p.categoryId === id && (!options?.onlyPublished || p.published));
  const applyFilters = (query: GalleryFilters) => {
    const grouped = categories
      .filter(c => (!query.onlyPublished || c.published) && (query.categoryId === 'all' || c.id === query.categoryId))
      .map(category => {
        const categoryPhotos = getCategoryPhotos(category.id, { onlyPublished: query.onlyPublished });
        const children = subcategories.filter(s => s.categoryId === category.id);
        const directPhotos = categoryPhotos.filter(p => !p.subcategoryId);
        const sections: { subcategory: GallerySubcategory | null; photos: GalleryPhoto[] }[] = [];
        if (directPhotos.length || !children.length || query.subcategoryId === 'none') sections.push({ subcategory: null, photos: directPhotos });
        sections.push(...children.map(subcategory => ({ subcategory, photos: categoryPhotos.filter(p => p.subcategoryId === subcategory.id) })));
        const visibleSections = sections.filter(s => !query.subcategoryId || query.subcategoryId === 'all' || (s.subcategory?.id ?? 'none') === query.subcategoryId);
        return { category, sections: visibleSections, photos: visibleSections.flatMap(s => s.photos) };
      });
    return { groupedByCategory: grouped, flatPhotos: grouped.flatMap(g => g.photos) };
  };
  return { categories, subcategories, photos, loading, hasLoaded, hasPhotosLoaded, error, refresh, policy, filters, setPhotoFilters, getCategoryPhotos, applyFilters, applyPhotos };
}
function useGalleryStore() {
  const { user } = useAuth(); const { pathname } = useLocation();
  const adminEnabled = user?.role === 'ADMIN' && pathname.startsWith('/admin/gallery');
  const publicEnabled = pathname === '/' || pathname === '/gallery' || pathname.startsWith('/dashboard/gallery');
  const publicData = useGalleryData(false, publicEnabled, 'public');
  const adminData = useGalleryData(true, adminEnabled, user?.role === 'ADMIN' ? `${user.id}:${attachmentSessionIdentity() ?? ''}` : '');
  const publicRefresh = useRef(publicData.refresh); publicRefresh.current = publicData.refresh;
  const adminRefresh = useRef(adminData.refresh); adminRefresh.current = adminData.refresh;
  const changed = useCallback(async () => { await Promise.all([adminRefresh.current(), publicRefresh.current()]); }, []);
  const write = async <T,>(operation: Promise<T>) => { const result = await operation; await changed(); return result; };
  return { publicData, adminData: {
    ...adminData,
    createSubcategory: (input: SubcategoryInput) => write(galleryService.createSubcategory(input)),
    updateSubcategory: (id: string, patch: Partial<SubcategoryInput>) => write(galleryService.updateSubcategory(id, patch)),
    deleteSubcategory: (id: string) => write(galleryService.remove('subcategories', id)),
    createCategory: (input: CategoryInput) => write(galleryService.createCategory(input)),
    updateCategory: (id: string, patch: Partial<CategoryInput>) => write(galleryService.updateCategory(id, patch)),
    deleteCategory: (id: string) => write(galleryService.remove('categories', id)),
    toggleCategoryPublished: (id: string) => write(galleryService.updateCategory(id, { published: !adminData.categories.find(c => c.id === id)?.published })),
    setPhotoStatus: async (photoIds: string[], published: boolean) => {
      try {
        const result = await galleryService.setPhotoStatus(photoIds, published);
        adminData.applyPhotos(result.items);
        await changed(); // Refresh errors are shown independently of a successful save.
        return result;
      } catch (failure) {
        await changed(); // A lost response may still have committed on the server.
        throw failure;
      }
    },
    reorderCategory: (id: string, direction: -1 | 1) => write(galleryService.reorder('categories', id, direction)),
    updatePhoto: (id: string, patch: PhotoPatch) => write(galleryService.updatePhoto(id, patch)),
    deletePhoto: (id: string) => write(galleryService.remove('photos', id)),
    togglePhotoPublished: (id: string) => write(galleryService.updatePhoto(id, { published: !adminData.photos.find(p => p.id === id)?.published })),
    movePhoto: (id: string, categoryId: string) => write(galleryService.updatePhoto(id, { categoryId })),
    reorderPhoto: (id: string, direction: -1 | 1) => write(galleryService.reorder('photos', id, direction)),
    uploadPhoto: useCallback(async (file: File, categoryId: string, signal: AbortSignal, progress: (percent: number) => void, subcategoryId?: string | null, metadata?: PhotoUploadMetadata) => {
      const result = await galleryService.upload(file, categoryId, signal, progress, subcategoryId, metadata); await changed(); return result;
    }, [changed]),
  } };
}
const GalleryContext = createContext<ReturnType<typeof useGalleryStore> | null>(null);
export function GalleryProvider({ children }: { children: ReactNode }) { const value = useGalleryStore(); return <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>; }
export function useGallery() { const context = useContext(GalleryContext); if (!context) throw new Error('GalleryProvider is required'); return context.publicData; }
export function useAdminGallery() { const context = useContext(GalleryContext); if (!context) throw new Error('GalleryProvider is required'); return context.adminData; }
