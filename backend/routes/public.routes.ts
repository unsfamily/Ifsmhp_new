import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as service from '../services/platform.service';

const router = Router({ mergeParams: true });

/**
 * Public, unauthenticated content endpoints.
 *
 * Policy (§B.2 / §C): Public visitors see ONLY status=PUBLISHED records.
 *  - Admin-only fields like reviewNotes, internalNotes are ALWAYS stripped
 *    in the service serializer — never trusted to the UI to hide (R4).
 *  - Drafts / Under Review / Rejected are invisible to any unauthenticated call.
 */

router.get(
  '/publications',
  asyncHandler(async (req, res) => {
    const data = await service.publicPublications(req);
    sendSuccess(res, data, 'Published research loaded');
  })
);

router.get(
  '/publications/:slugOrId',
  asyncHandler(async (req, res) => {
    const publication = await service.publicPublicationDetail(req.params.slugOrId!, req);
    sendSuccess(res, { publication }, 'Published work detail');
  })
);

router.get(
  '/events',
  asyncHandler(async (req, res) => {
    const data = await service.publicEvents(req);
    sendSuccess(res, data, 'Public events listing');
  })
);

router.get(
  '/events/:slugOrId',
  asyncHandler(async (req, res) => {
    const event = await service.eventDetail(req.params.slugOrId!);
    sendSuccess(res, { event }, 'Public event detail');
  })
);

router.get(
  '/gallery',
  asyncHandler(async (req, res) => {
    const data = await service.gallery(req);
    sendSuccess(res, data, 'Public gallery loaded');
  })
);

router.get(
  '/product-reviews',
  asyncHandler(async (req, res) => {
    const data = await service.productReviews(req);
    sendSuccess(res, data, 'Product reviews loaded');
  })
);

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const data = await service.publicStats();
    sendSuccess(res, data, 'Public platform statistics');
  })
);

export default router;
