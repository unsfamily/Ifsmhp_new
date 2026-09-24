import { randomUUID, createHash } from 'node:crypto';
import fs, { promises as fsp } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import type { RequestHandler } from 'express';
import { env } from '../config';
import { prisma } from '../config/database';
import { assertSafePath, uploadRoot } from '../utils/fileStorage';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { inspectImage } from './gallery-upload.service';
import { lockAdmin, getProfile } from './admin-profile.service';
import { writeAudit } from './audit.service';
const parser = multer({ storage: multer.diskStorage({ destination: uploadRoot, filename: (_req, _file, cb) => cb(null, randomUUID()) }), limits: { files: 1, fields: 1, fileSize: env.ADMIN_AVATAR_MAX_UPLOAD_MB * 1024 * 1024 + 1 } }).single('file');
export const avatarUpload: RequestHandler = (req, res, next) => {
  parser(req, res, error => {
    res.once('close', () => { if (req.file) void fsp.unlink(req.file.path).catch(() => undefined); });
    if (error) { if (req.file) void fsp.unlink(req.file.path).catch(() => undefined); next(ApiError.unprocessable(`Upload one JPEG, PNG, or WebP image up to ${env.ADMIN_AVATAR_MAX_UPLOAD_MB} MB.`)); }
    else next();
  });
};
export async function purgeAvatars() {
  const rows = await prisma.fileObject.findMany({ where: { avatarManaged: true, deletedAt: { not: null }, purgedAt: null, adminAvatars: { none: {} } }, take: 100 });
  for (const row of rows) {
    try { await fsp.unlink(assertSafePath(row.storageKey)).catch(e => { if (e.code !== 'ENOENT') throw e; }); await prisma.fileObject.update({ where: { id: row.id }, data: { purgedAt: new Date() } }); }
    catch (error) { logger.error('Avatar cleanup pending retry', { fileId: row.id, error: String(error) }); }
  }
}
export async function replaceAvatar(userId: string, expectedRevision: number, file?: Express.Multer.File) {
  if (file && file.size > env.ADMIN_AVATAR_MAX_UPLOAD_MB * 1024 * 1024) throw ApiError.unprocessable('Image exceeds the upload limit.');
  await inspectImage(file);
  const storageKey = randomUUID(), target = assertSafePath(storageKey);
  let committed = false;
  try {
    await sharp(file!.path, { failOn: 'warning' }).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(target);
    const bytes = await fsp.readFile(target);
    await prisma.$transaction(async tx => {
      await lockAdmin(tx, userId);
      const previous = await tx.adminProfile.findUnique({ where: { userId } });
      if ((previous?.revision ?? 0) !== expectedRevision) throw ApiError.conflict('Profile changed. Refresh before replacing the avatar.');
      const record = await tx.fileObject.create({ data: { uploaderId: userId, storageKey, originalName: path.basename(file!.originalname).slice(0, 191), mimeType: 'image/webp', sizeBytes: bytes.length, checksum: createHash('sha256').update(bytes).digest('hex'), avatarManaged: true, visibility: 'PRIVATE' } });
      await tx.adminProfile.upsert({ where: { userId }, create: { userId, avatarFileId: record.id, revision: 1 }, update: { avatarFileId: record.id, revision: { increment: 1 } } });
      if (previous?.avatarFileId) await tx.fileObject.update({ where: { id: previous.avatarFileId }, data: { deletedAt: new Date() } });
      await writeAudit({ actorId: userId, action: 'AdminAvatarUpdated', entity: `User ${userId}`, metadata: { fileId: record.id } }, tx);
    });
    committed = true;
  } finally {
    if (!committed) await fsp.unlink(target).catch(() => undefined);
    if (file) await fsp.unlink(file.path).catch(() => undefined);
  }
  await purgeAvatars().catch(error => logger.error('Avatar cleanup pending retry', { error: String(error) }));
  return getProfile(userId);
}
export async function authorizeAvatar(fileId: string, userId: string) {
  const profile = await prisma.adminProfile.findFirst({ where: { userId, avatarFileId: fileId, user: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null }, avatar: { deletedAt: null } }, include: { avatar: true } });
  if (!profile?.avatar) throw ApiError.notFound('Avatar not found.');
  return profile.avatar;
}
export const streamAvatar: RequestHandler = async (req, res, next) => {
  try {
    const profile = await prisma.adminProfile.findUnique({ where: { userId: req.user!.id } });
    if (!profile?.avatarFileId) throw ApiError.notFound('Avatar not found.');
    const file = await authorizeAvatar(profile.avatarFileId, req.user!.id), absolute = assertSafePath(file.storageKey);
    await fsp.access(absolute, fs.constants.R_OK).catch(() => { throw ApiError.notFound('Avatar not found.'); });
    res.set({ 'Content-Type': file.mimeType, 'Cache-Control': 'private, no-store', 'Cross-Origin-Resource-Policy': 'cross-origin', 'X-Content-Type-Options': 'nosniff' });
    const stream = fs.createReadStream(absolute); stream.on('error', () => res.destroy()); stream.pipe(res);
  } catch (error) { next(error); }
};
