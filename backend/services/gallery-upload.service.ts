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

const formats: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
};
const mimeAliases: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'audio/webm': 'video/webm',
};
export const galleryPolicy = { maxBytes: env.GALLERY_MAX_UPLOAD_MB * 1024 * 1024, mimeTypes: [...new Set(Object.values(formats))], extensions: Object.keys(formats) };

function normalizeMime(value: string | undefined) {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw || raw === 'application/octet-stream') return '';
  return mimeAliases[raw] ?? raw;
}
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
  const metadata = await inspectMedia(file);
  if (metadata.type !== 'image') throw ApiError.unprocessable('Choose a valid JPEG, PNG, or WebP image.', [{ field: 'file', message: 'Choose a supported image.' }]);
  return metadata;
}
export async function inspectMedia(file?: Express.Multer.File) {
  const unsupported = (message = 'Choose a valid JPEG, PNG, WebP, MP4, or WebM file.') =>
    ApiError.unprocessable(message, [{ field: 'file', message }]);
  if (!file || !file.size) throw unsupported('Choose one or more photographs or videos to upload.');
  const extension = path.extname(file.originalname).slice(1).toLowerCase();
  const expected = formats[extension];
  if (!expected) throw unsupported('Use a JPG, JPEG, PNG, WebP, MP4, or WebM file.');

  const declared = normalizeMime(file.mimetype);
  // Browsers on Windows often send an empty type or image/jpg; trust the sniffed bytes.
  if (declared && declared !== expected) throw unsupported('The file extension does not match the file type.');

  const { fileTypeFromFile } = await import('file-type');
  const detected = await fileTypeFromFile(file.path);
  if (!detected?.mime || detected.mime !== expected) {
    throw unsupported('This file is damaged or is not a supported photograph or video.');
  }
  file.mimetype = expected;

  let width: number, height: number;
  const type = expected.startsWith('video/') ? 'video' as const : 'image' as const;
  if (type === 'video') {
    ({ width, height } = await inspectVideo(file));
  } else {
    try {
      // failOn: 'error' keeps common EXIF/ICC warnings from rejecting phone photographs.
      const decoder = sharp(file.path, { failOn: 'error' });
      const metadata = await decoder.metadata();
      if (!metadata.width || !metadata.height) throw unsupported('This photograph could not be read.');
      if ((metadata.pages ?? 1) > 1) throw unsupported('Animated images are not supported. Upload a still photograph.');
      await decoder.stats(); // Decode pixels too: headers alone do not prove an image is valid.
      width = metadata.width; height = metadata.height;
      if (metadata.orientation && metadata.orientation >= 5) [width, height] = [height, width];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.warn('Award/gallery image decode failed', { name: file.originalname, detail: String(error).slice(0, 300) });
      throw unsupported('This photograph could not be read. Try exporting it as JPG or PNG.');
    }
  }
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file.path)) hash.update(chunk);
  return { type, width, height, checksum: hash.digest('hex'), aspect: width === height ? 'square' : width > height ? 'landscape' : 'portrait' };
}

const probe = promisify(execFile);
const playableMessage = 'Choose a playable MP4 (H.264 with optional AAC/MP3 audio) or WebM (VP8/VP9 with optional Opus/Vorbis audio).';
const probeEntries = 'stream=codec_type,codec_name,width,height,pix_fmt,nb_read_packets,duration:stream_disposition=attached_pic:stream_side_data_list:format=duration';
type ProbeStream = { codec_type?: string; codec_name?: string; width?: number; height?: number; pix_fmt?: string; nb_read_packets?: string; duration?: string; disposition?: { attached_pic?: number }; side_data_list?: { rotation?: number }[] };
type ProbeResult = { format?: { duration?: string }; streams?: ProbeStream[] };

async function probeExecutable() {
  return env.GALLERY_FFPROBE_PATH || (await import('@ffprobe-installer/ffprobe')).default.path;
}
async function readProbe(filePath: string) {
  // Only local containers are permitted; never follow network references. Scan
  // packets to reject empty/truncated containers, with bounded time and output.
  const { stdout, stderr } = await probe(await probeExecutable(), [
    '-v', 'error', '-protocol_whitelist', 'file', '-format_whitelist', 'mov,matroska,webm',
    '-count_packets', '-show_entries', probeEntries, '-of', 'json', filePath,
  ], { timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true });
  return { result: JSON.parse(stdout) as ProbeResult, stderr };
}
function assessVideo(file: Express.Multer.File, result: ProbeResult) {
  const streams = result.streams ?? [];
  const videos = streams.filter(stream => stream.codec_type === 'video' && !stream.disposition?.attached_pic);
  const video = videos[0];
  const audio = streams.filter(stream => stream.codec_type === 'audio');
  const mp4 = file.mimetype === 'video/mp4';
  const duration = Number(result.format?.duration ?? video?.duration);
  const intact = videos.length === 1 && !!video?.width && !!video.height && Number.isFinite(duration) && duration > 0 && Number(video.nb_read_packets) > 0;
  const playable = intact
    && (mp4 ? ['h264'] : ['vp8', 'vp9']).includes(video?.codec_name ?? '')
    && ['yuv420p', 'yuvj420p'].includes(video?.pix_fmt ?? '')
    && audio.every(stream => (mp4 ? ['aac', 'mp3'] : ['opus', 'vorbis']).includes(stream.codec_name ?? ''));
  // Phone cameras record HEVC, and some H.264 files are 10-bit. Both can be
  // converted to the browser-safe profile. Other codecs stay rejected.
  const convertible = mp4 && intact && ['h264', 'hevc'].includes(video?.codec_name ?? '');
  const rotation = video?.side_data_list?.find(side => side.rotation !== undefined)?.rotation ?? 0;
  const width = video?.width ?? 0;
  const height = video?.height ?? 0;
  const dimensions = Math.abs(rotation % 180) === 90 ? { width: height, height: width } : { width, height };
  return { playable, convertible, dimensions, video, audio, duration };
}
async function transcodeMp4(file: Express.Multer.File, result: ProbeResult) {
  const streams = result.streams ?? [];
  const videoIndex = streams.findIndex(stream => stream.codec_type === 'video' && !stream.disposition?.attached_pic);
  const audioIndex = streams.findIndex(stream => stream.codec_type === 'audio');
  const output = `${file.path}.h264`;
  const executable = env.GALLERY_FFMPEG_PATH || (await import('@ffmpeg-installer/ffmpeg')).default.path;
  try {
    await probe(executable, [
      '-y', '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file', '-i', file.path,
      '-map', `0:${videoIndex}`,
      ...(audioIndex >= 0 ? ['-map', `0:${audioIndex}`, '-c:a', 'aac', '-ac', '2', '-b:a', '128k'] : ['-an']),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-movflags', '+faststart', '-f', 'mp4', output,
    ], { timeout: 480000, maxBuffer: 1024 * 1024, windowsHide: true });
    const stat = await fsp.stat(output);
    if (!stat.size || stat.size > galleryPolicy.maxBytes) {
      const message = `Converted video exceeds ${env.GALLERY_MAX_UPLOAD_MB} MB.`;
      throw ApiError.unprocessable(message, [{ field: 'file', message }]);
    }
    await fsp.copyFile(output, file.path);
    file.size = stat.size;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const failure = error as NodeJS.ErrnoException & { stderr?: string; killed?: boolean };
    if (['ENOENT', 'EACCES', 'MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(String(failure.code))) {
      logger.error('Gallery video converter is unavailable', { code: failure.code ?? 'MISSING_FFMPEG' });
      throw new ApiError(503, 'Video conversion is unavailable. Please contact the administrator.');
    }
    if (failure.killed) throw ApiError.unprocessable('Video conversion timed out. Try a shorter video.', [{ field: 'file', message: 'Try a shorter video and upload again.' }]);
    logger.warn('Gallery video conversion failed', { detail: String(failure.stderr ?? failure.message ?? '').slice(0, 400) });
    throw new Error('Unsupported video');
  } finally {
    await fsp.rm(output, { force: true }).catch(() => undefined);
  }
}
async function inspectVideo(file: Express.Multer.File, converted = false): Promise<{ width: number; height: number }> {
  try {
    const { result, stderr } = await readProbe(file.path);
    const decision = assessVideo(file, result);
    // Phone recordings often emit non-fatal decoder notices ("Late SEI") while
    // the H.264 stream itself is fine. Those notices are not a codec rejection.
    if (stderr.trim()) logger.warn('Gallery video probe reported decoder notices', { codec: decision.video?.codec_name, notice: stderr.trim().slice(0, 400) });
    if (decision.playable) return decision.dimensions;
    if (!converted && decision.convertible) {
      await transcodeMp4(file, result);
      return inspectVideo(file, true);
    }
    logger.warn('Gallery video rejected', { codec: decision.video?.codec_name ?? null, pix: decision.video?.pix_fmt ?? null, audio: decision.audio.map(stream => stream.codec_name ?? 'unknown'), duration: decision.duration });
    throw new Error('Unsupported video');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const failure = error as NodeJS.ErrnoException & { stderr?: string; killed?: boolean };
    if (error instanceof SyntaxError || ['ENOENT', 'EACCES', 'MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(String(failure.code)) || /No match for section|Option not found|Failed to set value/.test(failure.stderr ?? '')) {
      logger.error('Gallery video validator is unavailable', { code: failure.code ?? 'INVALID_PROBE_OUTPUT' });
      throw new ApiError(503, 'Video validation is unavailable. Please contact the administrator.');
    }
    if (failure.killed) throw ApiError.unprocessable('Video validation timed out. Try a shorter video.', [{ field: 'file', message: 'Try a shorter video and upload again.' }]);
    throw ApiError.unprocessable(playableMessage, [{ field: 'file', message: playableMessage }]);
  }
}
