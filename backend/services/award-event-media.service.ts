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
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { assertSafePath, uploadRoot } from '../utils/fileStorage';

/** Allowed grid/lightbox preview widths. Full media is served without `w`. */
export const THUMB_WIDTHS = [320, 480, 640, 960] as const;
const DEFAULT_THUMB_WIDTH = 480;

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

function dto(item: MediaRecord, admin: boolean) {
  const base = admin ? '/admin' : '/public';
  const mediaUrl = `${base}/award-event-media/${item.id}/media`;
  return {
    id: item.id,
    mediaType: item.mediaType as MediaType,
    width: item.width,
    height: item.height,
    displayOrder: item.displayOrder,
    ...(admin ? { published: item.published, name: item.file.originalName, mimeType: item.file.mimeType, sizeBytes: item.file.sizeBytes } : {}),
    mediaUrl,
    // Grid tiles use a cached WebP thumb; lightbox keeps the full file.
    thumbUrl: item.mediaType === 'image' ? `${mediaUrl}?w=${DEFAULT_THUMB_WIDTH}` : null,
  };
}

function thumbStorageKey(storageKey: string, width: number) {
  return path.posix.join('thumbs', `${storageKey}.w${width}.webp`);
}

export async function resolveMediaPath(
  file: { storageKey: string; mimeType: string; originalName: string; sizeBytes: number },
  widthParam: unknown,
) {
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

async function removeThumbs(storageKey: string) {
  await Promise.all(THUMB_WIDTHS.map(width =>
    fsp.unlink(assertSafePath(thumbStorageKey(storageKey, width))).catch(() => undefined),
  ));
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
  try {
    return await prisma.$transaction(async db => {
      const count = await db.awardEventMedia.count({ where: { mediaType: metadata.type } });
      const stored = await db.fileObject.create({
        data: {
          uploaderId: actor.id,
          storageKey: file!.filename,
          originalName: file!.originalname.slice(0, 191),
          mimeType: file!.mimetype,
          sizeBytes: file!.size,
          checksum: metadata.checksum,
          visibility: 'PRIVATE',
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
        metadata: { fileId: stored.id, mediaType: metadata.type },
      }, db);
      return dto(await db.awardEventMedia.findUniqueOrThrow({ where: { id: created.id }, include: { file: true } }), true);
    });
  } catch (error) {
    await fsp.unlink(assertSafePath(file!.filename)).catch(() => undefined);
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
  await removeThumbs(current.file.storageKey);
  await fsp.unlink(assertSafePath(current.file.storageKey)).catch(error => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') logger.error('Award event media cleanup pending', { fileId: current.fileId, error: String(error) });
  });
  return { removed: true };
}

export function uploadPolicy() {
  return {
    maxBytes: galleryPolicy.maxBytes,
    mimeTypes: galleryPolicy.mimeTypes,
    extensions: galleryPolicy.extensions,
  };
}
