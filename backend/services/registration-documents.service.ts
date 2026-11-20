import crypto from 'node:crypto';
import type { FileObject, Prisma, PrismaClient } from '@prisma/client';
import { env } from '../config';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

export type RegistrationDocumentKind = 'CV' | 'CREDENTIAL' | 'PHOTO';

export interface RegistrationDocumentClaim {
  kind: RegistrationDocumentKind;
  fileId: string;
  claimToken: string;
}

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const DOCUMENT_KINDS: RegistrationDocumentKind[] = ['CV', 'CREDENTIAL', 'PHOTO'];
const DEFAULT_REQUIRED: RegistrationDocumentKind[] = ['CV', 'CREDENTIAL', 'PHOTO'];
export const REGISTRATION_MAX_BYTES = 5 * 1024 * 1024;
export const REGISTRATION_MAX_MB = 5;
const photographMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const missingDocumentMessage: Record<RegistrationDocumentKind, string> = {
  CV: 'Upload your CV.',
  CREDENTIAL: 'Upload your Credentials / Certifications / ID Card.',
  PHOTO: 'Upload your photograph.',
};

export const registrationAllowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const registrationAllowedExtensions = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp']);

function claimSignature(file: Pick<FileObject, 'id' | 'storageKey' | 'checksum' | 'sizeBytes' | 'mimeType'>) {
  return crypto
    .createHmac('sha256', env.JWT_REFRESH_SECRET)
    .update([file.id, file.storageKey, file.checksum ?? '', file.sizeBytes, file.mimeType].join(':'))
    .digest('base64url');
}

export function createRegistrationClaimToken(
  file: Pick<FileObject, 'id' | 'storageKey' | 'checksum' | 'sizeBytes' | 'mimeType'>,
) {
  return `regdoc.${claimSignature(file)}`;
}

export function verifyRegistrationClaimToken(
  file: Pick<FileObject, 'id' | 'storageKey' | 'checksum' | 'sizeBytes' | 'mimeType'>,
  token: string,
) {
  const expected = createRegistrationClaimToken(file);
  const left = Buffer.from(expected);
  const right = Buffer.from(token);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validateClaimShape(documents: RegistrationDocumentClaim[] | undefined, required: RegistrationDocumentKind[]) {
  if (!Array.isArray(documents)) throw ApiError.unprocessable('Required documents are missing', [{ field: 'documents', message: 'Upload the required documents.' }]);
  const seen = new Set<string>();
  for (const doc of documents) {
    if (!DOCUMENT_KINDS.includes(doc.kind) || seen.has(doc.kind)) throw ApiError.unprocessable('Invalid document type', [{ field: `documents.${doc.kind}`, message: 'Supply at most one file for each document type.' }]);
    seen.add(doc.kind);
  }
  for (const kind of required) if (!seen.has(kind)) throw ApiError.unprocessable('Required documents are missing', [{ field: `documents.${kind}`, message: missingDocumentMessage[kind] }]);
  if (new Set(documents.map(d => d.fileId)).size !== documents.length) throw ApiError.unprocessable('Use a different file for each document.');
}

export async function resolveRegistrationDocuments(
  documents: RegistrationDocumentClaim[] | undefined,
  db: PrismaLike = prisma,
  required: RegistrationDocumentKind[] = DEFAULT_REQUIRED,
) {
  validateClaimShape(documents, required);
  const resolved: Array<RegistrationDocumentClaim & { file: FileObject }> = [];

  for (const claim of documents!) {
    const file = await db.fileObject.findUnique({ where: { id: claim.fileId } });
    if (!file || file.deletedAt || file.uploaderId) {
      throw new ApiError(422, 'Uploaded document is no longer available', [
        { field: `documents.${claim.kind}`, message: 'Remove this document and upload it again.' },
      ]);
    }
    if (!registrationAllowedMimeTypes.has(file.mimeType) || file.sizeBytes > REGISTRATION_MAX_BYTES) {
      throw new ApiError(422, 'Uploaded document is not valid', [
        { field: `documents.${claim.kind}`, message: `Remove this document and upload a supported file under ${REGISTRATION_MAX_MB} MB.` },
      ]);
    }
    if (claim.kind === 'PHOTO' && !photographMimeTypes.has(file.mimeType)) {
      throw new ApiError(422, 'The member photograph must be an image', [
        { field: 'documents.PHOTO', message: `Upload a JPEG, PNG, or WebP photograph under ${REGISTRATION_MAX_MB} MB.` },
      ]);
    }
    if (!verifyRegistrationClaimToken(file, claim.claimToken)) {
      throw new ApiError(422, 'Uploaded document could not be verified', [
        { field: `documents.${claim.kind}`, message: 'Remove this document and upload it again.' },
      ]);
    }
    resolved.push({ ...claim, file });
  }

  return resolved;
}

const documentTitles: Record<RegistrationDocumentKind, string> = {
  CV: 'CV',
  CREDENTIAL: 'Credentials / Certifications / ID Card',
  PHOTO: 'Member photograph',
};

const documentTypes: Record<RegistrationDocumentKind, string> = {
  CV: 'CV',
  CREDENTIAL: 'Credential',
  PHOTO: 'Photograph',
};

export function registrationDocumentTitle(kind: RegistrationDocumentKind) {
  return documentTitles[kind];
}

export function registrationDocumentType(kind: RegistrationDocumentKind) {
  return documentTypes[kind];
}
