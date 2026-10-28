import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import {
  PARTICIPATION_LABELS,
  isCeremonySlug,
  type CeremonyRegistrationInput,
  type CeremonySlug,
  type ParticipationType,
} from '../domain/ceremony-registration';
import { writeAudit } from './audit.service';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { buildPaginatedResult, toSkipTake, type PaginationQuery } from '../utils/pagination';

const received = { received: true as const };

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Logs a stable code only. Prisma messages can repeat the submitted email address. */
function registrationFailure(error: unknown): ApiError {
  const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  logger.error('Ceremony registration could not be saved', code ? { code } : undefined);
  return new ApiError(500, 'Could not save your registration. Please try again.');
}

async function saveInterest(slug: CeremonySlug, emailNormalized: string, input: CeremonyRegistrationInput) {
  const consentAt = new Date();
  const details = {
    fullName: input.fullName,
    email: emailNormalized,
    phone: input.phone,
    institution: input.institution,
    designation: input.designation ?? null,
    participationType: input.participationType,
    message: input.message ?? null,
    consentAt,
  };
  return prisma.$transaction(async (tx) => {
    const saved = await tx.ceremonyRegistration.upsert({
      where: { ceremonySlug_emailNormalized: { ceremonySlug: slug, emailNormalized } },
      create: { ceremonySlug: slug, emailNormalized, ...details },
      update: details,
    });
    await writeAudit({
      actorRole: 'UNAUTHENTICATED',
      action: 'CeremonyInterestRegistered',
      entity: `CeremonyRegistration ${saved.id}`,
      entityType: 'CeremonyRegistration',
      entityId: saved.id,
      module: 'EVENT',
    }, tx);
    return received;
  });
}

/**
 * Records interest for one known ceremony.
 * The same ceremony and email updates the existing row instead of inserting another.
 */
export async function registerCeremonyInterest(slug: string, input: CeremonyRegistrationInput) {
  if (!isCeremonySlug(slug)) throw new ApiError(404, 'Ceremony not found');
  const emailNormalized = input.email.toLowerCase();
  try {
    return await saveInterest(slug, emailNormalized, input);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (!isUniqueConflict(error)) throw registrationFailure(error);
    try {
      return await saveInterest(slug, emailNormalized, input);
    } catch (retryError) {
      if (retryError instanceof ApiError) throw retryError;
      throw registrationFailure(retryError);
    }
  }
}

export async function listCeremonyRegistrations(query: PaginationQuery & { ceremony: CeremonySlug }) {
  const where = { ceremonySlug: query.ceremony };
  const [total, rows] = await prisma.$transaction([
    prisma.ceremonyRegistration.count({ where }),
    prisma.ceremonyRegistration.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      ...toSkipTake(query),
    }),
  ]);
  return buildPaginatedResult(rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    institution: row.institution,
    designation: row.designation,
    participationType: row.participationType as ParticipationType,
    participationLabel: PARTICIPATION_LABELS[row.participationType as ParticipationType] ?? row.participationType,
    message: row.message,
    consentAt: row.consentAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })), total, query);
}
