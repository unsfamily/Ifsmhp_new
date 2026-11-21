import { randomUUID } from 'node:crypto';
import { Prisma, type AwardNomination } from '@prisma/client';
import { prisma } from '../config/database';
import {
  awardDivisionLabel,
  awardLabel,
  nominationTypeLabel,
  type AwardNominationInput,
} from '../domain/award-nomination';
import { isCeremonySlug, type CeremonySlug } from '../domain/ceremony-registration';
import { writeAudit } from './audit.service';
import { sendAwardNominationAcknowledgement } from './mail.service';
import { verifyRegistrationClaimToken, REGISTRATION_MAX_BYTES } from './registration-documents.service';
import { ApiError } from '../utils/ApiError';
import { toCsv } from '../utils/csv';
import { toExcelSheet } from '../utils/excel-sheet';
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

const CV_MIME = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const PHOTO_MIME = new Set(['image/jpeg', 'image/png']);

async function nominationFile(claim: { fileId: string; claimToken: string }, kind: 'cv' | 'photo') {
  const file = await prisma.fileObject.findUnique({ where: { id: claim.fileId } });
  const allowed = kind === 'cv' ? CV_MIME : PHOTO_MIME;
  const message = kind === 'cv' ? 'Upload a PDF, DOC, or DOCX CV under 5 MB.' : 'Upload a JPG or PNG photograph under 5 MB.';
  if (!file || file.deletedAt || file.uploaderId || !verifyRegistrationClaimToken(file, claim.claimToken)) {
    throw ApiError.unprocessable('Uploaded document could not be verified.', [{ field: kind, message: 'Remove it and upload the file again.' }]);
  }
  if (!allowed.has(file.mimeType) || file.sizeBytes > REGISTRATION_MAX_BYTES) {
    throw ApiError.unprocessable(message, [{ field: kind, message }]);
  }
  return file;
}

async function saveNomination(slug: CeremonySlug, emailNormalized: string, input: AwardNominationInput) {
  if (input.cv.fileId === input.photo.fileId) {
    throw ApiError.unprocessable('Upload a separate CV and photograph.', [{ field: 'photo', message: 'Use a different file for the photograph.' }]);
  }
  const [cv, photo] = await Promise.all([
    nominationFile(input.cv, 'cv'),
    nominationFile(input.photo, 'photo'),
  ]);
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
    checklistCv: true,
    checklistStatement: true,
    checklistEvidence: false,
    checklistHonours: false,
    checklistRecommendation: false,
    checklistPhotograph: true,
    checklistConsent: false,
    cvFileId: cv.id,
    photoFileId: photo.id,
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
    if (error instanceof ApiError) throw error;
    if (!isUniqueConflict(error)) throw nominationFailure(error);
    try {
      result = await saveNomination(slug, emailNormalized, input);
    } catch (retryError) {
      if (retryError instanceof ApiError) throw retryError;
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

const nominationListSelect = {
  id: true,
  reference: true,
  awardName: true,
  division: true,
  nomineeName: true,
  nomineeEmail: true,
  nominatorName: true,
  nominatorEmail: true,
  acknowledgementSentAt: true,
  updatedAt: true,
} satisfies Prisma.AwardNominationSelect;

export async function listAwardNominations(query: PaginationQuery & { ceremony: CeremonySlug }) {
  const where = { ceremonySlug: query.ceremony };
  const [items, total] = await prisma.$transaction([
    prisma.awardNomination.findMany({ where, orderBy: { updatedAt: 'desc' }, select: nominationListSelect, ...toSkipTake(query) }),
    prisma.awardNomination.count({ where }),
  ]);
  return buildPaginatedResult(items, total, query);
}

export async function getAwardNomination(id: string) {
  const row = await prisma.awardNomination.findUnique({ where: { id } });
  if (!row) throw ApiError.notFound('Nomination not found');
  const { nomineeEmailNormalized, ...detail } = row;
  void nomineeEmailNormalized;
  return detail;
}

export async function deleteAwardNomination(id: string, actorId: string) {
  const existing = await prisma.awardNomination.findUnique({ where: { id }, select: { id: true, reference: true } });
  if (!existing) throw ApiError.notFound('Nomination not found');
  try {
    await prisma.$transaction(async (tx) => {
      await tx.awardNomination.delete({ where: { id } });
      await writeAudit({
        actorId,
        action: 'AwardNominationDeleted',
        entity: `AwardNomination ${existing.reference}`,
        entityType: 'AwardNomination',
        entityId: existing.id,
        outcome: 'SUCCEEDED',
      }, tx);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw ApiError.notFound('Nomination not found');
    throw error;
  }
  return { id: existing.id, reference: existing.reference };
}

const AWARD_NOMINATION_EXPORT_LIMIT = 10000;

const awardNominationExportHeaders = [
  'Reference',
  'Award',
  'Award code',
  'Division',
  'Nomination type',
  'Nominee name',
  'Nominee email',
  'Nominee phone',
  'Date of birth',
  'Nationality',
  'Country of residence',
  'Qualification',
  'Designation',
  'Institution',
  'Specialisation',
  'Years of contribution',
  'ORCID',
  'Career overview',
  'Principal contributions',
  'Impact',
  'Leadership',
  'Major awards',
  'Publications',
  'Patents',
  'Projects',
  'Institutions established',
  'Societal impact',
  'Statement',
  'Nominator name',
  'Nominator designation',
  'Nominator institution',
  'Nominator email',
  'Nominator phone',
  'Relationship',
  'CV included',
  'Statement included',
  'Evidence included',
  'Honours included',
  'Recommendation included',
  'Photograph included',
  'Consent confirmed',
  'Declared at',
  'Acknowledgement sent at',
  'Submitted at',
  'Updated at',
];

function included(value: boolean) {
  return value ? 'Yes' : 'No';
}

function awardNominationExportCells(row: AwardNomination): unknown[] {
  return [
    row.reference,
    row.awardName,
    row.awardCode,
    awardDivisionLabel(row.division),
    nominationTypeLabel(row.nominationType),
    row.nomineeName,
    row.nomineeEmail,
    row.nomineePhone,
    row.dateOfBirth,
    row.nationality,
    row.countryOfResidence,
    row.qualification,
    row.designation,
    row.institution,
    row.specialisation,
    row.yearsOfContribution,
    row.orcid ?? '',
    row.careerOverview,
    row.principalContributions,
    row.impact,
    row.leadership,
    row.majorAwards,
    row.publications,
    row.patents,
    row.projects,
    row.institutionsEstablished,
    row.societalImpact,
    row.statement,
    row.nominatorName,
    row.nominatorDesignation,
    row.nominatorInstitution,
    row.nominatorEmail,
    row.nominatorPhone,
    row.relationship,
    included(row.checklistCv),
    included(row.checklistStatement),
    included(row.checklistEvidence),
    included(row.checklistHonours),
    included(row.checklistRecommendation),
    included(row.checklistPhotograph),
    included(row.checklistConsent),
    row.declaredAt,
    row.acknowledgementSentAt,
    row.createdAt,
    row.updatedAt,
  ];
}

/** Every saved nomination for one ceremony. The list page is paginated; this export is not. */
export async function exportAwardNominations(query: { ceremony: CeremonySlug; format: 'csv' | 'xlsx' }) {
  const where = { ceremonySlug: query.ceremony };
  const total = await prisma.awardNomination.count({ where });
  if (total > AWARD_NOMINATION_EXPORT_LIMIT) {
    throw ApiError.unprocessable(`One export holds ${AWARD_NOMINATION_EXPORT_LIMIT} nominations, and ${total} are saved.`);
  }
  const rows = await prisma.awardNomination.findMany({ where, orderBy: { updatedAt: 'desc' } });
  const cells = rows.map(awardNominationExportCells);
  const day = new Date().toISOString().slice(0, 10);
  switch (query.format) {
    case 'csv': {
      const columns = awardNominationExportHeaders.map((label, index) => ({ key: String(index), label }));
      const csvRows = cells.map((row) => Object.fromEntries(row.map((value, index) => [String(index), value])));
      return { filename: `ifsmhp-award-nominations-${day}.csv`, body: toCsv(columns, csvRows), rows: rows.length, format: 'csv' as const };
    }
    case 'xlsx':
      return {
        filename: `ifsmhp-award-nominations-${day}.xlsx`,
        body: toExcelSheet('Award nominations', awardNominationExportHeaders, cells),
        rows: rows.length,
        format: 'xlsx' as const,
      };
    default: {
      const unknown: never = query.format;
      throw ApiError.unprocessable(`Unsupported export format: ${String(unknown)}`);
    }
  }
}
