import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
vi.mock('../services/mail.service', () => ({ sendOtpEmail: vi.fn(), sendApprovalEmail: vi.fn(), sendEventEmail: vi.fn(async () => true), verifyTransport: vi.fn() }));
import { prisma } from '../config/database';
import { createApp } from '../app';
import { hashPassword, sha256, signAccessToken } from '../utils/security';
import { writeAudit } from '../services/audit.service';
import { sendOtpEmail } from '../services/mail.service';
import { logger } from '../utils/logger';
import { assertSafePath, uploadRoot } from '../utils/fileStorage';

const app = createApp(), prefix = `audit-test-${randomUUID().slice(0, 8)}`, base = '/api/v1/admin/audit-log';
type Actor = { id: string; token: string; sessionId: string; email: string };
let admin: Actor, member: Actor, applicant: Actor, moderator: Actor;
const userIds: string[] = [], eventIds: string[] = [], fileIds: string[] = [], fileKeys: string[] = [], communityIds: string[] = [];
const api = (method: 'get' | 'post' | 'patch' | 'delete', url: string, actor = admin) => request(app)[method](url).set('Authorization', `Bearer ${actor.token}`);
async function actor(role: 'ADMIN' | 'MEMBER' | 'APPLICANT', name: string = role) {
  const user = await prisma.user.create({ data: { email: `${prefix}-${name}@example.test`, fullName: `${prefix} ${name}`, role, status: role === 'APPLICANT' ? 'PENDING' : 'ACTIVE', ...(role === 'ADMIN' ? { passwordHash: await hashPassword('Audit-password-2026!') } : {}) } });
  userIds.push(user.id);
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  return { id: user.id, email: user.email, sessionId: session.id, token: signAccessToken({ sub: user.id, role, sessionId: session.id }) };
}
async function fixture(data: Partial<Prisma.AuditLogUncheckedCreateInput> = {}) {
  return prisma.auditLog.create({ data: { actorId: admin.id, actorLabel: prefix, actorRole: 'ADMIN', action: `${prefix}Legacy`, entity: `${prefix} Entity`, description: `${prefix} historical record`, ...data } });
}
let rejectAuditInsert = false;
let afterAuditBatch: (() => Promise<void>) | null = null;
prisma.$use(async (params, next) => {
  if (rejectAuditInsert && params.model === 'AuditLog' && params.action === 'create') throw new Error('Injected audit insert failure');
  const result = await next(params);
  if (params.model === 'AuditLog' && params.action === 'findMany' && params.args?.take === 500 && afterAuditBatch) { const insert = afterAuditBatch; afterAuditBatch = null; await insert(); }
  return result;
});
async function failAudit() { rejectAuditInsert = true; }
beforeAll(async () => {
  admin = await actor('ADMIN'); member = await actor('MEMBER'); applicant = await actor('APPLICANT'); moderator = await actor('MEMBER', 'MODERATOR');
  await prisma.memberProfile.create({ data: { userId: member.id, memberId: prefix, professionalType: 'Scientist', institution: 'Test institution' } });
  const community = await prisma.community.create({ data: { name: prefix, slug: prefix, description: 'Private audit permission fixture', category: 'Research', createdById: admin.id, memberships: { create: { userId: moderator.id, role: 'MODERATOR', status: 'ACTIVE' } } } });
  communityIds.push(community.id);
});
afterEach(async () => { rejectAuditInsert = false; afterAuditBatch = null; vi.restoreAllMocks(); });
afterAll(async () => {
  rejectAuditInsert = false;
  await prisma.community.deleteMany({ where: { id: { in: communityIds } } });
  await prisma.galleryAlbum.deleteMany({ where: { label: { startsWith: prefix } } });
  await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  const support = await prisma.supportRequest.findMany({ where: { requesterId: { in: userIds } } });
  await prisma.supportRequest.deleteMany({ where: { requesterId: { in: userIds } } });
  await prisma.conversation.deleteMany({ where: { OR: [{ id: { in: support.flatMap(s => s.conversationId ? [s.conversationId] : []) } }, { participants: { some: { userId: { in: userIds } } } }] } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: (await prisma.contactInquiry.findMany({ where: { subject: { startsWith: prefix } }, select: { id: true } })).map(r => r.id) } } });
  await prisma.contactInquiry.deleteMany({ where: { subject: { startsWith: prefix } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: fileIds } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { actorLabel: { startsWith: prefix } }, { requestId: { startsWith: prefix } }, { deduplicationKey: { startsWith: prefix } }] } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await Promise.all(fileKeys.map(key => fs.unlink(assertSafePath(key)).catch(() => undefined)));
  await prisma.$disconnect();
});

describe('Audit API with real sessions and MySQL', () => {
  it.each(['', '/summary', '/options', '/export'])('restricts %s to active administrators, including against community moderators', async suffix => {
    const anonymous = await request(app).get(base + suffix);
    expect(anonymous.status).toBe(401);
    expect(await prisma.auditLog.findFirst({ where: { requestId: anonymous.headers['x-request-id'], action: 'AccessDenied', actorRole: 'UNAUTHENTICATED', actorId: null } })).not.toBeNull();
    for (const person of [member, applicant, moderator]) expect((await api('get', base + suffix, person)).status).toBe(403);
    await prisma.user.update({ where: { id: admin.id }, data: { status: 'SUSPENDED' } });
    try { expect((await api('get', base + suffix)).status).toBe(401); }
    finally { await prisma.user.update({ where: { id: admin.id }, data: { status: 'ACTIVE' } }); }
    expect((await api('get', base + suffix)).status).toBe(200);
  });
  it('rejects the existing development role-header bypass for sensitive audit history', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const response = await request(app).get(base).set('X-Test-Role', 'ADMIN').set('X-Test-User-Id', admin.id);
      expect(response.status).toBe(401);
      expect(await prisma.auditLog.findFirst({ where: { requestId: response.headers['x-request-id'], actorId: null, actorRole: 'UNAUTHENTICATED' } })).not.toBeNull();
      expect((await api('get', base)).status).toBe(200);
    } finally { process.env.NODE_ENV = previous; }
  });
  it('is append-only through application routes', async () => {
    for (const method of ['post', 'patch', 'delete'] as const) expect((await api(method, base).send({ action: 'Fabricated' })).status).toBe(404);
  });
  it('captures real gallery changes with immutable actor snapshots, safe fields and request context', async () => {
    const created = await api('post', '/api/v1/admin/gallery/categories').set('User-Agent', 'Audit test agent').send({ name: `${prefix} collection`, published: true });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const updated = await api('patch', `/api/v1/admin/gallery/categories/${id}`).set('X-Forwarded-For', '203.0.113.123').send({ published: false, description: 'PRIVATE PAYLOAD NEVER IN AUDIT' });
    expect(updated.status).toBe(200);
    const row = await prisma.auditLog.findFirstOrThrow({ where: { entityId: id, action: 'GalleryCollectionUpdated' } });
    expect(row).toMatchObject({ eventVersion: 1, actorId: admin.id, actorEmail: admin.email, actorLabel: `${prefix} ADMIN`, actorRole: 'ADMIN', source: 'ADMINISTRATOR', module: 'GALLERY', entityType: 'GalleryAlbum', outcome: 'SUCCEEDED' });
    expect(row.requestId).toBe(updated.headers['x-request-id']); expect(row.ipAddress).not.toBe('203.0.113.123');
    expect(row.changes).toEqual({ visibility: { before: 'PUBLIC', after: 'PRIVATE' } });
    expect(JSON.stringify(row)).not.toContain('PRIVATE PAYLOAD'); expect(+row.createdAt).toBeLessThanOrEqual(Date.now());
    await prisma.user.update({ where: { id: admin.id }, data: { fullName: 'Changed account name' } });
    try {
      const response = await api('get', base).query({ search: id });
      expect(response.body.data.items.find((r: { id: string }) => r.id === row.id).actorLabel).toBe(`${prefix} ADMIN`);
    } finally { await prisma.user.update({ where: { id: admin.id }, data: { fullName: `${prefix} ADMIN` } }); }
    const before = await prisma.auditLog.count({ where: { entityId: id } });
    await api('patch', `/api/v1/admin/gallery/categories/${id}`).send({ published: false });
    expect(await prisma.auditLog.count({ where: { entityId: id } })).toBe(before);
  });
  it('combines filters, includes UTC day boundaries, and deterministically pages equal timestamps in both directions', async () => {
    const action = `${prefix}Boundary`, at = new Date('2022-02-03T12:00:00Z');
    for (const [index, date] of [new Date('2022-02-02T23:59:59.999Z'), new Date('2022-02-03T00:00:00Z'), at, at, at, new Date('2022-02-03T23:59:59.999Z'), new Date('2022-02-04T00:00:00Z')].entries()) await fixture({ id: `${prefix}-boundary-${index}`, action, module: 'GALLERY', severity: 'WARNING', createdAt: date, actorEmail: `${prefix}@test.invalid` });
    const filter = { search: `${prefix}@test.invalid`, actorRole: 'ADMIN', module: 'GALLERY', action, severity: 'WARNING', from: '2022-02-03', to: '2022-02-03', limit: 2 };
    const ids: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const res = await api('get', base).query({ ...filter, page, sort: 'oldest' });
      expect(res.status).toBe(200); expect(res.body.data.pagination).toMatchObject({ total: 5, pages: 3 });
      ids.push(...res.body.data.items.map((r: { id: string }) => r.id));
    }
    expect(ids).toEqual([1, 2, 3, 4, 5].map(i => `${prefix}-boundary-${i}`));
    const newest = await api('get', base).query({ ...filter, limit: 100, sort: 'newest' });
    expect(newest.body.data.items.map((r: { id: string }) => r.id)).toEqual([...ids].reverse());
    const beyond = await api('get', base).query({ ...filter, page: 999 }); expect(beyond.body.data.pagination.page).toBe(3);
  });
  it.each([{ from: '2026-02-30' }, { from: 'not-date' }, { from: '2026-06-01', to: '2026-05-01' }, { page: 0 }, { limit: 101 }, { sort: 'random' }, { severity: 'bad' }, { search: 'x'.repeat(201) }, { unknown: 'field' }])('rejects invalid query %j', async filter => {
    expect((await api('get', base).query(filter)).status).toBe(422);
    expect((await api('get', base + '/export').query(filter)).status).toBe(422);
  });
  it('preserves records older than 365 days and renders legacy JSON without invented changes', async () => {
    const legacy = await fixture({ action: 'GalleryLegacyImported', createdAt: new Date('2001-01-01Z'), changes: { status: 'PRIVATE', password: 'NEVER EXPOSE', body: 'PRIVATE MESSAGE' } });
    const response = await api('get', base).query({ search: legacy.id });
    // IDs are target-searchable; event IDs remain available via their entity/actor filters.
    expect(response.status).toBe(200);
    const rows = (await api('get', base).query({ action: 'GalleryLegacyImported', module: 'GALLERY', from: '2001-01-01', to: '2001-01-01' })).body.data.items;
    const row = rows.find((r: { id: string }) => r.id === legacy.id);
    expect(row).toMatchObject({ eventVersion: 0, actorSnapshotAvailable: false, outcome: null, source: null, changes: null, legacyDetails: { status: 'PRIVATE' }, currentActor: { name: `${prefix} ADMIN` } });
    expect(JSON.stringify(row)).not.toContain('NEVER EXPOSE'); expect(JSON.stringify(row)).not.toContain('PRIVATE MESSAGE');
    expect((await prisma.auditLog.findUniqueOrThrow({ where: { id: legacy.id } })).changes).toEqual(legacy.changes);
    const malformed = await fixture({ action: `${prefix}Malformed`, changes: { status: { before: { nested: 'unavailable' }, after: 'PUBLIC' } } });
    const invalid = (await api('get', base).query({ action: malformed.action })).body.data.items[0];
    expect(invalid.changes).toBeNull(); expect(invalid.legacyDetails).toBeNull(); expect(invalid.legacyDetailsAvailable).toBe(true);
    const options = (await api('get', base + '/options')).body.data;
    expect(options.actions).toContain('GalleryLegacyImported'); expect(options.actorRoles).toEqual(expect.arrayContaining(['APPLICANT', 'UNAUTHENTICATED']));
  });
  it('computes summary windows from the database independently of timeline filters', async () => {
    const now = new Date(), day = 86400000;
    await fixture({ createdAt: new Date(+now - 8 * day), severity: 'DANGER' });
    const result = await api('get', base + '/summary'); expect(result.headers['cache-control']).toContain('no-store');
    const summary = result.body.data, time = new Date(summary.asOf);
    expect(summary.retention).toBe('INDEFINITE');
    expect(summary.admin24h).toBe(await prisma.auditLog.count({ where: { actorRole: 'ADMIN', createdAt: { gte: new Date(+time - day), lte: time } } }));
    expect(summary.danger7d).toBe(await prisma.auditLog.count({ where: { severity: 'DANGER', createdAt: { gte: new Date(+time - 7 * day), lte: time } } }));
    expect(summary.total).toBe(await prisma.auditLog.count());
  });
  it('exports all 503 matching rows in bounded batches with UTC, Unicode, escaping and formula protection', async () => {
    const action = `${prefix}Csv`;
    await prisma.auditLog.createMany({ data: Array.from({ length: 503 }, (_, i) => ({ id: `${prefix}-csv-${String(i).padStart(4, '0')}`, actorId: admin.id, actorLabel: i === 0 ? '=FORMULA' : `${prefix} தமிழ்`, actorRole: 'ADMIN', action, entity: `${prefix} export`, description: 'Quoted "value", line\nbreak', createdAt: new Date('2020-01-01T01:02:03Z') })) });
    let inserted = false;
    afterAuditBatch = async () => { inserted = true; await fixture({ id: `${prefix}-after-cutoff`, action }); };
    const exported = await api('get', base + '/export').query({ action, sort: 'oldest', limit: 1 });
    expect(inserted).toBe(true); expect(exported.text).not.toContain(`${prefix}-after-cutoff`);
    expect(exported.status).toBe(200); expect(exported.headers['content-type']).toContain('text/csv');
    expect((exported.text.match(new RegExp(`${prefix}-csv-`, 'g')) ?? [])).toHaveLength(503);
    expect(exported.text).toContain("'=FORMULA"); expect(exported.text).toContain('தமிழ்'); expect(exported.text).toContain('"Quoted ""value"", line\nbreak"'); expect(exported.text).toContain('2020-01-01T01:02:03.000Z');
    const event = await prisma.auditLog.findFirstOrThrow({ where: { requestId: exported.headers['x-request-id'], action: 'AuditLogExported' } });
    expect(event).toMatchObject({ outcome: 'ACCESS_GRANTED', severity: 'WARNING' }); expect(event.metadata).toMatchObject({ rows: 503, action }); expect(exported.text).not.toContain(event.id);
    const empty = await api('get', base + '/export').query({ action: `${prefix}Missing` }); expect(empty.status).toBe(200); expect(empty.text.split('\r\n')).toHaveLength(1);
  });
  it('records password success/failure without attributing unverified email attempts or copying secrets', async () => {
    const failed = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: 'Wrong-password-secret!' });
    expect(failed.status).toBe(401);
    const denied = await prisma.auditLog.findFirstOrThrow({ where: { requestId: failed.headers['x-request-id'] } });
    expect(denied).toMatchObject({ action: 'LoginFailed', actorId: null, actorEmail: null, actorRole: 'UNAUTHENTICATED', severity: 'DANGER', outcome: 'DENIED' });
    expect(JSON.stringify(denied)).not.toContain(admin.email); expect(JSON.stringify(denied)).not.toContain('Wrong-password');
    const success = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: 'Audit-password-2026!' }); expect(success.status).toBe(200);
    const recorded = await prisma.auditLog.findFirstOrThrow({ where: { requestId: success.headers['x-request-id'] } }); expect(recorded.action).toBe('LoginSucceeded'); expect(recorded.actorId).toBe(admin.id); expect(JSON.stringify(recorded)).not.toContain('Audit-password');
    const cookies = success.headers['set-cookie'];
    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', cookies); expect(logout.status).toBe(200);
    const total = await prisma.auditLog.count({ where: { action: 'Logout', actorId: admin.id } });
    await request(app).post('/api/v1/auth/logout').set('Cookie', cookies);
    expect(await prisma.auditLog.count({ where: { action: 'Logout', actorId: admin.id } })).toBe(total);
  });
  it('captures verified OTP sign-in and unverified OTP failures without code contents', async () => {
    const requested = await request(app).post('/api/v1/auth/otp/request').send({ purpose: 'LOGIN', email: member.email });
    expect(requested.status).toBe(200);
    const code = vi.mocked(sendOtpEmail).mock.calls.at(-1)![1];
    const failed = await request(app).post('/api/v1/auth/otp/verify').send({ purpose: 'LOGIN', email: member.email, code: code === '000000' ? '000001' : '000000' });
    expect(failed.status).toBe(422);
    const denied = await prisma.auditLog.findFirstOrThrow({ where: { requestId: failed.headers['x-request-id'] } });
    expect(denied).toMatchObject({ action: 'LoginFailed', actorId: null, actorRole: 'UNAUTHENTICATED' });
    const result = await request(app).post('/api/v1/auth/otp/verify').send({ purpose: 'LOGIN', email: member.email, code });
    expect(result.status).toBe(200);
    const event = await prisma.auditLog.findFirstOrThrow({ where: { requestId: result.headers['x-request-id'] } });
    expect(event).toMatchObject({ action: 'LoginSucceeded', actorId: member.id, metadata: { channel: 'OTP' } });
    expect(JSON.stringify(event.metadata)).not.toContain(code);
  });
  it('captures password reset and explicit notification changes without duplicate success events', async () => {
    const secret = randomUUID();
    await prisma.passwordResetToken.create({ data: { userId: applicant.id, tokenHash: sha256(secret), expiresAt: new Date(Date.now() + 60000) } });
    const body = { token: secret, password: 'Replacement-password-secret!' };
    const reset = await request(app).post('/api/v1/auth/reset-password').send(body); expect(reset.status).toBe(200);
    const event = await prisma.auditLog.findFirstOrThrow({ where: { requestId: reset.headers['x-request-id'] } });
    expect(event).toMatchObject({ action: 'PasswordReset', actorId: applicant.id, module: 'AUTHENTICATION' }); expect(JSON.stringify(event)).not.toContain(secret); expect(JSON.stringify(event)).not.toContain(body.password);
    expect((await request(app).post('/api/v1/auth/reset-password').send(body)).status).toBe(422);
    expect(await prisma.auditLog.count({ where: { actorId: applicant.id, action: 'PasswordReset' } })).toBe(1);
    const notice = await prisma.notification.create({ data: { userId: member.id, title: prefix, body: 'Private notice', type: 'message' } });
    const url = `/api/v1/notifications/${notice.id}/read`;
    expect((await api('post', url, member)).status).toBe(200); expect((await api('post', url, member)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { entityId: notice.id, action: 'NotificationsRead' } })).toBe(1);
  });
  it('rolls back manuscript and file relationships if submission auditing fails', async () => {
    const file = await prisma.fileObject.create({ data: { uploaderId: member.id, storageKey: randomUUID(), originalName: 'Manuscript.pdf', mimeType: 'application/pdf', sizeBytes: 10 } }); fileIds.push(file.id);
    await failAudit();
    const result = await api('post', '/api/v1/members/me/publications', member).send({ title: `${prefix} rollback publication`, category: 'Mental Health', researchType: 'Original Research', venue: 'IFSMHP Psychology of Well-Being', authors: 'Test Author', correspondingAuthor: 'Test Author', correspondingEmail: member.email, abstract: 'A sufficiently long abstract for validation purposes, repeated to clear the one hundred character minimum that the submission form enforces.', keywords: 'research, tests', conflicts: 'None', confirmOriginal: true, confirmPolicy: true, manuscriptFileId: file.id });
    expect(result.status, JSON.stringify(result.body)).toBe(500);
    expect(await prisma.publication.count({ where: { title: `${prefix} rollback publication` } })).toBe(0);
    expect(await prisma.publicationFile.count({ where: { fileId: file.id } })).toBe(0);
  });
  it('retains security denials when audit persistence fails and emits a correlated operational error', async () => {
    await failAudit(); const log = vi.spyOn(logger, 'error');
    const result = await api('get', base, member); expect(result.status).toBe(403);
    expect(log).toHaveBeenCalledWith('Security audit persistence failed', expect.objectContaining({ requestId: result.headers['x-request-id'], action: 'AccessDenied' }));
  });
  it('rolls gallery, event, support and session writes back when database audit writes fail', async () => {
    await failAudit();
    expect((await api('post', '/api/v1/admin/gallery/categories').send({ name: `${prefix} rollback` })).status).toBe(500);
    expect(await prisma.galleryAlbum.count({ where: { label: `${prefix} rollback` } })).toBe(0);
    expect((await api('post', '/api/v1/admin/events').send({ title: `${prefix} rollback` })).status).toBe(500);
    expect(await prisma.event.count({ where: { title: `${prefix} rollback` } })).toBe(0);
    const conversations = await prisma.conversation.count(), notices = await prisma.notification.count();
    expect((await api('post', '/api/v1/members/me/support', member).send({ subject: `${prefix} rollback`, description: 'Private support text must not leak.', types: ['Moral'] })).status).toBe(500);
    expect(await prisma.supportRequest.count({ where: { subject: `${prefix} rollback` } })).toBe(0); expect(await prisma.conversation.count()).toBe(conversations); expect(await prisma.notification.count()).toBe(notices);
    const sessions = await prisma.session.count({ where: { userId: admin.id } });
    expect((await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: 'Audit-password-2026!' })).status).toBe(500);
    expect(await prisma.session.count({ where: { userId: admin.id } })).toBe(sessions);
  });
  it('allows only safe field changes and deduplicates worker replay events', async () => {
    const input = { actorId: member.id, action: 'EventDeliveryOutcome', entity: `${prefix} safe`, deduplicationKey: `${prefix}-job`, changes: { status: { before: 'DRAFT', after: 'PUBLISHED' }, password: { before: 'secret', after: 'secret2' }, role: { before: 'MEMBER', after: 'MEMBER' } }, metadata: { jobId: 'job1', token: 'private-token', body: 'private text' }, description: 'private text' };
    await writeAudit(input); await writeAudit(input);
    const rows = await prisma.auditLog.findMany({ where: { deduplicationKey: input.deduplicationKey } }); expect(rows).toHaveLength(1);
    expect(rows[0]!.actorMemberId).toBe(prefix); expect(rows[0]!.changes).toEqual({ status: { before: 'DRAFT', after: 'PUBLISHED' } }); expect(rows[0]!.metadata).toEqual({ jobId: 'job1' }); expect(JSON.stringify(rows[0])).not.toContain('private');
  });
  it('logs sensitive file access after authorization and availability checks without claiming completed delivery', async () => {
    const storageKey = `${prefix}-${randomUUID()}.txt`; fileKeys.push(storageKey);
    const file = await prisma.fileObject.create({ data: { uploaderId: member.id, storageKey, originalName: 'Sensitive.txt', mimeType: 'text/plain', sizeBytes: 6, visibility: 'PRIVATE' } }); fileIds.push(file.id);
    const url = `/api/v1/files/${file.id}/download`;
    expect((await api('get', url)).status).toBe(404); expect(await prisma.auditLog.count({ where: { entityId: file.id, action: 'FileAccessGranted' } })).toBe(0);
    await fs.mkdir(uploadRoot, { recursive: true }); await fs.writeFile(assertSafePath(storageKey), 'secret');
    expect((await api('get', url, moderator)).status).toBe(404); expect(await prisma.auditLog.count({ where: { entityId: file.id, action: 'FileAccessGranted' } })).toBe(0);
    expect((await api('get', url)).status).toBe(200);
    const event = await prisma.auditLog.findFirstOrThrow({ where: { entityId: file.id, action: 'FileAccessGranted' } }); expect(event).toMatchObject({ outcome: 'ACCESS_GRANTED', severity: 'WARNING' }); expect(JSON.stringify(event)).not.toContain(storageKey); expect(JSON.stringify(event)).not.toContain('secret');
  });
  it('captures event and document mutations while suppressing idempotent document retries', async () => {
    const event = await api('post', '/api/v1/admin/events').send({ title: `${prefix} draft` }); expect(event.status).toBe(201); eventIds.push(event.body.data.id);
    expect(await prisma.auditLog.findFirst({ where: { entityId: event.body.data.id, action: 'EventCreated', actorId: admin.id, module: 'EVENT' } })).not.toBeNull();
    const payload = { type: 'message', body: 'PRIVATE DOCUMENT EXCHANGE CONTENT', clientRequestId: randomUUID() };
    const sent = await api('post', '/api/v1/members/me/document-exchange/items', member).send(payload); expect(sent.status).toBe(201);
    const retried = await api('post', '/api/v1/members/me/document-exchange/items', member).send(payload); expect(retried.body.data.replayed).toBe(true);
    const rows = await prisma.auditLog.findMany({ where: { entityId: sent.body.data.messageId, action: 'DocumentExchangeSent' } }); expect(rows).toHaveLength(1); expect(rows[0]!.module).toBe('DOCUMENT'); expect(JSON.stringify(rows)).not.toContain('PRIVATE DOCUMENT');
  });
  it('captures draft creation, inquiry submission/reply/status and notification unread actions', async () => {
    const project = await api('post', '/api/v1/members/me/projects', member).send({ title: `${prefix} draft`, category: 'Research', description: 'An isolated research draft for audit verification.', fromDate: '2026-01-01', toDate: '2026-12-31', submit: false });
    expect(project.status).toBe(201);
    expect(await prisma.auditLog.count({ where: { actorId: member.id, action: 'ProjectCreated', entityId: project.body.data.id } })).toBe(1);
    const inquiry = await request(app).post('/api/v1/contact').send({ name: 'Test visitor', email: `${prefix}@example.test`, topic: 'Research', subject: `${prefix} inquiry`, message: 'Private inquiry contents must not appear in audit.' });
    expect(inquiry.status).toBe(201); const id = inquiry.body.data.inquiryId;
    const created = await prisma.auditLog.findFirstOrThrow({ where: { entityId: id, action: 'InquiryCreated' } });
    expect(created.actorRole).toBe('UNAUTHENTICATED'); expect(created.actorId).toBeNull();
    expect((await api('post', `/api/v1/admin/inquiries/${id}/reply`).send({ text: 'Private reply' })).status).toBe(200);
    expect((await api('post', `/api/v1/admin/inquiries/${id}/close`).send({})).status).toBe(200);
    const total = await prisma.auditLog.count({ where: { entityId: id } });
    expect((await api('post', `/api/v1/admin/inquiries/${id}/close`).send({})).body.data).toEqual({ status: 'CLOSED' }); expect(await prisma.auditLog.count({ where: { entityId: id } })).toBe(total);
    const rows = await prisma.auditLog.findMany({ where: { entityId: id } });
    expect(rows.map(r => r.action)).toEqual(expect.arrayContaining(['InquiryCreated', 'InquiryReplied', 'InquiryStatusChanged'])); expect(JSON.stringify(rows)).not.toContain('Private');
    const notice = await prisma.notification.create({ data: { userId: member.id, title: prefix, body: 'Private notice', type: 'message', status: 'READ', readAt: new Date() } });
    expect((await api('post', `/api/v1/notifications/${notice.id}/unread`, member)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { entityId: notice.id, action: 'NotificationsUnread' } })).toBe(1);
  });
  it('audits actual authentication throttling without storing attempted credentials', async () => {
    let throttled;
    for (let i = 0; i < 21; i++) { const result = await request(app).post('/api/v1/auth/login').send({}); if (result.status === 429) { throttled = result; break; } }
    expect(throttled).toBeDefined();
    const event = await prisma.auditLog.findFirstOrThrow({ where: { requestId: throttled!.headers['x-request-id'] } });
    expect(event).toMatchObject({ action: 'AuthenticationThrottled', outcome: 'DENIED', severity: 'DANGER', actorId: null, actorRole: 'UNAUTHENTICATED' });
  });

});
