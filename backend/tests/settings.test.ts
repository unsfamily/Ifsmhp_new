import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
const delivery = vi.hoisted(() => vi.fn(async (_input: unknown) => ({ accepted: ['recipient@example.test'] })));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: delivery, verify: vi.fn() }) } }));
import { createApp } from '../app';
import { prisma } from '../config/database';
import { hashPassword, signAccessToken, sha256 } from '../utils/security';
import { effectiveSettings, membershipAge } from '../services/settings.service';
import { saveEvent } from '../services/events.service';
import { save as saveAnnouncement } from '../services/announcements.service';
import { sendConfiguredMail } from '../services/mail.service';
import { settingsDefaults } from '../domain/settings';
vi.setConfig({ testTimeout: 20000 });
const app = createApp(), base = '/api/v1/admin/settings', prefix = `settings-${randomUUID()}`, password = 'Settings-test-password-2026!';
let id: string, token: string, sessionId: string, failAudit = false;
let original: Awaited<ReturnType<typeof prisma.platformSetting.findMany>>;
let revisions: Awaited<ReturnType<typeof prisma.settingRevision.findMany>>;
const fixtures: string[] = [];
prisma.$use(async (p, next) => { if (failAudit && p.model === 'AuditLog' && p.action === 'create') throw Error('Audit unavailable'); return next(p); });
const get = () => request(app).get(base).set('Authorization', `Bearer ${token}`);
const patch = (section: string, values: unknown, expectedRevision = 0) => request(app).patch(`${base}/${section}`).set('Authorization', `Bearer ${token}`).send({ values, expectedRevision });
beforeAll(async () => {
  original = await prisma.platformSetting.findMany(); revisions = await prisma.settingRevision.findMany();
  const user = await prisma.user.create({ data: { email: `${prefix}@example.test`, fullName: 'Settings Administrator', role: 'ADMIN', status: 'ACTIVE', passwordHash: await hashPassword(password) } }); id = user.id;
  const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password }); expect(login.status).toBe(200); token = login.body.data.accessToken;
  sessionId = (await prisma.session.findFirstOrThrow({ where: { userId: id } })).id;
});
beforeEach(async () => { failAudit = false; await prisma.platformSetting.deleteMany(); await prisma.settingRevision.deleteMany(); delivery.mockClear(); });
afterAll(async () => {
  failAudit = false;
  await prisma.platformSetting.deleteMany(); await prisma.settingRevision.deleteMany();
  if (original.length) await prisma.platformSetting.createMany({ data: original }); if (revisions.length) await prisma.settingRevision.createMany({ data: revisions });
  await prisma.event.deleteMany({ where: { creatorId: id } }); await prisma.announcementOperation.deleteMany({ where: { actorId: id } }); await prisma.announcement.deleteMany({ where: { authorId: id } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: [id, ...fixtures] } } }); await prisma.user.deleteMany({ where: { id: { in: [id, ...fixtures] } } });
});
describe('Administration settings with MySQL and real sessions', () => {
  it('returns genuine defaults and deployment facts without samples', async () => {
    const response = await get(); expect(response.status).toBe(200); const d = response.body.data;
    expect(d.values).toEqual(settingsDefaults); expect(d.deployment.auditCount).toBe(await prisma.auditLog.count()); expect(d.deployment.retention).toBe('Indefinite'); expect(d.sections.billing.editable).toBe(false);
    expect(JSON.stringify(d)).not.toMatch(/Bloomsbury|Lindberg|pk_live|sk_prod|98\.6/);
  });
  it('preserves legacy settings and uses existing timezone and approval SLA', async () => {
    await prisma.platformSetting.createMany({ data: [{ section: 'events', key: 'default_timezone', value: 'Asia/Kolkata' }, { section: 'membership', key: 'approval_sla_days', value: 9 }, { section: 'legacy', key: 'private', value: 'preserve-me' }] });
    const d = (await get()).body.data; expect(d.values.general.timezone).toBe('Asia/Kolkata'); expect(d.values.membership).toEqual({ pendingDays: 9, reviewDays: 9 });
    expect((await patch('general', { shortName: 'New name' })).status).toBe(200); expect(await prisma.platformSetting.count()).toBe(4);
    expect((await prisma.platformSetting.findUniqueOrThrow({ where: { section_key: { section: 'legacy', key: 'private' } } })).value).toBe('preserve-me');
  });
  it.each(['general', 'membership', 'events', 'communications', 'review', 'security'])('saves and reloads section %s', async section => {
    const values: Record<string, unknown> = { general: { shortName: 'Research Forum', timezone: 'Asia/Kolkata', locale: 'hi', dateFormat: 'YYYY-MM-DD' }, membership: { pendingDays: 8 }, events: { capacity: 30, reminderDays: 3, registrationRequired: false }, communications: { senderName: 'Research team', replyTo: 'team@example.test', signature: 'With thanks', announcementSignoff: true }, review: { publicationDays: 12, projectDays: 13, supportDays: 14 }, security: { privacyEmail: 'privacy@example.test' } };
    const r = await patch(section, values[section]); expect(r.status).toBe(200); expect(r.body.data.sections[section].revision).toBe(1);
    expect((await get()).body.data.values[section]).toMatchObject(values[section]);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { actorId: id, action: 'PlatformSettingsUpdated', entityId: section }, orderBy: { createdAt: 'desc' } }); expect(audit.module).toBe('SETTINGS'); expect(audit.metadata).toHaveProperty('changedFields');
  });
  it('suppresses unchanged revisions, timestamps and audit entries', async () => {
    await patch('events', { capacity: 10 }); const first = (await get()).body.data; const count = await prisma.auditLog.count();
    const r = await patch('events', { capacity: 10 }, 1); expect(r.status).toBe(200); expect(r.body.data.sections.events).toEqual(first.sections.events); expect(await prisma.auditLog.count()).toBe(count);
  });
  it('serializes simultaneous saves and retains the winning transaction', async () => {
    const responses = await Promise.all([patch('review', { publicationDays: 12 }), patch('review', { publicationDays: 13 })]); expect(responses.map(r => r.status).sort()).toEqual([200, 409]); expect((await get()).body.data.sections.review.revision).toBe(1);
  });
  it('allows independent sections to save without conflicts', async () => {
    const responses = await Promise.all([patch('review', { publicationDays: 12 }), patch('events', { capacity: 12 })]); expect(responses.map(r => r.status)).toEqual([200, 200]);
  });
  it('rolls back changes and revision on audit failure', async () => {
    const before = (await get()).body.data; failAudit = true; const r = await patch('general', { shortName: 'Must roll back' }); failAudit = false; expect(r.status).toBe(500); expect((await get()).body.data).toEqual(before);
  });
  it.each([
    ['general', { timezone: 'Mars/Colony' }], ['general', { contactEmail: 'bad' }], ['general', { homepageUrl: 'javascript:alert(1)' }], ['general', { shortName: 'x'.repeat(61) }], ['general', { locale: 'invalid' }], ['general', { maintenance: true }],
    ['review', { publicationDays: 0 }], ['review', { projectDays: 366 }], ['review', { supportDays: 1.5 }], ['events', { capacity: -1 }], ['events', { reminderDays: [1, 3, 7] }], ['events', { reminderDays: 2 }],
    ['communications', { senderName: 'Hello\r\nBcc: victim@example.test' }], ['communications', { replyTo: 'a@example.test\nb@example.test' }], ['communications', { fromEmail: 'override@example.test' }],
    ['security', { mfaRequired: true }], ['integrations', { provider: 'Stripe' }], ['backup', {}], ['general', { arbitrary: true }],
  ])('rejects invalid/unsupported values in %s: %j', async (section, values) => { expect((await patch(section as string, values)).status).toBe(422); });
  it('accepts size and integer boundaries', async () => { expect((await patch('review', { publicationDays: 1, supportDays: 365 })).status).toBe(200); expect((await patch('events', { capacity: 100000, reminderDays: 0 })).status).toBe(200); });
  it('requires revision and rejects invalid section identifiers', async () => { expect((await request(app).patch(base + '/general').set('Authorization', `Bearer ${token}`).send({ values: {} })).status).toBe(422); expect((await patch('not-a-section', {})).status).toBe(422); });
  it('exposes only public configuration, including banner and privacy contact', async () => {
    await patch('general', { maintenance: true, maintenanceMessage: 'Scheduled maintenance notice' }); await patch('security', { privacyEmail: 'privacy@example.test' }); await patch('communications', { replyTo: 'private@example.test' });
    const r = await request(app).get('/api/v1/public/settings'); expect(r.status).toBe(200); expect(r.body.data.privacyEmail).toBe('privacy@example.test'); expect(r.body.data.maintenanceMessage).toContain('maintenance');
    expect(JSON.stringify(r.body)).not.toMatch(/private@example|updatedBy|revision|SMTP|storage|password/i);
    const login = await request(app).post('/api/v1/auth/login').send({ email: `${prefix}@example.test`, password }); expect(login.status).toBe(200);
  });
  it('denies anonymous access and forged development headers', async () => { expect((await request(app).get(base)).status).toBe(401); expect((await request(app).get(base).set('X-Test-Role', 'ADMIN').set('X-Test-User-Id', id)).status).toBe(401); });
  it.each(['MEMBER', 'APPLICANT'] as const)('denies %s sessions', async role => {
    const u = await prisma.user.create({ data: { email: `${prefix}-${role}@example.test`, fullName: role, role, status: 'ACTIVE' } }); fixtures.push(u.id);
    const s = await prisma.session.create({ data: { userId: u.id, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 86400000) } }); const t = signAccessToken({ sub: u.id, role, sessionId: s.id });
    expect((await request(app).get(base).set('Authorization', `Bearer ${t}`)).status).toBe(403); expect((await request(app).patch(base + '/general').set('Authorization', `Bearer ${t}`).send({ expectedRevision: 0, values: { shortName: 'No' } })).status).toBe(403);
  });
  it('denies revoked sessions immediately', async () => { await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } }); expect((await get()).status).toBe(401); await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: null } }); });
  it('uses persisted event defaults, preserves overrides and existing events', async () => {
    await patch('general', { timezone: 'Asia/Kolkata' }); await patch('events', { capacity: 42, registrationRequired: false, reminderDays: 7 });
    const first = await saveEvent(id, { title: 'Settings default event' }); expect(first.capacity).toBe(42); expect(first.timezone).toBe('Asia/Kolkata'); expect(first.reminderDays).toBe(7); expect(first.registrationRequired).toBe(false);
    await patch('events', { capacity: 90 }, 1); const edited = await saveEvent(id, { title: 'Settings preserved event' }, first.id); expect(edited.capacity).toBe(42);
    const override = await saveEvent(id, { title: 'Settings override event', capacity: 12, reminderDays: 0 }); expect(override.capacity).toBe(12); expect(override.reminderDays).toBe(0);
  });
  it('applies announcement defaults only to new drafts without explicit overrides', async () => {
    await patch('communications', { announcementSignoff: true });
    const response = await request(app).post('/api/v1/admin/announcements').set('Authorization', `Bearer ${token}`).send({ subject: 'Settings announcement', requestId: randomUUID() }); expect(response.status).toBe(201); const first = response.body.data; expect(first.sendSABPreview).toBe(true);
    const override = await saveAnnouncement(id, { subject: 'Explicit false', sendSABPreview: false, requestId: randomUUID() }); expect(override.sendSABPreview).toBe(false);
    await patch('communications', { announcementSignoff: false }, 1); const edited = await saveAnnouncement(id, { subject: 'Changed subject', requestId: randomUUID(), expectedRevision: first.revision }, first.id); expect(edited.sendSABPreview).toBe(true);
  });
  it('renders mail safely and reads settings on every delivery', async () => {
    await patch('communications', { senderName: 'Research team', replyTo: 'reply@example.test', signature: '<img src=x onerror=alert(1)> & thanks' });
    await sendConfiguredMail({ to: 'recipient@example.test', subject: 'Update', text: 'Body', html: '<p>Body</p>' });
    expect(delivery.mock.calls[0]?.[0]).toMatchObject({ from: { name: 'Research team' }, replyTo: 'reply@example.test', html: expect.stringContaining('&lt;img') });
    expect((delivery.mock.calls[0]?.[0] as { html: string }).html).not.toContain('<img'); await patch('communications', { senderName: 'Changed sender' }, 1); await sendConfiguredMail({ to: 'recipient@example.test', subject: 'Update', text: 'Body' }); expect(delivery.mock.calls[1]?.[0]).toMatchObject({ from: { name: 'Changed sender' } });
  });
  it('uses stage-specific thresholds and does not invent missing history', async () => {
    await patch('membership', { pendingDays: 3, reviewDays: 9 });
    const age = await membershipAge([{ id: 'missing-history', status: 'UNDER_REVIEW', submittedAt: new Date(Date.now() - 30 * 86400000) }, { id: 'pending', status: 'PENDING', submittedAt: new Date(Date.now() - 4 * 86400000) }]);
    expect(age.get('missing-history')).toEqual({ stageSlaDays: null, stageSlaTarget: 9, stageSlaBreached: false }); expect(age.get('pending')?.stageSlaBreached).toBe(true);
  });
  it('updates real project/support queue counts and publication reports', async () => {
    const aged = new Date(Date.now() - 8 * 86400000);
    const project = await prisma.project.create({ data: { ownerId: id, title: 'Settings SLA project', category: 'Research', description: 'Queue threshold fixture', status: 'SUBMITTED', submittedAt: aged } });
    const pub = await prisma.publication.create({ data: { authorId: id, title: 'Settings SLA publication', abstract: 'Fixture', category: 'Research', researchType: 'Review', status: 'UNDER_REVIEW', submittedAt: aged } });
    const support = await prisma.supportRequest.create({ data: { requesterId: id, assignedAdminId: id, subject: 'Settings SLA support', description: 'Fixture', createdAt: aged } });
    const read = async (url: string) => (await request(app).get('/api/v1/admin' + url).set('Authorization', `Bearer ${token}`)).body.data;
    try {
      const before = await read('/projects'); expect(before.counts.slaTargetDays).toBe(7);
      const supportBefore = await read('/support');
      await patch('review', { projectDays: 12, supportDays: 12, publicationDays: 3 });
      const after = await read('/projects'); expect(after.counts.slaBreach).toBeLessThan(before.counts.slaBreach); expect(after.counts.slaTargetDays).toBe(12);
      const supportAfter = await read('/support'); expect(supportAfter.stats.overSla).toBeLessThan(supportBefore.stats.overSla); expect(supportAfter.stats.slaTargetDays).toBe(12);
      const overview = await read('/profile/overview'); expect(overview.queues.find((q: { name: string }) => q.name.startsWith('Publication')).slaBreach).toBeGreaterThan(0); expect(overview.queues.find((q: { name: string }) => q.name.startsWith('Support')).slaBreach).toBe(0);
      const { REPORTS } = await import('../domain/reports'); const report = REPORTS.find(r => r.key === 'review-sla')!;
      const rows = await report.rows({ from: aged, to: new Date() }); expect(rows.find(r => r.title === pub.title)?.breachedSla).toBe('Yes');
      await patch('review', { publicationDays: 12 }, 1); expect((await report.rows({ from: aged, to: new Date() })).find(r => r.title === pub.title)?.breachedSla).toBe('No');
    } finally { await prisma.supportRequest.delete({ where: { id: support.id } }); await prisma.publication.delete({ where: { id: pub.id } }); await prisma.project.delete({ where: { id: project.id } }); }
  });
  it('reflects writes immediately without a process-local cache', async () => { await patch('review', { supportDays: 11 }); expect((await effectiveSettings()).review.supportDays).toBe(11); await prisma.platformSetting.update({ where: { section_key: { section: 'review', key: 'supportDays' } }, data: { value: 12 } }); expect((await effectiveSettings()).review.supportDays).toBe(12); });
});
