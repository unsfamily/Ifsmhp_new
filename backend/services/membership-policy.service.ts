import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { env } from '../config';
import { prisma } from '../config/database';
import { effectiveSettings } from './settings.service';
import { writeAudit } from './audit.service';
import { ApiError } from '../utils/ApiError';
import { legacyMembershipPolicy, membershipSettings, manualMemberId, isApplicationFeeExempt, normalizePaymentReference, paymentReference, type MembershipPolicy, type MembershipPolicySnapshot } from '../domain/membership';
import { resolveRegistrationDocuments, verifyRegistrationClaimToken, type RegistrationDocumentClaim } from './registration-documents.service';
type DB = Prisma.TransactionClient;
export const policyFor = (value: unknown): MembershipPolicy => value == null ? { ...legacyMembershipPolicy } : membershipSettings.parse(value);
export const requiredKinds = (p: MembershipPolicy): RegistrationDocumentClaim['kind'][] => [...(p.requireProfile ? ['CV' as const] : []), ...(p.requireCredential ? ['CREDENTIAL' as const] : [])];
export async function currentMembershipPolicy(): Promise<MembershipPolicySnapshot> {
  return prisma.$transaction(async tx => ({ values: (await effectiveSettings(tx)).membership, revision: (await tx.settingRevision.findUnique({ where: { section: 'membership' } }))?.revision ?? 0 }));
}
export async function publicMembershipPolicy() {
  const { values: p, revision } = await currentMembershipPolicy();
  return { revision, requireProfile: p.requireProfile, requireCredential: p.requireCredential, referralCount: p.referralCount, referenceLetterCount: p.referenceLetterCount, applicationFeeEnabled: p.applicationFeeEnabled, applicationFee: p.applicationFee, annualDuesEnabled: p.annualDuesEnabled, annualDues: p.annualDues, currency: p.currency, waiversEnabled: p.waiversEnabled, paymentInstructions: p.paymentInstructions, razorpayEnabled: env.razorpayConfigured && p.currency === 'INR' };
}
export interface RegistrationEvidence {
  documents: RegistrationDocumentClaim[];
  referrals?: { name: string; email: string; organization: string }[];
  referenceLetters?: { fileId: string; claimToken: string }[];
  waiverReason?: string;
  professionalType?: string;
  paymentReference?: string;
  paymentScreenshot?: { fileId: string; claimToken: string };
}
export async function validateMembershipEvidence(input: RegistrationEvidence, p: MembershipPolicy, db: DB = prisma) {
  const documents = await resolveRegistrationDocuments(input.documents, db, requiredKinds(p));
  const referrals = input.referrals ?? [], claims = input.referenceLetters ?? [];
  if (referrals.length < p.referralCount) throw ApiError.unprocessable('Referrals are required.', [{ field: 'referrals', message: `Provide at least ${p.referralCount} referrals.` }]);
  if (new Set(referrals.map(r => r.email.toLowerCase())).size !== referrals.length) throw ApiError.unprocessable('Duplicate referrers.', [{ field: 'referrals', message: 'Use a different email for each referrer.' }]);
  if (claims.length < p.referenceLetterCount) throw ApiError.unprocessable('Reference letters are required.', [{ field: 'referenceLetters', message: `Upload at least ${p.referenceLetterCount} reference letters.` }]);
  const ids = [...input.documents.map(d => d.fileId), ...claims.map(d => d.fileId), ...(input.paymentScreenshot ? [input.paymentScreenshot.fileId] : [])];
  if (new Set(ids).size !== ids.length) throw ApiError.unprocessable('Each document and letter must use a different file.');
  const letters = [];
  for (const claim of claims) {
    const [resolved] = await resolveRegistrationDocuments([{ ...claim, kind: 'CREDENTIAL' }], db, []);
    letters.push(resolved!);
  }
  if (input.waiverReason && input.professionalType && isApplicationFeeExempt(input.professionalType)) {
    throw ApiError.unprocessable('Students are not charged an application fee.', [{ field: 'waiverReason', message: 'Remove this waiver request.' }]);
  }
  if (input.waiverReason && (!p.waiversEnabled || !p.applicationFeeEnabled)) throw ApiError.unprocessable('Application-fee waivers are not enabled.', [{ field: 'waiverReason', message: 'Remove this waiver request.' }]);
  return { documents, letters, referrals };
}
export async function lockApplication(tx: DB, id: string) {
  // Lock before the first consistent read: MySQL REPEATABLE READ must not retain
  // a snapshot from before a competing payment, approval, or worker committed.
  const candidates = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM MembershipApplication WHERE id = ${id} OR userId = ${id} FOR UPDATE`;
  const candidate = candidates[0];
  if (!candidate) throw ApiError.notFound('Membership application not found');
  return tx.membershipApplication.findUniqueOrThrow({ where: { id: candidate.id }, include: { user: true, profile: { include: { credentials: { include: { file: true } } } }, referrals: true, referenceLetters: { include: { file: true } }, charges: { include: { payments: true, waivers: true, claimedScreenshot: true } } } });
}
type Application = Awaited<ReturnType<typeof lockApplication>>;
export const chargeStatus = (c: { payments: { reversedAt: Date | null }[]; waivers: { status: string }[] }) => c.payments.some(p => !p.reversedAt) ? 'PAID' : c.waivers.some(w => w.status === 'APPROVED') ? 'WAIVED' : 'UNPAID';
/** True when a non-student application still needs a paid/waived APPLICATION charge before membership approval. */
export function applicationFeeOutstanding(
  app: { policySnapshot: unknown; charges?: { kind: string; payments: { reversedAt: Date | null }[]; waivers: { status: string }[] }[] } | null | undefined,
  professionalType: string | null | undefined,
) {
  if (!app?.policySnapshot) return false;
  const p = policyFor(app.policySnapshot);
  if (!p.applicationFeeEnabled || isApplicationFeeExempt(professionalType ?? '')) return false;
  return !(app.charges ?? []).some(c => c.kind === 'APPLICATION' && chargeStatus(c) !== 'UNPAID');
}
export function approvalProblems(app: Application) {
  const problems: string[] = [], p = policyFor(app.policySnapshot);
  if (app.archivedAt) problems.push('Restore the archived application first.');
  // Historical applications were already accepted under the legacy review process.
  if (app.policySnapshot) {
    for (const kind of requiredKinds(p)) if (!app.profile.credentials.some(c => c.credentialType === (kind === 'CV' ? 'CV' : 'Credential') && c.file && !c.file.deletedAt)) problems.push(`Required ${kind === 'CV' ? 'Profile' : 'Credentials'} document is missing.`);
    if (app.referrals.length < p.referralCount || app.referenceLetters.filter(l => !l.file.deletedAt).length < p.referenceLetterCount) problems.push('Required referral evidence is missing.');
    if ((requiredKinds(p).length || p.referralCount || p.referenceLetterCount) && !app.evidenceReviewedAt) problems.push('Confirm that the required documents and references have been reviewed.');
    if (applicationFeeOutstanding(app, app.profile.professionalType)) {
      problems.push('Record the application fee payment or approve a waiver.');
    }
  }
  return problems;
}
/** Storage key for the single automatic counter. The year is not part of the member ID. */
const globalMemberSequenceYear = 0;
export async function issueMembershipId(tx: DB, app: Application, supplied?: string) {
  const p = policyFor(app.policySnapshot);
  if (p.idIssuance === 'MANUAL') {
    const parsed = manualMemberId.safeParse(supplied);
    if (!parsed.success) throw ApiError.unprocessable('Enter a valid member ID.', [{ field: 'memberId', message: 'A unique 3–100 character member ID is required.' }]);
    if (await tx.memberProfile.findUnique({ where: { memberId: parsed.data } })) throw ApiError.conflict('This member ID is already assigned.');
    return parsed.data;
  }
  if (supplied) throw ApiError.unprocessable('This application uses automatic member ID issuance.');
  for (let attempt = 0; attempt < 100; attempt++) {
    const seq = await tx.memberIdSequence.upsert({ where: { year: globalMemberSequenceYear }, create: { year: globalMemberSequenceYear, nextNumber: 2 }, update: { nextNumber: { increment: 1 } } });
    const memberId = `${p.idPrefix}-${String(seq.nextNumber - 1).padStart(p.idPadding, '0')}`;
    if (!await tx.memberProfile.findUnique({ where: { memberId } })) return memberId;
  }
  throw ApiError.conflict('Unable to allocate an unused member ID. Change the prefix or retry.');
}
async function audit(tx: DB, actorId: string | undefined, action: string, id: string) {
  await writeAudit({ actorId, actorRole: actorId ? undefined : 'SYSTEM', action, entity: `MembershipApplication ${id}`, entityType: 'MembershipApplication', entityId: id }, tx);
}
export async function createCharge(tx: DB, appId: string, kind: 'APPLICATION' | 'ANNUAL', p: MembershipPolicy, start: Date, actorId?: string) {
  const periodYear = kind === 'APPLICATION' ? 0 : start.getUTCFullYear();
  const key = { applicationId: appId, kind, periodYear };
  const existing = await tx.membershipCharge.findUnique({ where: { applicationId_kind_periodYear: key } });
  if (existing) return existing;
  const charge = await tx.membershipCharge.create({ data: { ...key, amount: kind === 'APPLICATION' ? p.applicationFee : p.annualDues, currency: p.currency, dueAt: kind === 'APPLICATION' ? start : new Date(+start + 30 * 86400000) } });
  await audit(tx, actorId, 'MembershipChargeCreated', appId);
  return charge;
}
export async function membershipDetail(id: string, ownUserId?: string) {
  return prisma.$transaction(async tx => {
    // Read-only transaction; do not take mutation locks for viewing.
    const app = await tx.membershipApplication.findFirst({ where: { OR: [{ id }, { userId: id }], ...(ownUserId ? { userId: ownUserId } : {}) }, include: { user: true, profile: { include: { credentials: { include: { file: true } } } }, referrals: true, referenceLetters: { include: { file: true } }, charges: { include: { payments: true, waivers: true, claimedScreenshot: true }, orderBy: { createdAt: 'desc' } } } });
    if (!app && ownUserId) {
      const historical = await tx.user.findUnique({ where: { id: ownUserId }, select: { role: true, status: true, memberProfile: { select: { memberId: true } } } });
      if (historical?.role === 'MEMBER') return { applicationId: '', applicationCode: '', status: historical.status, memberId: historical.memberProfile?.memberId ?? null, archivedAt: null, archiveSuppressed: false, evidenceReviewedAt: null, applicationFeeExempt: false, razorpayEnabled: false, policy: { paymentInstructions: '', waiversEnabled: false }, charges: [] };
    }
    if (!app) throw ApiError.notFound('Membership application not found');
    const p = policyFor(app.policySnapshot);
    const applicationFeeExempt = isApplicationFeeExempt(app.profile.professionalType);
    const hasUnpaid = app.charges.some(c => chargeStatus(c) === 'UNPAID');
    const payOnline = env.razorpayConfigured && p.currency === 'INR';
    return { applicationId: app.id, applicationCode: app.applicationCode, status: app.status, memberId: app.profile.memberId, archivedAt: app.archivedAt, archiveSuppressed: app.archiveSuppressed,
      applicationFeeExempt, razorpayEnabled: env.razorpayConfigured,
      policy: ownUserId ? { paymentInstructions: hasUnpaid && !payOnline ? p.paymentInstructions : '', waiversEnabled: p.waiversEnabled } : p,
      evidenceReviewedAt: app.evidenceReviewedAt, approvalProblems: ownUserId ? undefined : approvalProblems(app),
      referrals: ownUserId ? undefined : app.referrals.map(r => ({ id: r.id, name: r.name, email: r.email, organization: r.organization })),
      letters: ownUserId ? undefined : app.referenceLetters.map(l => ({ id: l.id, fileId: l.fileId, name: l.file.originalName })),
      charges: app.charges.map(c => ({ id: c.id, kind: c.kind, periodYear: c.periodYear, amount: c.amount.toFixed(2), currency: c.currency, dueAt: c.dueAt, status: chargeStatus(c), overdue: chargeStatus(c) === 'UNPAID' && c.dueAt < new Date(), claimedReference: c.claimedReference, claimedAt: c.claimedAt, claimedScreenshot: c.claimedScreenshot && !c.claimedScreenshot.deletedAt ? { fileId: c.claimedScreenshot.id, name: c.claimedScreenshot.originalName } : null, payments: c.payments.map(x => ({ id: x.id, reference: x.reference, createdAt: x.createdAt, reversedAt: x.reversedAt, correctionReason: x.correctionReason })), waivers: c.waivers.map(w => ({ id: w.id, status: w.status, reason: w.reason, decisionReason: w.decisionReason, createdAt: w.createdAt })) })) };
  });
}
export async function reviewEvidence(id: string, actorId: string) {
  await prisma.$transaction(async tx => {
    const app = await lockApplication(tx, id);
    if (!['PENDING', 'UNDER_REVIEW'].includes(app.status) || app.archivedAt) throw ApiError.conflict('Only pending applications can be reviewed.');
    const problems = approvalProblems({ ...app, evidenceReviewedAt: new Date() }).filter(p => !p.startsWith('Record the application fee'));
    if (problems.length) throw ApiError.unprocessable(problems.join(' '));
    if (!app.evidenceReviewedAt) {
      await tx.membershipApplication.update({ where: { id: app.id }, data: { evidenceReviewedAt: new Date(), evidenceReviewedBy: actorId } });
      await audit(tx, actorId, 'MembershipEvidenceReviewed', app.id);
    }
  });
  return membershipDetail(id);
}
const screenshotMimes = new Set(['image/jpeg', 'image/png']);
async function loadPaymentScreenshot(tx: DB, input?: { fileId?: string; claimToken?: string }) {
  if (!input?.fileId || !input.claimToken) throw ApiError.unprocessable('Upload a payment screenshot.', [{ field: 'paymentScreenshot', message: 'A JPEG or PNG screenshot of the payment is required.' }]);
  const file = await tx.fileObject.findUnique({ where: { id: input.fileId } });
  if (!file || file.deletedAt) throw ApiError.unprocessable('Uploaded screenshot is no longer available.', [{ field: 'paymentScreenshot', message: 'Remove it and upload the screenshot again.' }]);
  if (!screenshotMimes.has(file.mimeType) || file.sizeBytes > 10 * 1024 * 1024) throw ApiError.unprocessable('Payment screenshot must be a JPEG or PNG under 10 MB.', [{ field: 'paymentScreenshot', message: 'Upload a JPEG or PNG screenshot.' }]);
  if (!verifyRegistrationClaimToken(file, input.claimToken)) throw ApiError.unprocessable('Uploaded screenshot could not be verified.', [{ field: 'paymentScreenshot', message: 'Remove it and upload the screenshot again.' }]);
  return file;
}
/** Non-students owe the fee on the registration form: a UTR and a JPEG or PNG screenshot. Students and fee-free policies must not send either. */
export async function assertRegistrationPayment(input: { professionalType?: string; paymentReference?: string; paymentScreenshot?: { fileId: string; claimToken: string } }, p: MembershipPolicy, db: DB = prisma) {
  const charged = p.applicationFeeEnabled && !isApplicationFeeExempt(input.professionalType ?? '');
  if (!charged) {
    if (input.paymentReference || input.paymentScreenshot) throw ApiError.unprocessable('No application fee is due.', [{ field: 'paymentReference', message: 'Remove the payment details.' }]);
    return;
  }
  // Razorpay collects the fee after email verification. A client may still send an offline claim.
  if (env.razorpayConfigured && p.currency === 'INR' && !input.paymentReference && !input.paymentScreenshot) return;
  const reference = paymentReference.safeParse(input.paymentReference ?? '');
  if (!reference.success) throw ApiError.unprocessable('Enter the UTR or UPI payment reference.', [{ field: 'paymentReference', message: reference.error.issues[0]?.message ?? 'Enter the UTR or UPI reference.' }]);
  await loadPaymentScreenshot(db, input.paymentScreenshot);
}
async function attachPaymentScreenshot(tx: DB, actorId: string, input: { fileId?: string; claimToken?: string }) {
  const file = await loadPaymentScreenshot(tx, input);
  if (file.uploaderId && file.uploaderId !== actorId) throw ApiError.conflict('This screenshot was already claimed. Upload it again.');
  if (!file.uploaderId) {
    const claimed = await tx.fileObject.updateMany({ where: { id: file.id, uploaderId: null, deletedAt: null }, data: { uploaderId: actorId } });
    if (!claimed.count) throw ApiError.conflict('This screenshot was already claimed. Upload it again.');
  }
  return file.id;
}
export async function recordRegistrationPayment(tx: DB, actorId: string, chargeId: string, input: { paymentReference?: string; paymentScreenshot?: { fileId: string; claimToken: string } }) {
  const screenshotFileId = await attachPaymentScreenshot(tx, actorId, input.paymentScreenshot ?? {});
  await tx.membershipCharge.update({ where: { id: chargeId }, data: { claimedReference: input.paymentReference!, claimedAt: new Date(), claimedRequestId: randomUUID(), claimedScreenshotFileId: screenshotFileId } });
}
export async function changeCharge(id: string, chargeId: string, actorId: string, action: 'CLAIM' | 'PAY' | 'REVERSE' | 'REQUEST_WAIVER' | 'DECIDE_WAIVER', input: { requestId?: string; reference?: string; reason?: string; recordId?: string; status?: 'APPROVED' | 'REJECTED' | 'REVOKED'; fileId?: string; claimToken?: string }, own = false) {
  await prisma.$transaction(async tx => {
    const app = await lockApplication(tx, id);
    if (own && app.userId !== actorId) throw ApiError.notFound('Membership charge not found');
    // Own-session callers may claim a UTR or request a waiver only — never settle, reverse, or decide.
    if (own && action !== 'CLAIM' && action !== 'REQUEST_WAIVER') throw ApiError.forbidden('Only an administrator can settle or decide membership charges.');
    const charge = app.charges.find(c => c.id === chargeId);
    if (!charge) throw ApiError.notFound('Membership charge not found');
    if (action === 'CLAIM') {
      // Applicant/admin can submit a UTR for matching. This never settles the charge or approves membership.
      if (app.status === 'REJECTED') throw ApiError.conflict('This application was rejected.');
      if (chargeStatus(charge) !== 'UNPAID') throw ApiError.conflict('This charge is already settled.');
      if (charge.claimedRequestId === input.requestId!) {
        if (charge.claimedReference !== input.reference || charge.claimedScreenshotFileId !== input.fileId) throw ApiError.conflict('This request ID was already used.');
        return;
      }
      const reused = await tx.membershipCharge.findUnique({ where: { claimedRequestId: input.requestId! } });
      if (reused && reused.id !== charge.id) throw ApiError.conflict('This request ID was already used.');
      const screenshotFileId = await attachPaymentScreenshot(tx, actorId, input);
      await tx.membershipCharge.update({ where: { id: charge.id }, data: { claimedReference: input.reference!, claimedAt: new Date(), claimedRequestId: input.requestId!, claimedScreenshotFileId: screenshotFileId } });
    } else if (action === 'PAY') {
      const previous = await tx.membershipPayment.findUnique({ where: { requestId: input.requestId! } });
      if (previous) { if (previous.chargeId !== charge.id || previous.reference !== input.reference) throw ApiError.conflict('This request ID was already used.'); return; }
      if (chargeStatus(charge) !== 'UNPAID') throw ApiError.conflict('This charge is already settled.');
      // Offline validation: admin confirms the bank credit. When the applicant already
      // submitted a UTR, the recorded reference must match that claim (update the claim first if needed).
      if (charge.claimedReference && normalizePaymentReference(charge.claimedReference) !== normalizePaymentReference(input.reference!)) {
        throw ApiError.unprocessable('Recorded payment reference must match the applicant UTR.', [{ field: 'reference', message: 'Must match the submitted UTR / UPI reference, or update the claim first.' }]);
      }
      await tx.membershipPayment.create({ data: { chargeId, requestId: input.requestId!, reference: input.reference!, recordedBy: actorId } });
    } else if (action === 'REVERSE') {
      const payment = charge.payments.find(p => p.id === input.recordId);
      if (!payment) throw ApiError.notFound('Payment not found');
      if (payment.reversedAt) return;
      await tx.membershipPayment.update({ where: { id: payment.id }, data: { reversedAt: new Date(), reversedBy: actorId, correctionReason: input.reason! } });
    } else if (action === 'REQUEST_WAIVER') {
      if (!policyFor(app.policySnapshot).waiversEnabled) throw ApiError.unprocessable('Waivers are not enabled for this application.');
      const previous = await tx.membershipWaiver.findUnique({ where: { requestId: input.requestId! } });
      if (previous) { if (previous.chargeId !== charge.id || previous.requestedBy !== actorId || previous.reason !== input.reason) throw ApiError.conflict('This request ID was already used.'); return; }
      if (chargeStatus(charge) !== 'UNPAID' || charge.waivers.some(w => w.status === 'PENDING')) throw ApiError.conflict('This charge is settled or already has a pending waiver.');
      if (app.status === 'REJECTED') throw ApiError.conflict('This application was rejected.');
      await tx.membershipWaiver.create({ data: { chargeId, requestId: input.requestId!, reason: input.reason!, requestedBy: actorId } });
    } else {
      const waiver = charge.waivers.find(w => w.id === input.recordId);
      if (!waiver) throw ApiError.notFound('Waiver not found');
      if (waiver.status === input.status) return;
      if (input.status === 'REVOKED' ? waiver.status !== 'APPROVED' : waiver.status !== 'PENDING') throw ApiError.conflict('This waiver has already been decided.');
      if (input.status === 'APPROVED' && chargeStatus(charge) !== 'UNPAID') throw ApiError.conflict('This charge is already settled.');
      await tx.membershipWaiver.update({ where: { id: waiver.id }, data: { status: input.status, decidedAt: new Date(), decidedBy: actorId, decisionReason: input.reason! } });
    }
    await audit(tx, actorId, { CLAIM: 'MembershipPaymentClaimed', PAY: 'MembershipPaymentRecorded', REVERSE: 'MembershipPaymentCorrected', REQUEST_WAIVER: 'MembershipWaiverRequested', DECIDE_WAIVER: 'MembershipWaiverDecided' }[action], app.id);
  }).catch(error => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'This request identifier was already used.', [{ field: 'requestId', message: 'Use a new request identifier for a different operation.' }]); throw error; });
  return membershipDetail(id, own ? actorId : undefined);
}
export async function restoreArchive(id: string, actorId: string, enableAgain = false) {
  await prisma.$transaction(async tx => {
    const app = await lockApplication(tx, id);
    if (app.status !== 'REJECTED') throw ApiError.conflict('Only rejected applications can be restored from the archive.');
    await tx.membershipApplication.update({ where: { id: app.id }, data: { archivedAt: null, archiveSuppressed: !enableAgain } });
    await audit(tx, actorId, 'MembershipArchiveRestored', app.id);
  });
  return membershipDetail(id);
}
export function anniversary(start: Date, year: number) {
  const day = Math.min(start.getUTCDate(), new Date(Date.UTC(year, start.getUTCMonth() + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, start.getUTCMonth(), day, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), start.getUTCMilliseconds()));
}
export async function runMembershipJobs(now = new Date()) {
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.membershipApplication.findMany({ where: { policyRevision: { not: null }, status: { in: ['APPROVED', 'REJECTED'] } }, select: { id: true }, orderBy: { id: 'asc' }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (!batch.length) break;
    for (const row of batch) await prisma.$transaction(async tx => {
      const app = await lockApplication(tx, row.id), p = policyFor(app.policySnapshot);
      if (app.status === 'REJECTED' && p.autoArchive && !app.archivedAt && !app.archiveSuppressed && app.reviewedAt && +app.reviewedAt + p.archiveAfterDays * 86400000 <= +now) {
        await tx.membershipApplication.update({ where: { id: app.id }, data: { archivedAt: now } });
        await audit(tx, undefined, 'MembershipArchived', app.id);
      }
      if (app.status === 'APPROVED' && app.user.status === 'ACTIVE' && !app.user.deletedAt && p.annualDuesEnabled && app.profile.approvedAt) {
        for (let year = app.profile.approvedAt.getUTCFullYear(); year <= now.getUTCFullYear(); year++) {
          const due = anniversary(app.profile.approvedAt, year);
          if (due <= now) await createCharge(tx, app.id, 'ANNUAL', p, due);
        }
      }
    });
    cursor = batch.at(-1)!.id;
  }
}
