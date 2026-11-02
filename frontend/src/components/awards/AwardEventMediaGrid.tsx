import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Film } from 'lucide-react';
import {
  awardEventMediaAlt,
  awardEventMediaApi,
  type AwardEventMediaItem,
} from '../../api/awardEventMedia';
import { normalizeError } from '../../api/client';
import { CEREMONY_GALLERY_PATH } from '../../domain/ceremonyRegistration';
import { CdnImage } from '../media';
import AwardEventLightbox from './AwardEventLightbox';

export const AWARD_EVENT_GALLERY_TITLE = 'International Laureates Recognition Conclave';
const PREVIEW_PER_TYPE = 3;
const INITIAL_BATCH = 8;
const BATCH_SIZE = 8;

/** Cycling brand gradients for full-gallery photo frames. */
const GALLERY_FRAME_GRADIENTS = [
  'bg-gradient-to-br from-forum-800 via-forum-500 to-brass-400',
  'bg-gradient-to-tr from-brass-500 via-brass-400 to-forum-700',
  'bg-gradient-to-bl from-forum-950 via-forum-600 to-brass-500',
  'bg-gradient-to-r from-brass-600 via-forum-500 to-forum-900',
  'bg-gradient-to-tl from-forum-500 via-brass-400 to-forum-900',
  'bg-gradient-to-b from-brass-400 via-forum-700 to-forum-950',
  'bg-gradient-to-br from-forum-700 via-brass-500 to-brass-300',
  'bg-gradient-to-tr from-forum-900 via-brass-600 to-forum-400',
] as const;

function useNearViewport(enabled: boolean, rootMargin = '120px 0px') {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(!enabled);

  useEffect(() => {
    if (!enabled || visible) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, visible, rootMargin]);

  return { ref, visible };
}

function MediaTile({
  item,
  index,
  total,
  onOpen,
  dense = false,
  eager = false,
}: {
  item: AwardEventMediaItem;
  index: number;
  total: number;
  onOpen: () => void;
  dense?: boolean;
  eager?: boolean;
}) {
  const label = awardEventMediaAlt(item, { index, total, eventLabel: AWARD_EVENT_GALLERY_TITLE });
  const deferMedia = !eager && item.mediaType === 'image';
  const { ref, visible } = useNearViewport(deferMedia);
  const showImage = item.mediaType === 'image' && (eager || visible);
  const previewSrc = item.thumbUrl || item.mediaUrl;

  const frameClass = dense
    ? GALLERY_FRAME_GRADIENTS[index % GALLERY_FRAME_GRADIENTS.length]
    : null;

  return (
    <li className="min-w-0 [content-visibility:auto] [contain-intrinsic-size:200px]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${item.mediaType === 'video' ? 'video' : 'photograph'} ${index + 1} of ${total}`}
        className="group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-forum-700 focus-visible:ring-offset-2"
      >
        <span
          className={
            frameClass
              ? `block rounded-lg p-[2px] shadow-sm ${frameClass}`
              : 'block'
          }
        >
          <span
            ref={ref as RefObject<HTMLSpanElement>}
            className={`relative block aspect-[16/10] overflow-hidden bg-forum-100 ${dense ? 'rounded-[calc(0.5rem-1px)]' : ''}`}
          >
            {item.mediaType === 'video' ? (
              <>
                <span className="absolute inset-0 bg-gradient-to-br from-forum-800 to-forum-950" aria-hidden="true" />
                <span className="pointer-events-none absolute left-2 top-2 rounded bg-forum-950/75 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Video
                </span>
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-forum-900 shadow-sm">
                    <Film className="h-5 w-5" aria-hidden="true" />
                  </span>
                </span>
                <span className="sr-only">{label}</span>
              </>
            ) : showImage ? (
              <CdnImage
                src={previewSrc}
                alt={label}
                srcSet={item.srcSet}
                width={item.width ?? 480}
                height={item.height ?? 300}
                sizes={dense ? '(max-width:640px) 100vw, (max-width:1024px) 50vw, (max-width:1400px) 33vw, 25vw' : '(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw'}
                eager={eager}
                fetchPriority={eager ? 'high' : 'low'}
                aspectRatio="16 / 10"
                className="h-full w-full transition duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            ) : (
              <span className="absolute inset-0 bg-forum-100" aria-hidden="true" />
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function MediaRow({
  heading,
  items,
  indexById,
  total,
  onOpen,
  dense = false,
  eagerCount = 0,
}: {
  heading: string;
  items: AwardEventMediaItem[];
  indexById: Map<string, number>;
  total: number;
  onOpen: (item: AwardEventMediaItem) => void;
  dense?: boolean;
  eagerCount?: number;
}) {
  if (!items.length) return null;
  return (
    <div className={dense ? 'space-y-3' : 'space-y-4'}>
      <h3 className={`font-semibold text-forum-900 ${dense ? 'text-base sm:text-lg' : 'font-display text-2xl'}`}>
        {heading}
      </h3>
      <ul
        className={
          dense
            ? 'grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 lg:gap-3.5'
            : 'grid list-none grid-cols-1 gap-x-8 gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-12'
        }
      >
        {items.map((item, rowIndex) => {
          const index = indexById.get(item.id) ?? rowIndex;
          return (
            <MediaTile
              key={item.id}
              item={item}
              index={index}
              total={total}
              onOpen={() => onOpen(item)}
              dense={dense}
              eager={rowIndex < eagerCount}
            />
          );
        })}
      </ul>
    </div>
  );
}

export default function AwardEventMediaGrid({
  mode = 'full',
}: {
  mode?: 'preview' | 'full';
}) {
  const [items, setItems] = useState<AwardEventMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const dense = mode === 'full';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    awardEventMediaApi.listPublic()
      .then(next => {
        if (!cancelled) {
          setItems(next);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) setError(normalizeError(err).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const photos = useMemo(() => items.filter(item => item.mediaType === 'image'), [items]);
  const videos = useMemo(() => items.filter(item => item.mediaType === 'video'), [items]);
  const lightboxItems = useMemo(() => [...photos, ...videos], [photos, videos]);
  const indexById = useMemo(
    () => new Map(lightboxItems.map((item, index) => [item.id, index])),
    [lightboxItems],
  );

  const visiblePhotos = mode === 'preview' ? photos.slice(0, PREVIEW_PER_TYPE) : photos.slice(0, visibleCount);
  // Video tiles are poster-only (no file download), so keep them all mounted in full mode.
  const visibleVideos = mode === 'preview' ? videos.slice(0, PREVIEW_PER_TYPE) : videos;
  const remainingCount = Math.max(0, photos.length - PREVIEW_PER_TYPE) + Math.max(0, videos.length - PREVIEW_PER_TYPE);
  const showSeeMore = mode === 'preview' && remainingCount > 0;
  const hasMoreDense = dense && visibleCount < photos.length;

  useEffect(() => {
    if (!hasMoreDense) return;
    const node = loadMoreRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount(count => Math.min(count + BATCH_SIZE, lightboxItems.length));
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreDense, lightboxItems.length, visibleCount]);

  const openItem = (item: AwardEventMediaItem) => {
    const index = indexById.get(item.id);
    if (typeof index === 'number') setActive(index);
  };

  if (loading) {
    return <p role="status" className="text-sm text-ink-muted">Loading previous event media…</p>;
  }

  if (error) {
    return <p role="alert" className="text-sm text-danger-700">{error}</p>;
  }

  if (lightboxItems.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-paper-border bg-paper-raised px-6 py-10 text-center">
        <p className="font-display text-xl font-semibold text-forum-900">{AWARD_EVENT_GALLERY_TITLE}</p>
        <p className="mt-2 text-sm text-ink-muted">Award photographs and videos will appear here once they are published.</p>
      </div>
    );
  }

  return (
    <div className={dense ? 'space-y-8' : 'space-y-10'}>
      <MediaRow
        heading="Photographs"
        items={visiblePhotos}
        indexById={indexById}
        total={lightboxItems.length}
        onOpen={openItem}
        dense={dense}
        eagerCount={dense ? 4 : 3}
      />
      <MediaRow
        heading="Videos"
        items={visibleVideos}
        indexById={indexById}
        total={lightboxItems.length}
        onOpen={openItem}
        dense={dense}
        eagerCount={0}
      />

      {hasMoreDense && (
        <div ref={loadMoreRef} className="flex justify-center py-2" aria-hidden="true">
          <span className="text-sm text-ink-muted">Loading more…</span>
        </div>
      )}

      {showSeeMore && (
        <div className="flex justify-center pt-2">
          <Link
            to={CEREMONY_GALLERY_PATH}
            className="inline-flex items-center gap-2 rounded-full border border-paper-border bg-paper-raised px-5 py-2.5 text-[15px] font-medium text-forum-900 transition hover:border-forum-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forum-700"
          >
            See more
            <span className="text-ink-muted">({remainingCount} more)</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      {active !== null && (
        <AwardEventLightbox
          items={lightboxItems}
          index={active}
          title={AWARD_EVENT_GALLERY_TITLE}
          onClose={() => setActive(null)}
          onChange={setActive}
        />
      )}
    </div>
  );
}
