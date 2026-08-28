import crypto from 'node:crypto';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { env } from '../config';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { writeAudit } from '../services/audit.service';

const router = Router();

const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_STORAGE_PATH);
fs.mkdirSync(uploadRoot, { recursive: true });

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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

async function detectedMime(filePath: string): Promise<string | undefined> {
  const { fileTypeFromFile } = await import('file-type');
  return (await fileTypeFromFile(filePath))?.mime;
}

function assertSafePath(storageKey: string): string {
  const absolute = path.resolve(uploadRoot, storageKey);
  if (!absolute.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new ApiError(400, 'Invalid file path');
  }
  return absolute;
}

router.use(requireAuth);

router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new ApiError(422, 'A file is required', [{ field: 'file', message: 'Attach one file.' }]);
    if (!allowedMimeTypes.has(file.mimetype)) {
      await fsp.unlink(file.path).catch(() => undefined);
      throw new ApiError(422, 'Unsupported file type', [{ field: 'file', message: `${file.mimetype} is not allowed.` }]);
    }

    const magicMime = await detectedMime(file.path);
    const isTextLike = file.mimetype === 'text/plain' || file.mimetype === 'text/csv';
    if (magicMime && magicMime !== file.mimetype) {
      await fsp.unlink(file.path).catch(() => undefined);
      throw new ApiError(422, 'File contents do not match the declared MIME type');
    }
    if (!magicMime && !isTextLike) {
      await fsp.unlink(file.path).catch(() => undefined);
      throw new ApiError(422, 'File contents could not be verified');
    }

    const checksum = crypto.createHash('sha256').update(await fsp.readFile(file.path)).digest('hex');
    const record = await prisma.fileObject.create({
      data: {
        uploaderId: req.user!.id,
        storageKey: path.basename(file.filename),
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksum,
        visibility: req.body?.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
      },
    });
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
    const allowed =
      user.role === 'ADMIN' ||
      file.visibility === 'PUBLIC' ||
      file.uploaderId === user.id ||
      file.credentials.some((item) => item.profile.userId === user.id) ||
      file.projectFiles.some((item) => item.project.ownerId === user.id) ||
      file.publicationFiles.some((item) => item.publication.authorId === user.id) ||
      file.messageAttachments.some((item) => item.message.conversation.participants.some((p) => p.userId === user.id));

    if (!allowed) throw ApiError.notFound('File not found');

    if (user.role === 'ADMIN' || file.visibility !== 'PUBLIC') {
      await writeAudit({
        actorId: user.id,
        actorLabel: user.id,
        actorRole: user.role,
        action: 'FileDownloaded',
        entity: `FileObject ${file.id}`,
        severity: 'INFO',
        description: `Downloaded ${file.originalName}`,
      });
    }

    const absolute = assertSafePath(file.storageKey);
    await fsp.access(absolute, fs.constants.R_OK).catch(() => {
      throw ApiError.notFound('File not found');
    });
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName.replace(/"/g, '')}"`);
    fs.createReadStream(absolute).pipe(res);
  }),
);

export default router;
