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
const streamImage = (admin: boolean): RequestHandler => asyncHandler(async (req, res) => {
  const file = await gallery.imageFile(req.params.id!, admin);
  const absolute = assertSafePath(file.storageKey);
  await fsp.access(absolute, fs.constants.R_OK).catch(() => { throw ApiError.notFound('Image not found'); });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
  const stream = fs.createReadStream(absolute);
  stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
});
galleryAdminRoutes.get('/options', asyncHandler(async (_req, res) => sendSuccess(res, galleryPolicy, 'Gallery upload policy')));
for (const [router, admin] of [[galleryAdminRoutes, true], [galleryPublicRoutes, false]] as const) {
  router.get('/categories', asyncHandler(async (req, res) => sendSuccess(res, await gallery.categories(req.query, admin), 'Gallery collections')));
  router.get('/photos', asyncHandler(async (req, res) => sendSuccess(res, await gallery.photos(req.query, admin), 'Gallery photographs')));
  router.get('/photos/:id/image', streamImage(admin));
}
galleryAdminRoutes.post('/categories', asyncHandler(async (req, res) => sendSuccess(res, await gallery.saveCategory(req.user!, req.body), 'Collection created', 201)));
galleryAdminRoutes.patch('/categories/:id', asyncHandler(async (req, res) => sendSuccess(res, await gallery.saveCategory(req.user!, req.body, req.params.id!), 'Collection updated')));
galleryAdminRoutes.post('/photos', galleryUpload, asyncHandler(async (req, res) => {
  try {
    const result = await gallery.uploadPhoto(req.user!, req.body, req.file);
    res.locals.galleryCommitted = true;
    sendSuccess(res, result, 'Photograph uploaded', 201);
  } finally {
    if (req.file && !res.locals.galleryCommitted) await fsp.unlink(req.file.path).catch(() => undefined);
  }
}));
galleryAdminRoutes.patch('/photos/:id', asyncHandler(async (req, res) => sendSuccess(res, await gallery.savePhoto(req.user!, req.params.id!, req.body), 'Photograph updated')));
for (const kind of ['categories', 'photos'] as const) {
  galleryAdminRoutes.delete(`/${kind}/:id`, asyncHandler(async (req, res) => sendSuccess(res, await gallery.remove(req.user!, kind, req.params.id!), 'Gallery item deleted')));
  galleryAdminRoutes.post(`/${kind}/:id/reorder`, asyncHandler(async (req, res) => sendSuccess(res, await gallery.reorder(req.user!, kind, req.params.id!, req.body), 'Gallery order updated')));
}
