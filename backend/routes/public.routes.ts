import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';

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
  asyncHandler(async (_req, res) => {
    // Service: filter WHERE status = PUBLISHED
    sendSuccess(
      res,
      {
        rows: [],
        total: 0,
        filters: { category: 'all', q: '' },
      },
      'Published research (public listing)'
    );
  })
);

router.get(
  '/publications/:slugOrId',
  asyncHandler(async (req, res) => {
    // Service: WHERE (slug = :slugOrId OR id = :slugOrId) AND status = PUBLISHED
    sendSuccess(
      res,
      { publication: { id: req.params.slugOrId, status: 'PUBLISHED' } },
      'Published work detail'
    );
  })
);

router.get(
  '/events',
  asyncHandler(async (_req, res) => {
    // Only status=Published events and audience=Public (or Members+Public).
    sendSuccess(res, { rows: [], total: 0 }, 'Public events listing');
  })
);

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    // Aggregate-only. Never row-level PII.
    sendSuccess(
      res,
      {
        platform: {
          totalMembers: 277,
          countriesRepresented: 42,
          publicationsPublished: 223,
          publicLifetimeViews: 285142,
        },
        latest: [
          { title: 'CBT outcomes in digital mental health', publishedAt: '2026-07-15', slug: 'cbt-digital-mh-2026' },
        ],
      },
      'Public platform statistics'
    );
  })
);

export default router;
