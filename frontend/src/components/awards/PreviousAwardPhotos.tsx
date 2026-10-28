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
  const [active, setActive] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active === null) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
  }, [active]);

  const show = (index: number) => setActive((index + photos.length) % photos.length);
  const current = active === null ? null : photos[active];

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
        <div className="grid gap-1.5 p-1.5 sm:grid-cols-5 sm:grid-rows-2" role="group" aria-label="Photographs from the 2025 award function">
          {photos.map((photo, index) => (
            <button
              key={photo.caption}
              type="button"
              onClick={() => show(index)}
              className={`award-photo-tile group relative overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-forum-950 ${
                index === 0 ? 'sm:col-span-3 sm:row-span-2' : 'sm:col-span-2'
              }`}
            >
              <img
                src={photo.src}
                alt={photo.alt}
                className={`w-full object-cover transition duration-500 group-hover:scale-[1.03] ${
                  index === 0 ? 'aspect-[16/10] sm:aspect-auto sm:h-full sm:min-h-[28rem]' : 'aspect-[16/9] sm:aspect-auto sm:h-full sm:min-h-[13.75rem]'
                }`}
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-3 pt-10 text-sm font-medium text-white">
                {photo.caption}
              </span>
            </button>
          ))}
        </div>

        <dialog
          ref={dialogRef}
          className="award-photo-dialog"
          aria-label="2025 award function photograph"
          onClose={() => setActive(null)}
          onClick={(event) => {
            if (event.target === dialogRef.current) setActive(null);
          }}
        >
          {current && active !== null && (
            <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
                <p className="font-display text-lg font-semibold">{current.caption}</p>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setActive(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
                  aria-label="Close photograph"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <img src={current.src} alt={current.alt} className="max-h-[calc(100dvh-8.5rem)] w-full object-contain" />
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-white/80">
                <button type="button" onClick={() => show(active - 1)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 hover:bg-white/10" aria-label="Previous photograph">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </button>
                <span>{active + 1} of {photos.length}</span>
                <button type="button" onClick={() => show(active + 1)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 hover:bg-white/10" aria-label="Next photograph">
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
