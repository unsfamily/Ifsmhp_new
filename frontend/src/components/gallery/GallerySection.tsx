import GalleryMedia from './GalleryMedia';
import { useEffect, useMemo, useState } from 'react';
import {
  Images,
  FolderKanban,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Award,
  Sparkles,
  Info,
  Film,
} from 'lucide-react';
import { useGallery } from '../../context/GalleryContext';
import Button from '../common/Button';
import type { GalleryCategory, GalleryPhoto, GallerySubcategory } from '../../types/gallery';

const ALL_MEDIA_ID = 'all';

function CategoryPills({
  categories,
  selectedId,
  onSelect,
  getCount,
}: {
  categories: GalleryCategory[];
  selectedId: string;
  onSelect: (id: string) => void;
  getCount: (categoryId: string) => number;
}) {
  const pills = useMemo(
    () => [
      { id: ALL_MEDIA_ID, name: 'All Media' },
      ...categories.map((c) => ({ id: c.id, name: c.name })),
    ],
    [categories]
  );
  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pill) => {
        const active = selectedId === pill.id;
        const count =
          pill.id === ALL_MEDIA_ID
            ? categories.reduce((sum, c) => sum + getCount(c.id), 0)
            : getCount(pill.id);
        return (
          <button
            key={pill.id}
            type="button"
            onClick={() => onSelect(pill.id)}
            aria-pressed={active}
            aria-label={pill.name}
            className={`group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 border ${
              active
                ? 'bg-forum-900 text-white border-forum-900 shadow-md'
                : 'bg-white text-forum-800 border-paper-border hover:border-forum-200 hover:bg-forum-50'
            }`}
          >
            <FolderKanban className="h-4 w-4" />
            {pill.name}
            <span
              className={`ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                active
                  ? 'bg-white/15 text-white'
                  : 'bg-forum-50 text-forum-700 ring-1 ring-forum-900/10 group-hover:bg-white'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PhotoGrid({
  photos,
  layout,
  onOpen,
  emptyLabel = 'No published photographs in this category yet.',
}: {
  emptyLabel?: string;
  photos: GalleryPhoto[];
  layout: NonNullable<GalleryCategory['displayLayout']>;
  onOpen: (index: number) => void;
}) {
  if (photos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-forum-200 bg-forum-50/50 p-10 sm:p-14 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-forum-400 ring-1 ring-forum-100">
          <Images className="h-8 w-8" />
        </div>
        <h3 className="font-display text-xl font-semibold text-forum-900">
          {emptyLabel}
        </h3>
        <p className="mt-2 text-sm text-ink-muted max-w-lg mx-auto">
          This collection is being prepared. Check back soon for curated
          photographs from the IFSMHP community archive.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 sm:gap-5 ${layout === 'SQUARE' ? 'grid-cols-[repeat(auto-fill,150px)] justify-center' : layout === 'FULL' ? 'grid-cols-1' : layout === 'HALF' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
      {photos.map((photo, idx) => {
        const aspect = photo.aspect ?? 'landscape';
        const aspectClass =
          aspect === 'portrait'
            ? 'aspect-[4/5]'
            : aspect === 'square'
              ? 'aspect-square'
              : 'aspect-video';
        return (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(idx)}
            className={`group relative block w-full h-full overflow-hidden rounded-2xl ${layout === 'SQUARE' ? 'aspect-square' : aspectClass} bg-gradient-to-br from-forum-800 via-forum-600 to-brass-500 text-left ring-1 ring-paper-border shadow-sm transition-all duration-300 hover:shadow-xl hover:ring-forum-900/15`}
            aria-label={`Open ${photo.title}`}
          >
            <GalleryMedia
              src={photo.mediaUrl || photo.imageUrl}
              mediaType={photo.type ?? 'image'}
              alt={photo.altText || photo.title}
              className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-forum-950/85 via-forum-950/20 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <h4 className="text-sm sm:text-[15px] font-semibold text-white leading-snug line-clamp-2 drop-shadow-sm">
                {photo.title}
              </h4>
              {photo.caption ? (
                <p className="mt-1 text-[12px] text-white/80 line-clamp-2 max-w-prose">
                  {photo.caption}
                </p>
              ) : null}
            </div>
            <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur-md ring-1 ring-white/25 transition-opacity group-hover:opacity-100">
              <ZoomIn className="h-4.5 w-4.5" />
            </div>
            {photo.type === 'video' && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-forum-950/75 px-2 py-1 text-[10px] font-semibold uppercase text-white"><Film className="h-3 w-3" /> Video</span>}
          </button>
        );
      })}
    </div>
  );
}

function CategoryGroup({ category, sections, onOpen }: {
  category: GalleryCategory;
  sections: { subcategory: GallerySubcategory | null; photos: GalleryPhoto[] }[];
  onOpen: (photoId: string) => void;
}) {
  const count = sections.reduce((sum, section) => sum + section.photos.length, 0);
  const hasSubcategories = sections.some(section => section.subcategory);
  return (
    <section className="scroll-mt-28" aria-label={category.name}>
      <div className="mb-6 border-b border-paper-border pb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brass-50 text-brass-700 ring-1 ring-brass-500/20 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
          <Award className="h-3 w-3" /> {count} {count === 1 ? 'item' : 'items'}
        </span>
        <h3 className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-forum-900 break-words">{category.name}</h3>
        {category.description && <p className="mt-2 text-sm leading-relaxed text-ink-muted max-w-3xl">{category.description}</p>}
      </div>
      <div className="space-y-8">
        {sections.map(({ subcategory, photos }) => (
          <section key={subcategory?.id ?? 'none'} aria-label={subcategory?.name ?? 'Category photographs'} className={subcategory ? 'border-l-2 border-forum-100 pl-4 sm:pl-6' : ''}>
            {(subcategory || hasSubcategories) && <div className="mb-4 flex flex-wrap items-center gap-2">
              <h4 className="font-display text-xl font-semibold text-forum-900 break-words">{subcategory?.name ?? 'Category photographs'}</h4>
              <span className="text-xs text-ink-muted">{photos.length} {photos.length === 1 ? 'item' : 'items'}</span>
            </div>}
            {subcategory && !photos.length ? (
              <p className="rounded-xl border border-dashed border-forum-200 bg-forum-50/50 p-4 text-sm text-ink-muted">No published photographs in this subcategory yet.</p>
            ) : <PhotoGrid photos={photos} layout={category.displayLayout ?? 'QUARTER'} onOpen={index => onOpen(photos[index]!.id)} />}
          </section>
        ))}
      </div>
    </section>
  );
}

function Lightbox({
  photos,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  photos: GalleryPhoto[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const photo = photos[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onPrev, onNext]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-forum-950/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={photo.title}
    >
      <div
        className="w-full sm:max-w-6xl max-h-[94vh] sm:max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl ring-1 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-paper-border bg-forum-50/40">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brass-700 mb-0.5 inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              {index + 1} <span className="text-forum-400">of</span>{' '}
              {photos.length}
            </div>
            <h3 className="font-display text-base sm:text-lg font-semibold text-forum-900 truncate">
              {photo.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous photograph"
              className="h-9 w-9 rounded-lg border border-paper-border bg-white text-forum-700 hover:bg-forum-50 hover:border-forum-200 inline-flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Next photograph"
              className="h-9 w-9 rounded-lg border border-paper-border bg-white text-forum-700 hover:bg-forum-50 hover:border-forum-200 inline-flex items-center justify-center transition-colors"
            >
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
            <div className="w-px h-6 bg-paper-border mx-1" aria-hidden />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close viewer"
              className="h-9 w-9 rounded-lg border border-paper-border bg-white text-forum-700 hover:bg-forum-50 hover:border-forum-200 inline-flex items-center justify-center transition-colors"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-0 overflow-y-auto">
          <div className="md:col-span-3 bg-forum-950 border-b md:border-b-0 md:border-r border-paper-border relative">
            <div className="min-h-[280px] sm:min-h-[380px] md:min-h-[540px] flex items-center justify-center p-3 sm:p-5">
              <GalleryMedia
                src={photo.mediaUrl || photo.imageUrl}
                mediaType={photo.type ?? 'image'}
                alt={photo.altText || photo.title}
                className="max-h-[72vh] w-auto max-w-full h-auto object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
                controls={photo.type === 'video'}
                muted={false}
              />
            </div>
          </div>
          <div className="md:col-span-2 p-5 sm:p-6 space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-subtle mb-1">
                Caption
              </p>
              <p className="text-sm leading-relaxed text-ink">
                {photo.caption || 'No caption provided for this photograph.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-0.5">
                  Published
                </p>
                <p className="text-ink">
                  {new Date(photo.uploadedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              {photo.fileSizeBytes ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-0.5">
                    File size
                  </p>
                  <p className="text-ink">
                    {(photo.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              ) : null}
            </div>
            {photo.altText ? (
              <div className="rounded-xl bg-forum-50 ring-1 ring-forum-100 p-3.5">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-forum-700 mb-1 inline-flex items-center gap-1.5">
                  <Info className="h-3 w-3" /> Accessibility
                </p>
                <p className="text-xs leading-relaxed text-forum-800">
                  {photo.altText}
                </p>
              </div>
            ) : null}
            <div className="flex flex-col gap-2 pt-1">
              <Button variant="primary" className="w-full bg-forum-900 hover:bg-forum-800">
                <ZoomIn className="h-4 w-4" /> View original
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GallerySection({
  sectionId = 'gallery-section',
}: {
  sectionId?: string;
}) {
  const { categories, subcategories, applyFilters, getCategoryPhotos, loading, error, refresh } = useGallery();
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_MEDIA_ID);
  const [selectedSubcategory, setSelectedSubcategory] = useState('all');
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  useEffect(() => {
    if (!loading && selectedCategory !== ALL_MEDIA_ID && !categories.some(c => c.id === selectedCategory)) {
      setSelectedCategory(ALL_MEDIA_ID); setSelectedSubcategory('all');
    }
    if (!loading && selectedSubcategory !== 'all' && selectedSubcategory !== 'none' && !subcategories.some(s => s.id === selectedSubcategory && s.categoryId === selectedCategory)) setSelectedSubcategory('all');
  }, [categories, subcategories, loading, selectedCategory, selectedSubcategory]);

  const sortedCategories = useMemo(() => [...categories].filter(c => c.published).sort((a, b) => a.displayOrder - b.displayOrder), [categories]);
  const selectedChildren = subcategories.filter(s => s.categoryId === selectedCategory);
  const getCount = (categoryId: string) => getCategoryPhotos(categoryId, { onlyPublished: true }).length;
  const filtered = applyFilters({ categoryId: selectedCategory, subcategoryId: selectedSubcategory, onlyPublished: true });
  const flatPhotosPool = filtered.flatPhotos;
  const lightboxIndex = flatPhotosPool.findIndex(photo => photo.id === lightboxPhotoId);
  useEffect(() => { if (!loading && lightboxPhotoId && lightboxIndex < 0) setLightboxPhotoId(null); }, [loading, lightboxPhotoId, lightboxIndex]);
  const selectCategory = (id: string) => { setSelectedCategory(id); setSelectedSubcategory('all'); setLightboxPhotoId(null); };
  const selectSubcategory = (id: string) => { setSelectedSubcategory(id); setLightboxPhotoId(null); };

  return (
    <section
      id={sectionId}
      className="scroll-mt-24 bg-paper relative overflow-hidden"
      aria-label="IFSMHP Media Gallery"
    >
      {loading && <p role="status" className="p-4 text-center text-ink-muted">Loading gallery…</p>}
      {error && <div role="alert" className="p-4 text-center text-danger-600">{error} <button className="underline" onClick={() => void refresh()}>Retry</button></div>}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-forum-200 to-transparent"
        aria-hidden
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 lg:mb-12">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-forum-900 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-brass-100 ring-1 ring-inset ring-white/10 shadow-sm">
              <Images className="h-3.5 w-3.5" />
              Media Gallery
            </span>
            <h2 className="mt-5 font-display text-3xl font-semibold leading-tight text-forum-900 sm:text-4xl lg:text-[40px]">
              Moments from the{' '}
              <span className="text-brass-600">IFSMHP Community</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-muted sm:text-lg">
              Browse curated photographs from symposia, awards ceremonies,
              inductions, research showcases and outreach events across the
              International Forum.
            </p>
          </div>
        </div>

        <div className="mb-8 sm:mb-10 rounded-2xl border border-paper-border bg-white/80 p-4 sm:p-5 shadow-sm backdrop-blur-sm">
          <label className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Browse by category
          </label>
          <CategoryPills
            categories={sortedCategories}
            selectedId={selectedCategory}
            onSelect={selectCategory}
            getCount={getCount}
          />
          {selectedChildren.length > 0 && <nav aria-label="Browse subcategories" className="mt-4 border-t border-paper-border pt-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Subcategories</p>
            <div className="flex flex-wrap gap-2">
              {[{ id: 'all', name: 'All subcategories', photoCount: getCount(selectedCategory) },
                ...(getCategoryPhotos(selectedCategory).some(p => !p.subcategoryId) ? [{ id: 'none', name: 'Category photographs', photoCount: getCategoryPhotos(selectedCategory).filter(p => !p.subcategoryId).length }] : []),
                ...selectedChildren].map(sub => <button key={sub.id} type="button" aria-label={sub.name} aria-pressed={selectedSubcategory === sub.id} onClick={() => selectSubcategory(sub.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${selectedSubcategory === sub.id ? 'border-forum-900 bg-forum-900 text-white' : 'border-paper-border bg-white text-forum-800 hover:bg-forum-50'}`}>
                  {sub.name} <span className="ml-1 text-xs">({sub.photoCount})</span>
                </button>)}
            </div>
          </nav>}
        </div>

        {loading || error ? null : (
          <div className="space-y-14 sm:space-y-16">
            {filtered.groupedByCategory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-forum-200 bg-forum-50/40 p-10 text-center">
                <p className="font-display text-lg font-semibold text-forum-900">The gallery is being prepared</p>
                <p className="mt-1 text-sm text-ink-muted">Photographs from IFSMHP events will be published here shortly.</p>
              </div>
            ) : filtered.groupedByCategory.map(group => (
              <CategoryGroup key={group.category.id} category={group.category} sections={group.sections} onOpen={setLightboxPhotoId} />
            ))}
          </div>
        )}
      </div>

      {lightboxIndex >= 0 ? (
        <Lightbox
          photos={flatPhotosPool}
          index={lightboxIndex}
          onClose={() => setLightboxPhotoId(null)}
          onPrev={() => setLightboxPhotoId(flatPhotosPool[Math.max(0, lightboxIndex - 1)]?.id ?? null)}
          onNext={() => setLightboxPhotoId(flatPhotosPool[Math.min(flatPhotosPool.length - 1, lightboxIndex + 1)]?.id ?? null)}
        />
      ) : null}
    </section>
  );
}
