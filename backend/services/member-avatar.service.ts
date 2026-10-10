import { prisma } from '../config/database';
import { memberAvatarPolicy } from '../domain/member-avatar';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { writeAudit } from './audit.service';
import { createAvatarUpload, storeAvatar, purgeAvatars, streamAvatar } from './avatar-storage.service';

export const memberAvatarUpload = createAvatarUpload(memberAvatarPolicy.maxBytes);

export async function replaceMemberAvatar(userId: string, file?: Express.Multer.File) {
  const result = await storeAvatar(file, memberAvatarPolicy.maxBytes, data => prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findFirst({ where: { id: userId, role: 'MEMBER', status: 'ACTIVE', deletedAt: null } });
    if (!user) throw new ApiError(401, 'An active member account is required.');
    const previous = await tx.memberProfile.findUnique({ where: { userId } });
    if (!previous) throw ApiError.notFound('Profile not found');
    const record = await tx.fileObject.create({ data: { ...data, uploaderId: userId } });
    await tx.memberProfile.update({ where: { userId }, data: { avatarFileId: record.id } });
    if (previous.avatarFileId) await tx.fileObject.update({ where: { id: previous.avatarFileId }, data: { deletedAt: new Date() } });
    await writeAudit({ actorId: userId, action: 'UserProfileUpdated', entity: `MemberProfile ${previous.id}`, metadata: { changedFields: ['avatarFileId'], fileId: record.id } }, tx);
    return { avatarFileId: record.id };
  }));
  await purgeAvatars().catch(error => logger.error('Avatar cleanup pending retry', { error: String(error) }));
  return result;
}

export const streamMemberAvatar = streamAvatar(async userId =>
  (await prisma.memberProfile.findUnique({ where: { userId }, select: { avatarFileId: true } }))?.avatarFileId ?? null);
