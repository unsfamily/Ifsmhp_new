import { authorizeGalleryFile } from '../services/gallery.service';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { env } from '../config';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { assertSafePath, uploadRoot } from '../utils/fileStorage';
import { writeAudit } from '../services/audit.service';
import { recordOpening } from '../services/document-exchange.service';
import { logger } from '../utils/logger';
import { authorizeCommunityFile } from '../services/community-access.service';
import {
  createRegistrationClaimToken,
  registrationAllowedExtensions,
  registrationAllowedMimeTypes,
  verifyRegistrationClaimToken,
} from '../services/registration-documents.service';

const router = Router();

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
});

const registrationUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

async function detectedMime(filePath: string): Promise<string | undefined> {
  const { fileTypeFromFile } = await import('file-type');
  return (await fileTypeFromFile(filePath))?.mime;
}

function parseMulter(uploadMiddleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    uploadMiddleware(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE'
          ? 'File is too large. Upload a file under the allowed size.'
          : 'Could not process the uploaded file.';
        next(new ApiError(422, message, [{ field: 'file', message }], { reason: error.code }));
        return;
      }
      next(error);
    });
  };
}

function mimeForExtension(extension: string) {
  switch (extension) {
    case '.pdf':
      return 'application/pdf';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.ppt':
      return 'application/vnd.ms-powerpoint';
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    default:
      return null;
  }
}

function declaredMime(file: Express.Multer.File) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (file.mimetype === 'application/octet-stream') return mimeForExtension(extension) ?? file.mimetype;
  return file.mimetype;
}

function mimeMatches(declared: string, magicMime: string | undefined) {
  if (!magicMime) return false;
  if (magicMime === declared) return true;
  // Legacy Office containers are both detected as CFB/OLE, so the declared type
  // cannot be narrowed further than "it really is an old Office file".
  const legacyOffice = ['application/msword', 'application/vnd.ms-powerpoint'];
  return legacyOffice.includes(declared) && magicMime === 'application/x-cfb';
}

async function validateStoredUpload(
  file: Express.Multer.File,
  options: { allowedMimeTypes: Set<string>; validateExtension?: boolean; allowTextLike?: boolean; maxMb: number },
) {
  if (file.size <= 0) {
    await fsp.unlink(file.path).catch(() => undefined);
    throw new ApiError(422, 'The uploaded file is empty', [{ field: 'file', message: 'Choose a non-empty file.' }]);
  }

  const extension = path.extname(file.originalname).toLowerCase();
  if (options.validateExtension && !registrationAllowedExtensions.has(extension)) {
    await fsp.unlink(file.path).catch(() => undefined);
    throw new ApiError(422, 'Unsupported file type', [
      { field: 'file', message: 'Upload a PDF, DOC, DOCX, JPG, or PNG file.' },
    ]);
  }

  const mimeType = declaredMime(file);
  if (!options.allowedMimeTypes.has(mimeType)) {
    await fsp.unlink(file.path).catch(() => undefined);
    throw new ApiError(422, 'Unsupported file type', [{ field: 'file', message: `${mimeType} is not allowed.` }]);
  }

  if (file.size > options.maxMb * 1024 * 1024) {
    await fsp.unlink(file.path).catch(() => undefined);
    throw new ApiError(422, `File is too large. Upload a file under ${options.maxMb} MB.`, [
      { field: 'file', message: `Maximum file size is ${options.maxMb} MB.` },
    ]);
  }

  const magicMime = await detectedMime(file.path);
  const isTextLike = options.allowTextLike && (mimeType === 'text/plain' || mimeType === 'text/csv');
  if (!mimeMatches(mimeType, magicMime) && !isTextLike) {
    await fsp.unlink(file.path).catch(() => undefined);
    throw new ApiError(422, magicMime ? 'File contents do not match the declared MIME type' : 'File contents could not be verified', [
      { field: 'file', message: 'Choose a valid file of the selected type.' },
    ]);
  }

  const checksum = crypto.createHash('sha256').update(await fsp.readFile(file.path)).digest('hex');
  return { mimeType, checksum };
}

async function persistUpload(file: Express.Multer.File, mimeType: string, checksum: string, uploaderId?: string, visibility: 'PUBLIC' | 'PRIVATE' = 'PRIVATE') {
  try {
    return await prisma.$transaction(async tx => {
      const record = await tx.fileObject.create({ data: { uploaderId, storageKey: path.basename(file.filename), originalName: file.originalname, mimeType, sizeBytes: file.size, checksum, visibility } });
      await writeAudit({ actorId: uploaderId, actorRole: uploaderId ? undefined : 'UNAUTHENTICATED', action: 'FileUploaded', entity: `FileObject ${record.id}`, metadata: { fileId: record.id } }, tx);
      return record;
    });
  } catch (error) {
    await fsp.unlink(file.path).catch(cleanupError => logger.error('Uncommitted file cleanup failed', { code: cleanupError.code }));
    throw error;
  }
}

router.post(
  '/registration',
  parseMulter(registrationUpload.single('file')),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new ApiError(422, 'A file is required', [{ field: 'file', message: 'Attach one file.' }]);

    const { mimeType, checksum } = await validateStoredUpload(file, {
      allowedMimeTypes: registrationAllowedMimeTypes,
      validateExtension: true,
      maxMb: 10,
    });
    const record = await persistUpload(file, mimeType, checksum);

    sendSuccess(
      res,
      {
        id: record.id,
        claimToken: createRegistrationClaimToken(record),
        name: record.originalName,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        uploadedAt: record.createdAt,
      },
      'Registration document uploaded',
      201,
    );
  }),
);

router.delete(
  '/registration/:id',
  asyncHandler(async (req, res) => {
    const claimToken = String(req.body?.claimToken ?? '');
    const file = await prisma.fileObject.findUnique({ where: { id: req.params.id } });
    if (!file || file.deletedAt || file.uploaderId || !verifyRegistrationClaimToken(file, claimToken)) {
      throw ApiError.notFound('Uploaded document not found');
    }

    const removed = await prisma.$transaction(async tx => {
      const removed = await tx.fileObject.updateMany({ where: { id: file.id, deletedAt: null, uploaderId: null }, data: { deletedAt: new Date() } });
      if (removed.count) await writeAudit({ actorRole: 'UNAUTHENTICATED', action: 'FileUploadRemoved', entity: `FileObject ${file.id}` }, tx);
      return removed.count > 0;
    });
    if (!removed) throw ApiError.notFound('Uploaded document not found');
    await fsp.unlink(assertSafePath(file.storageKey)).catch(() => undefined);
    sendSuccess(res, { removed: true }, 'Registration document removed');
  }),
);

router.use(requireAuth);

router.post(
  '/upload',
  parseMulter(upload.single('file')),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new ApiError(422, 'A file is required', [{ field: 'file', message: 'Attach one file.' }]);

    const { mimeType, checksum } = await validateStoredUpload(file, {
      allowedMimeTypes,
      allowTextLike: true,
      maxMb: env.MAX_UPLOAD_MB,
    });
    const record = await persistUpload(file, mimeType, checksum, req.user!.id, req.body?.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE');
    sendSuccess(res, { id: record.id, name: record.originalName, mimeType: record.mimeType, sizeBytes: record.sizeBytes }, 'File uploaded', 201);
  }),
);

router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const file = await prisma.fileObject.findUnique({
      where: { id: req.params.id },
      include: {
        credentials: { include: { profile: true } },
        projectFiles: { include: { project: true } },
        publicationFiles: { include: { publication: true } },
        messageAttachments: { include: { message: { include: { conversation: { include: { participants: true } } } } } },
      },
    });
    if (!file || file.deletedAt) throw ApiError.notFound('File not found');

    const user = req.user!;
    if (file.galleryManaged || await prisma.galleryItem.count({ where: { fileId: file.id } })) {
      await authorizeGalleryFile(file.id, user.role === 'ADMIN');
      res.setHeader('Cache-Control', 'private, no-store');
    }
    // Community assets have revocable, contextual access even for their uploader.
    if (file.communityManaged) {
      await authorizeCommunityFile(user, file.id);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    const allowed = file.galleryManaged || file.communityManaged ||
      user.role === 'ADMIN' ||
      file.visibility === 'PUBLIC' ||
      file.uploaderId === user.id ||
      file.credentials.some((item) => item.profile.userId === user.id) ||
      file.projectFiles.some((item) => item.project.ownerId === user.id) ||
      file.publicationFiles.some((item) => item.publication.authorId === user.id) ||
      // Attaching a file to a message is what grants the other participants
      // download rights — but an internal note is admin-only, so a file on one
      // must not become readable by the member through this branch. Admins
      // still reach it via the role check above.
      file.messageAttachments.some(
        (item) => !item.message.internal && item.message.conversation.participants.some((p) => p.userId === user.id),
      );

    if (!allowed) throw ApiError.notFound('File not found');

    const attachmentId = req.query.attachmentId;
    const context = attachmentId === undefined ? undefined : file.messageAttachments.find(a => a.id === attachmentId);
    if (attachmentId !== undefined && (!context || (user.role !== 'ADMIN' && (context.message.internal || !context.message.conversation.participants.some(p => p.userId === user.id))))) {
      throw ApiError.notFound('Attachment not found');
    }
    const action = req.query.action ?? 'download';
    if (!['preview', 'download'].includes(String(action))) throw ApiError.unprocessable('Invalid file action');

    const absolute = assertSafePath(file.storageKey);
    await fsp.access(absolute, fs.constants.R_OK).catch(() => {
      throw ApiError.notFound('File not found');
    });
    if (req.method === 'GET' && (user.role === 'ADMIN' || file.visibility !== 'PUBLIC')) await writeAudit({ actorId: user.id, action: file.credentials.length ? 'CredentialAccessGranted' : 'FileAccessGranted', entity: `FileObject ${file.id}`, outcome: 'ACCESS_GRANTED', metadata: { fileId: file.id } });
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    if (req.method === 'GET' && context && context.message.conversation.kind === 'CRO' && !context.message.internal && context.message.senderId !== user.id) {
      res.once('finish', () => {
        void recordOpening(context.id, user.id, action as 'preview' | 'download').catch(error => logger.error('Attachment receipt failed', { error: String(error) }));
      });
    }
    const stream = fs.createReadStream(absolute);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }),
);

export default router;
