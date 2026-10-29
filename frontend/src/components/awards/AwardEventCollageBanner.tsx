import type { ReactNode } from 'react';
import type { AwardEventMediaItem } from '../../api/awardEventMedia';

function tileClass(index: number, count: number) {
  if (count <= 1) return 'col-span-12 row-span-6';
  if (count === 2) {
    return index === 0 ? 'col-span-12 row-span-4 sm:col-span-7 sm:row-span-6' : 'col-span-12 row-span-2 sm:col-span-5 sm:row-span-6';
  }
  if (count === 3) {
    if (index === 0) return 'col-span-12 row-span-3 sm:col-span-7 sm:row-span-6';
    if (index === 1) return 'col-span-6 row-span-3 sm:col-span-5 sm:row-span-3';
    return 'col-span-6 row-span-3 sm:col-span-5 sm:row-span-3';
  }
  if (count === 4) {
    if (index === 0) return 'col-span-12 row-span-3 sm:col-span-6 sm:row-span-6';
    if (index === 1) return 'col-span-6 row-span-3 sm:col-span-6 sm:row-span-3';
    if (index === 2) return 'col-span-6 row-span-2 sm:col-span-3 sm:row-span-3';
    return 'col-span-6 row-span-2 sm:col-span-3 sm:row-span-3';
  }
  if (index === 0) return 'col-span-12 row-span-3 sm:col-span-6 sm:row-span-6';
  if (index === 1) return 'col-span-6 row-span-2 sm:col-span-3 sm:row-span-3';
  if (index === 2) return 'col-span-6 row-span-2 sm:col-span-3 sm:row-span-3';
  if (index === 3) return 'col-span-6 row-span-2 sm:col-span-3 sm:row-span-3';
  return 'col-span-6 row-span-2 sm:col-span-3 sm:row-span-3';
}

export default function AwardEventCollageBanner({
  photos,
  onOpen,
  children,
}: {
  photos: AwardEventMediaItem[];
  onOpen: (index: number) => void;
  children: ReactNode;
}) {
  const tiles = photos.slice(0, Math.min(5, photos.length));
  const count = tiles.length;

  return (
    <div className="relative min-h-[56vh] overflow-hidden rounded-2xl bg-forum-950 sm:min-h-[68vh]">
      <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-1 sm:gap-1.5">
        {tiles.map((photo, index) => {
          const photoIndex = photos.findIndex(item => item.id === photo.id);
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => onOpen(photoIndex < 0 ? index : photoIndex)}
              aria-label={`Open photograph ${(photoIndex < 0 ? index : photoIndex) + 1} of ${photos.length}`}
              className={`group relative min-h-0 overflow-hidden bg-forum-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brass-400 ${tileClass(index, count)}`}
            >
              <img
                src={photo.mediaUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-forum-950/88 via-forum-950/45 to-transparent sm:via-forum-950/30" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-forum-950/85 via-transparent to-forum-950/20" />
      <div className="pointer-events-none relative z-10 mx-auto flex min-h-[56vh] w-full max-w-[1240px] flex-col justify-end px-5 py-10 sm:min-h-[68vh] md:px-10">
        <div className="max-w-[720px] text-white">{children}</div>
      </div>
    </div>
  );
}
