import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

const audience = 'announcement-email-unsubscribe';
export function unsubscribeToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, { algorithm: 'HS256', audience, expiresIn: '365d' });
}
async function userForToken(token: string) {
  let id: string;
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'], audience });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('Invalid token');
    id = payload.sub;
  } catch { throw ApiError.notFound('This unsubscribe link is invalid or expired.'); }
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, role: true } });
  if (!user) throw ApiError.notFound('This unsubscribe link is invalid or expired.');
  return user;
}
export const unsubscribeBody = z.object({ token: z.string().min(1).max(2048) }).strict();
export async function preference(token: string, disable = false) {
  const user = await userForToken(token);
  if (disable) await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM User WHERE id = ${user.id} FOR UPDATE`;
    const previous = await tx.announcementPreference.findUnique({ where: { userId: user.id } });
    if (previous?.emailEnabled === false) return;
    await tx.announcementPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, emailEnabled: false }, update: { emailEnabled: false } });
    await tx.auditLog.create({ data: { actorId: user.id, actorLabel: user.id, actorRole: user.role, action: 'AnnouncementEmailUnsubscribed', entity: 'AnnouncementPreference', severity: 'INFO', description: 'Announcement emails disabled; operational emails are unchanged.' } });
  });
  const row = await prisma.announcementPreference.findUnique({ where: { userId: user.id } });
  return { emailEnabled: row?.emailEnabled ?? true };
}
