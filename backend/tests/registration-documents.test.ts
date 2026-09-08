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
    const updated = await patch({ phone: '  +44 12345  ', websiteUrl: ' https://example.test/scientist ', scholarUrl: 'https://scholar.google.com/citations?user=test', orcid: '0000-0002-1825-0097' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ phone: '+44 12345', websiteUrl: 'https://example.test/scientist', orcid: '0000-0002-1825-0097' });
    expect((await patch({ phone: null })).status).toBe(200);
    const reloaded = await request(app).get('/api/v1/members/me/profile').auth(token, { type: 'bearer' });
    expect(reloaded.body.data).toMatchObject({ phone: null, websiteUrl: 'https://example.test/scientist' });
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
    expect(await prisma.memberProfile.findUnique({ where: { userId: user.id } })).toMatchObject({ phone: null, websiteUrl: null, scholarUrl: null, orcid: null });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ fullName: user.fullName });
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
