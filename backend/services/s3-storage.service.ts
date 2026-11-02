import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type ObjectCannedACL,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { env } from '../config';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

/** Long-lived CDN cache: objects are versioned by key (UUID), so immutable is safe. */
export const CDN_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const MULTIPART_THRESHOLD_BYTES = env.AWS_S3_MULTIPART_THRESHOLD_MB * 1024 * 1024;
const PART_SIZE_BYTES = 8 * 1024 * 1024;
const QUEUE_SIZE = 4;

export type S3UploadSource =
  | { kind: 'buffer'; body: Buffer }
  | { kind: 'path'; filePath: string };

export interface S3UploadInput {
  key: string;
  contentType: string;
  source: S3UploadSource;
  cacheControl?: string;
  metadata?: Record<string, string>;
  /** Optional ACL when the bucket policy does not grant public read via CloudFront OAC alone. */
  acl?: ObjectCannedACL;
}

export interface S3UploadResult {
  key: string;
  bucket: string;
  etag?: string;
  contentType: string;
  cacheControl: string;
  /** Absolute CloudFront URL for the stored object. */
  cdnUrl: string;
  sizeBytes?: number;
}

let client: S3Client | null = null;

/** True when S3 + CloudFront are fully configured for media storage. */
export function isS3Configured(): boolean {
  return env.s3Configured;
}

function requireS3() {
  if (!env.s3Configured) {
    throw ApiError.serviceUnavailable('Object storage is not configured.');
  }
}

function getClient(): S3Client {
  requireS3();
  if (!client) {
    client = new S3Client({
      region: env.AWS_REGION!,
      ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
  return client;
}

/** Builds the public CloudFront URL for an object key. */
export function cloudFrontUrl(key: string): string {
  requireS3();
  const base = env.AWS_CLOUDFRONT_URL!.replace(/\/+$/, '');
  const normalized = key.replace(/^\/+/, '');
  return `${base}/${normalized}`;
}

function normalizeKey(key: string): string {
  const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    throw ApiError.badRequest('Invalid object storage key.');
  }
  return normalized;
}

function prefixKey(key: string): string {
  const prefix = normalizeKey((env.AWS_S3_KEY_PREFIX || 'ifsmhp').replace(/^\/+|\/+$/g, ''));
  const body = normalizeKey(key);
  return `${prefix}/${body}`;
}

/** True when a stored absolute URL is under the configured CloudFront origin. */
export function isTrustedCdnUrl(url: string): boolean {
  if (!env.s3Configured || !env.AWS_CLOUDFRONT_URL) return false;
  try {
    const allowed = new URL(env.AWS_CLOUDFRONT_URL);
    const candidate = new URL(url);
    if (candidate.protocol !== 'https:') return false;
    return candidate.origin === allowed.origin;
  } catch {
    return false;
  }
}

/**
 * Uploads a file to S3.
 * Uses a single PutObject for smaller payloads and multipart Upload for large
 * videos / high-resolution assets so the request does not time out.
 */
export async function uploadObject(input: S3UploadInput): Promise<S3UploadResult> {
  requireS3();
  const key = prefixKey(input.key);
  const cacheControl = input.cacheControl ?? CDN_CACHE_CONTROL;
  const bucket = env.AWS_S3_BUCKET!;
  const s3 = getClient();

  let sizeBytes: number | undefined;
  let body: Buffer | ReturnType<typeof createReadStream>;

  if (input.source.kind === 'buffer') {
    body = input.source.body;
    sizeBytes = input.source.body.byteLength;
  } else {
    const info = await stat(input.source.filePath).catch(() => {
      throw ApiError.unprocessable('Upload file is missing on disk.');
    });
    sizeBytes = info.size;
    body = createReadStream(input.source.filePath);
  }

  // Multipart only above the threshold. Small disk files are buffered for a
  // single PutObject to avoid CreateMultipartUpload request charges.
  const useMultipart = (sizeBytes ?? 0) >= MULTIPART_THRESHOLD_BYTES;
  if (!useMultipart && input.source.kind === 'path') {
    body = await readFile(input.source.filePath);
    sizeBytes = body.byteLength;
  }

  const common = {
    Bucket: bucket,
    Key: key,
    ContentType: input.contentType,
    CacheControl: cacheControl,
    Metadata: input.metadata,
    ServerSideEncryption: 'AES256' as const,
    ...(input.acl ? { ACL: input.acl } : {}),
  };

  try {
    if (useMultipart) {
      const upload = new Upload({
        client: s3,
        params: {
          ...common,
          Body: body,
        },
        queueSize: QUEUE_SIZE,
        partSize: PART_SIZE_BYTES,
        leavePartsOnError: false,
      });
      upload.on('httpUploadProgress', progress => {
        if (progress.loaded != null && progress.total) {
          logger.debug('S3 multipart progress', {
            key,
            loaded: progress.loaded,
            total: progress.total,
            pct: Math.round((progress.loaded / progress.total) * 100),
          });
        }
      });
      const result = await upload.done();
      logger.info('S3 multipart upload complete', { key, bucket, contentType: input.contentType, sizeBytes });
      return {
        key,
        bucket,
        etag: result.ETag?.replaceAll('"', ''),
        contentType: input.contentType,
        cacheControl,
        cdnUrl: cloudFrontUrl(key),
        sizeBytes,
      };
    }

    const result = await s3.send(new PutObjectCommand({
      ...common,
      Body: body as Buffer,
    }));
    logger.info('S3 upload complete', { key, bucket, contentType: input.contentType, sizeBytes });
    return {
      key,
      bucket,
      etag: result.ETag?.replaceAll('"', ''),
      contentType: input.contentType,
      cacheControl,
      cdnUrl: cloudFrontUrl(key),
      sizeBytes,
    };
  } catch (error) {
    logger.error('S3 upload failed', {
      key,
      bucket,
      contentType: input.contentType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw ApiError.badGateway('Could not store the media file. Please try again.');
  }
}

/** Convenience helper for local disk files (large videos use multipart automatically). */
export async function uploadFile(
  filePath: string,
  key: string,
  contentType: string,
  options?: Omit<S3UploadInput, 'key' | 'contentType' | 'source'>,
): Promise<S3UploadResult> {
  return uploadObject({
    key,
    contentType,
    source: { kind: 'path', filePath },
    ...options,
  });
}

export async function uploadBuffer(
  body: Buffer,
  key: string,
  contentType: string,
  options?: Omit<S3UploadInput, 'key' | 'contentType' | 'source'>,
): Promise<S3UploadResult> {
  return uploadObject({
    key,
    contentType,
    source: { kind: 'buffer', body },
    ...options,
  });
}

export async function deleteObject(key: string): Promise<void> {
  if (!env.s3Configured) return;
  const normalized = normalizeKey(key.startsWith(env.AWS_S3_KEY_PREFIX || '') ? key : prefixKey(key));
  try {
    await getClient().send(new DeleteObjectCommand({
      Bucket: env.AWS_S3_BUCKET!,
      Key: normalized,
    }));
    logger.info('S3 object deleted', { key: normalized });
  } catch (error) {
    logger.error('S3 delete failed', {
      key: normalized,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (!env.s3Configured || keys.length === 0) return;
  const Objects = [...new Set(keys.map(key => normalizeKey(key)))].map(Key => ({ Key }));
  try {
    const result = await getClient().send(new DeleteObjectsCommand({
      Bucket: env.AWS_S3_BUCKET!,
      Delete: { Objects, Quiet: false },
    }));
    if (result.Errors?.length) {
      logger.error('S3 batch delete reported object errors', {
        count: Objects.length,
        errors: result.Errors.map(item => ({ key: item.Key, code: item.Code, message: item.Message })),
      });
    } else {
      logger.info('S3 objects deleted', { count: Objects.length });
    }
  } catch (error) {
    logger.error('S3 batch delete failed', {
      count: Objects.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function objectExists(key: string): Promise<boolean> {
  if (!env.s3Configured) return false;
  try {
    await getClient().send(new HeadObjectCommand({
      Bucket: env.AWS_S3_BUCKET!,
      Key: normalizeKey(key),
    }));
    return true;
  } catch {
    return false;
  }
}

/** Builds a deterministic object key under a feature prefix. */
export function buildObjectKey(parts: string[], filename?: string): string {
  const safe = parts
    .flatMap(part => part.split(/[/\\]+/))
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => part.replace(/[^a-zA-Z0-9._-]+/g, '-'));
  if (filename) {
    const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const base = path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80);
    safe.push(`${base || 'file'}${ext}`);
  }
  return safe.join('/');
}

/** Reset cached client — used by tests. */
export function resetS3ClientForTests(): void {
  client = null;
}
