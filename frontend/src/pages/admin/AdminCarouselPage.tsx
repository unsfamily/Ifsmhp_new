import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, ImagePlus, Trash2 } from 'lucide-react';
import Button from '../../components/common/Button';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { TextInput } from '../../components/common/Input';
import { apiClient, normalizeError } from '../../api/client';
import { homeCarouselApi, type HomeCarouselSlide } from '../../api/homeCarousel';
import { useAuth } from '../../context/AuthContext';
import ceremonyConclave01 from '../../assets/images/carousel/laureates-conclave-01.jpg';
import ceremonyConclave02 from '../../assets/images/carousel/laureates-conclave-02.jpg';
import ceremonyConclave03 from '../../assets/images/carousel/laureates-conclave-03.jpg';

const MAX_SLIDES = 3;
const MAX_BYTES = 15 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BUILTIN = [
  { src: ceremonyConclave01, label: 'Laureates with plaques · prior award ceremony' },
  { src: ceremonyConclave02, label: 'Certificate presentation · prior award ceremony' },
  { src: ceremonyConclave03, label: 'Full stage · prior award ceremony' },
];

function SlidePreview({ src, alt }: { src: string; alt: string }) {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!src || user?.role !== 'ADMIN') return;
    const controller = new AbortController();
    let objectUrl = '';
    apiClient.get<Blob>(src, { responseType: 'blob', signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(response.data);
      setUrl(objectUrl);
    }).catch(() => {
      if (!controller.signal.aborted) setUrl('');
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, user?.id, user?.role]);
  if (!url) return <div className="h-24 w-40 shrink-0 rounded-md bg-forum-50" />;
  return <img src={url} alt={alt || 'Carousel photograph'} className="h-24 w-40 shrink-0 rounded-md object-cover" />;
}

export default function AdminCarouselPage() {
  const [slides, setSlides] = useState<HomeCarouselSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  const load = async () => {
    setLoading(true);
    try {
      const items = await homeCarouselApi.list();
      setSlides(items);
      setDrafts(Object.fromEntries(items.map(item => [item.id, item.altText])));
      setNotice(null);
    } catch (error) {
      setNotice({ message: normalizeError(error).message, error: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await operation();
    } catch (error) {
      const details = normalizeError(error);
      setNotice({ message: Object.values(details.fieldErrors).find(Boolean) || details.message, error: true });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const uploadFiles = (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    const invalid = files.find(file => !PHOTO_TYPES.has(file.type) || file.size > MAX_BYTES);
    if (invalid) {
      setNotice({ message: !PHOTO_TYPES.has(invalid.type) ? 'Photographs must be JPG, PNG, or WebP.' : 'Each photograph must be 15 MB or smaller.', error: true });
      return;
    }
    if (slides.length + files.length > MAX_SLIDES) {
      setNotice({ message: `The carousel holds up to ${MAX_SLIDES} photographs.`, error: true });
      return;
    }
    void run(async () => {
      for (const file of files) await homeCarouselApi.upload(file);
      const items = await homeCarouselApi.list();
      setSlides(items);
      setDrafts(Object.fromEntries(items.map(item => [item.id, item.altText])));
      setNotice({ message: files.length === 1 ? 'Photograph added to the front-page carousel.' : `${files.length} photographs added to the front-page carousel.` });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <Link to="/admin/settings" className="inline-flex items-center gap-1 text-xs text-forum-700">
            <ArrowLeft className="h-3 w-3" /> Administration settings
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold text-forum-900 sm:text-3xl">Home carousel</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Upload up to three front-page carousel photographs. If none are uploaded, the site uses the built-in Second International Awards ceremony photos with the award event details.
          </p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={event => { uploadFiles(event.target.files); event.target.value = ''; }}
          />
          <Button size="sm" disabled={busy || slides.length >= MAX_SLIDES} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" /> Upload photographs
          </Button>
        </div>
      </div>

      {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-sm text-danger-700' : 'text-sm text-success-700'}>{notice.message}</p>}

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg font-semibold text-forum-900">Carousel photographs</h2>
          <p className="mt-1 text-xs text-ink-subtle">{slides.length} of {MAX_SLIDES} uploaded. Published photographs replace the built-in conclave set. Hidden photographs stay off the front page.</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {loading && <p role="status">Loading carousel photographs…</p>}
          {!loading && slides.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-ink-muted">No photographs uploaded yet. The front page is showing these built-in International Laureates Recognition Conclave photographs.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {BUILTIN.map(photo => (
                  <figure key={photo.label} className="overflow-hidden rounded-lg border border-paper-border">
                    <img src={photo.src} alt={photo.label} className="h-36 w-full object-cover" />
                    <figcaption className="px-3 py-2 text-xs text-ink-muted">{photo.label}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
          {slides.map((slide, index) => (
            <div key={slide.id} className="rounded-lg border border-paper-border p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col">
                  <button type="button" className="text-ink-subtle hover:text-forum-700 disabled:opacity-35" aria-label={`Move photograph ${index + 1} earlier`} disabled={busy || index === 0} onClick={() => void run(async () => setSlides(await homeCarouselApi.reorder(slide.id, -1)))}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" className="text-ink-subtle hover:text-forum-700 disabled:opacity-35" aria-label={`Move photograph ${index + 1} later`} disabled={busy || index === slides.length - 1} onClick={() => void run(async () => setSlides(await homeCarouselApi.reorder(slide.id, 1)))}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                <SlidePreview src={slide.imageUrl} alt={slide.altText} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-forum-900">Photograph {index + 1}</p>
                  <p className="truncate text-xs text-ink-subtle">{slide.name}</p>
                </div>
                <Button
                  size="sm"
                  variant={slide.published ? 'secondary' : 'outline'}
                  disabled={busy}
                  onClick={() => void run(async () => {
                    const updated = await homeCarouselApi.update(slide.id, { published: !slide.published });
                    setSlides(current => current.map(item => item.id === slide.id ? updated : item));
                    setNotice({ message: updated.published ? 'Photograph is on the front page.' : 'Photograph is hidden from the front page.' });
                  })}
                >
                  {slide.published ? 'Published' : 'Hidden'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void run(async () => {
                    await homeCarouselApi.remove(slide.id);
                    const items = await homeCarouselApi.list();
                    setSlides(items);
                    setDrafts(Object.fromEntries(items.map(item => [item.id, item.altText])));
                    setNotice({ message: 'Photograph removed from the carousel.' });
                  })}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </div>
              <div className="mt-3 max-w-xl">
                <TextInput
                  label="Alt text"
                  hint="Short description of the photograph for screen readers."
                  value={drafts[slide.id] ?? slide.altText}
                  maxLength={191}
                  disabled={busy}
                  onChange={event => setDrafts(current => ({ ...current, [slide.id]: event.target.value }))}
                  onBlur={() => {
                    const altText = (drafts[slide.id] ?? slide.altText).trim();
                    if (altText === slide.altText) return;
                    void run(async () => {
                      const updated = await homeCarouselApi.update(slide.id, { altText });
                      setSlides(current => current.map(item => item.id === slide.id ? updated : item));
                      setDrafts(current => ({ ...current, [slide.id]: updated.altText }));
                    });
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
