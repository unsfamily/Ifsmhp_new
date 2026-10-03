import path from 'node:path';
import { promises as fsp } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sentCodes: string[] = [];
vi.mock('../services/mail.service', () => ({
  sendOtpEmail: vi.fn(async (_email: string, code: string) => {
    sentCodes.push(code);
  }),
  verifyTransport: vi.fn(async () => undefined),
  sendApprovalEmail: vi.fn(async () => undefined),
}));

import { createApp } from '../app';
import { env } from '../config';
import { prisma } from '../config/database';
import { adminMemberDetail, memberProfile } from '../services/platform.service';
import { sha256, signAccessToken } from '../utils/security';

const app = createApp();
const PREFIX = 'registration-doc-test';
const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_STORAGE_PATH);
let rejectProfileAudit = false;
prisma.$use(async (params, next) => {
  if (rejectProfileAudit && params.model === 'AuditLog' && params.action === 'create' && params.args.data.action === 'UserProfileUpdated') {
    throw new Error('Injected profile audit failure');
  }
  return next(params);
});

const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: PREFIX } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  const files = await prisma.fileObject.findMany({
    where: { originalName: { contains: PREFIX } },
    select: { id: true, storageKey: true },
  });

  if (userIds.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  if (files.length) {
    await prisma.fileObject.deleteMany({ where: { id: { in: files.map((file) => file.id) } } });
    await Promise.all(files.map((file) => fsp.unlink(path.join(uploadRoot, file.storageKey)).catch(() => undefined)));
  }
  await prisma.emailOtp.deleteMany({ where: { email: { contains: PREFIX } } });
}

async function uploadRegistrationDocument(name: string, buffer: Buffer, contentType: string) {
  const response = await request(app)
    .post('/api/v1/files/registration')
    .attach('file', buffer, { filename: name, contentType });

  return response;
}

async function uploadRequiredPair(key: string) {
  const cv = await uploadRegistrationDocument(`${PREFIX}-${key}-cv.pdf`, pdf, 'application/pdf');
  const credential = await uploadRegistrationDocument(`${PREFIX}-${key}-credential.png`, png, 'image/png');
  expect(cv.status).toBe(201);
  expect(credential.status).toBe(201);
  return {
    cv: cv.body.data as { id: string; claimToken: string; name: string },
    credential: credential.body.data as { id: string; claimToken: string; name: string },
  };
}

function registrationPayload(
  key: string,
  documents: Array<{ kind: 'CV' | 'CREDENTIAL'; fileId: string; claimToken: string }>,
) {
  return {
    purpose: 'REGISTER',
    fullName: `Registration Document ${key}`,
    email: `${PREFIX}.${key}@example.test`,
    professionalType: 'Research Scholar / Scientist',
    institution: `${PREFIX} Institute`,
    credentials: 'PhD, clinical research license, and professional certification.',
    education: 'PhD in Clinical Psychology, Test University, 2024.',
    researchInterests: 'Digital mental health, community care, and assessment.',
    documents,
    agreeTerms: true,
  };
}

async function authTokenFor(user: { id: string; role: 'ADMIN' | 'MEMBER' | 'APPLICANT'; email: string }) {
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(`${PREFIX}-${user.id}-${Date.now()}`),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return signAccessToken({ sub: user.id, sessionId: session.id, role: user.role });
}

beforeEach(async () => {
  rejectProfileAudit = false;
  sentCodes.length = 0;
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('registration document uploads', () => {
  it('accepts a temporary registration document and returns claim metadata', async () => {
    const response = await uploadRegistrationDocument(`${PREFIX}-success.pdf`, pdf, 'application/pdf');

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: `${PREFIX}-success.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: pdf.length,
    });
    expect(response.body.data.claimToken).toMatch(/^regdoc\./);

    const file = await prisma.fileObject.findUniqueOrThrow({ where: { id: response.body.data.id } });
    expect(file.uploaderId).toBeNull();
    expect(file.visibility).toBe('PRIVATE');
  });

  it('rejects unsupported, oversized, and mismatched files with clear errors', async () => {
    const unsupported = await uploadRegistrationDocument(`${PREFIX}-bad.exe`, Buffer.from('hello'), 'application/octet-stream');
    expect(unsupported.status).toBe(422);
    expect(unsupported.body.errors[0].field).toBe('file');

    const oversized = await uploadRegistrationDocument(
      `${PREFIX}-large.pdf`,
      Buffer.alloc(10 * 1024 * 1024 + 1),
      'application/pdf',
    );
    expect(oversized.status).toBe(422);

    const mismatch = await uploadRegistrationDocument(`${PREFIX}-fake.pdf`, Buffer.from('not really a pdf'), 'application/pdf');
    expect(mismatch.status).toBe(422);
    expect(mismatch.body.errors[0].message).toContain('valid file');
  });

  it('removes a temporary upload and prevents using it for registration', async () => {
    const { cv, credential } = await uploadRequiredPair('removed');

    const removed = await request(app)
      .delete(`/api/v1/files/registration/${cv.id}`)
      .send({ claimToken: cv.claimToken });
    expect(removed.status).toBe(200);

    const otp = await request(app)
      .post('/api/v1/auth/otp/request')
      .send(registrationPayload('removed', [
        { kind: 'CV', fileId: cv.id, claimToken: cv.claimToken },
        { kind: 'CREDENTIAL', fileId: credential.id, claimToken: credential.claimToken },
      ]));
    expect(otp.status).toBe(422);
    expect(otp.body.message).toContain('no longer available');
  });
});

describe('registration document persistence and retrieval', () => {
  it('links uploaded documents to the verified applicant and authorizes retrieval', async () => {
    const { cv, credential } = await uploadRequiredPair('workflow');
    const documents = [
      { kind: 'CV' as const, fileId: cv.id, claimToken: cv.claimToken },
      { kind: 'CREDENTIAL' as const, fileId: credential.id, claimToken: credential.claimToken },
    ];

    const otp = await request(app).post('/api/v1/auth/otp/request').send(registrationPayload('workflow', documents));
    expect(otp.status).toBe(200);

    const verified = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ purpose: 'REGISTER', email: `${PREFIX}.workflow@example.test`, code: sentCodes.at(-1) });
    expect(verified.status).toBe(201);

    const userId = verified.body.data.user.id as string;
    const profile = await prisma.memberProfile.findUniqueOrThrow({
      where: { userId },
      include: { credentials: { include: { file: true } } },
    });
    expect(profile.credentials).toHaveLength(2);
    expect(profile.credentials.map((item) => item.file?.originalName).sort()).toEqual([credential.name, cv.name].sort());
    expect(profile.credentials.every((item) => item.file?.uploaderId === userId)).toBe(true);

    const adminDetail = await adminMemberDetail(verified.body.data.applicationId);
    expect(adminDetail.credentials.map((item) => item.fileName).sort()).toEqual([credential.name, cv.name].sort());

    const ownProfile = await memberProfile(userId);
    expect(ownProfile.credentials.map((item) => item.fileName).sort()).toEqual([credential.name, cv.name].sort());

    const applicantDownload = await request(app)
      .get(`/api/v1/files/${cv.id}/download`)
      .set('Authorization', `Bearer ${verified.body.data.accessToken}`);
    expect(applicantDownload.status).toBe(200);
    expect(applicantDownload.headers['content-type']).toContain('application/pdf');

    const admin = await prisma.user.create({
      data: {
        email: `${PREFIX}.admin@example.test`,
        fullName: 'Registration Document Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    const adminDownload = await request(app)
      .get(`/api/v1/files/${credential.id}/download`)
      .set('Authorization', `Bearer ${await authTokenFor({ id: admin.id, email: admin.email, role: 'ADMIN' })}`);
    expect(adminDownload.status).toBe(200);

    const stranger = await prisma.user.create({
      data: {
        email: `${PREFIX}.stranger@example.test`,
        fullName: 'Registration Document Stranger',
        role: 'MEMBER',
        status: 'ACTIVE',
        memberProfile: {
          create: {
            professionalType: 'Research Scholar / Scientist',
            institution: `${PREFIX} Other Institute`,
          },
        },
      },
    });
    const denied = await request(app)
      .get(`/api/v1/files/${credential.id}/download`)
      .set('Authorization', `Bearer ${await authTokenFor({ id: stranger.id, email: stranger.email, role: 'MEMBER' })}`);
    expect(denied.status).toBe(404);

    const applicantToken = verified.body.data.accessToken as string;
    expect((await request(app).get('/api/v1/members/me/profile').auth(applicantToken, { type: 'bearer' })).status).toBe(403);
    const adminToken = await authTokenFor({ ...admin, role: 'ADMIN' });
    const applicationId = verified.body.data.applicationId as string;
    expect((await request(app).post(`/api/v1/admin/members/${applicationId}/review`).auth(adminToken, { type: 'bearer' }).send({})).status).toBe(200);
    expect((await request(app).post(`/api/v1/admin/membership/${applicationId}/evidence-review`).auth(adminToken, { type: 'bearer' }).send({})).status).toBe(200);
    const approval = await request(app).post(`/api/v1/admin/members/${applicationId}/approve`).auth(adminToken, { type: 'bearer' }).send({ reviewNotes: 'Private review note' });
    expect(approval.status).toBe(200);
    const email = `${PREFIX}.workflow@example.test`;
    expect((await request(app).post('/api/v1/auth/otp/request').send({ purpose: 'LOGIN', email })).status).toBe(200);
    const login = await request(app).post('/api/v1/auth/otp/verify').send({ purpose: 'LOGIN', email, code: sentCodes.at(-1) });
    expect(login.status).toBe(200);
    expect(login.body.data.user).toMatchObject({ role: 'MEMBER', status: 'ACTIVE', professionalType: 'Research Scholar / Scientist' });
    const token = login.body.data.accessToken as string;
    const fetched = await request(app).get('/api/v1/members/me/profile').auth(token, { type: 'bearer' });
    expect(fetched.status).toBe(200);
    const persisted = await prisma.memberProfile.findUniqueOrThrow({ where: { userId } });
    expect(fetched.body.data).toMatchObject({
      id: userId, fullName: registrationPayload('workflow', documents).fullName, email,
      institution: `${PREFIX} Institute`, professionalType: 'Research Scholar / Scientist',
      memberId: approval.body.data.memberId, approvedAt: persisted.approvedAt!.toISOString(),
      status: 'ACTIVE', applicationStatus: 'APPROVED',
      phone: null, websiteUrl: null, scholarUrl: null, orcid: null,
      stats: { projects: 0, publications: 0, supportRequests: 0 }, publications: [],
    });
    expect(fetched.body.data.education[0]).toMatchObject({ degree: registrationPayload('workflow', documents).education });
    expect(fetched.body.data.researchInterests).toContain('Digital mental health');
    expect(fetched.body.data.credentials).toHaveLength(2);
    expect(JSON.stringify(fetched.body.data)).not.toMatch(/storageKey|claimToken|Private review note|profileId/);
    const download = await request(app).get(`/api/v1/files/${cv.id}/download`).auth(token, { type: 'bearer' });
    expect(download.status).toBe(200);
    expect(download.body).toEqual(pdf);
    await prisma.fileObject.update({ where: { id: cv.id }, data: { deletedAt: new Date() } });
    const afterDeletion = await request(app).get('/api/v1/members/me/profile').auth(token, { type: 'bearer' });
    expect(afterDeletion.body.data.credentials).toHaveLength(1);
    expect((await request(app).get(`/api/v1/files/${cv.id}/download`).auth(token, { type: 'bearer' })).status).toBe(404);
  });

  it('refuses to request a registration OTP without both required documents', async () => {
    const { cv } = await uploadRequiredPair('missing');
    const response = await request(app)
      .post('/api/v1/auth/otp/request')
      .send(registrationPayload('missing', [{ kind: 'CV', fileId: cv.id, claimToken: cv.claimToken }]));

    expect(response.status).toBe(422);
    expect(response.body.errors[0].field).toContain('documents');
  });
});

async function createScientist(key: string) {
  const user = await prisma.user.create({ data: {
    email: `${PREFIX}.${key}@example.test`, fullName: `Scientist ${key}`, role: 'MEMBER', status: 'ACTIVE',
    memberProfile: { create: { professionalType: 'Scientist', institution: `Institute ${key}`, phone: '12345' } },
  } });
  return { user, token: await authTokenFor({ ...user, role: 'MEMBER' }) };
}

describe('scientist profile persistence and isolation', () => {
  it('saves partial edits, clears optional fields, and rejects protected or invalid fields', async () => {
    const { user, token } = await createScientist('editable');
    const patch = (body: Record<string, unknown>) => request(app).patch('/api/v1/members/me/profile').auth(token, { type: 'bearer' }).send(body);
    const updated = await patch({ phone: '0123456789', websiteUrl: ' https://example.test/scientist ', scholarUrl: 'https://scholar.google.com/citations?user=test', orcid: '0000-0002-1825-0097' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ phone: '0123456789', websiteUrl: 'https://example.test/scientist', orcid: '0000-0002-1825-0097' });
    expect((await patch({ phone: null })).status).toBe(422);
    const reloaded = await request(app).get('/api/v1/members/me/profile').auth(token, { type: 'bearer' });
    expect(reloaded.body.data).toMatchObject({ phone: '0123456789', websiteUrl: 'https://example.test/scientist' });
    for (const body of [
      { websiteUrl: 'javascript:alert(1)' }, { scholarUrl: 'ftp://example.test' }, { websiteUrl: 'invalid' },
      { orcid: 'invalid' }, { phone: '1'.repeat(41) }, { phone: 123 }, {},
      { userId: 'someone-else' }, { fullName: 'Changed' }, { memberId: 'CHANGED' },
      { status: 'ACTIVE' }, { email: 'another@example.test' }, { institution: 'Changed' },
      { education: [] }, { credentials: [] }, { approvedAt: new Date().toISOString() },
    ]) {
      const response = await patch(body);
      expect(response.status, JSON.stringify(body)).toBe(422);
      expect(response.body.errors.length).toBeGreaterThan(0);
    }
    expect((await patch({ websiteUrl: '   ', scholarUrl: null, orcid: '' })).status).toBe(200);
    expect(await prisma.memberProfile.findUnique({ where: { userId: user.id } })).toMatchObject({ phone: '0123456789', websiteUrl: null, scholarUrl: null, orcid: null });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ fullName: user.fullName });
  });

  it.each([
    '', ...Array.from({ length: 9 }, (_, i) => '1'.repeat(i + 1)), '12345678901',
    '123456789a', '+123456789', '123 456789', '123-456789', '(123)45678',
    '１２３４５６７８９０', '١٢٣٤٥٦٧٨٩٠', ' 0123456789', '0123456789 ',
    '0123456789\n', '012345678\n', '012345678\t', '1234567890 ext 2',
    null, 1234567890, true, ['0123456789'], { number: '0123456789' },
  ])('rejects invalid phone %j without persisting any fields or audit records', async phone => {
    const { user, token } = await createScientist('invalid-phone');
    const before = await prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } });
    const response = await request(app).patch('/api/v1/members/me/profile').auth(token, { type: 'bearer' })
      .send({ phone, websiteUrl: 'https://example.test/must-not-save' });
    expect(response.status).toBe(422);
    expect(response.body.errors).toContainEqual({ field: 'phone', message: 'Enter exactly 10 digits, without spaces or a country code.' });
    expect(await prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } })).toEqual(before);
    expect(await prisma.auditLog.count({ where: { actorId: user.id, action: 'UserProfileUpdated' } })).toBe(0);
  });

  it.each([null, '', '12345', '+44 1234567890', '12345678901'])('requires correction of legacy phone %j even when omitted from PATCH', async phone => {
    const { user, token } = await createScientist('legacy-phone');
    await prisma.memberProfile.update({ where: { userId: user.id }, data: { phone } });
    const patch = (body: Record<string, unknown>) => request(app).patch('/api/v1/members/me/profile').auth(token, { type: 'bearer' }).send(body);
    const response = await patch({ websiteUrl: 'https://example.test/profile' });
    expect(response.status).toBe(422);
    expect(response.body.errors[0].field).toBe('phone');
    const fetched = await request(app).get('/api/v1/members/me/profile').auth(token, { type: 'bearer' });
    expect(fetched.body.data).toMatchObject({ phone, websiteUrl: null });
    expect(await prisma.auditLog.count({ where: { actorId: user.id, action: 'UserProfileUpdated' } })).toBe(0);
    expect((await patch({ phone: '0000000000', websiteUrl: 'https://example.test/profile' })).status).toBe(200);
    expect((await patch({ scholarUrl: 'https://scholar.google.com/' })).status).toBe(200);
    // Repeating an unchanged valid save must not create another audit record.
    expect((await patch({ phone: '0000000000' })).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { actorId: user.id, action: 'UserProfileUpdated' } })).toBe(2);
    const reloaded = await request(app).get('/api/v1/members/me/profile').auth(token, { type: 'bearer' });
    expect(reloaded.body.data).toMatchObject({ phone: '0000000000', websiteUrl: 'https://example.test/profile', scholarUrl: 'https://scholar.google.com/' });
  });

  it('rolls back phone correction and other fields if the audit write fails', async () => {
    const { user, token } = await createScientist('phone-rollback');
    const before = await prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } });
    rejectProfileAudit = true;
    try {
      const response = await request(app).patch('/api/v1/members/me/profile').auth(token, { type: 'bearer' })
        .send({ phone: '9876543210', websiteUrl: 'https://example.test/rollback' });
      expect(response.status).toBe(500);
    } finally {
      rejectProfileAudit = false;
    }
    expect(await prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } })).toEqual(before);
    expect(await prisma.auditLog.count({ where: { actorId: user.id, action: 'UserProfileUpdated' } })).toBe(0);
  });

  it('scopes identity, collections and statistics to the session, regardless of supplied IDs', async () => {
    const first = await createScientist('first');
    const second = await createScientist('second');
    await prisma.project.create({ data: { ownerId: first.user.id, title: 'Owned project', category: 'Research', description: 'Description' } });
    await prisma.supportRequest.create({ data: { requesterId: first.user.id, subject: 'Owned request', description: 'Description' } });
    for (let index = 0; index < 12; index += 1) {
      await prisma.publication.create({ data: { authorId: first.user.id, title: `Paper ${index}`, abstract: 'Abstract', category: 'Research', researchType: 'Research', status: 'PUBLISHED', publishedAt: new Date(2025, 0, index + 1) } });
    }
    await prisma.publication.create({ data: { authorId: second.user.id, title: 'Other paper', abstract: 'Abstract', category: 'Research', researchType: 'Research', status: 'PUBLISHED' } });
    const own = await request(app).get('/api/v1/members/me/profile').query({ userId: second.user.id, id: second.user.id }).auth(first.token, { type: 'bearer' });
    expect(own.body.data.id).toBe(first.user.id);
    expect(own.body.data.stats).toEqual({ projects: 1, publications: 12, supportRequests: 1 });
    expect(own.body.data.publications).toHaveLength(10);
    expect(own.body.data.publications[0].title).toBe('Paper 11');
    expect(own.body.data.publications[0]).toMatchObject({ fileId: null, fileName: null, mimeType: null, doi: null });
    expect(own.body.data.publications[9].title).toBe('Paper 2');
    const other = await request(app).get('/api/v1/members/me/profile').auth(second.token, { type: 'bearer' });
    expect(other.body.data.id).toBe(second.user.id);
    expect(other.body.data.stats).toEqual({ projects: 0, publications: 1, supportRequests: 0 });
    expect(other.body.data.education).toEqual([]);
    expect((await request(app).patch('/api/v1/members/me/profile').auth(first.token, { type: 'bearer' }).send({ userId: second.user.id, phone: '999' })).status).toBe(422);
    expect((await request(app).get(`/api/v1/members/${second.user.id}/profile`).auth(first.token, { type: 'bearer' })).status).toBe(404);
    expect(await prisma.memberProfile.findUnique({ where: { userId: second.user.id } })).toMatchObject({ phone: '12345' });
  });

  it('denies unauthenticated, expired, revoked, deleted and inactive accounts for reads and writes', async () => {
    const { user, token } = await createScientist('access');
    const access = async (bearer?: string) => {
      for (const method of ['get', 'patch'] as const) {
        const call = request(app)[method]('/api/v1/members/me/profile');
        if (bearer) call.auth(bearer, { type: 'bearer' });
        const response = await call.send(method === 'patch' ? { phone: '555' } : undefined);
        expect([401, 403]).toContain(response.status);
      }
    };
    await access();
    for (const status of ['PENDING', 'REJECTED', 'SUSPENDED', 'DEACTIVATED'] as const) {
      await prisma.user.update({ where: { id: user.id }, data: { status } });
      await access(token);
    }
    await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE', deletedAt: new Date() } });
    await access(token);
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: null } });
    await prisma.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });
    await access(token);
    await prisma.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() + 60000), revokedAt: new Date() } });
    await access(token);
  });
});

describe('extended registration fields', () => {
  async function draft(key: string, fields: Record<string, unknown> = {}) {
    const { cv, credential } = await uploadRequiredPair(key);
    return { ...registrationPayload(key, [
      { kind: 'CV', fileId: cv.id, claimToken: cv.claimToken },
      { kind: 'CREDENTIAL', fileId: credential.id, claimToken: credential.claimToken },
    ]), ...fields };
  }
  it('preserves new fields through OTP resend, verification, session and private detail responses', async () => {
    const fields = { firstName: '  ஜேன்  ', lastName: '  O’Connor  ', fullName: 'ஜேன் O’Connor', communicationAddress: '  10 Research Road\nChennai 600001  ', permanentAddress: '  20 Home Street\nMadurai 625001 ', phone: '+44 1234567890' };
    const body = await draft('new-fields', fields);
    expect((await request(app).post('/api/v1/auth/otp/request').send(body)).status).toBe(200);
    const pending = await prisma.emailOtp.findFirstOrThrow({ where: { email: body.email, consumedAt: null } });
    expect(pending.payload).toMatchObject({ firstName: 'ஜேன்', lastName: 'O’Connor', communicationAddress: fields.communicationAddress.trim(), permanentAddress: fields.permanentAddress.trim() });
    expect(await prisma.user.findUnique({ where: { email: body.email } })).toBeNull();
    await prisma.emailOtp.update({ where: { id: pending.id }, data: { lastSentAt: new Date(Date.now() - 120000) } });
    expect((await request(app).post('/api/v1/auth/otp/resend').send({ email: body.email, purpose: 'REGISTER' })).status).toBe(200);
    const result = await request(app).post('/api/v1/auth/otp/verify').send({ email: body.email, purpose: 'REGISTER', code: sentCodes.at(-1) });
    expect(result.status).toBe(201);
    const { user, accessToken, applicationId } = result.body.data;
    expect(user).toMatchObject({ firstName: 'ஜேன்', lastName: 'O’Connor', fullName: fields.fullName, role: 'APPLICANT', status: 'PENDING' });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { memberProfile: true } });
    expect(stored).toMatchObject({ firstName: 'ஜேன்', lastName: 'O’Connor', fullName: fields.fullName });
    expect(stored.memberProfile).toMatchObject({ communicationAddress: fields.communicationAddress.trim(), permanentAddress: fields.permanentAddress.trim(), phone: fields.phone });
    const session = await request(app).get('/api/v1/auth/me').auth(accessToken, { type: 'bearer' });
    expect(session.body.data.user).toMatchObject({ firstName: 'ஜேன்', lastName: 'O’Connor' });
    expect(session.body.data.user).not.toHaveProperty('communicationAddress');
    expect(await memberProfile(user.id)).toMatchObject({ communicationAddress: fields.communicationAddress.trim(), firstName: 'ஜேன்' });
    expect(await adminMemberDetail(applicationId)).toMatchObject({ permanentAddress: fields.permanentAddress.trim(), lastName: 'O’Connor' });
    expect(JSON.stringify(await prisma.auditLog.findMany({ where: { actorId: user.id } }))).not.toContain('Research Road');
  });
  it('accepts maximum-length names and addresses, and normalizes blank/null addresses', async () => {
    const firstName = 'A'.repeat(59), lastName = 'B'.repeat(59);
    const body = await draft('boundaries', { firstName, lastName, fullName: `${firstName} ${lastName}`, communicationAddress: '界'.repeat(1000), permanentAddress: ' \n ' });
    expect((await request(app).post('/api/v1/auth/otp/request').send(body)).status).toBe(200);
    const result = await request(app).post('/api/v1/auth/otp/verify').send({ email: body.email, purpose: 'REGISTER', code: sentCodes.at(-1) });
    expect(result.status).toBe(201);
    expect(await memberProfile(result.body.data.user.id)).toMatchObject({ firstName, lastName, communicationAddress: '界'.repeat(1000), permanentAddress: null });
  });
  it('returns field errors for malformed names and addresses before sending OTP or creating accounts', async () => {
    const body = await draft('invalid-fields');
    for (const [fields, field] of [
      [{ firstName: 'Jane' }, 'lastName'], [{ lastName: 'Smith' }, 'firstName'],
      [{ firstName: '', lastName: 'Smith' }, 'firstName'], [{ firstName: 'A'.repeat(60), lastName: 'Smith' }, 'firstName'],
      [{ firstName: 'Jane', lastName: 'Smith', fullName: 'Different Name' }, 'fullName'],
      [{ firstName: null }, 'firstName'], [{ communicationAddress: 'abcd' }, 'communicationAddress'],
      [{ permanentAddress: 'A'.repeat(1001) }, 'permanentAddress'],
      [{ communicationAddress: ['10 Test Street'] }, 'communicationAddress'], [{ permanentAddress: 12345 }, 'permanentAddress'],
    ] as const) {
      const count = sentCodes.length;
      const response = await request(app).post('/api/v1/auth/otp/request').send({ ...body, ...fields });
      expect(response.status, JSON.stringify(response.body)).toBe(422);
      expect(response.body.errors.some((error: { field: string }) => error.field === field)).toBe(true);
      expect(sentCodes.length).toBe(count);
    }
    expect(await prisma.user.findUnique({ where: { email: body.email } })).toBeNull();
  });
  it('edits and clears private addresses, retaining omission, phone rules, isolation and audit rollback', async () => {
    const { user, token } = await createScientist('addresses');
    const patch = (body: Record<string, unknown>) => request(app).patch('/api/v1/members/me/profile').auth(token, { type: 'bearer' }).send(body);
    expect((await patch({ communicationAddress: '10 Test Street' })).status).toBe(422); // Existing invalid phone must be corrected.
    const saved = await patch({ phone: '0123456789', communicationAddress: ' 10 Test Street\nChennai ', permanentAddress: '20 Other Street' });
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ communicationAddress: '10 Test Street\nChennai', permanentAddress: '20 Other Street', firstName: null, lastName: null });
    expect((await patch({ communicationAddress: 'Changed Street' })).body.data.permanentAddress).toBe('20 Other Street');
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { actorId: user.id, action: 'UserProfileUpdated' } });
    expect(JSON.stringify(audit.metadata)).toContain('communicationAddress'); expect(JSON.stringify(audit)).not.toContain('Test Street');
    const before = await prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } });
    rejectProfileAudit = true;
    try { expect((await patch({ communicationAddress: 'Must not persist' })).status).toBe(500); } finally { rejectProfileAudit = false; }
    expect(await prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } })).toEqual(before);
    for (const bad of [{ communicationAddress: 'tiny' }, { permanentAddress: 'x'.repeat(1001) }, { permanentAddress: {} }, { firstName: 'Changed' }, { lastName: 'Changed' }]) expect((await patch(bad)).status).toBe(422);
    const community = await request(app).get('/api/v1/members/me/community').auth(token, { type: 'bearer' });
    expect(community.status).toBe(200); expect(JSON.stringify(community.body)).not.toMatch(/communicationAddress|permanentAddress|Changed Street|Other Street/);
    const stranger = await createScientist('address-stranger');
    expect((await request(app).get('/api/v1/members/me/profile').auth(stranger.token, { type: 'bearer' })).body.data.communicationAddress).toBeNull();
    expect((await request(app).patch('/api/v1/members/me/profile').send({ communicationAddress: 'Unauthenticated' })).status).toBe(401);
    const cleared = await patch({ communicationAddress: ' \n ', permanentAddress: null });
    expect(cleared.body.data).toMatchObject({ communicationAddress: null, permanentAddress: null });
  });
});
