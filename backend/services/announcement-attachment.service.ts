import crypto from 'node:crypto';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import type { NextFunction, RequestHandler, Response } from 'express';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { assertSafePath, uploadRoot } from '../utils/fileStorage';
import { writeAudit } from './audit.service';
import { logger } from '../utils/logger';

export const ANNOUNCEMENT_PDF_MAX_MB = 10;
const maxBytes = ANNOUNCEMENT_PDF_MAX_MB * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.pdf`),
});

export const announcementPdfUpload = multer({
  storage,
  limits: { fileSize: maxBytes, files: 1 },
});

export function parseAnnouncementPdfUpload(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    middleware(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE'
          ? `PDF is too large. Upload a file of ${ANNOUNCEMENT_PDF_MAX_MB} MB or smaller.`
          : 'Could not process the uploaded PDF.';
        next(new ApiError(422, message, [{ field: 'file', message }], { reason: error.code }));
        return;
      }
      next(error);
    });
  };
}

function safePdfName(name: string) {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  const source = [...name].every(character => character.charCodeAt(0) <= 255) && !decoded.includes('\ufffd') ? decoded : name;
  const base = [...path.basename(source)].map(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? '_' : character).join('').replace(/^\.+/, '').slice(0, 180);
  const stem = base.toLowerCase().endsWith('.pdf') ? base.slice(0, -4) : base;
  return `${stem || 'announcement'}.pdf`;
}

async function detectedPdf(filePath: string) {
  // file-type is ESM-only; a static import fails under the CommonJS build.
  const { fileTypeFromFile } = await import('file-type');
  return (await fileTypeFromFile(filePath))?.mime === 'application/pdf';
}

export async function storeAnnouncementPdf(file: Express.Multer.File | undefined, uploaderId: string) {
  if (!file) throw new ApiError(422, 'A PDF is required', [{ field: 'file', message: 'Choose a PDF to attach.' }]);
  const reject = async (message: string) => {
    await fsp.unlink(file.path).catch(() => undefined);
    throw new ApiError(422, message, [{ field: 'file', message }]);
  };
  if (path.extname(file.originalname).toLowerCase() !== '.pdf') await reject('Upload a PDF file.');
  if (file.mimetype !== 'application/pdf' && file.mimetype !== 'application/octet-stream') await reject('Upload a PDF file.');
  if (file.size <= 0) await reject('The uploaded PDF is empty.');
  if (file.size > maxBytes) await reject(`PDF must be ${ANNOUNCEMENT_PDF_MAX_MB} MB or smaller.`);
  if (!await detectedPdf(file.path)) await reject('File contents are not a PDF.');
  const checksum = crypto.createHash('sha256').update(await fsp.readFile(file.path)).digest('hex');
  try {
    const record = await prisma.$transaction(async tx => {
      const created = await tx.fileObject.create({
        data: {
          uploaderId,
          storageKey: path.basename(file.filename),
          originalName: safePdfName(file.originalname),
          mimeType: 'application/pdf',
          sizeBytes: file.size,
          checksum,
          visibility: 'PRIVATE',
        },
      });
      await writeAudit({ actorId: uploaderId, action: 'FileUploaded', entity: `FileObject ${created.id}`, metadata: { fileId: created.id } }, tx);
      return created;
    });
    return { id: record.id, name: record.originalName, sizeBytes: record.sizeBytes };
  } catch (error) {
    await fsp.unlink(file.path).catch(cleanupError => logger.error('Uncommitted announcement PDF cleanup failed', { code: cleanupError instanceof Error ? cleanupError.message : 'unknown' }));
    throw error;
  }
}

/** Confirms the PDF belongs to this administrator and is not already used elsewhere. */
export async function bindAnnouncementPdf(tx: Prisma.TransactionClient, actorId: string, announcementId: string | undefined, fileId: string) {
  if (!fileId) return null;
  const file = await tx.fileObject.findFirst({ where: { id: fileId, deletedAt: null, uploaderId: actorId, mimeType: 'application/pdf', visibility: 'PRIVATE' } });
  if (!file || path.extname(file.originalName).toLowerCase() !== '.pdf') {
    throw ApiError.unprocessable('Attach a PDF you uploaded.', [{ field: 'attachmentFileId', message: 'Upload a PDF and try again.' }]);
  }
  const taken = await tx.announcement.findFirst({ where: { attachmentFileId: fileId, ...(announcementId ? { NOT: { id: announcementId } } : {}) }, select: { id: true } });
  if (taken) throw ApiError.conflict('This PDF is already attached to another announcement.');
  return file.id;
}

export function pdfConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw ApiError.conflict('This PDF is already attached to another announcement.');
  throw error;
}

export async function readAnnouncementPdf(fileId: string) {
  const file = await prisma.fileObject.findFirst({ where: { id: fileId, deletedAt: null, mimeType: 'application/pdf' } });
  if (!file) throw new Error('Announcement PDF is unavailable');
  try {
    const absolute = await openedPdf(file.storageKey, file.sizeBytes);
    try {
      const content = await absolute.handle.readFile();
      return { filename: file.originalName, content, contentType: 'application/pdf' as const };
    } finally {
      await absolute.handle.close().catch(() => undefined);
    }
  } catch {
    throw new Error('Announcement PDF is unavailable');
  }
}

async function openedPdf(storageKey: string, sizeBytes: number) {
  let handle: Awaited<ReturnType<typeof fsp.open>> | undefined;
  try {
    const root = await fsp.realpath(uploadRoot);
    const absolute = await fsp.realpath(assertSafePath(storageKey));
    if (!absolute.startsWith(root + path.sep)) throw new Error('Outside storage');
    handle = await fsp.open(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size === 0 || stat.size !== sizeBytes || stat.size > maxBytes) throw new Error('Unavailable bytes');
    return { handle, absolute };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    throw error;
  }
}

export async function streamAdminAnnouncementPdf(announcementId: string, res: Response, next: NextFunction, actorId: string) {
  const row = await prisma.announcement.findFirst({ where: { id: announcementId, deletedAt: null }, select: { attachmentFileId: true } });
  await streamAnnouncementPdf(announcementId, res, next, actorId, row?.attachmentFileId ?? null);
}

export async function streamAnnouncementPdf(announcementId: string, res: Response, next: NextFunction, actorId: string, fileId: string | null) {
  if (!fileId) throw ApiError.notFound('Announcement not found');
  const file = await prisma.fileObject.findFirst({ where: { id: fileId, deletedAt: null, mimeType: 'application/pdf' } });
  if (!file) throw ApiError.notFound('Announcement not found');
  let opened: Awaited<ReturnType<typeof openedPdf>>;
  try {
    opened = await openedPdf(file.storageKey, file.sizeBytes);
  } catch {
    throw ApiError.notFound('File is unavailable');
  }
  try {
    await writeAudit({ actorId, action: 'FileAccessGranted', entity: `FileObject ${file.id}`, outcome: 'ACCESS_GRANTED', metadata: { fileId: file.id, attachmentId: announcementId } });
  } catch (error) {
    await opened.handle.close();
    throw error;
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', file.sizeBytes);
  res.attachment(file.originalName);
  res.setHeader('Content-Type', 'application/pdf');
  const stream = opened.handle.createReadStream();
  stream.on('error', () => {
    if (res.headersSent) res.destroy();
    else {
      res.removeHeader('Content-Length');
      res.removeHeader('Content-Disposition');
      res.removeHeader('Content-Type');
      next(ApiError.notFound('File is unavailable'));
    }
  });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
