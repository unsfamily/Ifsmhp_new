import { useState } from 'react';

export type CdnVideoProps = {
  src: string;
  /** Accessible name announced to assistive tech. */
  label: string;
  poster?: string | null;
  className?: string;
  aspectRatio?: string;
  controls?: boolean;
  muted?: boolean;
  /** When false, only metadata is fetched until the user plays. */
  preload?: 'none' | 'metadata' | 'auto';
  autoPlay?: boolean;
  loop?: boolean;
};

/**
 * Streaming-friendly video for CloudFront URLs.
 * Uses playsInline + metadata preload and an optional poster so large files
 * do not block the first paint.
 */
export default function CdnVideo({
  src,
  label,
  poster,
  className = '',
  aspectRatio = '16 / 10',
  controls = true,
  muted = true,
  preload = 'metadata',
  autoPlay = false,
  loop = false,
}: CdnVideoProps) {
  const [ready, setReady] = useState(false);

  return (
    <span
      className={`relative block overflow-hidden bg-forum-950 ${className}`}
      style={aspectRatio === 'auto' ? undefined : { aspectRatio }}
      role="group"
      aria-label={label}
    >
      {!ready && (
        <span
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-forum-900 via-forum-800 to-forum-950"
          aria-hidden="true"
        />
      )}
      <video
        src={src}
        poster={poster || undefined}
        aria-label={label}
        className={`h-full w-full object-cover transition duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
        controls={controls}
        muted={muted}
        playsInline
        preload={preload}
        autoPlay={autoPlay}
        loop={loop}
        onLoadedData={() => setReady(true)}
      />
    </span>
  );
}
