import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Film, ImagePlus, Trash2 } from 'lucide-react';
import Button from '../../components/common/Button';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { apiClient, normalizeError } from '../../api/client';
import { awardEventMediaApi, type AwardEventMediaItem, type AwardMediaType } from '../../api/awardEventMedia';
import { useAuth } from '../../context/AuthContext';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const MAX_BYTES = 100 * 1024 * 1024;

function MediaPreview({ item }: { item: AwardEventMediaItem }) {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!item.mediaUrl || user?.role !== 'ADMIN') return;
    const controller = new AbortController();
    let objectUrl = '';
    apiClient.get<Blob>(item.mediaUrl, { responseType: 'blob', signal: controller.signal }).then(response => {
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
  }, [item.mediaUrl, user?.id, user?.role]);

  if (!url) return <div className="h-24 w-40 shrink-0 rounded-md bg-forum-50" />;
  if (item.mediaType === 'video') {
    return <video src={url} className="h-24 w-40 shrink-0 rounded-md object-cover" muted playsInline preload="metadata" />;
  }
  return <img src={url} alt="" className="h-24 w-40 shrink-0 rounded-md object-cover" />;
}

function MediaSection({
  title,
  description,
  type,
  accept,
  items,
  busy,
  onUpload,
  onReorder,
  onToggle,
  onRemove,
}: {
  title: string;
  description: string;
  type: AwardMediaType;
  accept: string;
  items: AwardEventMediaItem[];
  busy: boolean;
  onUpload: (files: FileList | null, type: AwardMediaType) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
  onToggle: (item: AwardEventMediaItem) => void;
  onRemove: (item: AwardEventMediaItem) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-forum-900">{title}</h2>
          <p className="mt-1 text-xs text-ink-subtle">{description}</p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            multiple
            className="sr-only"
            onChange={event => { onUpload(event.target.files, type); event.target.value = ''; }}
          />
          <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            {type === 'video' ? <Film className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
            Upload {type === 'video' ? 'videos' : 'photographs'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {items.length === 0 && (
          <p className="text-sm text-ink-muted">No {type === 'video' ? 'videos' : 'photographs'} uploaded yet.</p>
        )}
        {items.map((item, index) => (
          <div key={item.id} className="rounded-lg border border-paper-border p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col">
                <button type="button" className="text-ink-subtle hover:text-forum-700 disabled:opacity-35" aria-label={`Move ${type} ${index + 1} earlier`} disabled={busy || index === 0} onClick={() => onReorder(item.id, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" className="text-ink-subtle hover:text-forum-700 disabled:opacity-35" aria-label={`Move ${type} ${index + 1} later`} disabled={busy || index === items.length - 1} onClick={() => onReorder(item.id, 1)}>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <MediaPreview item={item} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-forum-900">{type === 'video' ? 'Video' : 'Photograph'} {index + 1}</p>
                <p className="truncate text-xs text-ink-subtle">{item.name}</p>
              </div>
              <Button size="sm" variant={item.published ? 'secondary' : 'outline'} disabled={busy} onClick={() => onToggle(item)}>
                {item.published ? 'Published' : 'Hidden'}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onRemove(item)}>
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminAwardEventMediaPage() {
  const [images, setImages] = useState<AwardEventMediaItem[]>([]);
  const [videos, setVideos] = useState<AwardEventMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const busyRef = useRef(false);

  const load = async () => {
    setLoading(true);
    try {
      const [imageItems, videoItems] = await Promise.all([
        awardEventMediaApi.list('image'),
        awardEventMediaApi.list('video'),
      ]);
      setImages(imageItems);
      setVideos(videoItems);
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

  const uploadFiles = (list: FileList | null, type: AwardMediaType) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    const allowed = type === 'video' ? VIDEO_TYPES : IMAGE_TYPES;
    const invalid = files.find(file => !allowed.has(file.type) || file.size > MAX_BYTES);
    if (invalid) {
      setNotice({
        message: !allowed.has(invalid.type)
          ? (type === 'video' ? 'Videos must be MP4 or WebM.' : 'Photographs must be JPG, PNG, or WebP.')
          : 'Each file must be 100 MB or smaller.',
        error: true,
      });
      return;
    }
    void run(async () => {
      for (const file of files) await awardEventMediaApi.upload(file);
      if (type === 'video') setVideos(await awardEventMediaApi.list('video'));
      else setImages(await awardEventMediaApi.list('image'));
      setNotice({
        message: files.length === 1
          ? `${type === 'video' ? 'Video' : 'Photograph'} uploaded.`
          : `${files.length} ${type === 'video' ? 'videos' : 'photographs'} uploaded.`,
      });
    });
  };

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <Link to="/admin/settings" className="inline-flex items-center gap-1 text-xs text-forum-700">
          <ArrowLeft className="h-3 w-3" /> Administration settings
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-forum-900 sm:text-3xl">Award event media</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Upload photographs and videos for previous award ceremonies. These appear on the awards pages. No captions or other details are required.
        </p>
      </div>

      {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-sm text-danger-700' : 'text-sm text-success-700'}>{notice.message}</p>}
      {loading && <p role="status">Loading award event media…</p>}

      {!loading && (
        <>
          <MediaSection
            title="Photographs"
            description={`${images.length} uploaded. Published photographs appear in the previous-event gallery.`}
            type="image"
            accept="image/jpeg,image/png,image/webp"
            items={images}
            busy={busy}
            onUpload={uploadFiles}
            onReorder={(id, direction) => void run(async () => setImages(await awardEventMediaApi.reorder(id, direction)))}
            onToggle={item => void run(async () => {
              const updated = await awardEventMediaApi.update(item.id, { published: !item.published });
              setImages(current => current.map(row => row.id === item.id ? updated : row));
              setNotice({ message: updated.published ? 'Photograph is published.' : 'Photograph is hidden.' });
            })}
            onRemove={item => void run(async () => {
              await awardEventMediaApi.remove(item.id);
              setImages(await awardEventMediaApi.list('image'));
              setNotice({ message: 'Photograph removed.' });
            })}
          />
          <MediaSection
            title="Videos"
            description={`${videos.length} uploaded. Published videos appear with the previous-event gallery.`}
            type="video"
            accept="video/mp4,video/webm"
            items={videos}
            busy={busy}
            onUpload={uploadFiles}
            onReorder={(id, direction) => void run(async () => setVideos(await awardEventMediaApi.reorder(id, direction)))}
            onToggle={item => void run(async () => {
              const updated = await awardEventMediaApi.update(item.id, { published: !item.published });
              setVideos(current => current.map(row => row.id === item.id ? updated : row));
              setNotice({ message: updated.published ? 'Video is published.' : 'Video is hidden.' });
            })}
            onRemove={item => void run(async () => {
              await awardEventMediaApi.remove(item.id);
              setVideos(await awardEventMediaApi.list('video'));
              setNotice({ message: 'Video removed.' });
            })}
          />
        </>
      )}
    </div>
  );
}
