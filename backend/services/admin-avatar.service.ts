import { env } from '../config';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { lockAdmin, getProfile } from './admin-profile.service';
import { writeAudit } from './audit.service';
import { createAvatarUpload, storeAvatar, purgeAvatars, streamAvatar as streamStoredAvatar } from './avatar-storage.service';
export { purgeAvatars, authorizeAvatar } from './avatar-storage.service';

const maxBytes = env.ADMIN_AVATAR_MAX_UPLOAD_MB * 1024 * 1024;
export const avatarUpload = createAvatarUpload(maxBytes, 1);
export async function replaceAvatar(userId: string, expectedRevision: number, file?: Express.Multer.File) {
  await storeAvatar(file, maxBytes, async data => {
    await prisma.$transaction(async tx => {
      await lockAdmin(tx, userId);
      const previous = await tx.adminProfile.findUnique({ where: { userId } });
      if ((previous?.revision ?? 0) !== expectedRevision) throw ApiError.conflict('Profile changed. Refresh before replacing the avatar.');
      const record = await tx.fileObject.create({ data: { ...data, uploaderId: userId } });
      await tx.adminProfile.upsert({ where: { userId }, create: { userId, avatarFileId: record.id, revision: 1 }, update: { avatarFileId: record.id, revision: { increment: 1 } } });
      if (previous?.avatarFileId) await tx.fileObject.update({ where: { id: previous.avatarFileId }, data: { deletedAt: new Date() } });
      await writeAudit({ actorId: userId, action: 'AdminAvatarUpdated', entity: `User ${userId}`, metadata: { fileId: record.id } }, tx);
    });
  });
  await purgeAvatars().catch(error => logger.error('Avatar cleanup pending retry', { error: String(error) }));
  return getProfile(userId);
}
export const streamAvatar = streamStoredAvatar(async userId =>
  (await prisma.adminProfile.findUnique({ where: { userId }, select: { avatarFileId: true } }))?.avatarFileId ?? null);
