import { useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { awardEventMediaAlt, type AwardEventMediaItem } from '../../api/awardEventMedia';

export default function AwardEventLightbox({
  items,
  index,
  title,
  onClose,
  onChange,
}: {
  items: AwardEventMediaItem[];
  index: number;
  title: string;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const total = items.length;
  const current = items[index] ?? null;
  const canNavigate = total > 1;

  const go = useCallback((nextIndex: number) => {
    if (!total) return;
    onChange((nextIndex + total) % total);
  }, [onChange, total]);

  useEffect(() => {
    if (!current) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') go(index + 1);
      if (event.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [current, go, index, onClose]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} gallery`}
      className="fixed inset-0 z-[1200] flex flex-col bg-forum-950/95 text-white"
      onClick={onClose}
    >
      <div className="flex h-full w-full flex-col" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div>
            <p className="text-[13px] font-semibold tracking-wide">{title}</p>
            <p className="text-[12px] text-white/65">{index + 1} of {total}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-forum-900 transition hover:bg-forum-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-3 sm:px-10">
          {canNavigate && (
            <button
              type="button"
              aria-label="Previous"
              onClick={() => go(index - 1)}
              className="absolute left-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:h-12 sm:w-12"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
          <figure className="flex max-h-full max-w-full flex-col items-center">
            {current.mediaType === 'video' ? (
              <video
                key={current.id}
                src={current.mediaUrl}
                aria-label={awardEventMediaAlt(current, { index, total, eventLabel: title })}
                controls
                playsInline
                className="max-h-[min(78vh,920px)] w-auto max-w-full bg-black shadow-[0_24px_80px_rgba(0,0,0,.45)]"
              />
            ) : (
              <img
                src={current.mediaUrl}
                alt={awardEventMediaAlt(current, { index, total, eventLabel: title })}
                className="max-h-[min(78vh,920px)] w-auto max-w-full object-contain shadow-[0_24px_80px_rgba(0,0,0,.45)]"
              />
            )}
          </figure>
          {canNavigate && (
            <button
              type="button"
              aria-label="Next"
              onClick={() => go(index + 1)}
              className="absolute right-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:h-12 sm:w-12"
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
        </div>

        {canNavigate && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-4 sm:justify-center sm:px-6">
            {items.map((item, itemIndex) => {
              const active = itemIndex === index;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Open item ${itemIndex + 1} of ${total}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onChange(itemIndex)}
                  className={`h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${active ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'}`}
                >
                  {item.mediaType === 'video' ? (
                    <video
                      src={item.mediaUrl}
                      aria-label={awardEventMediaAlt(item, { index: itemIndex, total, eventLabel: title })}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={item.mediaUrl}
                      alt={awardEventMediaAlt(item, { index: itemIndex, total, eventLabel: title })}
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
