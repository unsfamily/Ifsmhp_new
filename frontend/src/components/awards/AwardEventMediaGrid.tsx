import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Film } from 'lucide-react';
import { awardEventMediaAlt, awardEventMediaApi, type AwardEventMediaItem } from '../../api/awardEventMedia';
import { normalizeError } from '../../api/client';
import { CEREMONY_GALLERY_PATH } from '../../domain/ceremonyRegistration';
import AwardEventLightbox from './AwardEventLightbox';

export const AWARD_EVENT_GALLERY_TITLE = 'International Laureates Recognition Conclave';
const PREVIEW_PER_TYPE = 3;

function MediaTile({
  item,
  index,
  total,
  onOpen,
}: {
  item: AwardEventMediaItem;
  index: number;
  total: number;
  onOpen: () => void;
}) {
  const label = awardEventMediaAlt(item, { index, total, eventLabel: AWARD_EVENT_GALLERY_TITLE });
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${item.mediaType === 'video' ? 'video' : 'photograph'} ${index + 1} of ${total}`}
        className="group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-forum-700 focus-visible:ring-offset-2"
      >
        <span className="relative block aspect-[16/10] overflow-hidden bg-forum-100">
          {item.mediaType === 'video' ? (
            <>
              <video
                src={item.mediaUrl}
                aria-label={label}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                muted
                playsInline
                preload="metadata"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-forum-950/20">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-forum-900 shadow-sm">
                  <Film className="h-5 w-5" aria-hidden="true" />
                </span>
              </span>
            </>
          ) : (
            <img
              src={item.mediaUrl}
              alt={label}
              loading={index < 6 ? 'eager' : 'lazy'}
              decoding="async"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          )}
        </span>
      </button>
    </li>
  );
}

function MediaRow({
  heading,
  items,
  lightboxItems,
  onOpen,
}: {
  heading: string;
  items: AwardEventMediaItem[];
  lightboxItems: AwardEventMediaItem[];
  onOpen: (item: AwardEventMediaItem) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="space-y-4">
      <h3 className="font-display text-2xl font-semibold text-forum-900">{heading}</h3>
      <ul className="grid list-none grid-cols-1 gap-x-8 gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-12">
        {items.map((item) => {
          const index = lightboxItems.findIndex(row => row.id === item.id);
          return (
            <MediaTile
              key={item.id}
              item={item}
              index={index}
              total={lightboxItems.length}
              onOpen={() => onOpen(item)}
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

  const visiblePhotos = mode === 'preview' ? photos.slice(0, PREVIEW_PER_TYPE) : photos;
  const visibleVideos = mode === 'preview' ? videos.slice(0, PREVIEW_PER_TYPE) : videos;
  const remainingCount = Math.max(0, photos.length - visiblePhotos.length) + Math.max(0, videos.length - visibleVideos.length);
  const showSeeMore = mode === 'preview' && remainingCount > 0;

  const openItem = (item: AwardEventMediaItem) => {
    const index = lightboxItems.findIndex(row => row.id === item.id);
    if (index >= 0) setActive(index);
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
    <div className="space-y-10">
      <MediaRow heading="Photographs" items={visiblePhotos} lightboxItems={lightboxItems} onOpen={openItem} />
      <MediaRow heading="Videos" items={visibleVideos} lightboxItems={lightboxItems} onOpen={openItem} />

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
