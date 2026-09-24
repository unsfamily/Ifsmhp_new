import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../services/mail.service', () => ({ sendOtpEmail: vi.fn(), sendApprovalEmail: vi.fn(), sendEventEmail: vi.fn(async () => true), sendAdminNotificationEmail: vi.fn(async () => true), verifyTransport: vi.fn() }));
import { prisma } from '../config/database';
import { createApp } from '../app';
import { hashPassword, sha256, signAccessToken } from '../utils/security';
import { notifyAdmins, processAdminEmailJobs } from '../services/admin-notifications.service';
import { sendAdminNotificationEmail } from '../services/mail.service';
import { assertSafePath } from '../utils/fileStorage';
import { createContactInquiry, postMemberMessage } from '../services/platform.service';
import { createSupport, updateSupport, transitionSupport } from '../services/support.service';
import { purgeAvatars } from '../services/admin-avatar.service';
import { passwordBody } from '../domain/admin-profile';
vi.setConfig({ testTimeout: 15000 });
const app = createApp(), prefix = `profile-${randomUUID().slice(0, 8)}`, base = '/api/v1/admin/profile', password = 'Original-password-2026!';
const ids: string[] = [];
type Actor = { id: string; token: string; email: string };
let admin: Actor, other: Actor, security: Actor, member: Actor;
let rejectAudit = false;
prisma.$use(async (params, next) => { if (rejectAudit && params.model === 'AuditLog' && params.action === 'create') throw new Error('Injected audit failure'); return next(params); });
async function actor(role: 'ADMIN' | 'MEMBER', suffix: string) {
  const user = await prisma.user.create({ data: { fullName: `${prefix} ${suffix}`, email: `${prefix}-${suffix}@example.test`, role, status: 'ACTIVE', passwordHash: role === 'ADMIN' ? await hashPassword(password) : null } }); ids.push(user.id);
  if (role !== 'ADMIN') return { ...user, token: '' };
  const response = await request(app).post('/api/v1/auth/login').send({ email: user.email, password }); expect(response.status).toBe(200);
  return { id: user.id, email: user.email, token: response.body.data.accessToken as string };
}
const api = (method: 'get' | 'post' | 'patch' | 'delete', url = base, who = admin) => request(app)[method](url).set('Authorization', `Bearer ${who.token}`);
const read = async () => (await api('get')).body.data;
const fields = { firstName: 'Ada', lastName: 'Lovelace', displayName: 'Dr. Ada', designation: 'CRO Lead', jobTitle: 'Research lead', workEmail: 'contact@example.test', phone: '+44 123 456', institution: 'Research Office', country: 'United Kingdom', timezone: 'Europe/London', orcid: '0000-0002-1825-0097', website: 'https://example.test/lab', bio: 'Research profile' };
beforeAll(async () => { admin = await actor('ADMIN', 'main'); other = await actor('ADMIN', 'other'); security = await actor('ADMIN', 'security'); member = await actor('MEMBER', 'member'); });
afterEach(() => { rejectAudit = false; vi.mocked(sendAdminNotificationEmail).mockReset().mockResolvedValue(true); });
afterAll(async () => {
  const files = await prisma.fileObject.findMany({ where: { uploaderId: { in: ids } } });
  await prisma.adminProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.fileObject.deleteMany({ where: { uploaderId: { in: ids } } });
  await Promise.all(files.map(f => fs.unlink(assertSafePath(f.storageKey)).catch(() => undefined)));
  const tickets = await prisma.supportRequest.findMany({ where: { requesterId: member.id } });
  await prisma.supportRequest.deleteMany({ where: { requesterId: member.id } });
  await prisma.conversation.deleteMany({ where: { id: { in: tickets.flatMap(t => t.conversationId ? [t.conversationId] : []) } } });
  await prisma.contactInquiry.deleteMany({ where: { subject: { startsWith: prefix } } });
  await prisma.notification.deleteMany({ where: { title: { startsWith: prefix } } });
  await prisma.adminEmailJob.deleteMany({ where: { OR: [{ userId: { in: ids } }, { title: { startsWith: prefix } }] } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});
describe('Administrator profile with real sessions and MySQL', () => {
  it('loads a legacy account without fabricated names, security dates, or features', async () => {
    const data = await read(); expect(data.profile.firstName).toBe(''); expect(data.account.fullName).toBe(`${prefix} main`); expect(data.revision).toBe(0);
    expect(data.defaults).toEqual({ appNewMember: true, supportUrgent: true, supportAll: false, inquiryNew: false }); expect(data.capabilities.mfa).toBe(false);
    const overview = await api('get', `${base}/overview`); expect(overview.status).toBe(200); expect(overview.body.data.security.passwordChangedAt).toBeNull(); expect(overview.body.data.security.activeSessions).toBe(1);
  });
  it('requires real authentication and rejects role-header impersonation', async () => {
    for (const suffix of ['', '/overview', '/sessions', '/avatar']) expect((await request(app).get(base + suffix)).status).toBe(401);
    const before = process.env.NODE_ENV; process.env.NODE_ENV = 'development';
    try { expect((await request(app).get(base).set('X-Test-Role', 'ADMIN').set('X-Test-User-Id', admin.id)).status).toBe(401); } finally { process.env.NODE_ENV = before; }
  });
  it('saves profile and preferences atomically without changing login identity or privileges', async () => {
    const data = await read(); const res = await api('patch').send({ expectedRevision: data.revision, profile: fields, preferences: { ...data.preferences, inquiryNew: true } }); expect(res.status).toBe(200);
    expect(res.body.data.account.fullName).toBe('Ada Lovelace'); expect(res.body.data.account.loginEmail).toBe(admin.email); expect(res.body.data.account.role).toBe('ADMIN'); expect(res.body.data.profile.workEmail).toBe(fields.workEmail);
    const current = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${admin.token}`); expect(current.body.data.user.fullName).toBe('Ada Lovelace');
  });
  it.each([{ role: 'MEMBER' }, { userId: 'someone-else' }, { email: 'other@example.test' }, { preferences: { weeklyDigest: true } }])('rejects unsupported or privileged fields %j', async extra => {
    expect((await api('patch').send({ expectedRevision: (await read()).revision, ...extra })).status).toBe(422);
  });
  it.each([{ bio: 'x'.repeat(601) }, { timezone: 'Moon/Base' }, { orcid: '0000-0002-1825-3821' }, { website: 'javascript:alert(1)' }, { workEmail: 'invalid' }, { firstName: '' }])('validates profile fields %j', async extra => {
    expect((await api('patch').send({ expectedRevision: (await read()).revision, profile: { ...fields, ...extra } })).status).toBe(422);
  });
  it('supports field lengths beyond MySQL default string limits', async () => {
    const data = await read(); expect((await api('patch').send({ expectedRevision: data.revision, profile: { ...fields, jobTitle: 'J'.repeat(200), institution: 'I'.repeat(200), website: 'https://example.test/' + 'a'.repeat(700) } })).status).toBe(200);
  });
  it('suppresses no-op revisions and audit events', async () => {
    const data = await read(), count = await prisma.auditLog.count({ where: { actorId: admin.id } });
    const res = await api('patch').send({ expectedRevision: data.revision, profile: data.profile, preferences: data.preferences });
    expect(res.body.data.revision).toBe(data.revision); expect(await prisma.auditLog.count({ where: { actorId: admin.id } })).toBe(count);
  });
  it('serializes concurrent saves and rejects stale revisions', async () => {
    const data = await read(); const responses = await Promise.all(['First', 'Second'].map(displayName => api('patch').send({ expectedRevision: data.revision, profile: { ...data.profile, displayName } })));
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  });
  it('rolls back profile, account name, preferences, and revision when auditing fails', async () => {
    const data = await read(); rejectAudit = true;
    expect((await api('patch').send({ expectedRevision: data.revision, profile: { ...fields, firstName: 'Rollback' }, preferences: { ...data.preferences, supportAll: !data.preferences.supportAll } })).status).toBe(500);
    rejectAudit = false; expect(await read()).toEqual(data);
  });
  it('stores safe audit metadata and filters exact actors including CSV export', async () => {
    const rows = await prisma.auditLog.findMany({ where: { actorId: admin.id, action: 'AdminProfileUpdated' } }); expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain('Research profile'); expect(JSON.stringify(rows)).not.toContain('contact@example.test');
    const list = await api('get', `/api/v1/admin/audit-log?actorId=${other.id}`); expect(list.status).toBe(200); expect(list.body.data.items.every((r: { actorId: string }) => r.actorId === other.id)).toBe(true);
    const csv = await api('get', `/api/v1/admin/audit-log/export?actorId=${other.id}`); expect(csv.status).toBe(200); expect(csv.text).toContain(other.email); expect(csv.text).not.toContain(admin.email);
  });
  it('lists owned sessions only and protects other accounts against revocation', async () => {
    const page = await api('get', `${base}/sessions`); expect(page.body.data.items[0].current).toBe(true); expect(JSON.stringify(page.body.data)).not.toContain('tokenHash');
    const foreign = await prisma.session.findFirstOrThrow({ where: { userId: other.id } }); expect((await api('delete', `${base}/sessions/${foreign.id}`)).status).toBe(404);
  });
  it('revokes other sessions and safely repeats revocation', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password });
    expect((await api('post', `${base}/sessions/revoke-others`)).status).toBe(200);
    expect((await request(app).get(base).set('Authorization', `Bearer ${login.body.data.accessToken}`)).status).toBe(401);
    const count = await prisma.auditLog.count({ where: { actorId: admin.id, action: 'AdminSessionsRevoked' } }); await api('post', `${base}/sessions/revoke-others`); expect(await prisma.auditLog.count({ where: { actorId: admin.id, action: 'AdminSessionsRevoked' } })).toBe(count);
  });
  it('validates password confirmation and UTF-8 byte boundaries', async () => {
    expect(passwordBody.safeParse({ currentPassword: password, password: 'é'.repeat(36), confirmation: 'é'.repeat(36) }).success).toBe(true);
    expect(passwordBody.safeParse({ currentPassword: password, password: 'é'.repeat(37), confirmation: 'é'.repeat(37) }).success).toBe(false);
    for (const body of [{ password: 'short', confirmation: 'short' }, { password: 'Valid-new-password!', confirmation: 'Different-password!' }]) expect((await api('post', `${base}/password`, security).send({ currentPassword: password, ...body })).status).toBe(422);
    expect((await api('post', `${base}/password`, security).send({ currentPassword: 'wrong', password: 'Valid-new-password!', confirmation: 'Valid-new-password!' })).status).toBe(422);
  });
  it('rolls back credential changes and session revocations on audit failure', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: security.id } }); rejectAudit = true;
    expect((await api('post', `${base}/password`, security).send({ currentPassword: password, password: 'Changed-password-2026!', confirmation: 'Changed-password-2026!' })).status).toBe(500); rejectAudit = false;
    expect((await prisma.user.findUniqueOrThrow({ where: { id: security.id } })).passwordHash).toBe(before.passwordHash); expect((await api('get', base, security)).status).toBe(200);
  });
  it('changes password, invalidates reset tokens and other sessions, retaining this browser', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: security.email, password });
    const token = await prisma.passwordResetToken.create({ data: { userId: security.id, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 60000) } });
    expect((await api('post', `${base}/password`, security).send({ currentPassword: password, password: 'Changed-password-2026!', confirmation: 'Changed-password-2026!' })).status).toBe(200);
    expect((await api('get', base, security)).status).toBe(200); expect((await request(app).get(base).set('Authorization', `Bearer ${login.body.data.accessToken}`)).status).toBe(401);
    expect((await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: token.id } })).usedAt).not.toBeNull(); expect((await prisma.user.findUniqueOrThrow({ where: { id: security.id } })).passwordChangedAt).not.toBeNull();
  });
  it('applies administrator policy to password reset without consuming invalid requests', async () => {
    const raw = randomUUID() + randomUUID(), token = await prisma.passwordResetToken.create({ data: { userId: security.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 60000) } });
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token: raw, password: 'shortpwd' })).status).toBe(422);
    expect((await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: token.id } })).usedAt).toBeNull();
  });
  it('uploads, normalizes, protects and replaces an avatar', async () => {
    const image = await sharp({ create: { width: 30, height: 20, channels: 3, background: '#456' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    let data = await read(); const first = await api('post', `${base}/avatar`).field('expectedRevision', data.revision).attach('file', image, { filename: 'avatar.jpg', contentType: 'image/jpeg' }); expect(first.status).toBe(200);
    const id = first.body.data.avatarFileId; const file = await prisma.fileObject.findUniqueOrThrow({ where: { id } });
    const metadata = await sharp(assertSafePath(file.storageKey)).metadata(); expect(metadata.format).toBe('webp'); expect(metadata.orientation).toBeUndefined(); expect(metadata.width).toBe(20);
    expect((await api('get', `${base}/avatar`)).status).toBe(200); expect((await api('get', `/api/v1/files/${id}/download`, other)).status).toBe(404); expect((await api('get', `/api/v1/files/${id}/download`)).status).toBe(200);
    data = await read(); expect((await api('post', `${base}/avatar`).field('expectedRevision', data.revision).attach('file', image, 'next.jpg')).status).toBe(200);
    expect((await api('get', `/api/v1/files/${id}/download`)).status).toBe(404); expect((await prisma.fileObject.findUniqueOrThrow({ where: { id } })).purgedAt).not.toBeNull();
  });
  it('rejects missing, empty, spoofed and malformed avatars', async () => {
    const revision = (await read()).revision;
    expect((await api('post', `${base}/avatar`).field('expectedRevision', revision)).status).toBe(422);
    for (const image of [Buffer.alloc(0), Buffer.from('not an image'), Buffer.from([0xff, 0xd8, 0xff, 0xd9])]) expect((await api('post', `${base}/avatar`).field('expectedRevision', revision).attach('file', image, { filename: 'photo.jpg', contentType: 'image/jpeg' })).status).toBe(422);
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer(); expect((await api('post', `${base}/avatar`).field('expectedRevision', revision).attach('file', png, { filename: 'photo.jpg', contentType: 'image/jpeg' })).status).toBe(422);
  });
  it('rejects oversized uploads and stale avatar revisions without creating files', async () => {
    const data = await read(), before = await prisma.fileObject.count({ where: { uploaderId: admin.id } });
    expect((await api('post', `${base}/avatar`).field('expectedRevision', data.revision).attach('file', Buffer.alloc(data.policy.avatarMaxBytes + 1), 'large.png')).status).toBe(422);
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer(); expect((await api('post', `${base}/avatar`).field('expectedRevision', 0).attach('file', image, 'photo.png')).status).toBe(409);
    expect(await prisma.fileObject.count({ where: { uploaderId: admin.id } })).toBe(before);
  });
  it('rolls back failed avatar persistence and retries tombstone cleanup', async () => {
    const data = await read(), image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer(); rejectAudit = true;
    expect((await api('post', `${base}/avatar`).field('expectedRevision', data.revision).attach('file', image, 'photo.png')).status).toBe(500); rejectAudit = false; expect((await read()).avatarFileId).toBe(data.avatarFileId);
    const file = await prisma.fileObject.create({ data: { uploaderId: admin.id, storageKey: randomUUID(), originalName: 'gone.webp', mimeType: 'image/webp', sizeBytes: 0, avatarManaged: true, deletedAt: new Date() } }); await purgeAvatars(); expect((await prisma.fileObject.findUniqueOrThrow({ where: { id: file.id } })).purgedAt).not.toBeNull();
  });
  it('persists application notices once and creates one email for overlapping support preferences', async () => {
    await prisma.adminProfile.upsert({ where: { userId: other.id }, create: { userId: other.id, supportAll: true }, update: { supportAll: true } });
    const notice = { key: `${prefix}-support`, category: 'SUPPORT' as const, entityId: prefix, title: `${prefix} update`, link: '/admin/support', priority: 'High', assignedAdminId: other.id };
    await prisma.$transaction(async tx => { await notifyAdmins(tx, notice); await notifyAdmins(tx, notice); });
    expect(await prisma.adminEmailJob.count({ where: { userId: other.id, entityId: prefix } })).toBe(1); expect(await prisma.notification.count({ where: { userId: other.id, title: notice.title } })).toBe(1);
    await prisma.$transaction(tx => notifyAdmins(tx, { ...notice, key: `${prefix}-app`, category: 'APPLICATION', title: `${prefix} application` })); expect(await prisma.adminEmailJob.count({ where: { userId: other.id, category: 'APPLICATION' } })).toBe(1);
  });
  it('captures actual inquiry and support workflows without duplicate in-app notices', async () => {
    const inquiry = await createContactInquiry({ name: 'Test', email: 'sender@example.test', topic: 'General', subject: `${prefix} inquiry`, message: 'Private inquiry content' });
    expect(await prisma.adminEmailJob.count({ where: { entityId: inquiry.inquiryId, userId: admin.id, status: 'QUEUED' } })).toBe(1);
    const support = await createSupport(member.id, { subject: `${prefix} support`, description: 'A request needing assistance', priority: 'High', types: ['Official'] });
    expect(await prisma.notification.count({ where: { userId: other.id, link: `/admin/support/${support.id}` } })).toBe(1);
    await updateSupport(support.id, admin.id, { assignedAdminId: other.id });
    await transitionSupport(support.id, admin.id, 'UNDER_REVIEW', 'Reviewing the request');
    expect(await prisma.adminEmailJob.count({ where: { userId: other.id, entityId: support.id } })).toBe(3);
    expect(await prisma.adminEmailJob.count({ where: { userId: admin.id, entityId: support.id } })).toBe(1);
    expect(JSON.stringify(await prisma.adminEmailJob.findMany({ where: { entityId: inquiry.inquiryId } }))).not.toContain('Private inquiry content');
  });
  it('adds member support reply notices to the assignee, preserving member notifications', async () => {
    const support = await prisma.supportRequest.findFirstOrThrow({ where: { requesterId: member.id, assignedAdminId: other.id } });
    const before = await prisma.adminEmailJob.count({ where: { userId: other.id, entityId: support.id } });
    await postMemberMessage(member.id, support.conversationId!, { body: 'Private member reply should stay out of email jobs' });
    expect(await prisma.adminEmailJob.count({ where: { userId: other.id, entityId: support.id } })).toBe(before + 1);
    expect(JSON.stringify(await prisma.adminEmailJob.findMany({ where: { entityId: support.id } }))).not.toContain('Private member reply');
  });
  it('rolls back business state, notices and outbox jobs on transaction failure', async () => {
    const count = await prisma.adminEmailJob.count(); rejectAudit = true;
    await expect(createContactInquiry({ name: 'Test', email: 'test@example.test', topic: 'General', subject: `${prefix} rollback`, message: 'Test rollback inquiry' })).rejects.toThrow('Injected');
    rejectAudit = false; expect(await prisma.adminEmailJob.count()).toBe(count); expect(await prisma.contactInquiry.count({ where: { subject: `${prefix} rollback` } })).toBe(0);
  });
  it('dispatches to login email and does not redeliver completed jobs', async () => {
    await processAdminEmailJobs(); const calls = vi.mocked(sendAdminNotificationEmail).mock.calls; expect(calls.some(([input]) => input.to === admin.email)).toBe(true); expect(calls.some(([input]) => input.to === fields.workEmail)).toBe(false);
    const count = calls.length; await processAdminEmailJobs(); expect(vi.mocked(sendAdminNotificationEmail).mock.calls.length).toBe(count);
  });
  it('rechecks preferences and account eligibility before delivering queued emails', async () => {
    const job = await prisma.adminEmailJob.create({ data: { key: randomUUID(), userId: other.id, category: 'INQUIRY', entityId: prefix, title: `${prefix} suppression`, link: '/admin/inquiries' } });
    await processAdminEmailJobs(); expect((await prisma.adminEmailJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('SUPPRESSED');
    const inactive = await prisma.adminEmailJob.create({ data: { key: randomUUID(), userId: other.id, category: 'APPLICATION', entityId: prefix, title: `${prefix} inactive`, link: '/admin' } });
    await prisma.user.update({ where: { id: other.id }, data: { status: 'SUSPENDED' } }); try { await processAdminEmailJobs(); expect((await prisma.adminEmailJob.findUniqueOrThrow({ where: { id: inactive.id } })).status).toBe('SUPPRESSED'); } finally { await prisma.user.update({ where: { id: other.id }, data: { status: 'ACTIVE' } }); }
  });
  it('records unconfigured delivery and retries SMTP failures with final auditing', async () => {
    const job = await prisma.adminEmailJob.create({ data: { key: randomUUID(), userId: other.id, category: 'APPLICATION', entityId: prefix, title: `${prefix} delivery`, link: '/admin', dueAt: new Date(0) } });
    vi.mocked(sendAdminNotificationEmail).mockResolvedValue(false); await processAdminEmailJobs(); expect((await prisma.adminEmailJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('UNCONFIGURED');
    vi.mocked(sendAdminNotificationEmail).mockRejectedValue(new Error('smtp unavailable')); await processAdminEmailJobs(new Date(Date.now() + 120000)); expect((await prisma.adminEmailJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('QUEUED');
    await prisma.adminEmailJob.update({ where: { id: job.id }, data: { attempts: 4, dueAt: new Date(0) } }); await processAdminEmailJobs(); expect((await prisma.adminEmailJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('FAILED'); expect(await prisma.auditLog.count({ where: { deduplicationKey: `admin-email:${job.id}:FAILED` } })).toBe(1);
  });
  it('denies member and applicant sessions on all profile endpoints', async () => {
    for (const role of ['MEMBER', 'APPLICANT'] as const) {
      const user = await prisma.user.create({ data: { email: `${prefix}-${role.toLowerCase()}-acl@example.test`, fullName: 'Non admin', role, status: role === 'MEMBER' ? 'ACTIVE' : 'PENDING' } }); ids.push(user.id);
      const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 60000) } });
      const token = signAccessToken({ sub: user.id, role, sessionId: session.id });
      for (const [method, path] of [['get', ''], ['patch', ''], ['get', '/overview'], ['get', '/avatar'], ['post', '/avatar'], ['post', '/password'], ['get', '/sessions'], ['post', '/sessions/revoke-others'], ['delete', '/sessions/arbitrary']] as const) expect((await request(app)[method](base + path).set('Authorization', `Bearer ${token}`)).status).toBe(403);
    }
  });
  it('accepts the exact upload size limit', async () => {
    const data = await read(), png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
    const image = Buffer.concat([png, Buffer.alloc(data.policy.avatarMaxBytes - png.length)]);
    expect((await api('post', `${base}/avatar`).field('expectedRevision', data.revision).attach('file', image, 'limit.png')).status).toBe(200);
  });
  it('shows real approval history and correctly scoped queue counts', async () => {
    const support = await prisma.supportRequest.findFirstOrThrow({ where: { requesterId: member.id } });
    await transitionSupport(support.id, admin.id, 'APPROVED', 'Approved after review');
    const res = await api('get', `${base}/overview`); expect(res.body.data.approvals.some((r: { entity: string }) => r.entity === support.subject)).toBe(true);
    expect(res.body.data.queues.find((q: { name: string }) => q.name.includes('Assigned to you')).open).toBe(0);
    const otherOverview = await api('get', `${base}/overview`, other); expect(otherOverview.body.data.approvals.some((r: { entity: string }) => r.entity === support.subject)).toBe(false);
  });
  it('paginates owned sessions and revokes the current session immediately', async () => {
    await prisma.session.createMany({ data: Array.from({ length: 12 }, () => ({ userId: other.id, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 60000) })) });
    const page = await api('get', `${base}/sessions?limit=10&page=2`, other); expect(page.body.data.items.length).toBe(3); expect(page.body.data.pagination.total).toBe(13);
    const all = await api('get', `${base}/sessions?limit=100`, other); const current = all.body.data.items.find((r: { current: boolean }) => r.current);
    expect((await api('delete', `${base}/sessions/${current.id}`, other)).body.data.signedOut).toBe(true); expect((await api('get', base, other)).status).toBe(401);
  });
  it('rate limits credential mutations and returns the standard failure envelope', async () => {
    let res = await api('post', `${base}/password`, security).send({});
    for (let i = 0; i < 11 && res.status !== 429; i++) res = await api('post', `${base}/password`, security).send({});
    expect(res.status).toBe(429); expect(res.body.success).toBe(false); expect(await prisma.auditLog.count({ where: { actorId: security.id, action: 'AuthenticationThrottled' } })).toBeGreaterThan(0);
  });

});
