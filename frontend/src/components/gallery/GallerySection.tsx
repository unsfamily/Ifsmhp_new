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
} from 'lucide-react';
import { useGallery } from '../../context/GalleryContext';
import Button from '../common/Button';
import type { GalleryCategory, GalleryPhoto } from '../../types/gallery';

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
  onOpen,
}: {
  photos: GalleryPhoto[];
  onOpen: (index: number) => void;
}) {
  if (photos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-forum-200 bg-forum-50/50 p-10 sm:p-14 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-forum-400 ring-1 ring-forum-100">
          <Images className="h-8 w-8" />
        </div>
        <h3 className="font-display text-xl font-semibold text-forum-900">
          No photographs in this category
        </h3>
        <p className="mt-2 text-sm text-ink-muted max-w-lg mx-auto">
          This collection is being prepared. Check back soon for curated
          photographs from the IFSMHP community archive.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
            className={`group relative block w-full overflow-hidden rounded-2xl ${aspectClass} bg-gradient-to-br from-forum-800 via-forum-600 to-brass-500 text-left ring-1 ring-paper-border shadow-sm transition-all duration-300 hover:shadow-xl hover:ring-forum-900/15`}
            aria-label={`Open ${photo.title}`}
          >
            <img
              src={photo.imageUrl}
              alt={photo.altText || photo.title}
              className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
              loading="lazy"
              decoding="async"
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
          </button>
        );
      })}
    </div>
  );
}

function CategoryGroup({
  category,
  photos,
  onOpen,
}: {
  category: GalleryCategory;
  photos: GalleryPhoto[];
  onOpen: (index: number, categoryId: string) => void;
}) {
  if (photos.length === 0) return null;
  return (
    <div className="scroll-mt-28">
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-paper-border pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brass-50 text-brass-700 ring-1 ring-brass-500/20 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
              <Award className="h-3 w-3" />
              {photos.length} {photos.length === 1 ? 'photograph' : 'photographs'}
            </span>
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">
            {category.name}
          </h3>
          <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-ink-muted max-w-3xl">
            {category.description}
          </p>
        </div>
      </div>
      <PhotoGrid
        photos={photos}
        onOpen={(i) => onOpen(i, category.id)}
      />
    </div>
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
              <img
                src={photo.imageUrl}
                alt={photo.altText || photo.title}
                className="max-h-[72vh] w-auto max-w-full h-auto object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
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
  const { categories, applyFilters, getCategoryPhotos } = useGallery();
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_MEDIA_ID);

  const sortedCategories = useMemo(
    () =>
      [...categories]
        .filter((c) => c.published)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [categories]
  );

  const getCount = (categoryId: string) =>
    getCategoryPhotos(categoryId, { onlyPublished: true }).length;

  const filtered = useMemo(
    () =>
      applyFilters({
        categoryId: selectedCategory as 'all' | string,
        onlyPublished: true,
      }),
    [applyFilters, selectedCategory]
  );

  const flatPhotosPool: GalleryPhoto[] = useMemo(() => {
    if (selectedCategory === ALL_MEDIA_ID) {
      const list: GalleryPhoto[] = [];
      filtered.groupedByCategory.forEach((g) => list.push(...g.photos));
      return list;
    }
    return filtered.flatPhotos;
  }, [selectedCategory, filtered]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openFromCategory = (idx: number, categoryId: string) => {
    if (selectedCategory === ALL_MEDIA_ID) {
      const offset = filtered.groupedByCategory
        .filter((g) => g.category.id !== categoryId)
        .reduce((sum, g) => sum + g.photos.length, 0);
      void offset;
      let running = 0;
      let found = false;
      for (const g of filtered.groupedByCategory) {
        if (g.category.id === categoryId) {
          running += idx;
          found = true;
          break;
        }
        running += g.photos.length;
      }
      setLightboxIndex(found ? running : idx);
    } else {
      setLightboxIndex(idx);
    }
  };

  const openFlat = (i: number) => setLightboxIndex(i);

  const lightboxCount = flatPhotosPool.length;
  const hasPrev = typeof lightboxIndex === 'number' && lightboxIndex > 0;
  void hasPrev;

  return (
    <section
      id={sectionId}
      className="scroll-mt-24 bg-paper relative overflow-hidden"
      aria-label="IFSMHP Media Gallery"
    >
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
            Browse by collection
          </label>
          <CategoryPills
            categories={sortedCategories}
            selectedId={selectedCategory}
            onSelect={setSelectedCategory}
            getCount={getCount}
          />
        </div>

        {selectedCategory === ALL_MEDIA_ID ? (
          <div className="space-y-14 sm:space-y-16">
            {filtered.groupedByCategory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-forum-200 bg-forum-50/40 p-10 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-forum-400 ring-1 ring-forum-100">
                  <Images className="h-7 w-7" />
                </div>
                <p className="font-display text-lg font-semibold text-forum-900">
                  The gallery is being prepared
                </p>
                <p className="mt-1 text-sm text-ink-muted max-w-lg mx-auto">
                  Photographs from IFSMHP events will be published here
                  shortly.
                </p>
              </div>
            ) : (
              filtered.groupedByCategory.map((group) => (
                <CategoryGroup
                  key={group.category.id}
                  category={group.category}
                  photos={group.photos}
                  onOpen={openFromCategory}
                />
              ))
            )}
          </div>
        ) : (
          <div>
            {filtered.groupedByCategory.length > 0 ? (
              (() => {
                const group = filtered.groupedByCategory[0]!;
                return (
                  <>
                    <div className="mb-6 rounded-2xl border border-forum-100 bg-gradient-to-br from-forum-50 via-white to-brass-50/60 p-5 sm:p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-forum-900 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brass-100 ring-1 ring-inset ring-white/10">
                          <FolderKanban className="h-3 w-3" />
                          Collection
                        </span>
                      </div>
                      <h3 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">
                        {group.category.name}
                      </h3>
                      <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-ink-muted max-w-3xl">
                        {group.category.description}
                      </p>
                    </div>
                    <PhotoGrid photos={group.photos} onOpen={openFlat} />
                  </>
                );
              })()
            ) : (
              <PhotoGrid photos={[]} onOpen={() => {}} />
            )}
          </div>
        )}
      </div>

      {typeof lightboxIndex === 'number' ? (
        <Lightbox
          photos={flatPhotosPool}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex((i) =>
              typeof i === 'number' && i > 0 ? i - 1 : i
            )
          }
          onNext={() =>
            setLightboxIndex((i) =>
              typeof i === 'number' && i < lightboxCount - 1 ? i + 1 : i
            )
          }
        />
      ) : null}
    </section>
  );
}
