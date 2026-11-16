import { promises as fsp } from 'node:fs';
import { prisma } from '../config/database';
import { certificateFilename, type CertificatePerson } from '../domain/membership-certificate';
import { renderMembershipCertificate } from './membership-certificate-document';
import { ApiError } from '../utils/ApiError';
import { assertSafePath } from '../utils/fileStorage';
import { logger } from '../utils/logger';

async function portraitBytes(storageKey: string | null | undefined, deletedAt: Date | null | undefined): Promise<Buffer | undefined> {
  if (!storageKey || deletedAt) return undefined;
  try {
    return await fsp.readFile(assertSafePath(storageKey));
  } catch {
    logger.warn('Membership certificate portrait could not be read');
    return undefined;
  }
}

/** Builds the PDF for an approved application. The address and portrait come from the stored profile, never from the request. */
export async function renderApplicationCertificate(applicationId: string): Promise<{ pdf: Buffer; filename: string }> {
  const application = await prisma.membershipApplication.findUnique({
    where: { id: applicationId },
    include: { user: true, profile: { include: { avatar: true } } },
  });
  if (!application || application.user.deletedAt) throw ApiError.notFound('Member application not found');
  if (application.status !== 'APPROVED' || !application.profile.memberId || !application.profile.approvedAt) {
    throw new ApiError(409, 'A membership certificate is available after approval');
  }
  const person: CertificatePerson = {
    fullName: application.user.fullName,
    professionalTitle: application.profile.professionalTitle,
    professionalType: application.profile.professionalType,
    institution: application.profile.institution,
    country: application.profile.country,
    memberId: application.profile.memberId,
    approvedAt: application.profile.approvedAt,
    issuedAt: new Date(),
  };
  const photo = await portraitBytes(application.profile.avatar?.storageKey, application.profile.avatar?.deletedAt);
  const pdf = await renderMembershipCertificate(person, photo);
  return { pdf, filename: certificateFilename(person.memberId) };
}
