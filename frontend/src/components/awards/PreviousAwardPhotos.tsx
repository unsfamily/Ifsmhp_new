import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import stagePhoto from '../../assets/images/conclave-2025-stage.jpg';
import laureatesPhoto from '../../assets/images/conclave-2025-laureates.jpg';
import presentationPhoto from '../../assets/images/conclave-2025-presentation.jpg';

const photos = [
  {
    src: stagePhoto,
    alt: 'Laureates and guests gathered on stage at the International Laureates Recognition Conclave 2025, holding certificates beneath the Impact Bharath banner.',
    caption: 'The full stage',
  },
  {
    src: laureatesPhoto,
    alt: 'Laureates holding certificates on stage at the International Laureates Recognition Conclave 2025.',
    caption: 'Laureates with certificates',
  },
  {
    src: presentationPhoto,
    alt: 'A group of laureates presenting certificates on stage at the International Laureates Recognition Conclave 2025.',
    caption: 'Certificate presentation',
  },
];

export default function PreviousAwardPhotos() {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightbox === null) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
  }, [lightbox]);

  useEffect(() => {
    if (paused || lightbox !== null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % photos.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused, lightbox]);

  const show = (next: number) => setIndex((next + photos.length) % photos.length);
  const current = lightbox === null ? null : photos[lightbox];

  return (
    <div className="award-photo-stage">
      <figure className="award-photo-frame text-white">
        <figcaption className="relative flex flex-wrap items-end justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-forum-950 via-forum-900 to-forum-950 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-400">2025 award function</p>
            <p className="mt-1 font-display text-xl font-semibold sm:text-2xl">International Laureates Recognition Conclave</p>
          </div>
          <p className="text-sm text-white/70">Impact Bharath</p>
        </figcaption>

        <div
          className="relative"
          aria-roledescription="carousel"
          aria-label="Photographs from the 2025 award function"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
          }}
        >
          <div className="relative aspect-[1024/410] overflow-hidden bg-forum-950">
            {photos.map((photo, photoIndex) => {
              const active = photoIndex === index;
              return (
                <button
                  key={photo.caption}
                  type="button"
                  onClick={() => setLightbox(photoIndex)}
                  aria-label={photo.caption}
                  aria-hidden={!active}
                  tabIndex={active ? 0 : -1}
                  className={`award-photo-tile absolute inset-0 text-left transition-opacity duration-700 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-forum-950 ${
                    active ? 'opacity-100' : 'pointer-events-none opacity-0'
                  }`}
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    width={1024}
                    height={410}
                    loading={photoIndex === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={photoIndex === 0 ? 'high' : 'low'}
                    className="h-full w-full object-cover"
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-3 pt-10 text-sm font-medium text-white">
                    {photo.caption}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => show(index - 1)}
            className="absolute left-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-forum-950/55 text-white backdrop-blur transition hover:bg-forum-950/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
            aria-label="Previous photograph"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => show(index + 1)}
            className="absolute right-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-forum-950/55 text-white backdrop-blur transition hover:bg-forum-950/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
            aria-label="Next photograph"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-forum-950/50 px-2.5 py-1.5 backdrop-blur">
              {photos.map((photo, photoIndex) => (
                <button
                  key={photo.caption}
                  type="button"
                  aria-label={`Show ${photo.caption}`}
                  aria-current={photoIndex === index ? 'true' : undefined}
                  onClick={() => show(photoIndex)}
                  className={`h-2 rounded-full transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 ${
                    photoIndex === index ? 'w-8 bg-brass-300' : 'w-2 bg-white/55 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <dialog
          ref={dialogRef}
          className="award-photo-dialog"
          aria-label="2025 award function photograph"
          onClose={() => setLightbox(null)}
          onClick={(event) => {
            if (event.target === dialogRef.current) setLightbox(null);
          }}
        >
          {current && lightbox !== null && (
            <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
                <p className="font-display text-lg font-semibold">{current.caption}</p>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
                  aria-label="Close photograph"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <img src={current.src} alt={current.alt} width={1024} height={410} decoding="async" className="max-h-[calc(100dvh-8.5rem)] w-full object-contain" />
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-white/80">
                <button type="button" onClick={() => setLightbox((lightbox - 1 + photos.length) % photos.length)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 hover:bg-white/10" aria-label="Previous photograph in lightbox">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </button>
                <span>{lightbox + 1} of {photos.length}</span>
                <button type="button" onClick={() => setLightbox((lightbox + 1) % photos.length)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 hover:bg-white/10" aria-label="Next photograph in lightbox">
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </dialog>
      </figure>
    </div>
  );
}
