import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mail is stubbed so the suite never opens an SMTP connection. The spy also
// hands back the generated code, the only place it is ever exposed.
const sentCodes: string[] = [];
vi.mock('../services/mail.service', () => ({
  sendOtpEmail: vi.fn(async (_email: string, code: string) => {
    sentCodes.push(code);
  }),
  verifyTransport: vi.fn(async () => undefined),
  sendApprovalEmail: vi.fn(async () => undefined),
}));

import { createApp } from '../app';
import { prisma } from '../config/database';

/**
 * How the auth surface answers for each account state.
 *
 * The case that matters most is the soft-deleted one: `requireAuth` refuses a
 * user with `deletedAt`, but the login paths used to look the row up without
 * it, so the account could collect a code and a session and only then start
 * 401-ing on every request.
 */
const app = createApp();
const PREFIX = 'auth-state-test';
const email = (n: string) => `${PREFIX}.${n}@example.test`;

const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

type Role = 'APPLICANT' | 'MEMBER' | 'ADMIN';
type Status = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'DEACTIVATED';

async function makeUser(key: string, opts: { role?: Role; status?: Status; deleted?: boolean } = {}) {
  return prisma.user.create({
    data: {
      email: email(key),
      passwordHash: null,
      fullName: `Auth State ${key}`,
      role: opts.role ?? 'MEMBER',
      status: opts.status ?? 'ACTIVE',
      deletedAt: opts.deleted ? new Date() : null,
    },
  });
}

const requestOtp = (address: string) =>
  request(app).post('/api/v1/auth/otp/request').send({ purpose: 'LOGIN', email: address });

const resendOtp = (address: string) =>
  request(app).post('/api/v1/auth/otp/resend').send({ purpose: 'LOGIN', email: address });

async function wipe() {
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { contains: PREFIX } }, { email: { contains: 'deleted+' } }] },
    select: { id: true, email: true },
  });
  const ours = users.filter((u) => u.email.includes(PREFIX) || u.email.endsWith('@deleted.invalid'));
  if (ours.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ours.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: ours.map((u) => u.id) } } });
  }
  await prisma.emailOtp.deleteMany({ where: { email: { contains: PREFIX } } });
  await prisma.fileObject.deleteMany({ where: { originalName: { startsWith: PREFIX } } });
}

beforeEach(async () => {
  sentCodes.length = 0;
  await wipe();
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe('login OTP request — account states', () => {
  it('404s an address that was never registered', async () => {
    const response = await requestOtp(email('nobody'));

    expect(response.status).toBe(404);
    expect(response.body.errors[0]).toMatchObject({ field: 'email' });
  });

  it('sends a code to an active member', async () => {
    await makeUser('active');

    const response = await requestOtp(email('active'));

    expect(response.status).toBe(200);
    expect(sentCodes).toHaveLength(1);
  });

  it('still sends a code to a pending applicant, who signs in to track the application', async () => {
    await makeUser('pending', { role: 'APPLICANT', status: 'PENDING' });

    const response = await requestOtp(email('pending'));

    expect(response.status).toBe(200);
    expect(sentCodes).toHaveLength(1);
  });

  it('points an administrator at password sign-in', async () => {
    await makeUser('admin', { role: 'ADMIN' });

    const response = await requestOtp(email('admin'));

    expect(response.status).toBe(400);
    expect(sentCodes).toHaveLength(0);
  });

  it.each(['REJECTED', 'SUSPENDED', 'DEACTIVATED'] as const)('refuses a %s account with 403', async (status) => {
    await makeUser(`blocked-${status}`, { status });

    const response = await requestOtp(email(`blocked-${status}`));

    expect(response.status).toBe(403);
    expect(sentCodes).toHaveLength(0);
  });
});

describe('soft-deleted accounts', () => {
  it('reads as "not registered" rather than handing out a code', async () => {
    await makeUser('deleted', { deleted: true });

    const response = await requestOtp(email('deleted'));

    expect(response.status).toBe(404);
    expect(sentCodes).toHaveLength(0);
  });

  it('is indistinguishable from an address that never existed', async () => {
    await makeUser('deleted', { deleted: true });

    const [gone, unknown] = await Promise.all([requestOtp(email('deleted')), requestOtp(email('nobody'))]);

    expect(gone.status).toBe(unknown.status);
    expect(gone.body.message).toBe(unknown.body.message);
    expect(gone.body.errors).toEqual(unknown.body.errors);
  });

  it('404s on resend as well as on request', async () => {
    await makeUser('deleted', { deleted: true });

    const response = await resendOtp(email('deleted'));

    expect(response.status).toBe(404);
  });

  it('cannot exchange a code minted before deletion for a session', async () => {
    const user = await makeUser('deleted-later');
    const requested = await requestOtp(email('deleted-later'));
    expect(requested.status).toBe(200);
    const code = sentCodes.at(-1)!;

    // Deleted while the code was still live.
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

    const response = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ purpose: 'LOGIN', email: email('deleted-later'), code });

    expect(response.status).toBe(404);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('refuses a refresh token issued before deletion', async () => {
    const user = await makeUser('deleted-refresh');
    await requestOtp(email('deleted-refresh'));
    const verified = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ purpose: 'LOGIN', email: email('deleted-refresh'), code: sentCodes.at(-1)! });
    expect(verified.status).toBe(200);
    const cookie = verified.headers['set-cookie'];

    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

    const response = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(response.status).toBe(401);
  });

  it('releases the address so it can be registered again', async () => {
    const gone = await makeUser('reclaim', { deleted: true });

    const upload = async (name: string, body: Buffer, type: string) => {
      const res = await request(app)
        .post('/api/v1/files/registration')
        .attach('file', body, { filename: name, contentType: type });
      expect(res.status).toBe(201);
      return res.body.data as { id: string; claimToken: string };
    };
    const cv = await upload(`${PREFIX}-cv.pdf`, pdf, 'application/pdf');
    const credential = await upload(`${PREFIX}-cred.png`, png, 'image/png');

    const payload = {
      purpose: 'REGISTER' as const,
      fullName: 'Reclaimed Account',
      email: email('reclaim'),
      professionalType: 'Research Scholar / Scientist',
      institution: `${PREFIX} Institute`,
      credentials: 'PhD, clinical research license, and professional certification.',
      education: 'PhD in Clinical Psychology, Test University, 2024.',
      researchInterests: 'Digital mental health, community care, and assessment.',
      documents: [
        { kind: 'CV' as const, fileId: cv.id, claimToken: cv.claimToken },
        { kind: 'CREDENTIAL' as const, fileId: credential.id, claimToken: credential.claimToken },
      ],
      agreeTerms: true as const,
    };

    // The soft-deleted row must not read as a live conflict.
    const requested = await request(app).post('/api/v1/auth/otp/request').send(payload);
    expect(requested.status).toBe(200);

    const verified = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ purpose: 'REGISTER', email: email('reclaim'), code: sentCodes.at(-1)! });
    expect(verified.status).toBe(201);

    // The old row survives to anchor its history, parked on an undeliverable
    // address so the real one is free.
    const tombstoned = await prisma.user.findUniqueOrThrow({ where: { id: gone.id } });
    expect(tombstoned.email).toBe(`deleted+${gone.id}@deleted.invalid`);
    expect(tombstoned.deletedAt).not.toBeNull();

    const fresh = await prisma.user.findUniqueOrThrow({ where: { email: email('reclaim') } });
    expect(fresh.id).not.toBe(gone.id);
    expect(fresh.deletedAt).toBeNull();
  });
});

describe('login OTP resend — parity with request', () => {
  it('points an administrator at password sign-in, as request does', async () => {
    await makeUser('admin-resend', { role: 'ADMIN' });

    const response = await resendOtp(email('admin-resend'));

    expect(response.status).toBe(400);
  });

  it('404s an unknown address', async () => {
    const response = await resendOtp(email('nobody'));

    expect(response.status).toBe(404);
  });
});
