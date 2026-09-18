import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { validate } from '../middleware/validate';
import * as announcements from '../services/announcements.service';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));
router.get('/options', asyncHandler(async (_req, res) => sendSuccess(res, await announcements.options(), 'Announcement options')));
router.get('/', asyncHandler(async (req, res) => sendSuccess(res, await announcements.list(req.query), 'Announcements')));
router.post('/', validate({ body: announcements.createBody }), asyncHandler(async (req, res) => sendSuccess(res, await announcements.save(req.user!.id, req.body), 'Draft saved', 201)));
router.get('/:id', asyncHandler(async (req, res) => sendSuccess(res, await announcements.detail(req.params.id!), 'Announcement')));
router.patch('/:id', validate({ body: announcements.updateBody }), asyncHandler(async (req, res) => sendSuccess(res, await announcements.save(req.user!.id, req.body, req.params.id!), 'Draft saved')));
router.get('/:id/deliveries', asyncHandler(async (req, res) => sendSuccess(res, await announcements.deliveries(req.params.id!, req.query), 'Delivery outcomes')));
for (const action of ['preview', 'sign-off', 'send', 'schedule', 'cancel', 'retry', 'delete'] as const) {
  router.post(`/:id/${action}`, validate({ body: announcements.actionBody }), asyncHandler(async (req, res) => sendSuccess(res, await announcements.act(req.user!.id, req.params.id!, action, req.body), 'Announcement updated')));
}
export default router;
