import { randomUUID, createHash } from 'node:crypto';
import fs, { promises as fsp } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import type { FileObject } from '@prisma/client';
import type { RequestHandler } from 'express';
import { prisma } from '../config/database';
import { assertSafePath, uploadRoot } from '../utils/fileStorage';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { inspectImage } from './gallery-upload.service';

export function createAvatarUpload(maxBytes: number, fields = 0): RequestHandler {
  // Multer treats its limit as exclusive; the processor enforces the inclusive limit.
  const parser = multer({ storage: multer.diskStorage({ destination: uploadRoot, filename: (_req, _file, cb) => cb(null, randomUUID()) }), limits: { files: 1, fields, fileSize: maxBytes + 1 } }).single('file');
  return (req, res, next) => {
    const cleanup = async () => { if (req.file) await fsp.unlink(req.file.path).catch(() => undefined); };
    res.once('close', () => { void cleanup(); });
    parser(req, res, error => {
      if (error) void cleanup().then(() => next(ApiError.unprocessable(`Upload one JPEG, PNG, or WebP image up to ${maxBytes / 1024 / 1024} MB.`, [{ field: 'file', message: 'Check the file type, size, and number of files.' }])));
      else next();
    });
  };
}

type AvatarFileData = Pick<FileObject, 'storageKey' | 'originalName' | 'mimeType' | 'sizeBytes' | 'checksum' | 'avatarManaged' | 'visibility'>;

/** Keeps the normalized file only once its database transaction has committed. */
export async function storeAvatar<T>(file: Express.Multer.File | undefined, maxBytes: number, persist: (data: AvatarFileData) => Promise<T>): Promise<T> {
  const storageKey = randomUUID(), target = assertSafePath(storageKey);
  let committed = false;
  try {
    if (file && file.size > maxBytes) throw ApiError.unprocessable('Image exceeds the upload limit.', [{ field: 'file', message: `Choose an image up to ${maxBytes / 1024 / 1024} MB.` }]);
    await inspectImage(file);
    await sharp(file!.path, { failOn: 'warning' }).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(target);
    const bytes = await fsp.readFile(target);
    const result = await persist({ storageKey, originalName: path.basename(file!.originalname).slice(0, 191), mimeType: 'image/webp', sizeBytes: bytes.length, checksum: createHash('sha256').update(bytes).digest('hex'), avatarManaged: true, visibility: 'PRIVATE' });
    committed = true;
    return result;
  } finally {
    if (!committed) await fsp.unlink(target).catch(() => undefined);
    if (file) await fsp.unlink(file.path).catch(() => undefined);
  }
}

export async function purgeAvatars() {
  const rows = await prisma.fileObject.findMany({ where: { avatarManaged: true, deletedAt: { not: null }, purgedAt: null, adminAvatars: { none: {} }, memberAvatars: { none: {} } }, take: 100 });
  for (const row of rows) {
    try { await fsp.unlink(assertSafePath(row.storageKey)).catch(e => { if (e.code !== 'ENOENT') throw e; }); await prisma.fileObject.update({ where: { id: row.id }, data: { purgedAt: new Date() } }); }
    catch (error) { logger.error('Avatar cleanup pending retry', { fileId: row.id, error: String(error) }); }
  }
}

/** This check runs before the generic files endpoint's administrator bypass. */
export async function authorizeAvatar(fileId: string, userId: string) {
  const file = await prisma.fileObject.findFirst({ where: {
    id: fileId, avatarManaged: true, deletedAt: null, uploaderId: userId,
    OR: [
      { adminAvatars: { some: { userId, user: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null } } } },
      { memberAvatars: { some: { userId, user: { role: 'MEMBER', status: 'ACTIVE', deletedAt: null } } } },
    ],
  } });
  if (!file) throw ApiError.notFound('Avatar not found.');
  return file;
}

export function streamAvatar(resolve: (userId: string) => Promise<string | null>): RequestHandler {
  return async (req, res, next) => {
    let handle: Awaited<ReturnType<typeof fsp.open>> | undefined;
    try {
      const fileId = await resolve(req.user!.id);
      if (!fileId) throw ApiError.notFound('Avatar not found.');
      const file = await authorizeAvatar(fileId, req.user!.id);
      try {
        const root = await fsp.realpath(uploadRoot), absolute = await fsp.realpath(assertSafePath(file.storageKey));
        if (!absolute.startsWith(root + path.sep)) throw new Error('Outside storage');
        handle = await fsp.open(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size !== file.sizeBytes || !stat.size) throw new Error('Unavailable bytes');
      } catch { throw ApiError.notFound('Avatar not found.'); }
      res.set({ 'Content-Type': file.mimeType, 'Content-Length': String(file.sizeBytes), 'Cache-Control': 'private, no-store', 'Cross-Origin-Resource-Policy': 'cross-origin', 'X-Content-Type-Options': 'nosniff' });
      const stream = handle.createReadStream();
      stream.on('error', () => res.destroy());
      res.once('close', () => stream.destroy());
      stream.pipe(res);
    } catch (error) { await handle?.close().catch(() => undefined); next(error); }
  };
}
