import crypto from 'node:crypto';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import multer from 'multer';
import sharp from 'sharp';
import type { RequestHandler } from 'express';
import { env } from '../config';
import { uploadRoot } from '../utils/fileStorage';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

const formats: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm' };
export const galleryPolicy = { maxBytes: env.GALLERY_MAX_UPLOAD_MB * 1024 * 1024, mimeTypes: [...new Set(Object.values(formats))], extensions: Object.keys(formats) };
const parser = multer({
  storage: multer.diskStorage({ destination: uploadRoot, filename: (_req, _file, cb) => cb(null, crypto.randomUUID()) }),
  limits: { fileSize: galleryPolicy.maxBytes, files: 1, fields: 8, fieldSize: 40000 },
}).single('file');
export const galleryUpload: RequestHandler = (req, res, next) => {
  parser(req, res, error => {
    const cleanup = () => { if (req.file && !res.locals.galleryCommitted) void fsp.unlink(req.file.path).catch(() => undefined); };
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FIELD_VALUE') {
      cleanup();
      const field = error.field ?? '(root)';
      const message = field === 'title' ? 'Name must be 191 characters or fewer.' : field === 'caption' ? 'Description must be 10,000 characters or fewer.' : 'Text field is too large.';
      return next(ApiError.unprocessable(message, [{ field, message }]));
    }
    if (error) { cleanup(); return next(ApiError.unprocessable(error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? `Media exceeds ${env.GALLERY_MAX_UPLOAD_MB} MB.` : 'Attach one supported image or video.', [{ field: 'file', message: 'Check the file and upload limit.' }])); }
    next();
  });
};
// Avatar uploads share the image validator and must remain image-only.
export async function inspectImage(file?: Express.Multer.File) {
  if (!file?.mimetype.startsWith('image/')) throw ApiError.unprocessable('Choose a valid JPEG, PNG, or WebP image.', [{ field: 'file', message: 'Choose a supported image.' }]);
  return inspectMedia(file);
}
export async function inspectMedia(file?: Express.Multer.File) {
  const fail = () => ApiError.unprocessable('Choose a valid JPEG, PNG, WebP, MP4, or WebM file.', [{ field: 'file', message: 'File contents, extension, and MIME type must match.' }]);
  if (!file || !file.size) throw fail();
  const extension = path.extname(file.originalname).slice(1).toLowerCase();
  const expected = formats[extension];
  if (!expected || expected !== file.mimetype) throw fail();
  const { fileTypeFromFile } = await import('file-type');
  if ((await fileTypeFromFile(file.path))?.mime !== expected) throw fail();
  let width: number, height: number;
  const type = expected.startsWith('video/') ? 'video' as const : 'image' as const;
  if (type === 'video') {
    ({ width, height } = await inspectVideo(file));
  } else {
    try {
      const decoder = sharp(file.path, { failOn: 'warning' });
      const metadata = await decoder.metadata();
      if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw fail();
      await decoder.stats(); // Decode pixels too: headers alone do not prove an image is valid.
      width = metadata.width; height = metadata.height;
      if (metadata.orientation && metadata.orientation >= 5) [width, height] = [height, width];
    } catch { throw fail(); }
  }
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file.path)) hash.update(chunk);
  return { type, width, height, checksum: hash.digest('hex'), aspect: width === height ? 'square' : width > height ? 'landscape' : 'portrait' };
}

const probe = promisify(execFile);
async function inspectVideo(file: Express.Multer.File) {
  const message = 'Choose a playable MP4 (H.264 with optional AAC/MP3 audio) or WebM (VP8/VP9 with optional Opus/Vorbis audio).';
  try {
    // Only local containers are permitted; never follow network references. Scan
    // packets to reject empty/truncated containers, with bounded time and output.
    const executable = env.GALLERY_FFPROBE_PATH || (await import('@ffprobe-installer/ffprobe')).default.path;
    const { stdout, stderr } = await probe(executable, [
      '-v', 'error', '-protocol_whitelist', 'file', '-format_whitelist', 'mov,matroska,webm',
      '-count_packets', '-show_entries', 'stream=codec_type,codec_name,width,height,pix_fmt,nb_read_packets:stream_disposition=attached_pic:stream_side_data_list:format=duration',
      '-of', 'json', file.path,
    ], { timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true });
    const result = JSON.parse(stdout) as { format?: { duration?: string }; streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; pix_fmt?: string; nb_read_packets?: string; disposition?: { attached_pic?: number }; side_data_list?: { rotation?: number }[] }[] };
    const videos = result.streams?.filter(s => s.codec_type === 'video' && !s.disposition?.attached_pic) ?? [];
    const video = videos[0];
    const mp4 = file.mimetype === 'video/mp4';
    const duration = Number(result.format?.duration);
    if (stderr.trim() || videos.length !== 1 || !video?.width || !video.height || !Number.isFinite(duration) || duration <= 0 || !(Number(video.nb_read_packets) > 0)
      || !(mp4 ? ['h264'] : ['vp8', 'vp9']).includes(video.codec_name ?? '')
      || !['yuv420p', 'yuvj420p'].includes(video.pix_fmt ?? '')
      || result.streams?.some(s => s.codec_type === 'audio' && !(mp4 ? ['aac', 'mp3'] : ['opus', 'vorbis']).includes(s.codec_name ?? ''))) throw new Error('Unsupported video');
    const rotation = video.side_data_list?.find(s => s.rotation !== undefined)?.rotation ?? 0;
    return Math.abs(rotation % 180) === 90 ? { width: video.height, height: video.width } : { width: video.width, height: video.height };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string; killed?: boolean };
    if (error instanceof SyntaxError || ['ENOENT', 'EACCES', 'MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(String(failure.code)) || /No match for section|Option not found|Failed to set value/.test(failure.stderr ?? '')) {
      logger.error('Gallery video validator is unavailable', { code: failure.code ?? 'INVALID_PROBE_OUTPUT' });
      throw new ApiError(503, 'Video validation is unavailable. Please contact the administrator.');
    }
    if (failure.killed) throw ApiError.unprocessable('Video validation timed out. Try a shorter video.', [{ field: 'file', message: 'Try a shorter video and upload again.' }]);
    throw ApiError.unprocessable(message, [{ field: 'file', message }]);
  }
}
