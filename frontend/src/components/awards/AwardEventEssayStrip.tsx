import { useMemo, useState } from 'react';
import type { AwardEventMediaItem } from '../../api/awardEventMedia';

function isPortrait(ratio: number | undefined) {
  return typeof ratio === 'number' && ratio > 0 && ratio < 1.08;
}

function groupEssayRows(photos: AwardEventMediaItem[], aspects: Record<string, number>) {
  const rows: { key: string; items: AwardEventMediaItem[]; pair: boolean }[] = [];
  for (let index = 0; index < photos.length; ) {
    const photo = photos[index]!;
    const next = photos[index + 1];
    if (isPortrait(aspects[photo.id]) && next && isPortrait(aspects[next.id])) {
      rows.push({ key: `${photo.id}-${next.id}`, items: [photo, next], pair: true });
      index += 2;
    } else {
      rows.push({ key: String(photo.id), items: [photo], pair: false });
      index += 1;
    }
  }
  return rows;
}

export default function AwardEventEssayStrip({
  photos,
  onOpen,
  eagerCount = 4,
}: {
  photos: AwardEventMediaItem[];
  onOpen: (index: number) => void;
  eagerCount?: number;
}) {
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const rows = useMemo(() => groupEssayRows(photos, aspects), [photos, aspects]);
  const total = photos.length;

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <div className="flex flex-col gap-2.5 md:gap-3.5">
        {rows.map(row => (
          <div key={row.key} className={row.pair ? 'grid grid-cols-2 gap-2.5 md:gap-3.5' : 'block'}>
            {row.items.map(photo => {
              const photoIndex = photos.findIndex(item => item.id === photo.id);
              return (
                <figure key={photo.id} className="m-0 min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpen(photoIndex)}
                    aria-label={`Open photograph ${photoIndex + 1} of ${total}`}
                    className="block w-full bg-forum-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-forum-700"
                  >
                    <img
                      src={photo.mediaUrl}
                      alt=""
                      loading={photoIndex < eagerCount ? 'eager' : 'lazy'}
                      decoding="async"
                      onLoad={event => {
                        const image = event.currentTarget;
                        if (!image.naturalWidth) return;
                        setAspects(current => {
                          if (current[photo.id]) return current;
                          return { ...current, [photo.id]: image.naturalWidth / image.naturalHeight };
                        });
                      }}
                      className={row.pair ? 'aspect-[4/5] h-full w-full object-cover' : 'block h-auto w-full'}
                    />
                  </button>
                </figure>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
