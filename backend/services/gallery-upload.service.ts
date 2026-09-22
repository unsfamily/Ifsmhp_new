import crypto from 'node:crypto';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import type { RequestHandler } from 'express';
import { env } from '../config';
import { uploadRoot } from '../utils/fileStorage';
import { ApiError } from '../utils/ApiError';

export const galleryPolicy = { maxBytes: env.GALLERY_MAX_UPLOAD_MB * 1024 * 1024, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], extensions: ['jpg', 'jpeg', 'png', 'webp'] };
const parser = multer({
  storage: multer.diskStorage({ destination: uploadRoot, filename: (_req, _file, cb) => cb(null, crypto.randomUUID()) }),
  limits: { fileSize: galleryPolicy.maxBytes, files: 1, fields: 8, fieldSize: 20000 },
}).single('file');
export const galleryUpload: RequestHandler = (req, res, next) => {
  parser(req, res, error => {
    const cleanup = () => { if (req.file && !res.locals.galleryCommitted) void fsp.unlink(req.file.path).catch(() => undefined); };
    if (error) { cleanup(); return next(ApiError.unprocessable(error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? `Image exceeds ${env.GALLERY_MAX_UPLOAD_MB} MB.` : 'Attach one supported image.', [{ field: 'file', message: 'Check the file and upload limit.' }])); }
    next();
  });
};
export async function inspectImage(file?: Express.Multer.File) {
  const fail = () => ApiError.unprocessable('Choose a valid JPEG, PNG, or WebP image.', [{ field: 'file', message: 'Image contents, extension, and MIME type must match.' }]);
  if (!file || !file.size) throw fail();
  const extension = path.extname(file.originalname).slice(1).toLowerCase();
  const expected = ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string, string>)[extension];
  if (!expected || expected !== file.mimetype) throw fail();
  const { fileTypeFromFile } = await import('file-type');
  if ((await fileTypeFromFile(file.path))?.mime !== expected) throw fail();
  let width: number, height: number;
  try {
    const decoder = sharp(file.path, { failOn: 'warning' });
    const metadata = await decoder.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw fail();
    await decoder.stats(); // Decode pixels too: headers alone do not prove an image is valid.
    width = metadata.width; height = metadata.height;
    if (metadata.orientation && metadata.orientation >= 5) [width, height] = [height, width];
  } catch { throw fail(); }
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file.path)) hash.update(chunk);
  return { width, height, checksum: hash.digest('hex'), aspect: width === height ? 'square' : width > height ? 'landscape' : 'portrait' };
}
