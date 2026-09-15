import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config';
import { ApiError } from './ApiError';

/**
 * Where uploaded bytes live on disk.
 *
 * Shared rather than private to the files router because the public
 * publications route streams manuscripts too, and both paths must agree on the
 * root they resolve against — two copies of this would be two chances to drift.
 */
export const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_STORAGE_PATH);
fs.mkdirSync(uploadRoot, { recursive: true });

/**
 * Resolves a stored key to an absolute path, refusing anything that escapes the
 * upload root. `storageKey` comes from the database rather than the request, but
 * a traversal sequence that ever reached that column would otherwise read any
 * file the process can.
 */
export function assertSafePath(storageKey: string): string {
  const absolute = path.resolve(uploadRoot, storageKey);
  if (!absolute.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new ApiError(400, 'Invalid file path');
  }
  return absolute;
}
