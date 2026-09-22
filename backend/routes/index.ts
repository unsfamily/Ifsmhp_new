import { Router } from 'express';
import communityRoutes, { communityAdminRoutes } from './community.routes';
import healthRoutes from './health.routes';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import memberRoutes from './member.routes';
import publicRoutes from './public.routes';
import contactRoutes from './contact.routes';
import publicationsPublicRoutes from './publications.routes';
import filesRoutes from './files.routes';
import announcementRoutes from './announcements.routes';
import notificationRoutes, { unsubscribeRouter } from './notifications.routes';

/**
 * API v1 router (spec §39).
 *
 * Authorization hierarchy (also enforced in each route file via middleware):
 *   /health            Public
 *   /public/*          Public (published data only)
 *   /contact           Public (rate-limited)
 *   /auth/*            Public (rate-limited)
 *   /members/*         MEMBER — requireAuth + requireRole(MEMBER) + object ownership
 *   /admin/*           ADMIN  — requireAuth + requireRole(ADMIN) on EVERY endpoint
 *
 * Per architecture §B.3 / §I: "Never rely only on frontend route protection."
 * Route-level middleware here AND service-layer ownership checks combine to
 * form the full authorization boundary.
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/public', publicRoutes);
router.use('/contact', contactRoutes);
router.use('/publications', publicationsPublicRoutes);
router.use('/auth', authRoutes);
router.use('/files', filesRoutes);
router.use('/members', memberRoutes);
router.use('/admin/announcements', announcementRoutes);
router.use('/community', communityRoutes);
router.use('/admin/community', communityAdminRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);
router.use('/announcements/unsubscribe', unsubscribeRouter);

export default router;
