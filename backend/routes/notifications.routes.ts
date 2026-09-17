import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { validate } from '../middleware/validate';
import { listNotifications, notificationDetail, readNotifications } from '../services/notifications.service';
import { preference, unsubscribeBody } from '../services/announcement-preferences.service';

export const unsubscribeRouter = Router();
unsubscribeRouter.get('/', validate({ query: unsubscribeBody }), asyncHandler(async (req, res) => { res.setHeader('Cache-Control', 'no-store'); sendSuccess(res, await preference(String(req.query.token)), 'Announcement email preference'); }));
unsubscribeRouter.post('/', validate({ body: unsubscribeBody }), asyncHandler(async (req, res) => { res.setHeader('Cache-Control', 'no-store'); sendSuccess(res, await preference(req.body.token, true), 'Announcement emails disabled'); }));

const router = Router();
router.use(requireAuth, requireRole('MEMBER', 'ADMIN'));
router.get('/', asyncHandler(async (req, res) => sendSuccess(res, await listNotifications(req.user!.id, req.query), 'Notifications')));
router.post('/read-all', validate({ body: z.object({ through: z.string().datetime().refine(v => Date.parse(v) <= Date.now(), 'Use the notification snapshot time.') }).strict() }), asyncHandler(async (req, res) => sendSuccess(res, await readNotifications(req.user!.id, undefined, req.body.through), 'Notifications marked read')));
router.get('/:id', asyncHandler(async (req, res) => sendSuccess(res, await notificationDetail(req.user!.id, req.params.id!), 'Notification')));
router.post('/:id/read', asyncHandler(async (req, res) => sendSuccess(res, await readNotifications(req.user!.id, req.params.id!), 'Notification marked read')));
export default router;
