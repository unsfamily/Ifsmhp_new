import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { ApiError } from '../utils/ApiError';
import { assertSafePath } from '../utils/fileStorage';
import * as carousel from '../services/home-carousel.service';

export const homeCarouselAdminRoutes = Router();
export const homeCarouselPublicRoutes = Router();
homeCarouselAdminRoutes.use(requireAuth, requireRole('ADMIN'));

const streamSlide = (admin: boolean): RequestHandler => asyncHandler(async (req, res) => {
  const file = await carousel.slideFile(req.params.id!, admin);
  const absolute = assertSafePath(file.storageKey);
  const stat = await fsp.stat(absolute).catch(() => { throw ApiError.notFound('Photograph not found'); });
  if (!stat.isFile()) throw ApiError.notFound('Photograph not found');
  res.setHeader('Cache-Control', admin ? 'private, no-store' : 'public, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = fs.createReadStream(absolute);
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
});

homeCarouselPublicRoutes.get('/', asyncHandler(async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, await carousel.listSlides(false), 'Home carousel');
}));
homeCarouselPublicRoutes.get('/:id/image', streamSlide(false));

homeCarouselAdminRoutes.get('/', asyncHandler(async (_req, res) => sendSuccess(res, await carousel.listSlides(true), 'Home carousel')));
homeCarouselAdminRoutes.get('/:id/image', streamSlide(true));
homeCarouselAdminRoutes.post('/', carousel.homeCarouselUpload, asyncHandler(async (req, res) => {
  try {
    const result = await carousel.uploadSlide(req.user!, req.file);
    res.locals.carouselCommitted = true;
    sendSuccess(res, result, 'Photograph added to the carousel', 201);
  } finally {
    if (req.file && !res.locals.carouselCommitted) await fsp.unlink(req.file.path).catch(() => undefined);
  }
}));
homeCarouselAdminRoutes.patch('/:id', asyncHandler(async (req, res) => sendSuccess(res, await carousel.updateSlide(req.user!, req.params.id!, req.body), 'Carousel photograph updated')));
homeCarouselAdminRoutes.post('/:id/reorder', asyncHandler(async (req, res) => sendSuccess(res, await carousel.reorderSlide(req.user!, req.params.id!, req.body), 'Carousel order updated')));
homeCarouselAdminRoutes.delete('/:id', asyncHandler(async (req, res) => sendSuccess(res, await carousel.removeSlide(req.user!, req.params.id!), 'Carousel photograph removed')));
