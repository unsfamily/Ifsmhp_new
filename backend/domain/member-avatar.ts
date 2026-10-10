import { env } from '../config';

export const memberAvatarPolicy = {
  maxBytes: env.MEMBER_AVATAR_MAX_UPLOAD_MB * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  extensions: ['jpg', 'jpeg', 'png', 'webp'],
};
