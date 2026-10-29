import { useEffect, useMemo, useState } from 'react';
import { Film } from 'lucide-react';
import { awardEventMediaApi, type AwardEventMediaItem } from '../../api/awardEventMedia';
import { normalizeError } from '../../api/client';
import AwardEventCollageBanner from './AwardEventCollageBanner';
import AwardEventEssayStrip from './AwardEventEssayStrip';
import AwardEventLightbox from './AwardEventLightbox';

const TITLE = 'International Laureates Recognition Conclave';
const YEAR_LABEL = '2025 award function';

export default function PreviousAwardPhotos() {
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

  const openLightbox = (index: number, source: 'photo' | 'video') => {
    if (source === 'photo') setActive(index);
    else setActive(photos.length + index);
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
        <p className="font-display text-xl font-semibold text-forum-900">{TITLE}</p>
        <p className="mt-2 text-sm text-ink-muted">Award photographs and videos will appear here once they are published.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {photos.length > 0 && (
        <>
          <AwardEventCollageBanner photos={photos} onOpen={index => openLightbox(index, 'photo')}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-400">{YEAR_LABEL}</p>
            <p className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{TITLE}</p>
            <p className="mt-3 text-sm text-white/75">Impact Bharath · {photos.length} photograph{photos.length === 1 ? '' : 's'}</p>
          </AwardEventCollageBanner>
          <AwardEventEssayStrip photos={photos} onOpen={index => openLightbox(index, 'photo')} />
        </>
      )}

      {videos.length > 0 && (
        <section aria-labelledby="award-event-videos-heading" className="space-y-4">
          <div>
            <h3 id="award-event-videos-heading" className="font-display text-2xl font-semibold text-forum-900">Event videos</h3>
            <p className="mt-1 text-sm text-ink-muted">{videos.length} video{videos.length === 1 ? '' : 's'} from the ceremony.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video, index) => (
              <button
                key={video.id}
                type="button"
                onClick={() => openLightbox(index, 'video')}
                className="group relative aspect-video overflow-hidden rounded-2xl bg-forum-950 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-forum-700"
                aria-label={`Open video ${index + 1} of ${videos.length}`}
              >
                <video src={video.mediaUrl} className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.03]" muted playsInline preload="metadata" />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-forum-950/25">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-forum-900 shadow-sm">
                    <Film className="h-5 w-5" aria-hidden="true" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {active !== null && (
        <AwardEventLightbox
          items={lightboxItems}
          index={active}
          title={TITLE}
          onClose={() => setActive(null)}
          onChange={setActive}
        />
      )}
    </div>
  );
}
