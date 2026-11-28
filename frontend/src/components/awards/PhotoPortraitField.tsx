import { useEffect, useId, useRef, useState } from 'react';
import { Image, User } from 'lucide-react';
import Button from '../common/Button';

const VIEWPORT = 288;
const OUTPUT = 800;
const SOURCE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const SOURCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type Offset = { x: number; y: number };

type PhotoPortraitFieldProps = {
  id: string;
  status: 'idle' | 'uploading' | 'uploaded' | 'removing' | 'failed';
  fileName: string | null;
  previewUrl: string | null;
  error: string | null;
  disabled: boolean;
  onSelect: (file: File) => void;
  onInvalid: (message: string) => void;
};

function sourceError(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const allowedType = !file.type || SOURCE_TYPES.has(file.type);
  if (!SOURCE_EXTENSIONS.has(extension) || !allowedType) return 'Upload a JPG, PNG, or WebP photograph.';
  if (file.size <= 0) return 'Choose a non-empty file.';
  if (file.size > 5 * 1024 * 1024) return 'Upload a photograph under 5 MB.';
  return null;
}

function coveredScale(width: number, height: number, zoom: number) {
  return Math.max(VIEWPORT / width, VIEWPORT / height) * zoom;
}

function clampOffset(offset: Offset, width: number, height: number, zoom: number): Offset {
  const scale = coveredScale(width, height, zoom);
  const maxX = Math.max(0, (width * scale - VIEWPORT) / 2);
  const maxY = Math.max(0, (height * scale - VIEWPORT) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

async function cropToJpeg(image: HTMLImageElement, zoom: number, offset: Offset, sourceName: string) {
  const scale = coveredScale(image.naturalWidth, image.naturalHeight, zoom);
  const displayedWidth = image.naturalWidth * scale;
  const displayedHeight = image.naturalHeight * scale;
  const imageLeft = (VIEWPORT - displayedWidth) / 2 + offset.x;
  const imageTop = (VIEWPORT - displayedHeight) / 2 + offset.y;
  const sourceX = (0 - imageLeft) / scale;
  const sourceY = (0 - imageTop) / scale;
  const sourceSize = VIEWPORT / scale;
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT;
  canvas.height = OUTPUT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the photograph.');
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT, OUTPUT);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Could not prepare the photograph.');
  const base = sourceName.replace(/\.[^.]+$/, '') || 'photograph';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

function PhotoCropDialog({
  file,
  onCancel,
  onUse,
}: {
  file: File;
  onCancel: () => void;
  onUse: (file: File) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; origin: Offset } | null>(null);
  const titleId = useId();
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const move = (next: Offset) => {
    if (!size) return;
    setOffset(clampOffset(next, size.width, size.height, zoom));
  };

  const confirm = async () => {
    const image = imageRef.current;
    if (!image || !size || busy) return;
    setBusy(true);
    setError(null);
    try {
      onUse(await cropToJpeg(image, zoom, offset, file.name));
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : 'Could not prepare the photograph.');
    }
  };

  const scale = size ? coveredScale(size.width, size.height, zoom) : 1;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-paper-border bg-paper-raised p-5 text-ink shadow-xl backdrop:bg-black/50"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && !busy) onCancel();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => event.preventDefault()}
    >
      <h2 id={titleId} className="font-display text-lg font-semibold text-forum-900">Crop your photograph</h2>
      <p className="mt-1 text-sm text-ink-muted">Drag the picture to frame your head and shoulders. Use the slider to zoom.</p>
      <div
        className="relative mx-auto mt-4 h-72 w-72 touch-none overflow-hidden rounded-full bg-forum-100 ring-1 ring-paper-border"
        role="application"
        tabIndex={0}
        aria-label="Photograph frame. Use the arrow keys to move it."
        onPointerDown={(event) => {
          if (!size) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY, origin: offset };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          move({ x: drag.origin.x + event.clientX - drag.x, y: drag.origin.y + event.clientY - drag.y });
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 24 : 8;
          const next = { ...offset };
          if (event.key === 'ArrowLeft') next.x -= step;
          else if (event.key === 'ArrowRight') next.x += step;
          else if (event.key === 'ArrowUp') next.y -= step;
          else if (event.key === 'ArrowDown') next.y += step;
          else return;
          event.preventDefault();
          move(next);
        }}
      >
        {url && (
        <img
          ref={imageRef}
          src={url}
          alt=""
          draggable={false}
          className={`absolute left-1/2 top-1/2 max-w-none select-none ${size ? '' : 'opacity-0'}`}
          style={size ? {
            width: size.width * scale,
            height: size.height * scale,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          } : undefined}
          onLoad={(event) => {
            const image = event.currentTarget;
            setSize({ width: image.naturalWidth, height: image.naturalHeight });
            setOffset({ x: 0, y: 0 });
          }}
          onError={() => setError('This photograph could not be opened. Choose a JPG, PNG, or WebP file.')}
        />
        )}
      </div>
      <label className="mt-4 block text-sm font-medium text-ink">
        Zoom
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          disabled={!size || busy}
          className="mt-2 block w-full accent-forum-700"
          onChange={(event) => {
            const nextZoom = Number(event.currentTarget.value);
            setZoom(nextZoom);
            if (size) setOffset((current) => clampOffset(current, size.width, size.height, nextZoom));
          }}
        />
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-danger-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="button" onClick={() => { void confirm(); }} disabled={!size || busy || !!error}>
          {busy ? 'Preparing...' : 'Use photograph'}
        </Button>
      </div>
    </dialog>
  );
}

export default function PhotoPortraitField({
  id,
  status,
  fileName,
  previewUrl,
  error,
  disabled,
  onSelect,
  onInvalid,
}: PhotoPortraitFieldProps) {
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const dragDepth = useRef(0);
  const busy = disabled || status === 'uploading' || status === 'removing';

  const openCrop = (file: File | null) => {
    if (!file || busy) return;
    const message = sourceError(file);
    if (message) {
      onInvalid(message);
      return;
    }
    setPending(file);
  };

  return (
    <div
      className={`rounded-md ${dragOver ? 'ring-2 ring-forum-600 ring-offset-2' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        if (!busy) setDragOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragOver(false);
        openCrop(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      <p id={`${id}-label`} className="mb-1.5 text-sm font-medium text-ink">
        Photo
        <span className="ml-1 text-danger-600">*</span>
      </p>
      <div className={`flex items-center gap-3 rounded-md border bg-paper px-3 py-2 ${error ? 'border-danger-600' : 'border-paper-border'}`}>
        <Image className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{fileName ?? 'JPG, PNG, or WebP'}</span>
        <label className={`inline-flex items-center rounded-md border border-paper-border bg-paper-raised px-3 py-1 text-sm font-medium text-forum-900 ${busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-forum-50'}`}>
          {status === 'uploading' ? 'Uploading...' : 'Choose'}
          <input
            id={id}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            aria-labelledby={`${id}-label`}
            aria-describedby={`${id}-hint`}
            onChange={(event) => {
              openCrop(event.currentTarget.files?.[0] ?? null);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-paper-border" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forum-100 text-forum-700" aria-hidden="true">
            <User className="h-5 w-5" />
          </span>
        )}
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-ink-muted">
          Example photograph. Upload a clear head-and-shoulders picture like this. Drag a photograph here to crop it first.
        </p>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-danger-600">{error}</p>}
      {pending && (
        <PhotoCropDialog
          file={pending}
          onCancel={() => setPending(null)}
          onUse={(file) => {
            setPending(null);
            onSelect(file);
          }}
        />
      )}
    </div>
  );
}
