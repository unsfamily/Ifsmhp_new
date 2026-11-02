import crypto from 'node:crypto';
import { promises as fsp } from 'node:fs';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import type { AuthenticatedUser } from '../middleware/auth';
import { prisma } from '../config/database';
import { writeAudit } from './audit.service';
import { inspectImage } from './gallery-upload.service';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { assertSafePath, uploadRoot } from '../utils/fileStorage';

export const HOME_CAROUSEL_LIMIT = 3;
const maxBytes = 15 * 1024 * 1024;

const parser = multer({
  storage: multer.diskStorage({
    destination: uploadRoot,
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: maxBytes, files: 1, fields: 4, fieldSize: 1000 },
}).single('file');

export const homeCarouselUpload: RequestHandler = (req, res, next) => {
  parser(req, res, error => {
    const cleanup = () => { if (req.file) void fsp.unlink(req.file.path).catch(() => undefined); };
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      cleanup();
      return next(ApiError.unprocessable('Each photograph must be 15 MB or smaller.', [{ field: 'file', message: 'Each photograph must be 15 MB or smaller.' }]));
    }
    if (error) {
      cleanup();
      return next(ApiError.unprocessable('Attach one JPG, PNG, or WebP photograph.', [{ field: 'file', message: 'Choose a supported photograph.' }]));
    }
    next();
  });
};

const patchBody = z.object({
  altText: z.string().trim().max(191, 'Alt text must be 191 characters or fewer.').optional(),
  published: z.boolean().optional(),
}).strict().refine(value => value.altText !== undefined || value.published !== undefined, { message: 'Nothing to update.' });

const reorderBody = z.object({ direction: z.union([z.literal(-1), z.literal(1)]) }).strict();

type SlideRecord = Prisma.HomeCarouselSlideGetPayload<{ include: { file: true } }>;

function dto(slide: SlideRecord, admin: boolean) {
  return {
    id: slide.id,
    altText: slide.altText,
    displayOrder: slide.displayOrder,
    ...(admin ? { published: slide.published, name: slide.file.originalName } : {}),
    imageUrl: `${admin ? '/admin' : '/public'}/home-carousel/${slide.id}/image`,
  };
}

const orderBy = [{ displayOrder: 'asc' as const }, { id: 'asc' as const }];

export async function listSlides(admin: boolean) {
  const slides = await prisma.homeCarouselSlide.findMany({
    where: admin ? {} : { published: true, file: { deletedAt: null } },
    include: { file: true },
    orderBy,
    ...(admin ? {} : { take: HOME_CAROUSEL_LIMIT }),
  });
  return { items: slides.filter(slide => slide.file && !slide.file.deletedAt).map(slide => dto(slide, admin)) };
}

async function slideOrThrow(id: string) {
  const slide = await prisma.homeCarouselSlide.findUnique({ where: { id }, include: { file: true } });
  if (!slide?.file || slide.file.deletedAt) throw ApiError.notFound('Photograph not found');
  return slide;
}

export async function slideFile(id: string, admin: boolean) {
  const slide = await prisma.homeCarouselSlide.findFirst({
    where: { id, ...(admin ? {} : { published: true }), file: { deletedAt: null } },
    include: { file: true },
  });
  if (!slide?.file) throw ApiError.notFound('Photograph not found');
  return slide.file;
}

async function normalize(db: Prisma.TransactionClient) {
  const rows = await db.homeCarouselSlide.findMany({ orderBy });
  for (const [index, row] of rows.entries()) {
    if (row.displayOrder !== index + 1) await db.homeCarouselSlide.update({ where: { id: row.id }, data: { displayOrder: index + 1 } });
  }
}

export async function uploadSlide(actor: AuthenticatedUser, file?: Express.Multer.File) {
  const metadata = await inspectImage(file);
  try {
    return await prisma.$transaction(async db => {
      const count = await db.homeCarouselSlide.count();
      if (count >= HOME_CAROUSEL_LIMIT) {
        throw ApiError.unprocessable(`The carousel holds up to ${HOME_CAROUSEL_LIMIT} photographs.`, [{ field: 'file', message: `Remove a photograph before uploading more than ${HOME_CAROUSEL_LIMIT}.` }]);
      }
      const stored = await db.fileObject.create({
        data: {
          uploaderId: actor.id,
          storageKey: file!.filename,
          originalName: file!.originalname.slice(0, 191),
          mimeType: file!.mimetype,
          sizeBytes: file!.size,
          checksum: metadata.checksum,
          visibility: 'PRIVATE',
          carouselManaged: true,
        },
      });
      const created = await db.homeCarouselSlide.create({
        data: {
          fileId: stored.id,
          altText: '',
          published: true,
          displayOrder: count + 1,
        },
        include: { file: true },
      });
      await normalize(db);
      await writeAudit({ actorId: actor.id, action: 'HomeCarouselUploaded', entity: `HomeCarouselSlide ${created.id}`, entityType: 'HomeCarouselSlide', entityId: created.id, metadata: { fileId: stored.id } }, db);
      return dto(await db.homeCarouselSlide.findUniqueOrThrow({ where: { id: created.id }, include: { file: true } }), true);
    });
  } catch (error) {
    await fsp.unlink(assertSafePath(file!.filename)).catch(() => undefined);
    throw error;
  }
}

export async function updateSlide(actor: AuthenticatedUser, id: string, input: unknown) {
  const body = patchBody.parse(input);
  const current = await slideOrThrow(id);
  const updated = await prisma.$transaction(async db => {
    const record = await db.homeCarouselSlide.update({
      where: { id },
      data: { altText: body.altText, published: body.published },
      include: { file: true },
    });
    await writeAudit({
      actorId: actor.id,
      action: 'HomeCarouselUpdated',
      entity: `HomeCarouselSlide ${id}`,
      entityType: 'HomeCarouselSlide',
      entityId: id,
      changes: {
        altText: { before: current.altText, after: record.altText },
        published: { before: current.published, after: record.published },
      },
    }, db);
    return record;
  });
  return dto(updated, true);
}

export async function reorderSlide(actor: AuthenticatedUser, id: string, input: unknown) {
  const { direction } = reorderBody.parse(input);
  await slideOrThrow(id);
  await prisma.$transaction(async db => {
    const rows = await db.homeCarouselSlide.findMany({ orderBy });
    const index = rows.findIndex(row => row.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    for (const [position, row] of next.entries()) {
      if (row.displayOrder !== position + 1) await db.homeCarouselSlide.update({ where: { id: row.id }, data: { displayOrder: position + 1 } });
    }
    await writeAudit({ actorId: actor.id, action: 'HomeCarouselReordered', entity: `HomeCarouselSlide ${id}`, entityType: 'HomeCarouselSlide', entityId: id }, db);
  });
  return listSlides(true);
}

export async function removeSlide(actor: AuthenticatedUser, id: string) {
  const current = await slideOrThrow(id);
  await prisma.$transaction(async db => {
    await db.homeCarouselSlide.delete({ where: { id } });
    await db.fileObject.delete({ where: { id: current.fileId } });
    await normalize(db);
    await writeAudit({ actorId: actor.id, action: 'HomeCarouselDeleted', entity: `HomeCarouselSlide ${id}`, entityType: 'HomeCarouselSlide', entityId: id, metadata: { fileId: current.fileId } }, db);
  });
  await fsp.unlink(assertSafePath(current.file.storageKey)).catch(error => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') logger.error('Carousel photograph cleanup pending', { fileId: current.fileId, error: String(error) });
  });
  return { removed: true };
}
