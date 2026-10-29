import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { awardEventMediaAlt, awardEventMediaApi, type AwardEventMediaItem } from '../../api/awardEventMedia';
import { normalizeError } from '../../api/client';
import AwardEventLightbox from './AwardEventLightbox';

const TITLE = 'International Laureates Recognition Conclave';

export default function AwardEventMediaGrid() {
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

  if (loading) {
    return <p role="status" className="text-sm text-ink-muted">Loading previous event media…</p>;
  }

  if (error) {
    return <p role="alert" className="text-sm text-danger-700">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-paper-border bg-paper-raised px-6 py-10 text-center">
        <p className="font-display text-xl font-semibold text-forum-900">{TITLE}</p>
        <p className="mt-2 text-sm text-ink-muted">Award photographs and videos will appear here once they are published.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="grid list-none grid-cols-1 gap-x-8 gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-12">
        {items.map((item, index) => (
          <li key={item.id} className="min-w-0">
            <button
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Open ${item.mediaType === 'video' ? 'video' : 'photograph'} ${index + 1} of ${items.length}`}
              className="group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-forum-700 focus-visible:ring-offset-2"
            >
              <span className="relative block aspect-[16/10] overflow-hidden bg-forum-100">
                {item.mediaType === 'video' ? (
                  <>
                    <video
                      src={item.mediaUrl}
                      aria-label={awardEventMediaAlt(item, { index, total: items.length, eventLabel: TITLE })}
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
                    alt={awardEventMediaAlt(item, { index, total: items.length, eventLabel: TITLE })}
                    loading={index < 6 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {active !== null && (
        <AwardEventLightbox
          items={items}
          index={active}
          title={TITLE}
          onClose={() => setActive(null)}
          onChange={setActive}
        />
      )}
    </>
  );
}
