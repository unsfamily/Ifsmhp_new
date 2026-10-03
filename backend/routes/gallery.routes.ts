import { Router } from 'express';
import type { RequestHandler } from 'express';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { assertSafePath } from '../utils/fileStorage';
import { ApiError } from '../utils/ApiError';
import * as gallery from '../services/gallery.service';
import { galleryPolicy, galleryUpload } from '../services/gallery-upload.service';

export const galleryAdminRoutes = Router();
export const galleryPublicRoutes = Router();
galleryAdminRoutes.use(requireAuth, requireRole('ADMIN'));
const streamMedia = (admin: boolean): RequestHandler => asyncHandler(async (req, res) => {
  const file = await gallery.mediaFile(req.params.id!, admin);
  const absolute = assertSafePath(file.storageKey);
  const stat = await fsp.stat(absolute).catch(() => { throw ApiError.notFound('Media not found'); });
  if (!stat.isFile()) throw ApiError.notFound('Media not found');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
  const ranges = req.range(stat.size);
  if (ranges === -1) {
    res.setHeader('Content-Range', `bytes */${stat.size}`);
    res.status(416).end(); return;
  }
  // Ignore malformed/multipart ranges; a complete 200 response is permitted.
  // Without a matching validator, If-Range also requests the full representation.
  const range = !req.headers['if-range'] && Array.isArray(ranges) && ranges.type === 'bytes' && ranges.length === 1 ? ranges[0] : undefined;
  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`);
  }
  res.setHeader('Content-Length', range ? range.end - range.start + 1 : stat.size);
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = fs.createReadStream(absolute, range ? { start: range.start, end: range.end } : undefined);
  stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
});
galleryAdminRoutes.get('/options', asyncHandler(async (_req, res) => sendSuccess(res, galleryPolicy, 'Gallery upload policy')));
for (const [router, admin] of [[galleryAdminRoutes, true], [galleryPublicRoutes, false]] as const) {
  router.get('/subcategories', asyncHandler(async (req, res) => sendSuccess(res, await gallery.subcategories(req.query, admin), 'Gallery subcategories')));
  router.get('/categories', asyncHandler(async (req, res) => sendSuccess(res, await gallery.categories(req.query, admin), 'Gallery collections')));
  router.get('/photos', asyncHandler(async (req, res) => sendSuccess(res, await gallery.photos(req.query, admin), 'Gallery photographs')));
  router.get('/photos/:id/image', streamMedia(admin)); // Existing clients retain their URL.
  router.get('/photos/:id/media', streamMedia(admin));
}
galleryAdminRoutes.post('/subcategories', asyncHandler(async (req, res) => sendSuccess(res, await gallery.saveSubcategory(req.user!, req.body), 'Subcategory created', 201)));
galleryAdminRoutes.patch('/subcategories/:id', asyncHandler(async (req, res) => sendSuccess(res, await gallery.saveSubcategory(req.user!, req.body, req.params.id!), 'Subcategory updated')));
galleryAdminRoutes.delete('/subcategories/:id', asyncHandler(async (req, res) => sendSuccess(res, await gallery.removeSubcategory(req.user!, req.params.id!), 'Subcategory deleted')));
galleryAdminRoutes.post('/categories', asyncHandler(async (req, res) => sendSuccess(res, await gallery.saveCategory(req.user!, req.body), 'Collection created', 201)));
galleryAdminRoutes.patch('/categories/:id', asyncHandler(async (req, res) => sendSuccess(res, await gallery.saveCategory(req.user!, req.body, req.params.id!), 'Collection updated')));
galleryAdminRoutes.post('/photos', galleryUpload, asyncHandler(async (req, res) => {
  try {
    const result = await gallery.uploadPhoto(req.user!, req.body, req.file);
    res.locals.galleryCommitted = true;
    sendSuccess(res, result, 'Media uploaded', 201);
  } finally {
    if (req.file && !res.locals.galleryCommitted) await fsp.unlink(req.file.path).catch(() => undefined);
  }
}));
galleryAdminRoutes.patch('/photos/:id', asyncHandler(async (req, res) => sendSuccess(res, await gallery.savePhoto(req.user!, req.params.id!, req.body), 'Photograph updated')));
for (const kind of ['categories', 'photos'] as const) {
  galleryAdminRoutes.delete(`/${kind}/:id`, asyncHandler(async (req, res) => sendSuccess(res, await gallery.remove(req.user!, kind, req.params.id!), 'Gallery item deleted')));
  galleryAdminRoutes.post(`/${kind}/:id/reorder`, asyncHandler(async (req, res) => sendSuccess(res, await gallery.reorder(req.user!, kind, req.params.id!, req.body), 'Gallery order updated')));
}
