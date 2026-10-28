import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../config/database';
import {
  CEREMONY_REGISTRATION_RATE_LIMIT,
  CEREMONY_REGISTRATION_RATE_WINDOW_MS,
} from '../domain/ceremony-registration';
import { logger } from '../utils/logger';
import { sha256, signAccessToken } from '../utils/security';

const app = createApp();
const prefix = `ceremony-${randomUUID().slice(0, 8)}`;
const path = '/api/v1/public/awards/second-international/registrations';
const adminPath = '/api/v1/admin/ceremony-registrations';
const email = `${prefix}@example.test`;
const phone = '+447700900123';
const institution = `Institute ${prefix}`;
const message = `Private note ${prefix}`;
let adminToken = '';
let memberToken = '';
let adminId = '';
let memberId = '';

const valid = (overrides: Record<string, unknown> = {}) => ({
  fullName: `Ada ${prefix}`,
  email,
  phone,
  institution,
  designation: 'Researcher',
  participationType: 'DELEGATE',
  message,
  consent: true,
  ...overrides,
});

beforeAll(async () => {
  const admin = await prisma.user.create({ data: { fullName: 'Ceremony test admin', email: `${prefix}-admin@example.test`, role: 'ADMIN', status: 'ACTIVE' } });
  const member = await prisma.user.create({ data: { fullName: 'Ceremony test member', email: `${prefix}-member@example.test`, role: 'MEMBER', status: 'ACTIVE' } });
  adminId = admin.id;
  memberId = member.id;
  const adminSession = await prisma.session.create({ data: { userId: admin.id, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  const memberSession = await prisma.session.create({ data: { userId: member.id, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  adminToken = signAccessToken({ sub: admin.id, sessionId: adminSession.id, role: 'ADMIN' });
  memberToken = signAccessToken({ sub: member.id, sessionId: memberSession.id, role: 'MEMBER' });
});

afterAll(async () => {
  const rows = await prisma.ceremonyRegistration.findMany({ where: { emailNormalized: { contains: prefix } }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: rows.map((row) => row.id) } } });
  await prisma.ceremonyRegistration.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: [adminId, memberId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminId, memberId] } } });
  await prisma.$disconnect();
});

describe('ceremony interest registration', () => {
  it('saves one interest record and keeps personal details out of the public response and audit log', async () => {
    const eventsBefore = await prisma.eventRegistration.count();
    const response = await request(app).post(path).send(valid());
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toEqual({ success: true, data: { received: true }, message: 'Your registration of interest has been received.' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(response.body).toLowerCase()).not.toContain('email');
    expect(await prisma.eventRegistration.count()).toBe(eventsBefore);

    const rows = await prisma.ceremonyRegistration.findMany({ where: { emailNormalized: email } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ceremonySlug: 'second-international', fullName: `Ada ${prefix}`, phone, institution, designation: 'Researcher', participationType: 'DELEGATE', message });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: rows[0]!.id } });
    const auditText = JSON.stringify(audit);
    for (const secret of [email, phone, institution, message, `Ada ${prefix}`]) expect(auditText).not.toContain(secret);
    expect(audit.action).toBe('CeremonyInterestRegistered');
  });

  it('updates the same ceremony and email instead of creating a duplicate', async () => {
    const created = await prisma.ceremonyRegistration.findFirstOrThrow({ where: { emailNormalized: email } });
    const response = await request(app).post(path).send(valid({
      email: email.toUpperCase(),
      fullName: `Updated ${prefix}`,
      participationType: 'AWARD_NOMINATION',
      designation: '',
      message: `Updated note ${prefix}`,
    }));
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Your registration of interest has been received.');
    const rows = await prisma.ceremonyRegistration.findMany({ where: { emailNormalized: email } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: created.id, fullName: `Updated ${prefix}`, participationType: 'AWARD_NOMINATION', designation: null, message: `Updated note ${prefix}` });
    expect(rows[0]!.createdAt).toEqual(created.createdAt);
  });

  it('rejects invalid interest and unknown ceremonies without saving', async () => {
    const before = await prisma.ceremonyRegistration.count({ where: { emailNormalized: { contains: prefix } } });
    const missing = await request(app).post(path).send(valid({ fullName: 'A', phone: '07700900123', participationType: 'Guest', consent: false, extra: true }));
    expect(missing.status).toBe(422);
    const fields = missing.body.errors.map((error: { field: string }) => error.field);
    for (const field of ['fullName', 'phone', 'participationType', 'consent']) expect(fields).toContain(field);
    expect(JSON.stringify(missing.body.errors)).toContain('extra');
    const unknown = await request(app).post('/api/v1/public/awards/other-ceremony/registrations').send(valid({ email: `other-${prefix}@example.test` }));
    expect(unknown.status).toBe(404);
    const longMessage = await request(app).post(path).send(valid({ message: 'x'.repeat(1001) }));
    expect(longMessage.status).toBe(422);
    expect(longMessage.body.errors.map((error: { field: string }) => error.field)).toContain('message');
    expect(await prisma.ceremonyRegistration.count({ where: { emailNormalized: { contains: prefix } } })).toBe(before);
  });

  it('shows saved interests only to an administrator', async () => {
    const anonymous = await request(app).get(adminPath);
    const member = await request(app).get(adminPath).set('Authorization', `Bearer ${memberToken}`);
    const admin = await request(app).get(adminPath).query({ ceremony: 'second-international' }).set('Authorization', `Bearer ${adminToken}`);
    expect(anonymous.status).toBe(401);
    expect(member.status).toBe(403);
    expect(JSON.stringify(anonymous.body)).not.toContain(email);
    expect(JSON.stringify(member.body)).not.toContain(email);
    expect(admin.status).toBe(200);
    expect(admin.headers['cache-control']).toBe('no-store');
    expect(admin.body.data.items.find((row: { email: string }) => row.email === email)).toMatchObject({ fullName: `Updated ${prefix}`, participationLabel: 'Interested in award nomination' });
    expect(await request(app).get(path).set('Authorization', `Bearer ${adminToken}`)).toMatchObject({ status: 404 });
  });

  it('returns a safe error and keeps the email out of logs when saving fails', async () => {
    const secret = `fail-${prefix}@example.test`;
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const transaction = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error(`database down ${secret}`));
    const response = await request(app).post(path).send(valid({ email: secret, fullName: `Fail ${prefix}` }));
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Could not save your registration. Please try again.');
    expect(JSON.stringify(response.body)).not.toContain(secret);
    expect(JSON.stringify(logged.mock.calls)).not.toContain(secret);
    expect(await prisma.ceremonyRegistration.count({ where: { emailNormalized: secret } })).toBe(0);
    transaction.mockRestore();
    logged.mockRestore();
  });

  it('stops further anonymous attempts after the public limit', async () => {
    const limited = express();
    limited.use(express.json());
    let saved = 0;
    limited.post('/', rateLimit({
      windowMs: CEREMONY_REGISTRATION_RATE_WINDOW_MS,
      limit: CEREMONY_REGISTRATION_RATE_LIMIT,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, message: 'Too many registration attempts. Please try again later.', errors: [] },
    }), (_req, res) => {
      saved += 1;
      res.status(200).json({ success: true });
    });
    for (let attempt = 0; attempt < CEREMONY_REGISTRATION_RATE_LIMIT; attempt += 1) {
      expect((await request(limited).post('/').send({ email })).status).toBe(200);
    }
    const blocked = await request(limited).post('/').send({ email });
    expect(blocked.status).toBe(429);
    expect(JSON.stringify(blocked.body)).not.toContain(email);
    expect(saved).toBe(CEREMONY_REGISTRATION_RATE_LIMIT);
  });
});
