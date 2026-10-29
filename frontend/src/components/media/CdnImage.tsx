import { useState } from 'react';

const DEFAULT_WIDTHS = [320, 480, 640, 960, 1280] as const;

export type CdnImageProps = {
  src: string;
  alt: string;
  /** Optional pre-built srcset from the API (preferred when CDN variants exist). */
  srcSet?: string | null;
  sizes?: string;
  width?: number;
  height?: number;
  className?: string;
  /** Intrinsic box used to prevent layout shift before the image paints. */
  aspectRatio?: string;
  eager?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  /**
   * When true and `srcSet` is omitted, derive WebP candidates as `{src}.w{width}.webp`
   * (matches the award-media / S3 variant convention).
   */
  deriveWebpSrcSet?: boolean;
  srcSetWidths?: number[];
  onLoad?: () => void;
  onError?: () => void;
};

function buildWebpSrcSet(src: string, widths: number[]) {
  return widths.map(width => `${src}.w${width}.webp ${width}w`).join(', ');
}

/**
 * High-performance image for CloudFront (or any absolute CDN) URLs.
 * Lazy-loads by default, prefers WebP variants via srcset, and reserves space
 * with an aspect-ratio box + skeleton to avoid layout shift.
 */
export default function CdnImage({
  src,
  alt,
  srcSet,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  width,
  height,
  className = '',
  aspectRatio = '16 / 10',
  eager = false,
  fetchPriority = 'auto',
  deriveWebpSrcSet = false,
  srcSetWidths = [...DEFAULT_WIDTHS],
  onLoad,
  onError,
}: CdnImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const resolvedSrcSet = srcSet
    || (deriveWebpSrcSet && src ? buildWebpSrcSet(src, srcSetWidths) : undefined);

  return (
    <span
      className={`relative block overflow-hidden bg-forum-100 ${className}`}
      style={{ aspectRatio }}
      role="img"
      aria-label={alt}
    >
      {!loaded && !failed && (
        <span
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-forum-100 via-forum-50 to-brass-50"
          aria-hidden="true"
        />
      )}
      {!failed ? (
        <picture>
          {resolvedSrcSet ? (
            <source type="image/webp" srcSet={resolvedSrcSet} sizes={sizes} />
          ) : null}
          <img
            src={src}
            srcSet={resolvedSrcSet}
            sizes={sizes}
            alt={alt}
            width={width}
            height={height}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={fetchPriority}
            className={`h-full w-full object-cover transition duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => {
              setLoaded(true);
              onLoad?.();
            }}
            onError={() => {
              setFailed(true);
              onError?.();
            }}
          />
        </picture>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-forum-100 text-sm text-ink-muted" aria-hidden="true">
          Image unavailable
        </span>
      )}
    </span>
  );
}
