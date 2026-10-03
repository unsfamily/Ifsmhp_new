import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const codes = vi.hoisted(() => new Map<string, string>());
vi.mock('../services/mail.service', () => ({ sendOtpEmail: vi.fn(async (email: string, code: string) => { codes.set(email, code); }), sendApprovalEmail: vi.fn(async () => undefined), verifyTransport: vi.fn() }));
import { prisma } from '../config/database';
import { env } from '../config';
import { createApp } from '../app';
import { sha256, signAccessToken } from '../utils/security';
import { registerApplicant } from '../services/auth.service';
import { legacyMembershipPolicy, type MembershipPolicy } from '../domain/membership';
import { currentMembershipPolicy, runMembershipJobs, anniversary } from '../services/membership-policy.service';
import { updateSettings } from '../services/settings.service';
import type { Request } from 'express';
const app = createApp(), prefix = 'membership-policy-test-', api = '/api/v1';
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
let adminId: string, token: string, auditFail = false;
let original: Awaited<ReturnType<typeof prisma.platformSetting.findMany>>, revisions: Awaited<ReturnType<typeof prisma.settingRevision.findMany>>;
prisma.$use(async (p, next) => { if (auditFail && p.model === 'AuditLog' && p.action === 'create') throw new Error('Injected membership audit failure'); return next(p); });
async function session(userId: string, role: 'ADMIN' | 'APPLICANT' | 'MEMBER') {
  const s = await prisma.session.create({ data: { userId, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 86400000) } });
  return signAccessToken({ sub: userId, role, sessionId: s.id });
}
async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: prefix }, id: { not: adminId ?? '' } }, select: { id: true } });
  const ids = users.map(u => u.id);
  const applications = await prisma.membershipApplication.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: applications.map(a => a.id) } }] } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  const files = await prisma.fileObject.findMany({ where: { originalName: { startsWith: prefix } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: files.map(f => f.id) } } });
  await Promise.all(files.map(f => fs.unlink(path.resolve(env.UPLOAD_STORAGE_PATH, f.storageKey)).catch(() => undefined)));
  await prisma.emailOtp.deleteMany({ where: { email: { startsWith: prefix } } });
}
async function upload() {
  const r = await request(app).post(api + '/files/registration').attach('file', pdf, { filename: `${prefix}${randomUUID()}.pdf`, contentType: 'application/pdf' });
  expect(r.status).toBe(201); return { fileId: r.body.data.id as string, claimToken: r.body.data.claimToken as string };
}
function input(documents: { kind: 'CV' | 'CREDENTIAL'; fileId: string; claimToken: string }[] = []) {
  return { fullName: 'Policy Applicant', firstName: 'Policy', lastName: 'Applicant', email: `${prefix}${randomUUID()}@example.test`, professionalType: 'Researcher', institution: 'Test Institute', credentials: 'Professional research credentials', education: 'Doctoral degree in research', researchInterests: 'Community mental health research', documents, agreeTerms: true as const };
}
async function policy(values: Partial<MembershipPolicy>) {
  const current = await currentMembershipPolicy();
  await updateSettings(adminId, 'membership', current.revision, values);
  return currentMembershipPolicy();
}
async function applicant(values: Partial<MembershipPolicy> = {}, legacy = false) {
  const snap = { revision: 1, values: { ...legacyMembershipPolicy, requireProfile: false, requireCredential: false, ...values } };
  const documents = legacy ? [{ kind: 'CV' as const, ...await upload() }, { kind: 'CREDENTIAL' as const, ...await upload() }] : [];
  const payload = input(documents);
  const registered = await registerApplicant({ ...payload, ...(!legacy ? { membershipPolicy: snap } : {}) }, { get: () => undefined } as unknown as Request);
  const application = await prisma.membershipApplication.findUniqueOrThrow({ where: { userId: registered.user.id } });
  return { ...application, token: await session(registered.user.id, 'APPLICANT') };
}
const post = (id: string, suffix: string, body: unknown = {}, t = token) => request(app).post(`${api}/admin/membership/${id}/${suffix}`).set('Authorization', `Bearer ${t}`).send(body);
const approve = (id: string, memberId?: string) => request(app).post(`${api}/admin/members/${id}/approve`).set('Authorization', `Bearer ${token}`).send({ memberId });
const detail = (id: string) => request(app).get(`${api}/admin/membership/${id}`).set('Authorization', `Bearer ${token}`);
beforeAll(async () => {
  const url = new URL(env.DATABASE_URL); if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw Error('Use isolated test MySQL');
  original = await prisma.platformSetting.findMany(); revisions = await prisma.settingRevision.findMany();
  const admin = await prisma.user.create({ data: { fullName: 'Membership Policy Admin', email: `${prefix}admin@example.test`, role: 'ADMIN', status: 'ACTIVE' } }); adminId = admin.id; token = await session(adminId, 'ADMIN');
});
beforeEach(async () => { auditFail = false; await prisma.platformSetting.deleteMany({ where: { section: 'membership' } }); await prisma.settingRevision.deleteMany({ where: { section: 'membership' } }); });
afterEach(async () => { auditFail = false; await cleanup(); });
afterAll(async () => {
  await prisma.platformSetting.deleteMany(); await prisma.settingRevision.deleteMany();
  if (original.length) await prisma.platformSetting.createMany({ data: original }); if (revisions.length) await prisma.settingRevision.createMany({ data: revisions });
  await prisma.auditLog.deleteMany({ where: { actorId: adminId } }); await prisma.user.delete({ where: { id: adminId } }); await prisma.$disconnect();
});
describe('Membership settings, registration and review', () => {
  it('persists every new setting and exposes only applicant policy fields', async () => {
    const values = { ...legacyMembershipPolicy, idIssuance: 'MANUAL' as const, idPrefix: 'FORUM', idPadding: 8, requireProfile: false, requireCredential: false, applicationFeeEnabled: true, applicationFee: '125.50', annualDuesEnabled: true, annualDues: '500.00', currency: 'USD' as const, paymentInstructions: 'Pay externally using your application code.', waiversEnabled: true, referralCount: 2, referenceLetterCount: 2, autoArchive: true, archiveAfterDays: 45 };
    await policy(values); expect((await currentMembershipPolicy()).values).toEqual(values);
    const publicResponse = await request(app).get(api + '/public/membership-policy'); expect(publicResponse.status).toBe(200); expect(publicResponse.body.data.applicationFee).toBe('125.50'); expect(publicResponse.body.data.idPrefix).toBeUndefined();
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { actorId: adminId, action: 'PlatformSettingsUpdated' }, orderBy: { createdAt: 'desc' } });
    expect(audit.metadata).toHaveProperty('changedFields'); expect(JSON.stringify(audit)).not.toContain(values.paymentInstructions);
  });
  it.each([{ idPrefix: 'bad prefix' }, { idPadding: 3 }, { idPadding: 11 }, { applicationFee: '-1' }, { applicationFee: '1.999' }, { annualDues: 10 }, { currency: 'XXX' }, { referralCount: 6 }, { referralCount: -1 }, { referenceLetterCount: 6 }, { archiveAfterDays: 0 }, { archiveAfterDays: 3651 }, { applicationFeeEnabled: true }, { applicationFeeEnabled: true, applicationFee: '20' }])('rejects malformed settings %j', async values => {
    const response = await request(app).patch(api + '/admin/settings/membership').set('Authorization', `Bearer ${token}`).send({ expectedRevision: 0, values }); expect(response.status).toBe(422); expect((await currentMembershipPolicy()).revision).toBe(0);
  });
  it('snapshots policy through upload, OTP resend, verification, review and approval', async () => {
    const snap = await policy({ applicationFeeEnabled: true, applicationFee: '100.00', paymentInstructions: 'Bank transfer with application code', waiversEnabled: true, referralCount: 1, referenceLetterCount: 1, annualDuesEnabled: true, annualDues: '500.00' });
    const documents = [{ kind: 'CV' as const, ...await upload() }, { kind: 'CREDENTIAL' as const, ...await upload() }], letter = await upload();
    const payload = { ...input(documents), purpose: 'REGISTER', policyRevision: snap.revision, referrals: [{ name: 'Referrer Name', email: 'referrer@example.test', organization: 'University' }], referenceLetters: [letter], waiverReason: 'Please consider my financial hardship.' };
    expect((await request(app).post(api + '/auth/otp/request').send(payload)).status).toBe(200);
    await policy({ requireProfile: false, referralCount: 5, applicationFee: '900.00' });
    await prisma.emailOtp.updateMany({ where: { email: payload.email }, data: { lastSentAt: new Date(0) } });
    expect((await request(app).post(api + '/auth/otp/resend').send({ purpose: 'REGISTER', email: payload.email })).status).toBe(200);
    const verified = await request(app).post(api + '/auth/otp/verify').send({ purpose: 'REGISTER', email: payload.email, code: codes.get(payload.email) }); expect(verified.status).toBe(201);
    const own = await request(app).get(api + '/membership').set('Authorization', `Bearer ${verified.body.data.accessToken}`); expect(own.status).toBe(200); expect(own.body.data.charges[0].amount).toBe('100.00'); expect(own.body.data.referrals).toBeUndefined();
    const id = own.body.data.applicationId; expect((await approve(id)).status).toBe(422);
    expect((await post(id, 'evidence-review')).status).toBe(200);
    const charge = own.body.data.charges[0]; expect((await post(id, `charges/${charge.id}/waiver-decision`, { recordId: charge.waivers[0].id, status: 'APPROVED', reason: 'Hardship evidence reviewed and accepted.' })).status).toBe(200);
    expect((await approve(id)).status).toBe(200);
    const saved = await prisma.membershipApplication.findUniqueOrThrow({ where: { id }, include: { referenceLetters: true, referrals: true, profile: true } }); expect(saved.policyRevision).toBe(snap.revision); expect(saved.referrals).toHaveLength(1); expect(saved.referenceLetters).toHaveLength(1); expect(saved.profile.memberId).toMatch(/^IFSMHP-\d{4}-\d{6}$/);
    expect((await detail(id)).body.data.charges.find((c: { kind: string }) => c.kind === 'ANNUAL').amount).toBe('500.00');
    const memberView = await request(app).get(api + '/members/me/profile').set('Authorization', `Bearer ${verified.body.data.accessToken}`); expect(memberView.status).toBe(200);
    const auditRows = await prisma.auditLog.findMany({ where: { entityId: id } }); expect(JSON.stringify(auditRows)).not.toContain(payload.waiverReason); expect(JSON.stringify(auditRows)).not.toContain('referrer@example.test');
  });
  it('requires a policy refresh when the submitted form revision is stale', async () => {
    await policy({ requireProfile: false, requireCredential: false });
    const r = await request(app).post(api + '/auth/otp/request').send({ ...input(), purpose: 'REGISTER', policyRevision: 0 }); expect(r.status).toBe(409);
    expect(await prisma.emailOtp.count({ where: { email: { startsWith: prefix } } })).toBe(0);
  });
  it('accepts optional documents but still rejects invalid supplied claims', async () => {
    const snap = await policy({ requireProfile: false, requireCredential: false });
    const good = input(); expect((await request(app).post(api + '/auth/otp/request').send({ ...good, purpose: 'REGISTER', policyRevision: snap.revision })).status).toBe(200);
    expect((await request(app).post(api + '/auth/otp/request').send({ ...input([{ kind: 'CV', fileId: 'missing', claimToken: 'x'.repeat(30) }]), purpose: 'REGISTER' })).status).toBe(422);
  });
  it('rejects missing and duplicate referrals, missing letters, and forged policy snapshots', async () => {
    await policy({ requireProfile: false, requireCredential: false, referralCount: 2, referenceLetterCount: 1 });
    for (const extra of [{}, { referrals: [{ name: 'Person One', email: 'a@example.test' }, { name: 'Person Two', email: 'a@example.test' }] }, { referrals: [{ name: 'Person One', email: 'a@example.test' }, { name: 'Person Two', email: 'b@example.test' }] }, { membershipPolicy: { values: legacyMembershipPolicy, revision: 0 } }]) {
      expect((await request(app).post(api + '/auth/otp/request').send({ ...input(), purpose: 'REGISTER', ...extra })).status).toBe(422);
    }
  });
  it('keeps historical applications and OTP drafts under legacy rules', async () => {
    const old = await applicant({}, true);
    await policy({ idIssuance: 'MANUAL', applicationFeeEnabled: true, applicationFee: '50', paymentInstructions: 'External payment', referralCount: 5 });
    expect((await approve(old.id)).status).toBe(200);
    const documents = [{ kind: 'CV' as const, ...await upload() }, { kind: 'CREDENTIAL' as const, ...await upload() }];
    const draft = input(documents), code = '123456';
    await prisma.emailOtp.create({ data: { email: draft.email, purpose: 'REGISTER', payload: draft, codeHash: sha256(`REGISTER:${draft.email}:${code}`), expiresAt: new Date(Date.now() + 60000), lastSentAt: new Date() } });
    const verified = await request(app).post(api + '/auth/otp/verify').send({ email: draft.email, purpose: 'REGISTER', code });
    expect(verified.status).toBe(201);
    const a = await prisma.membershipApplication.findUniqueOrThrow({ where: { userId: verified.body.data.user.id } }); expect(a.policySnapshot).toBeNull(); expect((await approve(a.id)).status).toBe(200);
  });
  it('requires manual IDs and rejects duplicates without changing mappings', async () => {
    const a = await applicant({ idIssuance: 'MANUAL' }), b = await applicant({ idIssuance: 'MANUAL' });
    expect((await approve(a.id)).status).toBe(422); expect((await approve(a.id, 'MEMBER-CUSTOM-001')).status).toBe(200);
    expect((await approve(b.id, 'member-custom-001')).status).toBe(409);
    expect((await prisma.membershipApplication.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('PENDING');
  });
  it('allocates different automatic IDs during simultaneous approvals', async () => {
    const a = await applicant({ idPrefix: 'TEST', idPadding: 8 }), b = await applicant({ idPrefix: 'TEST', idPadding: 8 });
    const responses = await Promise.all([approve(a.id), approve(b.id)]); expect(responses.map(r => r.status)).toEqual([200, 200]);
    const ids = responses.map(r => r.body.data.memberId); expect(new Set(ids).size).toBe(2); expect(ids[0]).toMatch(/^TEST-\d{4}-\d{8}$/);
    expect((await request(app).post(`${api}/admin/members/${a.id}/reject`).set('Authorization', `Bearer ${token}`).send({ reason: 'No longer valid rejection' })).status).toBe(409);
  });
});
describe('Charges, waivers, archive jobs and authorization', () => {
  it('records payment once, preserves full history, and gates approval after correction', async () => {
    const a = await applicant({ applicationFeeEnabled: true, applicationFee: '125.50', paymentInstructions: 'Bank transfer' });
    const c = (await detail(a.id)).body.data.charges[0]; const body = { requestId: randomUUID(), reference: 'bank-transaction-123' };
    expect((await approve(a.id)).status).toBe(422);
    const saved = await post(a.id, `charges/${c.id}/payments`, body); expect(saved.status).toBe(200); expect((await post(a.id, `charges/${c.id}/payments`, body)).status).toBe(200);
    expect(await prisma.membershipPayment.count({ where: { chargeId: c.id } })).toBe(1);
    expect((await post(a.id, `charges/${c.id}/corrections`, { recordId: saved.body.data.charges[0].payments[0].id, reason: 'Incorrect payment reference verified.' })).status).toBe(200);
    expect((await approve(a.id)).status).toBe(422);
    expect((await post(a.id, `charges/${c.id}/payments`, { requestId: randomUUID(), reference: 'correct-payment' })).status).toBe(200); expect((await approve(a.id)).status).toBe(200);
  });
  it('serializes duplicate payments and approval racing with settlement', async () => {
    const a = await applicant({ applicationFeeEnabled: true, applicationFee: '10' }); const c = (await detail(a.id)).body.data.charges[0];
    const responses = await Promise.all([post(a.id, `charges/${c.id}/payments`, { requestId: randomUUID(), reference: 'one' }), post(a.id, `charges/${c.id}/payments`, { requestId: randomUUID(), reference: 'two' }), approve(a.id)]);
    expect(responses.slice(0, 2).map(r => r.status).sort()).toEqual([200, 409]); expect([200, 422]).toContain(responses[2]!.status);
    expect(await prisma.membershipPayment.count({ where: { chargeId: c.id } })).toBe(1);
  });
  it('allows own waiver requests and admin decisions, but prevents cross-account access', async () => {
    const a = await applicant({ applicationFeeEnabled: true, applicationFee: '10', waiversEnabled: true }), other = await applicant(); const c = (await detail(a.id)).body.data.charges[0];
    const endpoint = `${api}/membership/charges/${c.id}/waivers`, body = { requestId: randomUUID(), reason: 'Unable to pay due to hardship.' };
    expect((await request(app).post(endpoint).set('Authorization', `Bearer ${other.token}`).send(body)).status).toBe(404);
    const r = await request(app).post(endpoint).set('Authorization', `Bearer ${a.token}`).send(body); expect(r.status).toBe(200);
    expect((await request(app).post(endpoint).set('Authorization', `Bearer ${a.token}`).send(body)).status).toBe(200);
    const waiver = r.body.data.charges[0].waivers[0]; expect((await post(a.id, `charges/${c.id}/waiver-decision`, { recordId: waiver.id, status: 'APPROVED', reason: 'Approved after reviewing the application.' }, a.token)).status).toBe(403);
    expect((await post(a.id, `charges/${c.id}/waiver-decision`, { recordId: waiver.id, status: 'APPROVED', reason: 'Approved after reviewing the application.' })).status).toBe(200);
    expect((await post(a.id, `charges/${c.id}/waiver-decision`, { recordId: waiver.id, status: 'REVOKED', reason: 'Correcting a mistaken waiver decision.' })).status).toBe(200);
    expect((await approve(a.id)).status).toBe(422);
  });
  it('rolls back membership changes if auditing fails', async () => {
    const a = await applicant({ applicationFeeEnabled: true, applicationFee: '10' }); const c = (await detail(a.id)).body.data.charges[0]; auditFail = true;
    expect((await post(a.id, `charges/${c.id}/payments`, { requestId: randomUUID(), reference: 'rollback' })).status).toBe(500); auditFail = false;
    expect(await prisma.membershipPayment.count({ where: { chargeId: c.id } })).toBe(0);
  });
  it('creates anniversary dues once, catches up after restart and preserves access', async () => {
    const a = await applicant({ annualDuesEnabled: true, annualDues: '40.00' }); expect((await approve(a.id)).status).toBe(200);
    await prisma.membershipCharge.deleteMany({ where: { applicationId: a.id } });
    await prisma.memberProfile.update({ where: { id: a.profileId }, data: { approvedAt: new Date('2024-02-29T10:00:00Z') } });
    await Promise.all([runMembershipJobs(new Date('2026-03-01T00:00:00Z')), runMembershipJobs(new Date('2026-03-01T00:00:00Z'))]);
    await runMembershipJobs(new Date('2026-03-01T00:00:00Z'));
    const charges = await prisma.membershipCharge.findMany({ where: { applicationId: a.id }, orderBy: { periodYear: 'asc' } }); expect(charges).toHaveLength(3); expect(charges[1]!.dueAt.toISOString()).toBe('2025-03-30T10:00:00.000Z');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.userId } })).status).toBe('ACTIVE');
    expect(anniversary(new Date('2024-02-29T10:00:00Z'), 2025).toISOString()).toBe('2025-02-28T10:00:00.000Z');
  });
  it('archives only enrolled rejections, retains records, and respects restoration', async () => {
    const a = await applicant({ autoArchive: true, archiveAfterDays: 1 }), legacy = await applicant({}, true);
    await prisma.membershipApplication.updateMany({ where: { id: { in: [a.id, legacy.id] } }, data: { status: 'REJECTED', reviewedAt: new Date('2025-01-01') } });
    await runMembershipJobs(new Date('2025-01-03')); expect((await detail(a.id)).body.data.archivedAt).toBeTruthy(); expect((await detail(legacy.id)).body.data.archivedAt).toBeNull();
    const archived = await request(app).get(api + '/admin/members?archive=archived').set('Authorization', `Bearer ${token}`); expect(archived.body.data.items.map((r: { id: string }) => r.id)).toContain(a.id);
    const active = await request(app).get(api + '/admin/members').set('Authorization', `Bearer ${token}`); expect(active.body.data.items.map((r: { id: string }) => r.id)).not.toContain(a.id);
    expect((await post(a.id, 'restore')).status).toBe(200); await runMembershipJobs(new Date('2025-01-04')); expect((await detail(a.id)).body.data.archivedAt).toBeNull();
    expect((await post(a.id, 'restore', { enableAutoArchive: true })).status).toBe(200); await runMembershipJobs(new Date('2025-01-04')); expect((await detail(a.id)).body.data.archivedAt).toBeTruthy();
    expect(await prisma.user.findUnique({ where: { id: a.userId } })).toBeTruthy();
  });
  it('returns a clean empty state for historical members without applications', async () => {
    const user = await prisma.user.create({ data: { fullName: 'Historical member', email: `${prefix}${randomUUID()}@example.test`, role: 'MEMBER', status: 'ACTIVE', memberProfile: { create: { professionalType: 'Researcher', institution: 'Old Institute', memberId: `OLD-${randomUUID()}` } } } });
    const response = await request(app).get(api + '/membership').set('Authorization', `Bearer ${await session(user.id, 'MEMBER')}`);
    expect(response.status).toBe(200); expect(response.body.data.charges).toEqual([]); expect(response.body.data.policy.waiversEnabled).toBe(false);
  });
  it('does not expose private letters to another member', async () => {
    const snap = await policy({ requireProfile: false, requireCredential: false, referenceLetterCount: 1 }), letter = await upload();
    const payload = { ...input(), referenceLetters: [letter], membershipPolicy: snap };
    const registered = await registerApplicant(payload, { get: () => undefined } as unknown as Request);
    const other = await applicant();
    const ownerToken = await session(registered.user.id, 'APPLICANT');
    expect((await request(app).get(`${api}/files/${letter.fileId}/download`).set('Authorization', `Bearer ${other.token}`)).status).toBe(404);
    expect((await request(app).get(`${api}/files/${letter.fileId}/download`).set('Authorization', `Bearer ${ownerToken}`)).status).toBe(200);
    expect((await request(app).get(`${api}/files/${letter.fileId}/download`).set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });
  it('rejects disabled waivers and unapproved changes to a charge amount', async () => {
    const a = await applicant({ applicationFeeEnabled: true, applicationFee: '10' }); const c = (await detail(a.id)).body.data.charges[0];
    expect((await post(a.id, `charges/${c.id}/waivers`, { requestId: randomUUID(), reason: 'Please grant a fee waiver.' })).status).toBe(422);
    expect((await post(a.id, `charges/${c.id}/payments`, { requestId: randomUUID(), reference: 'partial', amount: '1' })).status).toBe(422);
    expect((await detail(a.id)).body.data.charges[0].amount).toBe('10.00');
  });
  it('concurrent manual approvals cannot assign the same ID twice', async () => {
    const a = await applicant({ idIssuance: 'MANUAL' }), b = await applicant({ idIssuance: 'MANUAL' });
    const responses = await Promise.all([approve(a.id, 'SHARED-MANUAL-001'), approve(b.id, 'SHARED-MANUAL-001')]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.memberProfile.count({ where: { memberId: 'SHARED-MANUAL-001' } })).toBe(1);
  });
  it('automatic issuance skips a manually reserved sequence value', async () => {
    const a = await applicant({ idIssuance: 'MANUAL' }), b = await applicant();
    const year = new Date().getUTCFullYear(), next = (await prisma.memberIdSequence.findUnique({ where: { year } }))?.nextNumber ?? 1;
    const reserved = `IFSMHP-${year}-${String(next).padStart(6, '0')}`;
    expect((await approve(a.id, reserved)).status).toBe(200); const response = await approve(b.id); expect(response.status).toBe(200); expect(response.body.data.memberId).not.toBe(reserved);
  });
  it('rolls back approval, ID allocation and annual charge when auditing fails', async () => {
    const a = await applicant({ annualDuesEnabled: true, annualDues: '20' }); auditFail = true;
    expect((await approve(a.id)).status).toBe(500); auditFail = false;
    const stored = await prisma.membershipApplication.findUniqueOrThrow({ where: { id: a.id }, include: { profile: true, user: true, charges: true } });
    expect(stored.status).toBe('PENDING'); expect(stored.profile.memberId).toBeNull(); expect(stored.user.role).toBe('APPLICANT'); expect(stored.charges).toHaveLength(0);
  });
  it('requires real authorized sessions for all membership endpoints', async () => {
    const a = await applicant();
    expect((await request(app).get(api + '/membership')).status).toBe(401);
    expect((await post(a.id, 'evidence-review', {}, a.token)).status).toBe(403);
    expect((await request(app).get(`${api}/admin/membership/${a.id}`).set('X-Test-Role', 'ADMIN')).status).toBe(401);
    await prisma.session.updateMany({ where: { userId: a.userId }, data: { revokedAt: new Date() } });
    expect((await request(app).get(api + '/membership').set('Authorization', `Bearer ${a.token}`)).status).toBe(401);
  });
});
