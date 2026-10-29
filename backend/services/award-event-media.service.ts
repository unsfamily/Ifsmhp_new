import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fsp } from 'node:fs';
import multer from 'multer';
import sharp from 'sharp';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import type { AuthenticatedUser } from '../middleware/auth';
import { prisma } from '../config/database';
import { writeAudit } from './audit.service';
import { galleryPolicy, inspectMedia } from './gallery-upload.service';
import {
  buildObjectKey,
  deleteObjects,
  isS3Configured,
  isTrustedCdnUrl,
  uploadBuffer,
  uploadFile,
} from './s3-storage.service';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { assertSafePath, uploadRoot } from '../utils/fileStorage';

/** Allowed grid/lightbox preview widths. Keep this short — each width is an S3 object. */
export const THUMB_WIDTHS = [320, 640, 960] as const;
const DEFAULT_THUMB_WIDTH = 640;

const mediaTypes = ['image', 'video'] as const;
type MediaType = (typeof mediaTypes)[number];

const parser = multer({
  storage: multer.diskStorage({
    destination: uploadRoot,
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: galleryPolicy.maxBytes, files: 1, fields: 4, fieldSize: 1000 },
}).single('file');

export const awardEventMediaUpload: RequestHandler = (req, res, next) => {
  parser(req, res, error => {
    const cleanup = () => { if (req.file) void fsp.unlink(req.file.path).catch(() => undefined); };
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      cleanup();
      return next(ApiError.unprocessable(`Each file must be ${Math.round(galleryPolicy.maxBytes / (1024 * 1024))} MB or smaller.`, [{ field: 'file', message: `Each file must be ${Math.round(galleryPolicy.maxBytes / (1024 * 1024))} MB or smaller.` }]));
    }
    if (error) {
      cleanup();
      return next(ApiError.unprocessable('Attach one JPG, PNG, WebP, MP4, or WebM file.', [{ field: 'file', message: 'Choose a supported image or video.' }]));
    }
    if (!req.file) {
      return next(ApiError.unprocessable('Choose one or more photographs or videos to upload.', [{ field: 'file', message: 'Choose one or more photographs or videos to upload.' }]));
    }
    next();
  });
};

const listQuery = z.object({
  type: z.enum(mediaTypes).optional(),
}).strict();

const patchBody = z.object({
  published: z.boolean(),
}).strict();

const reorderBody = z.object({
  direction: z.union([z.literal(-1), z.literal(1)]),
}).strict();

type MediaRecord = Prisma.AwardEventMediaGetPayload<{ include: { file: true } }>;

function isS3Object(file: { cdnUrl: string | null }) {
  return Boolean(file.cdnUrl);
}

/** CloudFront variant URL convention: `{cdnUrl}.w{width}.webp`. */
export function awardMediaVariantUrl(cdnUrl: string, width: number) {
  return `${cdnUrl}.w${width}.webp`;
}

function dto(item: MediaRecord, admin: boolean) {
  const base = admin ? '/admin' : '/public';
  const streamUrl = `${base}/award-event-media/${item.id}/media`;
  // Only emit absolute CDN URLs for published items. Unpublished drafts stay on
  // the authenticated/admin stream path so we do not advertise a public link.
  // Note: objects already on CloudFront remain fetchable by anyone who already
  // has the URL until they are deleted — treat CDN keys as sensitive.
  const cdn = item.published && item.file.cdnUrl && isTrustedCdnUrl(item.file.cdnUrl)
    ? item.file.cdnUrl
    : null;
  const mediaUrl = cdn || streamUrl;
  const thumbUrl = item.mediaType === 'image'
    ? (cdn ? awardMediaVariantUrl(cdn, DEFAULT_THUMB_WIDTH) : `${streamUrl}?w=${DEFAULT_THUMB_WIDTH}`)
    : null;
  const srcSet = item.mediaType === 'image' && cdn
    ? THUMB_WIDTHS.map(width => `${awardMediaVariantUrl(cdn, width)} ${width}w`).join(', ')
    : null;
  return {
    id: item.id,
    mediaType: item.mediaType as MediaType,
    width: item.width,
    height: item.height,
    displayOrder: item.displayOrder,
    ...(admin ? { published: item.published, name: item.file.originalName, mimeType: item.file.mimeType, sizeBytes: item.file.sizeBytes } : {}),
    mediaUrl,
    thumbUrl,
    srcSet,
    posterUrl: null as string | null,
  };
}

function thumbStorageKey(storageKey: string, width: number) {
  return path.posix.join('thumbs', `${storageKey}.w${width}.webp`);
}

export async function resolveMediaPath(
  file: { storageKey: string; mimeType: string; originalName: string; sizeBytes: number; cdnUrl?: string | null },
  widthParam: unknown,
) {
  if (file.cdnUrl) {
    throw ApiError.badRequest('CDN-backed media is served from CloudFront.');
  }
  const absolute = assertSafePath(file.storageKey);
  const width = typeof widthParam === 'string' && widthParam.trim()
    ? Number.parseInt(widthParam, 10)
    : null;
  const wantsThumb = width !== null && Number.isFinite(width) && (THUMB_WIDTHS as readonly number[]).includes(width);
  if (!wantsThumb || !file.mimeType.startsWith('image/')) {
    return { absolute, mimeType: file.mimeType, originalName: file.originalName, cacheable: true };
  }

  const thumbKey = thumbStorageKey(file.storageKey, width!);
  const thumbAbsolute = assertSafePath(thumbKey);
  try {
    await fsp.access(thumbAbsolute);
  } catch {
    await fsp.mkdir(path.dirname(thumbAbsolute), { recursive: true });
    await sharp(absolute, { failOn: 'error' })
      .rotate()
      .resize({ width: width!, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(thumbAbsolute);
  }
  return {
    absolute: thumbAbsolute,
    mimeType: 'image/webp',
    originalName: file.originalName.replace(/\.[^.]+$/, '') + `.w${width}.webp`,
    cacheable: true,
  };
}

/** Public redirect target for CDN objects (full asset or WebP variant). */
export function resolveCdnRedirect(
  file: { cdnUrl: string | null; mimeType: string },
  widthParam: unknown,
): string | null {
  if (!file.cdnUrl || !isTrustedCdnUrl(file.cdnUrl)) return null;
  const width = typeof widthParam === 'string' && widthParam.trim()
    ? Number.parseInt(widthParam, 10)
    : null;
  if (
    width !== null
    && Number.isFinite(width)
    && (THUMB_WIDTHS as readonly number[]).includes(width)
    && file.mimeType.startsWith('image/')
  ) {
    const variant = awardMediaVariantUrl(file.cdnUrl, width);
    return isTrustedCdnUrl(variant) ? variant : null;
  }
  return file.cdnUrl;
}

async function removeLocalThumbs(storageKey: string) {
  await Promise.all(THUMB_WIDTHS.map(width =>
    fsp.unlink(assertSafePath(thumbStorageKey(storageKey, width))).catch(() => undefined),
  ));
}

async function removeStoredFile(file: { storageKey: string; cdnUrl: string | null; mimeType: string }) {
  if (isS3Object(file) && file.cdnUrl) {
    const keys = [file.storageKey];
    if (file.mimeType.startsWith('image/')) {
      for (const width of THUMB_WIDTHS) keys.push(`${file.storageKey}.w${width}.webp`);
    }
    await deleteObjects(keys);
    return;
  }
  await removeLocalThumbs(file.storageKey);
  await fsp.unlink(assertSafePath(file.storageKey)).catch(error => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('Award event media cleanup pending', { storageKey: file.storageKey, error: String(error) });
    }
  });
}

/**
 * Persists the multer temp file to S3 (when configured) or keeps it on local disk.
 * Image uploads also push WebP width variants for responsive `srcSet`.
 */
async function persistUpload(file: Express.Multer.File, mediaType: MediaType) {
  if (!isS3Configured()) {
    return { storageKey: file.filename, cdnUrl: null as string | null };
  }

  const objectKey = buildObjectKey(['award-event-media', file.filename], file.originalname);
  const writtenKeys: string[] = [];
  try {
    const uploaded = await uploadFile(file.path, objectKey, file.mimetype, {
      metadata: { mediaType, originalName: file.originalname.slice(0, 100) },
    });
    writtenKeys.push(uploaded.key);

    if (mediaType === 'image') {
      for (const width of THUMB_WIDTHS) {
        const body = await sharp(file.path, { failOn: 'error' })
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 72 })
          .toBuffer();
        const variant = await uploadBuffer(body, `${objectKey}.w${width}.webp`, 'image/webp');
        writtenKeys.push(variant.key);
      }
    }

    await fsp.unlink(file.path).catch(() => undefined);
    return { storageKey: uploaded.key, cdnUrl: uploaded.cdnUrl };
  } catch (error) {
    if (writtenKeys.length) await deleteObjects(writtenKeys);
    throw error;
  }
}

const orderBy = [{ displayOrder: 'asc' as const }, { id: 'asc' as const }];

export async function listMedia(admin: boolean, query: unknown = {}) {
  const { type } = listQuery.parse(query);
  const items = await prisma.awardEventMedia.findMany({
    where: {
      ...(type ? { mediaType: type } : {}),
      ...(admin ? {} : { published: true, file: { deletedAt: null } }),
    },
    include: { file: true },
    orderBy,
  });
  return { items: items.filter(item => item.file && !item.file.deletedAt).map(item => dto(item, admin)) };
}

async function mediaOrThrow(id: string) {
  const item = await prisma.awardEventMedia.findUnique({ where: { id }, include: { file: true } });
  if (!item?.file || item.file.deletedAt) throw ApiError.notFound('Award media not found');
  return item;
}

export async function mediaFile(id: string, admin: boolean) {
  const item = await prisma.awardEventMedia.findFirst({
    where: { id, ...(admin ? {} : { published: true }), file: { deletedAt: null } },
    include: { file: true },
  });
  if (!item?.file) throw ApiError.notFound('Award media not found');
  return item.file;
}

async function normalize(db: Prisma.TransactionClient, mediaType: string) {
  const rows = await db.awardEventMedia.findMany({ where: { mediaType }, orderBy });
  for (const [index, row] of rows.entries()) {
    if (row.displayOrder !== index + 1) await db.awardEventMedia.update({ where: { id: row.id }, data: { displayOrder: index + 1 } });
  }
}

export async function uploadMedia(actor: AuthenticatedUser, file?: Express.Multer.File) {
  const metadata = await inspectMedia(file);
  const persisted = await persistUpload(file!, metadata.type);
  try {
    return await prisma.$transaction(async db => {
      const count = await db.awardEventMedia.count({ where: { mediaType: metadata.type } });
      const stored = await db.fileObject.create({
        data: {
          uploaderId: actor.id,
          storageKey: persisted.storageKey,
          originalName: file!.originalname.slice(0, 191),
          mimeType: file!.mimetype,
          sizeBytes: file!.size,
          checksum: metadata.checksum,
          cdnUrl: persisted.cdnUrl,
          visibility: persisted.cdnUrl ? 'PUBLIC' : 'PRIVATE',
          awardMediaManaged: true,
        },
      });
      const created = await db.awardEventMedia.create({
        data: {
          fileId: stored.id,
          mediaType: metadata.type,
          width: metadata.width,
          height: metadata.height,
          published: true,
          displayOrder: count + 1,
        },
        include: { file: true },
      });
      await normalize(db, metadata.type);
      await writeAudit({
        actorId: actor.id,
        action: 'AwardEventMediaUploaded',
        entity: `AwardEventMedia ${created.id}`,
        entityType: 'AwardEventMedia',
        entityId: created.id,
        metadata: { fileId: stored.id, mediaType: metadata.type, storage: persisted.cdnUrl ? 's3' : 'local' },
      }, db);
      return dto(await db.awardEventMedia.findUniqueOrThrow({ where: { id: created.id }, include: { file: true } }), true);
    });
  } catch (error) {
    if (persisted.cdnUrl) {
      await removeStoredFile({ storageKey: persisted.storageKey, cdnUrl: persisted.cdnUrl, mimeType: file!.mimetype });
    } else {
      await fsp.unlink(assertSafePath(file!.filename)).catch(() => undefined);
    }
    throw error;
  }
}

export async function updateMedia(actor: AuthenticatedUser, id: string, input: unknown) {
  const body = patchBody.parse(input);
  const current = await mediaOrThrow(id);
  const updated = await prisma.$transaction(async db => {
    const record = await db.awardEventMedia.update({
      where: { id },
      data: { published: body.published },
      include: { file: true },
    });
    await writeAudit({
      actorId: actor.id,
      action: 'AwardEventMediaUpdated',
      entity: `AwardEventMedia ${id}`,
      entityType: 'AwardEventMedia',
      entityId: id,
      changes: { published: { before: current.published, after: record.published } },
    }, db);
    return record;
  });
  return dto(updated, true);
}

export async function reorderMedia(actor: AuthenticatedUser, id: string, input: unknown) {
  const { direction } = reorderBody.parse(input);
  const current = await mediaOrThrow(id);
  await prisma.$transaction(async db => {
    const rows = await db.awardEventMedia.findMany({ where: { mediaType: current.mediaType }, orderBy });
    const index = rows.findIndex(row => row.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    for (const [position, row] of next.entries()) {
      if (row.displayOrder !== position + 1) await db.awardEventMedia.update({ where: { id: row.id }, data: { displayOrder: position + 1 } });
    }
    await writeAudit({
      actorId: actor.id,
      action: 'AwardEventMediaReordered',
      entity: `AwardEventMedia ${id}`,
      entityType: 'AwardEventMedia',
      entityId: id,
    }, db);
  });
  return listMedia(true, { type: current.mediaType as MediaType });
}

export async function removeMedia(actor: AuthenticatedUser, id: string) {
  const current = await mediaOrThrow(id);
  await prisma.$transaction(async db => {
    await db.awardEventMedia.delete({ where: { id } });
    await db.fileObject.delete({ where: { id: current.fileId } });
    await normalize(db, current.mediaType);
    await writeAudit({
      actorId: actor.id,
      action: 'AwardEventMediaDeleted',
      entity: `AwardEventMedia ${id}`,
      entityType: 'AwardEventMedia',
      entityId: id,
      metadata: { fileId: current.fileId, mediaType: current.mediaType },
    }, db);
  });
  await removeStoredFile(current.file);
  return { removed: true };
}

export function uploadPolicy() {
  return {
    maxBytes: galleryPolicy.maxBytes,
    mimeTypes: galleryPolicy.mimeTypes,
    extensions: galleryPolicy.extensions,
    storage: isS3Configured() ? 's3' : 'local',
  };
}
