import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { readXlsxEntries } from '../utils/excel-sheet';
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

const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function upload(name: string, body: Buffer, type: string) {
  const response = await request(app).post('/api/v1/files/registration').attach('file', body, { filename: name, contentType: type });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return { fileId: response.body.data.id as string, claimToken: response.body.data.claimToken as string };
}

const valid = async (overrides: Record<string, unknown> = {}) => ({
  awardCode: 'SWAMINATHAN',
  division: 'EXCELLENCE',
  nomineeName,
  dateOfBirth: '1 January 1970',
  nationality: 'Indian',
  qualification: 'PhD',
  designation: 'Professor',
  institution: `Institute ${prefix}`,
  yearsOfContribution: '20',
  countryOfResidence: 'India',
  nomineeEmail,
  nomineePhone: '+919876543210',
  careerOverview: 'Career overview',
  principalContributions: 'Principal contributions',
  majorAwards: 'Prior distinctions',
  publications: 'Selected publications',
  projects: 'Research projects',
  statement,
  nominationType: 'COLLEAGUE',
  nominatorName: `Nominator ${prefix}`,
  nominatorDesignation: 'Director',
  nominatorInstitution: `College ${prefix}`,
  nominatorEmail,
  nominatorPhone: '+919876543211',
  relationship: 'Professional colleague',
  cv: await upload(`${prefix}-cv.pdf`, pdf, 'application/pdf'),
  photo: await upload(`${prefix}-photo.png`, png, 'image/png'),
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
    const response = await request(app).post(path).send(await valid());
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
      specialisation: '',
      impact: '',
      leadership: '',
      patents: '',
      institutionsEstablished: '',
      societalImpact: '',
      checklistCv: true,
      checklistEvidence: true,
      checklistConsent: true,
      checklistHonours: false,
      checklistRecommendation: false,
      checklistPhotograph: true,
    });
    expect(rows[0]!.cvFileId).toBeTruthy();
    expect(rows[0]!.photoFileId).toBeTruthy();
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
    const response = await request(app).post(path).send(await valid({
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
    const response = await request(app).post(path).send(await valid({ nomineeEmail: email, nominatorEmail: `${prefix}-sender@example.test`, awardCode: 'KALAM', division: undefined }));
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.data).toEqual({ received: true, acknowledgementSent: false });
    const row = await prisma.awardNomination.findFirstOrThrow({ where: { nomineeEmailNormalized: email, awardCode: 'KALAM' } });
    expect(row.division).toBeNull();
    expect(row.awardName).toBe('Dr. A. P. J. Abdul Kalam Gold Medal');
    expect(row.acknowledgementSentAt).toBeNull();
  });

  it('rejects an incomplete nomination and an unknown ceremony', async () => {
    const before = await prisma.awardNomination.count({ where: { nomineeEmailNormalized: { contains: prefix } } });
    const missingDivision = await request(app).post(path).send(await valid({ division: undefined }));
    expect(missingDivision.status).toBe(422);
    expect(missingDivision.body.errors.map((error: { field: string }) => error.field)).toContain('division');
    const missingDeclaration = await request(app).post(path).send(await valid({ declaration: false }));
    expect(missingDeclaration.status).toBe(422);
    expect(missingDeclaration.body.errors.map((error: { field: string }) => error.field)).toContain('declaration');
    const extra = await request(app).post(path).send(await valid({ extra: true }));
    expect(extra.status).toBe(422);
    expect(JSON.stringify(extra.body.errors)).toContain('extra');
    const medalDivision = await request(app).post(path).send(await valid({ awardCode: 'SARABHAI', division: 'EXCELLENCE', nomineeEmail: `${prefix}-medal@example.test` }));
    expect(medalDivision.status).toBe(422);
    expect(medalDivision.body.errors.map((error: { field: string }) => error.field)).toContain('division');
    const unknown = await request(app).post('/api/v1/public/awards/other-ceremony/nominations').send(await valid({ nomineeEmail: `${prefix}-other@example.test` }));
    expect(unknown.status).toBe(404);
    expect(await prisma.awardNomination.count({ where: { nomineeEmailNormalized: { contains: prefix } } })).toBe(before);
  });

  it('rejects a CV of the wrong type and a photograph that reuses the CV', async () => {
    const before = await prisma.awardNomination.count({ where: { nomineeEmailNormalized: { contains: prefix } } });
    const wrongCv = await upload(`${prefix}-not-a-cv.png`, png, 'image/png');
    const photo = await upload(`${prefix}-separate.png`, png, 'image/png');
    const wrongType = await request(app).post(path).send(await valid({
      nomineeEmail: `${prefix}-bad-cv@example.test`,
      cv: wrongCv,
      photo,
    }));
    expect(wrongType.status, JSON.stringify(wrongType.body)).toBe(422);
    expect(wrongType.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'cv' })]));
    const reused = await request(app).post(path).send(await valid({
      nomineeEmail: `${prefix}-same-file@example.test`,
      cv: photo,
      photo,
    }));
    expect(reused.status, JSON.stringify(reused.body)).toBe(422);
    expect(reused.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'photo' })]));
    expect(await prisma.awardNomination.count({ where: { nomineeEmailNormalized: { contains: prefix } } })).toBe(before);
  });

  it('keeps nominations with the same update time in id order', async () => {
    const firstEmail = `${prefix}-order-first@example.test`;
    const secondEmail = `${prefix}-order-second@example.test`;
    expect((await request(app).post(path).send(await valid({ nomineeEmail: firstEmail, awardCode: 'SALIM_ALI' }))).status).toBe(200);
    expect((await request(app).post(path).send(await valid({ nomineeEmail: secondEmail, awardCode: 'NK_BOSE' }))).status).toBe(200);
    const rows = await prisma.awardNomination.findMany({
      where: { nomineeEmailNormalized: { in: [firstEmail, secondEmail] } },
      select: { id: true },
    });
    const stamp = new Date('2099-01-01T00:00:00.000Z');
    for (const row of rows) {
      await prisma.$executeRaw`UPDATE AwardNomination SET updatedAt = ${stamp} WHERE id = ${row.id}`;
    }
    const listed = await request(app).get(adminPath).query({ ceremony: 'second-international', page: 1, limit: 2 }).set('Authorization', `Bearer ${adminToken}`);
    expect(listed.status, JSON.stringify(listed.body)).toBe(200);
    expect(listed.body.data.items.map((row: { id: string }) => row.id)).toEqual([...rows.map((row) => row.id)].sort().reverse());
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
    const paged = await request(app).get(adminPath).query({ ceremony: 'second-international', page: 1, limit: 1 }).set('Authorization', `Bearer ${adminToken}`);
    expect(paged.status).toBe(200);
    expect(paged.body.data.items).toHaveLength(1);
    expect(paged.body.data.pagination).toMatchObject({ page: 1, limit: 1 });
    expect(paged.body.data.pagination.pages).toBe(paged.body.data.pagination.total);
    const saved = admin.body.data.items.find((row: { nomineeEmail: string }) => row.nomineeEmail === nomineeEmail);
    const detail = await request(app).get(`${adminPath}/${saved.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.statement).toContain(prefix);
    expect(detail.body.data.nomineeEmailNormalized).toBeUndefined();
    const csv = await request(app).get(`${adminPath}/export`).query({ format: 'csv', ceremony: 'second-international' }).set('Authorization', `Bearer ${adminToken}`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.headers['content-disposition']).toContain('.csv');
    expect(csv.headers['cache-control']).toBe('private, no-store');
    expect(csv.text.startsWith('\uFEFFReference,')).toBe(true);
    expect(csv.text).toContain(`Updated ${prefix}`);
    expect(csv.text).toContain(`${prefix}-unsent@example.test`);
    expect(csv.text).toContain('Updated statement');
    expect(csv.text).not.toContain('nomineeEmailNormalized');
    const workbook = await request(app).get(`${adminPath}/export`).query({ format: 'xlsx', ceremony: 'second-international' }).set('Authorization', `Bearer ${adminToken}`).buffer(true).parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });
    expect(workbook.status).toBe(200);
    expect(workbook.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(workbook.headers['content-disposition']).toContain('.xlsx');
    const worksheet = readXlsxEntries(workbook.body as Buffer).get('xl/worksheets/sheet1.xml') ?? '';
    expect(worksheet).toContain(`Updated ${prefix}`);
    expect(worksheet).toContain(`${prefix}-unsent@example.test`);
    expect((await request(app).get(`${adminPath}/export`)).status).toBe(401);
    expect((await request(app).get(`${adminPath}/export`).set('Authorization', `Bearer ${memberToken}`)).status).toBe(403);
    expect((await request(app).get(`${adminPath}/export`).query({ format: 'pdf' }).set('Authorization', `Bearer ${adminToken}`)).status).toBe(422);
    expect((await request(app).get(`${adminPath}/export`).query({ page: 1, limit: 1, format: 'csv' }).set('Authorization', `Bearer ${adminToken}`)).status).toBe(422);
    const exportAudit = await prisma.auditLog.findFirstOrThrow({ where: { actorId: adminId, action: 'AwardNominationExported' } });
    expect(JSON.stringify(exportAudit)).not.toContain(nomineeEmail);
    expect(JSON.stringify(exportAudit)).not.toContain(statement);
    expect((await request(app).get(`${adminPath}/${saved.id}`)).status).toBe(401);
    expect((await request(app).get(`${adminPath}/${saved.id}`).set('Authorization', `Bearer ${memberToken}`)).status).toBe(403);
    const removed = await request(app).delete(`${adminPath}/${saved.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.reference).toBe(saved.reference);
    expect((await request(app).get(`${adminPath}/${saved.id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
    expect((await request(app).delete(`${adminPath}/${saved.id}`).set('Authorization', `Bearer ${memberToken}`)).status).toBe(403);
  });

  it('returns a safe error and keeps the email out of logs when saving fails', async () => {
    const secret = `fail-${prefix}@example.test`;
    const body = await valid({ nomineeEmail: secret });
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const transaction = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error(`database down ${secret}`));
    const response = await request(app).post(path).send(body);
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Could not save your nomination. Please try again.');
    expect(JSON.stringify(response.body)).not.toContain(secret);
    expect(JSON.stringify(logged.mock.calls)).not.toContain(secret);
    expect(await prisma.awardNomination.count({ where: { nomineeEmailNormalized: secret } })).toBe(0);
    transaction.mockRestore();
    logged.mockRestore();
  });
});
