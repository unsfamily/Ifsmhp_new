import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { sha256, signAccessToken } from '../utils/security';

vi.mock('../services/mail.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/mail.service')>();
  return { ...actual, sendAwardNominationAcknowledgement: vi.fn(async () => true) };
});

import { sendAwardNominationAcknowledgement } from '../services/mail.service';

const app = createApp();
const prefix = `award-${randomUUID().slice(0, 8)}`;
const path = '/api/v1/public/awards/second-international/nominations';
const adminPath = '/api/v1/admin/award-nominations';
const nomineeEmail = `${prefix}-nominee@example.test`;
const nominatorEmail = `${prefix}-nominator@example.test`;
const nomineeName = `Nominee ${prefix}`;
const statement = `Independent review note ${prefix}`;
let adminToken = '';
let memberToken = '';
let adminId = '';
let memberId = '';

const text = (value: string) => value;
const valid = (overrides: Record<string, unknown> = {}) => ({
  awardCode: 'SWAMINATHAN',
  division: 'EXCELLENCE',
  nomineeName,
  dateOfBirth: '1 January 1970',
  nationality: 'Indian',
  qualification: 'PhD',
  designation: 'Professor',
  institution: `Institute ${prefix}`,
  specialisation: 'Agriculture',
  yearsOfContribution: '20',
  countryOfResidence: 'India',
  nomineeEmail,
  nomineePhone: '+919876543210',
  careerOverview: text('Career overview'),
  principalContributions: text('Principal contributions'),
  impact: text('National impact'),
  leadership: text('Mentoring'),
  majorAwards: text('Prior distinctions'),
  publications: text('Selected publications'),
  patents: text('None recorded'),
  projects: text('Research projects'),
  institutionsEstablished: text('Programmes established'),
  societalImpact: text('Documented impact'),
  statement,
  nominationType: 'COLLEAGUE',
  nominatorName: `Nominator ${prefix}`,
  nominatorDesignation: 'Director',
  nominatorInstitution: `College ${prefix}`,
  nominatorEmail,
  nominatorPhone: '+919876543211',
  relationship: 'Professional colleague',
  checklistCv: true,
  checklistStatement: true,
  checklistEvidence: true,
  checklistPhotograph: true,
  checklistConsent: true,
  declaration: true,
  ...overrides,
});

beforeAll(async () => {
  const admin = await prisma.user.create({ data: { fullName: 'Nomination test admin', email: `${prefix}-admin@example.test`, role: 'ADMIN', status: 'ACTIVE' } });
  const member = await prisma.user.create({ data: { fullName: 'Nomination test member', email: `${prefix}-member@example.test`, role: 'MEMBER', status: 'ACTIVE' } });
  adminId = admin.id;
  memberId = member.id;
  const adminSession = await prisma.session.create({ data: { userId: admin.id, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  const memberSession = await prisma.session.create({ data: { userId: member.id, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  adminToken = signAccessToken({ sub: admin.id, sessionId: adminSession.id, role: 'ADMIN' });
  memberToken = signAccessToken({ sub: member.id, sessionId: memberSession.id, role: 'MEMBER' });
});

afterAll(async () => {
  const rows = await prisma.awardNomination.findMany({ where: { nomineeEmailNormalized: { contains: prefix } }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: rows.map((row) => row.id) } } });
  await prisma.awardNomination.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: [adminId, memberId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminId, memberId] } } });
  await prisma.$disconnect();
});

describe('award nomination', () => {
  it('saves a nomination and reports an acknowledgement only when mail accepts it', async () => {
    const response = await request(app).post(path).send(valid());
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toEqual({ success: true, data: { received: true, acknowledgementSent: true }, message: 'Your nomination has been received.' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(response.body)).not.toContain(nomineeEmail);
    expect(JSON.stringify(response.body)).not.toContain(statement);

    const rows = await prisma.awardNomination.findMany({ where: { nomineeEmailNormalized: nomineeEmail, awardCode: 'SWAMINATHAN' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ceremonySlug: 'second-international',
      awardName: 'Dr. M. S. Swaminathan Award',
      division: 'EXCELLENCE',
      nomineeName,
      nominatorEmail,
    });
    expect(rows[0]!.reference).toMatch(/^AWD-2026-/);
    expect(rows[0]!.acknowledgementSentAt).toBeInstanceOf(Date);
    expect(sendAwardNominationAcknowledgement).toHaveBeenCalledWith(nominatorEmail, rows[0]!.reference);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: rows[0]!.id, action: 'AwardNominationSubmitted' } });
    const auditText = JSON.stringify(audit);
    for (const secret of [nomineeEmail, nominatorEmail, nomineeName, statement]) expect(auditText).not.toContain(secret);
  });

  it('updates the same nominee and award without sending another acknowledgement', async () => {
    const created = await prisma.awardNomination.findFirstOrThrow({ where: { nomineeEmailNormalized: nomineeEmail, awardCode: 'SWAMINATHAN' } });
    vi.mocked(sendAwardNominationAcknowledgement).mockClear();
    const response = await request(app).post(path).send(valid({
      nomineeEmail: nomineeEmail.toUpperCase(),
      nomineeName: `Updated ${prefix}`,
      statement: `Updated statement ${prefix}`,
    }));
    expect(response.status).toBe(200);
    expect(response.body.data.acknowledgementSent).toBe(false);
    expect(sendAwardNominationAcknowledgement).not.toHaveBeenCalled();
    const rows = await prisma.awardNomination.findMany({ where: { nomineeEmailNormalized: nomineeEmail, awardCode: 'SWAMINATHAN' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: created.id, nomineeName: `Updated ${prefix}`, statement: `Updated statement ${prefix}` });
    expect(rows[0]!.createdAt).toEqual(created.createdAt);
  });

  it('does not claim an acknowledgement when mail is not accepted', async () => {
    vi.mocked(sendAwardNominationAcknowledgement).mockResolvedValueOnce(false);
    const email = `${prefix}-unsent@example.test`;
    const response = await request(app).post(path).send(valid({ nomineeEmail: email, nominatorEmail: `${prefix}-sender@example.test`, awardCode: 'KALAM', division: undefined }));
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.data).toEqual({ received: true, acknowledgementSent: false });
    const row = await prisma.awardNomination.findFirstOrThrow({ where: { nomineeEmailNormalized: email, awardCode: 'KALAM' } });
    expect(row.division).toBeNull();
    expect(row.awardName).toBe('Dr. A. P. J. Abdul Kalam Gold Medal');
    expect(row.acknowledgementSentAt).toBeNull();
  });

  it('rejects an incomplete nomination and an unknown ceremony', async () => {
    const before = await prisma.awardNomination.count({ where: { nomineeEmailNormalized: { contains: prefix } } });
    const missingDivision = await request(app).post(path).send(valid({ division: undefined }));
    expect(missingDivision.status).toBe(422);
    expect(missingDivision.body.errors.map((error: { field: string }) => error.field)).toContain('division');
    const missingDeclaration = await request(app).post(path).send(valid({ declaration: false }));
    expect(missingDeclaration.status).toBe(422);
    expect(missingDeclaration.body.errors.map((error: { field: string }) => error.field)).toContain('declaration');
    const extra = await request(app).post(path).send(valid({ extra: true }));
    expect(extra.status).toBe(422);
    expect(JSON.stringify(extra.body.errors)).toContain('extra');
    const medalDivision = await request(app).post(path).send(valid({ awardCode: 'SARABHAI', division: 'EXCELLENCE', nomineeEmail: `${prefix}-medal@example.test` }));
    expect(medalDivision.status).toBe(422);
    expect(medalDivision.body.errors.map((error: { field: string }) => error.field)).toContain('division');
    const unknown = await request(app).post('/api/v1/public/awards/other-ceremony/nominations').send(valid({ nomineeEmail: `${prefix}-other@example.test` }));
    expect(unknown.status).toBe(404);
    expect(await prisma.awardNomination.count({ where: { nomineeEmailNormalized: { contains: prefix } } })).toBe(before);
  });

  it('shows saved nominations only to an administrator', async () => {
    const anonymous = await request(app).get(adminPath);
    const member = await request(app).get(adminPath).set('Authorization', `Bearer ${memberToken}`);
    const admin = await request(app).get(adminPath).query({ ceremony: 'second-international' }).set('Authorization', `Bearer ${adminToken}`);
    expect(anonymous.status).toBe(401);
    expect(member.status).toBe(403);
    expect(JSON.stringify(anonymous.body)).not.toContain(nomineeEmail);
    expect(JSON.stringify(member.body)).not.toContain(nomineeEmail);
    expect(admin.status).toBe(200);
    expect(admin.headers['cache-control']).toBe('no-store');
    expect(admin.body.data.items.find((row: { nomineeEmail: string }) => row.nomineeEmail === nomineeEmail)).toMatchObject({ nomineeName: `Updated ${prefix}`, awardName: 'Dr. M. S. Swaminathan Award' });
  });

  it('returns a safe error and keeps the email out of logs when saving fails', async () => {
    const secret = `fail-${prefix}@example.test`;
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const transaction = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error(`database down ${secret}`));
    const response = await request(app).post(path).send(valid({ nomineeEmail: secret }));
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Could not save your nomination. Please try again.');
    expect(JSON.stringify(response.body)).not.toContain(secret);
    expect(JSON.stringify(logged.mock.calls)).not.toContain(secret);
    expect(await prisma.awardNomination.count({ where: { nomineeEmailNormalized: secret } })).toBe(0);
    transaction.mockRestore();
    logged.mockRestore();
  });
});
