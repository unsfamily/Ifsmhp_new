import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { ApiError } from '../utils/ApiError';
import { assertSafePath } from '../utils/fileStorage';
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

/**
 * The manuscript of a published paper, served to anyone.
 *
 * Publishing is what grants this access — the same gate that already makes the
 * abstract and full text public — so the FileObject stays PRIVATE and the
 * authenticated `/files/:id/download` ACL is untouched. This is the only
 * anonymous byte-serving path in the API.
 *
 * `?inline=1` renders the PDF in the browser ("Read Full Paper"); the default
 * attachment disposition downloads it ("PDF").
 */
router.get(
  '/publications/:slugOrId/file',
  asyncHandler(async (req, res) => {
    const manuscript = await service.publicPublicationManuscript(req.params.slugOrId!);
    // One 404 for "no such paper", "not published yet" and "no manuscript
    // attached" alike — a paper's review status must not be inferable here.
    if (!manuscript) throw ApiError.notFound('Publication not found');

    const absolute = assertSafePath(manuscript.file.storageKey);
    await fsp.access(absolute, fs.constants.R_OK).catch(() => {
      throw ApiError.notFound('Publication not found');
    });

    await service.recordPublicationDownload(manuscript.publicationId);

    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', manuscript.file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${manuscript.file.originalName.replace(/"/g, '')}"`,
    );
    fs.createReadStream(absolute).pipe(res);
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
