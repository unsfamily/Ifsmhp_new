import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import multer from 'multer';
import type { Request, RequestHandler } from 'express';
import { env } from '../config';
import { ApiError } from '../utils/ApiError';
import { uploadRoot } from '../utils/fileStorage';
import { DOCUMENT_MIME_TYPES, DOCUMENT_EXTENSIONS } from '../domain/document-exchange';
import type { Actor, DB } from './community-access.service';

export const uploadPolicy = { maxFiles: 5, maxBytes: env.MAX_UPLOAD_MB * 1024 * 1024, mimeTypes: DOCUMENT_MIME_TYPES, extensions: DOCUMENT_EXTENSIONS, imageMaxBytes: 5 * 1024 * 1024 };
const images = ['image/jpeg', 'image/png', 'image/webp'];
const extensionTypes: Record<string, string> = Object.fromEntries(DOCUMENT_EXTENSIONS.map((ext) => [ext, ({ pdf: 'application/pdf', doc: 'application/msword', docx: DOCUMENT_MIME_TYPES[7], jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', txt: 'text/plain', csv: 'text/csv', xlsx: DOCUMENT_MIME_TYPES[8], ppt: 'application/vnd.ms-powerpoint', pptx: DOCUMENT_MIME_TYPES[10] } as Record<string, string>)[ext]!]));
const storage = multer.diskStorage({ destination: uploadRoot, filename: (_req, _file, cb) => cb(null, crypto.randomUUID()) });
export function uploaded(req: Request): Express.Multer.File[] { return Array.isArray(req.files) ? req.files : Object.values(req.files ?? {}).flat(); }
export async function cleanup(req: Request) { await Promise.all(uploaded(req).map(f => fs.unlink(f.path).catch(() => undefined))); }
export function communityUpload(kind: 'images' | 'attachments'): RequestHandler {
  const upload = multer({ storage, limits: { files: kind === 'images' ? 2 : 5, fileSize: kind === 'images' ? uploadPolicy.imageMaxBytes : uploadPolicy.maxBytes, fields: 12, fieldSize: 50000 } });
  const parser = kind === 'images' ? upload.fields([{ name: 'image', maxCount: 1 }, { name: 'banner', maxCount: 1 }]) : upload.array('attachments', 5);
  return (req, res, next) => {
    parser(req, res, error => {
      if (error) { void cleanup(req).then(() => next(ApiError.unprocessable(error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the upload size limit.' : 'Invalid upload or too many files.', [{ field: kind, message: 'Check file sizes and the number of files.' }]))); return; }
      res.once('finish', () => { if (!res.locals.communityUploadCommitted) void cleanup(req); });
      void Promise.all(uploaded(req).map(file => validate(file, kind))).then(() => next(), next);
    });
  };
}
async function validate(file: Express.Multer.File, kind: 'images' | 'attachments') {
  const fail = () => ApiError.unprocessable('Unsupported or invalid file.', [{ field: file.fieldname, message: 'Choose a non-empty file with a supported type and matching contents.' }]);
  const extension = path.extname(file.originalname).slice(1).toLowerCase();
  if (!file.size || extensionTypes[extension] !== file.mimetype || (kind === 'images' && !images.includes(file.mimetype))) throw fail();
  const { fileTypeFromFile } = await import('file-type');
  const detected = (await fileTypeFromFile(file.path))?.mime;
  if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv') {
    const bytes = await fs.readFile(file.path);
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw fail(); }
    if (detected || bytes.includes(0)) throw fail();
  } else if (detected !== file.mimetype && !(['application/msword', 'application/vnd.ms-powerpoint'].includes(file.mimetype) && detected === 'application/x-cfb')) throw fail();
}
export async function saveFiles(db: DB, actor: Actor, files: Express.Multer.File[]) {
  return Promise.all(files.map(async f => db.fileObject.create({ data: {
    uploaderId: actor.id, storageKey: path.basename(f.path), originalName: path.basename(f.originalname), mimeType: f.mimetype, sizeBytes: f.size,
    checksum: crypto.createHash('sha256').update(await fs.readFile(f.path)).digest('hex'), visibility: 'PRIVATE', communityManaged: true,
  } })));
}
