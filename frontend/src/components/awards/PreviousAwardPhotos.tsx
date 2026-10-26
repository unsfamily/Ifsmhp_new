import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import GalleryMedia from '../gallery/GalleryMedia';

type GalleryCategory = { id: string; name: string };
type GallerySubcategory = { id: string; name: string };
type GalleryPhoto = {
  id: string;
  title: string;
  caption: string;
  altText: string;
  imageUrl: string;
  mediaUrl?: string;
  type?: 'image' | 'video';
  displayOrder: number;
};

const AWARDS_CATEGORY = 'awards';
const LAST_FUNCTION = 'event 2025';

/**
 * Photographs from the previous award function, taken from the published
 * gallery subcategory "Event 2025" inside the Awards category.
 */
export default function PreviousAwardPhotos() {
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const categories = await apiClient.get<{ data: { items: GalleryCategory[] } }>('/public/gallery/categories', { params: { limit: 50 }, signal: controller.signal });
      const awards = categories.data.data.items.find((category) => category.name.trim().toLowerCase() === AWARDS_CATEGORY);
      if (!awards) {
        setPhotos([]);
        return;
      }
      const subcategories = await apiClient.get<{ data: { items: GallerySubcategory[] } }>('/public/gallery/subcategories', { params: { limit: 50, categoryId: awards.id }, signal: controller.signal });
      const event = subcategories.data.data.items.find((item) => item.name.trim().toLowerCase() === LAST_FUNCTION);
      if (!event) {
        setPhotos([]);
        return;
      }
      const response = await apiClient.get<{ data: { items: GalleryPhoto[] } }>('/public/gallery/photos', {
        params: { limit: 24, categoryId: awards.id, subcategoryId: event.id },
        signal: controller.signal,
      });
      const images = response.data.data.items
        .filter((photo) => (photo.type ?? 'image') === 'image' && (photo.mediaUrl || photo.imageUrl))
        .sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title))
        .slice(0, 6);
      setPhotos(images);
    };
    load().catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The 2025 award photographs could not be loaded.');
    });
    return () => controller.abort();
  }, []);

  if (error) return <p role="alert" className="mt-8 text-sm text-danger-600">{error}</p>;
  if (!photos) return <p className="mt-8 text-sm text-ink-muted" role="status">Loading photographs from the 2025 award function…</p>;
  if (photos.length === 0) return <p className="mt-8 text-sm text-ink-muted">Photographs from the 2025 award function will appear here when they are published in the gallery.</p>;

  return (
    <div className="mt-8" role="group" aria-label="Photographs from the 2025 award function">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-700">2025 award function</p>
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
        {photos.map((photo) => (
          <li key={photo.id} className="overflow-hidden rounded-xl border border-paper-border bg-paper-raised shadow-sm">
            <GalleryMedia
              src={photo.mediaUrl || photo.imageUrl}
              mediaType="image"
              alt={photo.altText || photo.caption || photo.title}
              className="aspect-[4/3] w-full object-cover"
            />
            {photo.caption.trim() ? <p className="px-2 py-2 text-xs leading-relaxed text-ink-muted">{photo.caption}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
