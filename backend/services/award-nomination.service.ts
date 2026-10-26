import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import {
  awardLabel,
  type AwardNominationInput,
} from '../domain/award-nomination';
import { isCeremonySlug, type CeremonySlug } from '../domain/ceremony-registration';
import { writeAudit } from './audit.service';
import { sendAwardNominationAcknowledgement } from './mail.service';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { buildPaginatedResult, toSkipTake, type PaginationQuery } from '../utils/pagination';

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function nominationFailure(error: unknown): ApiError {
  const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  logger.error('Award nomination could not be saved', code ? { code } : undefined);
  return new ApiError(500, 'Could not save your nomination. Please try again.');
}

function referenceFor(id: string) {
  return `AWD-2026-${id.slice(-8).toUpperCase()}`;
}

async function saveNomination(slug: CeremonySlug, emailNormalized: string, input: AwardNominationInput) {
  const declaredAt = new Date();
  const details = {
    awardName: awardLabel(input.awardCode),
    division: input.division ?? null,
    nomineeName: input.nomineeName,
    dateOfBirth: input.dateOfBirth,
    nationality: input.nationality,
    qualification: input.qualification,
    designation: input.designation,
    institution: input.institution,
    specialisation: input.specialisation,
    yearsOfContribution: input.yearsOfContribution,
    countryOfResidence: input.countryOfResidence,
    nomineeEmail: emailNormalized,
    nomineePhone: input.nomineePhone,
    orcid: input.orcid ?? null,
    careerOverview: input.careerOverview,
    principalContributions: input.principalContributions,
    impact: input.impact,
    leadership: input.leadership,
    majorAwards: input.majorAwards,
    publications: input.publications,
    patents: input.patents,
    projects: input.projects,
    institutionsEstablished: input.institutionsEstablished,
    societalImpact: input.societalImpact,
    statement: input.statement,
    nominationType: input.nominationType,
    nominatorName: input.nominatorName,
    nominatorDesignation: input.nominatorDesignation,
    nominatorInstitution: input.nominatorInstitution,
    nominatorEmail: input.nominatorEmail.trim().toLowerCase(),
    nominatorPhone: input.nominatorPhone,
    relationship: input.relationship,
    checklistCv: input.checklistCv,
    checklistStatement: input.checklistStatement,
    checklistEvidence: input.checklistEvidence,
    checklistHonours: input.checklistHonours,
    checklistRecommendation: input.checklistRecommendation,
    checklistPhotograph: input.checklistPhotograph,
    checklistConsent: input.checklistConsent,
    declaredAt,
  };
  return prisma.$transaction(async (tx) => {
    const existing = await tx.awardNomination.findUnique({
      where: { ceremonySlug_nomineeEmailNormalized_awardCode: { ceremonySlug: slug, nomineeEmailNormalized: emailNormalized, awardCode: input.awardCode } },
    });
    let saved = existing
      ? await tx.awardNomination.update({ where: { id: existing.id }, data: details })
      : await tx.awardNomination.create({
        data: {
          ceremonySlug: slug,
          nomineeEmailNormalized: emailNormalized,
          awardCode: input.awardCode,
          reference: `AWD-2026-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
          ...details,
        },
      });
    if (!existing) {
      saved = await tx.awardNomination.update({ where: { id: saved.id }, data: { reference: referenceFor(saved.id) } });
    }
    await writeAudit({
      actorRole: 'UNAUTHENTICATED',
      action: 'AwardNominationSubmitted',
      entity: `AwardNomination ${saved.id}`,
      entityType: 'AwardNomination',
      entityId: saved.id,
    }, tx);
    return { saved, created: !existing };
  });
}

export async function submitAwardNomination(slug: string, input: AwardNominationInput) {
  if (!isCeremonySlug(slug)) throw ApiError.notFound('Ceremony not found');
  const emailNormalized = input.nomineeEmail.trim().toLowerCase();
  let result: Awaited<ReturnType<typeof saveNomination>>;
  try {
    result = await saveNomination(slug, emailNormalized, input);
  } catch (error) {
    if (!isUniqueConflict(error)) throw nominationFailure(error);
    try {
      result = await saveNomination(slug, emailNormalized, input);
    } catch (retryError) {
      throw nominationFailure(retryError);
    }
  }
  let acknowledgementSent = false;
  if (result.created) {
    acknowledgementSent = await sendAwardNominationAcknowledgement(result.saved.nominatorEmail, result.saved.reference);
    if (acknowledgementSent) {
      await prisma.awardNomination.update({ where: { id: result.saved.id }, data: { acknowledgementSentAt: new Date() } }).catch(() => {
        logger.error('Award nomination acknowledgement time could not be recorded');
      });
    }
  }
  return { received: true as const, acknowledgementSent };
}

export async function listAwardNominations(query: PaginationQuery & { ceremony: CeremonySlug }) {
  const where = { ceremonySlug: query.ceremony };
  const [items, total] = await prisma.$transaction([
    prisma.awardNomination.findMany({ where, orderBy: { updatedAt: 'desc' }, ...toSkipTake(query) }),
    prisma.awardNomination.count({ where }),
  ]);
  return buildPaginatedResult(items, total, query);
}
