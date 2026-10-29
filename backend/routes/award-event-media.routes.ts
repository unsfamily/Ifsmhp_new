import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { ApiError } from '../utils/ApiError';
import * as awardMedia from '../services/award-event-media.service';

export const awardEventMediaAdminRoutes = Router();
export const awardEventMediaPublicRoutes = Router();
awardEventMediaAdminRoutes.use(requireAuth, requireRole('ADMIN'));

const streamMedia = (admin: boolean): RequestHandler => asyncHandler(async (req, res) => {
  const file = await awardMedia.mediaFile(req.params.id!, admin);
  const resolved = await awardMedia.resolveMediaPath(file, req.query.w);
  const stat = await fsp.stat(resolved.absolute).catch(() => { throw ApiError.notFound('Award media not found'); });
  if (!stat.isFile()) throw ApiError.notFound('Award media not found');
  res.setHeader('Cache-Control', admin ? 'private, no-store' : 'public, max-age=86400, stale-while-revalidate=604800');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', resolved.mimeType);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(resolved.originalName)}`);
  const ranges = req.range(stat.size);
  if (ranges === -1) {
    res.setHeader('Content-Range', `bytes */${stat.size}`);
    res.status(416).end();
    return;
  }
  const range = !req.headers['if-range'] && Array.isArray(ranges) && ranges.type === 'bytes' && ranges.length === 1 ? ranges[0] : undefined;
  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`);
  }
  res.setHeader('Content-Length', range ? range.end - range.start + 1 : stat.size);
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = fs.createReadStream(resolved.absolute, range ? { start: range.start, end: range.end } : undefined);
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
});

awardEventMediaPublicRoutes.get('/', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  sendSuccess(res, await awardMedia.listMedia(false, req.query), 'Award event media');
}));
awardEventMediaPublicRoutes.get('/:id/media', streamMedia(false));

awardEventMediaAdminRoutes.get('/options', asyncHandler(async (_req, res) => sendSuccess(res, awardMedia.uploadPolicy(), 'Award event media upload policy')));
awardEventMediaAdminRoutes.get('/', asyncHandler(async (req, res) => sendSuccess(res, await awardMedia.listMedia(true, req.query), 'Award event media')));
awardEventMediaAdminRoutes.get('/:id/media', streamMedia(true));
awardEventMediaAdminRoutes.post('/', awardMedia.awardEventMediaUpload, asyncHandler(async (req, res) => {
  try {
    const result = await awardMedia.uploadMedia(req.user!, req.file);
    res.locals.awardMediaCommitted = true;
    sendSuccess(res, result, 'Award media uploaded', 201);
  } finally {
    if (req.file && !res.locals.awardMediaCommitted) await fsp.unlink(req.file.path).catch(() => undefined);
  }
}));
awardEventMediaAdminRoutes.patch('/:id', asyncHandler(async (req, res) => sendSuccess(res, await awardMedia.updateMedia(req.user!, req.params.id!, req.body), 'Award media updated')));
awardEventMediaAdminRoutes.post('/:id/reorder', asyncHandler(async (req, res) => sendSuccess(res, await awardMedia.reorderMedia(req.user!, req.params.id!, req.body), 'Award media order updated')));
awardEventMediaAdminRoutes.delete('/:id', asyncHandler(async (req, res) => sendSuccess(res, await awardMedia.removeMedia(req.user!, req.params.id!), 'Award media removed')));
