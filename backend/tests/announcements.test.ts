import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole, UserStatus } from '@prisma/client';
const fixture = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock('../services/mail.service', () => ({ sendAnnouncementEmail: vi.fn(), sendOtpEmail: vi.fn(), verifyTransport: vi.fn(), sendApprovalEmail: vi.fn() }));
// Keep worker recipient resolution inside fixtures even when a separate test DB is unavailable.
vi.mock('../services/announcements.service', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/announcements.service')>();
  return { ...actual, recipientWhere: (audience: string) => ({ AND: [actual.recipientWhere(audience), { id: { in: fixture.ids } }] }) };
});
import { createApp } from '../app';
import { prisma } from '../config/database';
import { env } from '../config';
import { sha256, signAccessToken } from '../utils/security';
import { announcementSchema } from '../domain/announcement-input';
import { renderAnnouncement } from '../domain/announcement-markdown';
import { sendAnnouncementEmail } from '../services/mail.service';
import { processAnnouncementJobs } from '../services/announcement-jobs.service';
import { recipientWhere } from '../services/announcements.service';
import { unsubscribeToken } from '../services/announcement-preferences.service';

const app = createApp();
const prefix = `ann-test-${crypto.randomUUID()}`;
const base = '/api/v1/admin/announcements';
type Actor = { id: string; email: string; token: string };
let admin: Actor, member: Actor, other: Actor, applicant: Actor, inactive: Actor;
const announcements: string[] = [];
const originalSAB = env.SAB_PREVIEW_EMAILS;
const call = (actor: Actor, method: 'get' | 'post' | 'patch', url: string) => request(app)[method](url).set('Authorization', `Bearer ${actor.token}`);
const valid = { subject: `${prefix} broadcast`, body: 'A real announcement body with useful member information.', audience: 'Scientists Track', channel: 'Email + In-App', timezone: 'UTC' };
async function actor(name: string, role: UserRole, status: UserStatus = 'ACTIVE', professionalType = 'Research Scholar / Scientist') {
  const user = await prisma.user.create({ data: { fullName: `${prefix} ${name}`, email: `${prefix}.${name}@example.test`, role, status, memberProfile: { create: { professionalType, institution: 'Test Institute', country: 'India' } } }, include: { memberProfile: true } });
  fixture.ids.push(user.id);
  if (role === 'APPLICANT') await prisma.membershipApplication.create({ data: { userId: user.id, profileId: user.memberProfile!.id, applicationCode: `${prefix}-${name}`, credentialsText: '', educationText: '', researchText: '', status: 'PENDING' } });
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(crypto.randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  return { id: user.id, email: user.email, token: signAccessToken({ sub: user.id, sessionId: session.id, role }) };
}
async function draft(data: Record<string, unknown> = {}) {
  const response = await call(admin, 'post', base).send({ ...valid, ...data, requestId: crypto.randomUUID() });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  announcements.push(response.body.data.id);
  return response.body.data as { id: string; revision: number; status: string };
}
const act = (row: { id: string; revision: number }, action: string, body = {}) => call(admin, 'post', `${base}/${row.id}/${action}`).send({ expectedRevision: row.revision, requestId: crypto.randomUUID(), ...body });
const tick = async (id: string, advance = 0) => processAnnouncementJobs(new Date(Date.now() + advance), id);
beforeAll(async () => {
  admin = await actor('admin', 'ADMIN'); member = await actor('scientist', 'MEMBER'); other = await actor('professional', 'MEMBER', 'ACTIVE', 'Psychologist');
  applicant = await actor('applicant', 'APPLICANT', 'PENDING'); inactive = await actor('inactive', 'MEMBER', 'SUSPENDED');
  await actor('unknown', 'MEMBER', 'ACTIVE', 'Legacy classification');
  await actor('academic', 'MEMBER', 'ACTIVE', 'Academic Researcher');
  await actor('doctoral', 'MEMBER', 'ACTIVE', 'Doctoral Candidate');
  env.SAB_PREVIEW_EMAILS = ['reviewer@example.test'];
});
beforeEach(() => { vi.mocked(sendAnnouncementEmail).mockReset().mockResolvedValue(true); });
afterAll(async () => {
  env.SAB_PREVIEW_EMAILS = originalSAB;
  await prisma.notification.deleteMany({ where: { userId: { in: fixture.ids } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: fixture.ids } }, { entity: { in: announcements.map(id => `Announcement ${id}`) } }] } });
  await prisma.announcement.deleteMany({ where: { id: { in: announcements } } });
  await prisma.user.deleteMany({ where: { id: { in: fixture.ids } } });
  await prisma.$disconnect();
});

describe('announcement APIs and shared validation', () => {
  it('requires active administrators and protects every action', async () => {
    const row = await draft();
    for (const url of [base, `${base}/options`, `${base}/${row.id}`, `${base}/${row.id}/deliveries`]) {
      expect((await request(app).get(url)).status).toBe(401);
      expect((await call(member, 'get', url)).status).toBe(403);
      expect((await call(inactive, 'get', url)).status).toBe(401);
    }
    for (const action of ['preview', 'sign-off', 'send', 'schedule', 'cancel', 'retry']) expect((await call(member, 'post', `${base}/${row.id}/${action}`).send({})).status).toBe(403);
    expect((await call(member, 'post', base).send(valid)).status).toBe(403);
    expect((await call(member, 'patch', `${base}/${row.id}`).send({})).status).toBe(403);
    expect((await call(admin, 'get', `${base}/missing`)).status).toBe(404);
  });
  it('persists incomplete drafts, merges partial edits and rejects stale revisions', async () => {
    const row = await draft({ subject: '  Only a subject  ', body: '' });
    const first = (await call(admin, 'get', `${base}/${row.id}`)).body.data;
    expect(first.subject).toBe('Only a subject'); expect(first.body).toBe(''); expect(first.revision).toBe(1);
    expect((await act(row, 'send')).status).toBe(422);
    const updated = await call(admin, 'patch', `${base}/${row.id}`).send({ body: valid.body, requestId: crypto.randomUUID(), expectedRevision: 1 });
    expect(updated.status).toBe(200); expect(updated.body.data).toMatchObject({ subject: 'Only a subject', body: valid.body, revision: 2 });
    expect((await act(row, 'send')).status).toBe(409);
    expect((await call(admin, 'patch', `${base}/${row.id}`).send({ subject: 'Lost update', requestId: crypto.randomUUID(), expectedRevision: 1 })).status).toBe(409);
    expect((await call(admin, 'post', base).send({ subject: ' ', body: ' ', requestId: crypto.randomUUID() })).status).toBe(422);
  });
  it('deduplicates concurrent creates and rejects reused identifiers with different payloads', async () => {
    const input = { ...valid, requestId: crypto.randomUUID() };
    const results = await Promise.all([1, 2].map(() => call(admin, 'post', base).send(input)));
    results.forEach(r => expect(r.status).toBe(201));
    const id = results[0]!.body.data.id; announcements.push(id);
    expect(results[1]!.body.data.id).toBe(id);
    expect(await prisma.announcementOperation.count({ where: { announcementId: id } })).toBe(1);
    expect((await call(admin, 'post', base).send({ ...input, subject: 'Changed' })).status).toBe(409);
  });
  it.each([
    { subject: '' }, { body: 'too short' }, { subject: 's'.repeat(81) }, { body: 'x'.repeat(20001) },
    { audience: 'Newsletter (Public)' }, { audience: 'Pending Applicants', channel: 'In-App Only' }, { timezone: 'Not/Zone' },
  ])('shares client/server publication validation: %j', async invalid => {
    expect(announcementSchema('send').safeParse({ ...valid, ...invalid }).success).toBe(false);
    const result = await call(admin, 'post', base).send({ ...valid, ...invalid, requestId: crypto.randomUUID() });
    if (result.status === 201) { announcements.push(result.body.data.id); expect((await act(result.body.data, 'send')).status).toBe(422); }
    else expect(result.status).toBe(422);
  });
  it('validates timezone boundaries and stores UTC scheduling with cancellation', async () => {
    for (const invalid of [{ scheduledAt: '2000-01-01T09:00' }, { scheduledAt: '2035-02-30T09:00' }, { scheduledAt: '2035-03-11T02:30', timezone: 'America/New_York' }, { scheduledAt: '2035-11-04T01:30', timezone: 'America/New_York' }]) expect(announcementSchema('schedule').safeParse({ ...valid, ...invalid }).success).toBe(false);
    const row = await draft({ scheduledAt: '2035-06-10T09:00', timezone: 'Asia/Kolkata' });
    expect((await act(row, 'schedule')).status).toBe(200);
    const stored = await prisma.announcement.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.scheduledAt?.toISOString()).toBe('2035-06-10T03:30:00.000Z');
    await tick(row.id); expect(await prisma.announcementDelivery.count({ where: { announcementId: row.id } })).toBe(0);
    expect((await act(row, 'cancel')).body.data).toMatchObject({ status: 'Draft', scheduledAt: '', revision: 2 });
    await tick(row.id); expect(await prisma.announcementDelivery.count({ where: { announcementId: row.id } })).toBe(0);
  });
  it('filters before pagination and keeps independent tab counts', async () => {
    const rows = await prisma.announcement.createMany({ data: Array.from({ length: 27 }, (_, i) => ({ id: `${prefix}-page-${i}`, subject: `${prefix} pagination ${i}`, body: '', audience: 'Members Only', channel: 'In-App Only', authorId: admin.id, managed: true })) });
    expect(rows.count).toBe(27); announcements.push(...Array.from({ length: 27 }, (_, i) => `${prefix}-page-${i}`));
    const first = (await call(admin, 'get', base).query({ q: `${prefix} pagination`, audience: 'Members Only', status: 'Draft', limit: 10 })).body.data;
    const third = (await call(admin, 'get', base).query({ q: `${prefix} pagination`, limit: 10, page: 3 })).body.data;
    expect(first.pagination).toMatchObject({ total: 27, pages: 3 }); expect(third.items).toHaveLength(7);
    const empty = (await call(admin, 'get', base).query({ q: crypto.randomUUID() })).body.data;
    expect(empty.pagination.total).toBe(0); expect(empty.counts).toEqual(first.counts);
  });
});

describe('recipient boundaries and durable delivery', () => {
  it('recognizes registration classifications and never targets admins or public subscribers', async () => {
    const count = (audience: string) => prisma.user.count({ where: recipientWhere(audience) });
    expect(await count('All Members')).toBe(5); expect(await count('Members Only')).toBe(5);
    expect(await count('Scientists Track')).toBe(3); expect(await count('Professionals Track')).toBe(1);
    expect(await count('Pending Applicants')).toBe(1); expect(await count('Newsletter (Public)')).toBe(0);
    const options = (await call(admin, 'get', `${base}/options`)).body.data;
    expect(options.audiences.find((a: { name: string }) => a.name === 'Pending Applicants').inApp).toBe(0);
    expect(options.audiences.find((a: { name: string }) => a.name === 'Newsletter (Public)').available).toBe(false);
  });
  it('resolves recipients at dispatch, deduplicates concurrent workers and commits notifications atomically', async () => {
    const row = await draft({ channel: 'In-App Only', audience: 'Professionals Track' });
    const requestId = crypto.randomUUID();
    const result = await act(row, 'send', { requestId }); expect(result.status).toBe(200);
    expect((await act(row, 'send', { requestId })).status).toBe(200);
    await Promise.all([tick(row.id), tick(row.id)]);
    expect(await prisma.announcementDelivery.count({ where: { announcementId: row.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { announcementDelivery: { announcementId: row.id }, userId: other.id } })).toBe(1);
    expect((await call(admin, 'get', `${base}/${row.id}`)).body.data.status).toBe('Sent');
    expect((await act(row, 'cancel')).status).toBe(409);
    expect(sendAnnouncementEmail).not.toHaveBeenCalled();
    const calls = await prisma.announcementDelivery.findMany({ where: { announcementId: row.id } });
    expect(calls.every(d => fixture.ids.includes(d.recipientUserId!))).toBe(true);
  });
  it('handles missed schedules after restart and keeps future-dated receipts out of Document Exchange', async () => {
    const row = await draft({ channel: 'Email', audience: 'Professionals Track', scheduledAt: '2035-06-10T09:00' });
    await act(row, 'schedule');
    await processAnnouncementJobs(new Date('2035-06-10T10:00:00Z'), row.id);
    expect(sendAnnouncementEmail).toHaveBeenCalledTimes(1);
    // An email-carrying announcement now also delivers in-app, so the notification exists...
    expect(await prisma.notification.count({ where: { announcementDelivery: { announcementId: row.id } } })).toBe(1);
    // ...but the receipt is dated 2035, so it stays hidden until that date arrives.
    const exchange = await call(other, 'get', '/api/v1/members/me/document-exchange/items?type=announcements&limit=100');
    expect(exchange.body.data.items.some((a: { id: string }) => a.id === row.id)).toBe(false);
  });
  it('rechecks eligibility and email preferences and leaves operational mail unaffected', async () => {
    const row = await draft({ audience: 'Professionals Track' }); await act(row, 'send');
    const token = unsubscribeToken(other.id);
    const url = '/api/v1/announcements/unsubscribe';
    expect((await request(app).get(url).query({ token })).body.data.emailEnabled).toBe(true);
    expect((await request(app).post(url).send({ token })).body.data.emailEnabled).toBe(false);
    expect((await request(app).post(url).send({ token })).status).toBe(200);
    expect((await request(app).post(url).send({ token: 'forged' })).status).toBe(404);
    await tick(row.id);
    expect(sendAnnouncementEmail).not.toHaveBeenCalled();
    const receipts = await prisma.announcementDelivery.findMany({ where: { announcementId: row.id } });
    expect(receipts.find(d => d.channel === 'EMAIL')?.status).toBe('SUPPRESSED'); expect(receipts.find(d => d.channel === 'IN_APP')?.status).toBe('SENT');
    await prisma.announcementPreference.delete({ where: { userId: other.id } });
    const suspended = await draft({ audience: 'Professionals Track' }); await act(suspended, 'send');
    await prisma.user.update({ where: { id: other.id }, data: { status: 'SUSPENDED' } });
    try { await tick(suspended.id); expect((await call(admin, 'get', `${base}/${suspended.id}`)).body.data.status).toBe('Suppressed'); }
    finally { await prisma.user.update({ where: { id: other.id }, data: { status: 'ACTIVE' } }); }
  });
  it('keeps unconfigured delivery unsent and retries failures with bounded backoff', async () => {
    const row = await draft({ audience: 'Professionals Track' }); await act(row, 'send');
    vi.mocked(sendAnnouncementEmail).mockResolvedValue(false); await tick(row.id);
    let delivery = await prisma.announcementDelivery.findFirstOrThrow({ where: { announcementId: row.id, channel: 'EMAIL' } });
    expect(delivery.status).toBe('UNCONFIGURED'); expect(delivery.deliveredAt).toBeNull();
    vi.mocked(sendAnnouncementEmail).mockRejectedValue(new Error('private SMTP credentials must not escape'));
    for (let i = 1; i <= 5; i++) { await prisma.announcementDelivery.update({ where: { id: delivery.id }, data: { dueAt: new Date(0) } }); await tick(row.id); }
    delivery = await prisma.announcementDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(delivery.status).toBe('FAILED'); expect(delivery.attempts).toBe(5); expect(delivery.error).not.toContain('private SMTP');
    expect((await call(admin, 'get', `${base}/${row.id}`)).body.data.status).toBe('Partial');
    const results = await call(admin, 'get', `${base}/${row.id}/deliveries?channel=EMAIL&purpose=BROADCAST`);
    expect(results.body.data.items).toHaveLength(1); expect(JSON.stringify(results.body)).not.toContain('claimToken');
    expect((await act(row, 'retry')).status).toBe(200);
    vi.mocked(sendAnnouncementEmail).mockResolvedValue(true); await tick(row.id);
    expect((await call(admin, 'get', `${base}/${row.id}`)).body.data.status).toBe('Sent');
    const sent = vi.mocked(sendAnnouncementEmail).mock.calls.at(-1)![0];
    expect(sent.unsubscribeUrl).toContain('#token=');
  });
  it('recovers expired claims without duplicating an existing in-app receipt', async () => {
    const row = await draft({ audience: 'Professionals Track', channel: 'In-App Only' }); await act(row, 'send'); await tick(row.id);
    const receipt = await prisma.announcementDelivery.findFirstOrThrow({ where: { announcementId: row.id } });
    await prisma.announcementDelivery.update({ where: { id: receipt.id }, data: { status: 'PROCESSING', claimToken: 'lost-worker', lockedAt: new Date(0), dueAt: new Date(0) } });
    await tick(row.id);
    expect(await prisma.notification.count({ where: { announcementDeliveryId: receipt.id } })).toBe(1);
    expect((await prisma.announcementDelivery.findUniqueOrThrow({ where: { id: receipt.id } })).status).toBe('SENT');
  });
  it('processes more than one batch without skipping recipients', async () => {
    const row = await draft({ audience: 'Professionals Track', channel: 'In-App Only' });
    await prisma.announcement.update({ where: { id: row.id }, data: { status: 'SENDING', dispatchStartedAt: new Date() } });
    await prisma.announcementDelivery.createMany({ data: Array.from({ length: 105 }, (_, i) => ({ key: `${prefix}-batch-${i}`, announcementId: row.id, recipientUserId: other.id, recipientEmail: other.email, channel: 'IN_APP', purpose: 'BROADCAST', revision: 1, status: 'QUEUED' })) });
    await tick(row.id); expect(await prisma.announcementDelivery.count({ where: { announcementId: row.id, status: 'SENT' } })).toBe(100);
    await tick(row.id); expect(await prisma.announcementDelivery.count({ where: { announcementId: row.id, status: 'SENT' } })).toBe(105);
    const page = await call(admin, 'get', `${base}/${row.id}/deliveries?limit=50&page=3`); expect(page.body.data.items).toHaveLength(5);
  });
});

describe('member announcement lifecycle', () => {
  const memberBase = '/api/v1/members/me/announcements';
  const visible = async (who: Actor, id: string) => call(who, 'get', `${memberBase}/${id}`);
  async function publish(extra: Record<string, unknown> = {}) {
    const row = await draft({ channel: 'In-App Only', ...extra });
    expect((await act(row, 'send')).status).toBe(200);
    await tick(row.id);
    return row;
  }
  it('requires active members and hides drafts, future schedules and unrelated audiences', async () => {
    const row = await draft();
    expect((await visible(member, row.id)).status).toBe(404);
    expect((await request(app).get(memberBase)).status).toBe(401);
    expect((await call(inactive, 'get', memberBase)).status).toBe(401);
    expect((await call(applicant, 'get', memberBase)).status).toBe(403);
    const future = await draft({ scheduledAt: '2035-06-10T09:00' });
    await act(future, 'schedule'); await tick(future.id);
    expect((await visible(member, future.id)).status).toBe(404);
    const sent = await publish();
    expect((await visible(other, sent.id)).status).toBe(404);
    expect((await visible(member, sent.id)).body.data).toMatchObject({ subject: valid.subject, body: valid.body, status: 'UNREAD', sender: 'CRO Office' });
    expect((await visible(member, sent.id)).body.data).not.toHaveProperty('deliveries');
  });
  it('synchronizes read/unread across exchange and notifications without losing first-read history', async () => {
    const row = await publish();
    const notification = await prisma.notification.findUniqueOrThrow({ where: { userId_announcementId: { userId: member.id, announcementId: row.id } } });
    expect((await call(other, 'post', `${memberBase}/${row.id}/read`)).status).toBe(404);
    expect((await call(member, 'post', `${memberBase}/${row.id}/read`)).body.data.status).toBe('READ');
    const first = await prisma.announcementDelivery.findUniqueOrThrow({ where: { id: notification.announcementDeliveryId! } });
    expect(first.openedAt).not.toBeNull();
    expect((await call(member, 'post', `/api/v1/notifications/${notification.id}/unread`)).status).toBe(200);
    expect((await visible(member, row.id)).body.data.status).toBe('UNREAD');
    const exchange = (await call(member, 'get', '/api/v1/members/me/document-exchange/items?type=announcements&limit=100')).body.data;
    expect(exchange.items.find((item: { id: string }) => item.id === row.id).status).toBe('UNREAD');
    await call(member, 'post', `/api/v1/notifications/${notification.id}/read`);
    expect((await prisma.announcementDelivery.findUniqueOrThrow({ where: { id: first.id } })).openedAt).toEqual(first.openedAt);
    expect((await visible(member, row.id)).body.data.status).toBe('READ');
  });
  it('keeps successful in-app delivery visible during partial email failure', async () => {
    vi.mocked(sendAnnouncementEmail).mockRejectedValue(new Error('fixture failure'));
    const row = await publish({ channel: 'Email + In-App' });
    expect((await visible(member, row.id)).status).toBe(200);
    await prisma.announcement.update({ where: { id: row.id }, data: { status: 'PARTIAL' } });
    expect((await visible(member, row.id)).status).toBe(200);
  });
  it('shows email-carrying announcements in-app and still emails them', async () => {
    const row = await publish({ channel: 'Email' });
    expect((await visible(member, row.id)).status).toBe(200);
    const mine = await prisma.announcementDelivery.findMany({ where: { announcementId: row.id, purpose: 'BROADCAST', recipientUserId: member.id }, select: { channel: true } });
    expect(mine.map(d => d.channel).sort()).toEqual(['EMAIL', 'IN_APP']);
    expect(sendAnnouncementEmail).toHaveBeenCalled();
  });

  it('delivers in-app even when the member has opted out of announcement email', async () => {
    await prisma.announcementPreference.upsert({ where: { userId: member.id }, create: { userId: member.id, emailEnabled: false }, update: { emailEnabled: false } });
    try {
      const row = await publish({ channel: 'Email' });
      // The opt-out silences the email; the in-app copy still arrives.
      expect((await visible(member, row.id)).status).toBe(200);
      const mine = await prisma.announcementDelivery.findMany({ where: { announcementId: row.id, recipientUserId: member.id }, select: { channel: true, status: true } });
      expect(mine.find(d => d.channel === 'EMAIL')?.status).toBe('SUPPRESSED');
      expect(mine.find(d => d.channel === 'IN_APP')?.status).toBe('SENT');
    } finally {
      await prisma.announcementPreference.update({ where: { userId: member.id }, data: { emailEnabled: true } });
    }
  });

  it('keeps Pending Applicants email-only — they have no in-app reader', async () => {
    const row = await draft({ audience: 'Pending Applicants', channel: 'Email' });
    expect((await act(row, 'send')).status).toBe(200);
    await tick(row.id);
    const deliveries = await prisma.announcementDelivery.findMany({ where: { announcementId: row.id, purpose: 'BROADCAST' }, select: { channel: true } });
    expect(deliveries.length).toBeGreaterThan(0);
    expect([...new Set(deliveries.map(d => d.channel))]).toEqual(['EMAIL']);
  });

  it('excludes preview-only, stale-revision and future-dated receipts', async () => {
    const preview = await draft(); await act(preview, 'preview'); await tick(preview.id);
    expect((await visible(member, preview.id)).status).toBe(404);
    const stale = await publish();
    await prisma.announcement.update({ where: { id: stale.id }, data: { revision: { increment: 1 } } });
    expect((await visible(member, stale.id)).status).toBe(404);
    const future = await publish();
    await prisma.announcementDelivery.updateMany({ where: { announcementId: future.id }, data: { deliveredAt: new Date(Date.now() + 86400000) } });
    expect((await visible(member, future.id)).status).toBe(404);
  });
  it('rechecks current audience membership for existing notifications', async () => {
    const row = await publish();
    const notification = await prisma.notification.findUniqueOrThrow({ where: { userId_announcementId: { userId: member.id, announcementId: row.id } } });
    await prisma.memberProfile.update({ where: { userId: member.id }, data: { professionalType: 'Psychologist' } });
    try {
      expect((await visible(member, row.id)).status).toBe(404);
      expect((await call(member, 'get', `/api/v1/notifications/${notification.id}`)).status).toBe(404);
      expect((await call(member, 'post', `/api/v1/notifications/${notification.id}/read`)).status).toBe(404);
    } finally { await prisma.memberProfile.update({ where: { userId: member.id }, data: { professionalType: 'Research Scholar / Scientist' } }); }
  });
  it('validates expiry dates and persists timezone conversion without resetting expiry on partial edits', async () => {
    const row = await draft({ expiresAt: '2035-06-10T10:00', timezone: 'Asia/Kolkata' });
    expect((await prisma.announcement.findUniqueOrThrow({ where: { id: row.id } })).expiresAt?.toISOString()).toBe('2035-06-10T04:30:00.000Z');
    const updated = await call(admin, 'patch', `${base}/${row.id}`).send({ subject: 'Updated subject', expectedRevision: row.revision, requestId: crypto.randomUUID() });
    expect(updated.body.data.expiresAt).toBe('2035-06-10T10:00');
    for (const input of [
      { expiresAt: '2035-02-30T10:00' }, { expiresAt: '2035-03-11T02:30', timezone: 'America/New_York' },
      { expiresAt: '2035-11-04T01:30', timezone: 'America/New_York' },
      { scheduledAt: '2035-06-10T10:00', expiresAt: '2035-06-10T10:00' }, { expiresAt: '2000-01-01T10:00' },
    ]) expect(announcementSchema('send').safeParse({ ...valid, ...input }).success).toBe(false);
  });
  it('removes expired content from every member surface and prevents delivery retry', async () => {
    const row = await publish();
    const notification = await prisma.notification.findUniqueOrThrow({ where: { userId_announcementId: { userId: member.id, announcementId: row.id } } });
    await prisma.announcement.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    expect((await visible(member, row.id)).status).toBe(404);
    expect((await call(member, 'get', `/api/v1/notifications/${notification.id}`)).status).toBe(404);
    expect((await call(member, 'get', `/api/v1/notifications?announcement=${row.id}`)).body.data.items).toEqual([]);
    expect((await call(member, 'post', `${memberBase}/${row.id}/unread`)).status).toBe(404);
    expect((await act(row, 'retry')).status).toBe(409);
  });
  it('suppresses a schedule that expires while the worker is offline', async () => {
    const row = await draft({ scheduledAt: '2035-06-10T09:00', expiresAt: '2035-06-10T10:00' });
    await act(row, 'schedule');
    await processAnnouncementJobs(new Date('2035-06-10T10:00:00Z'), row.id);
    expect((await prisma.announcement.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('SUPPRESSED');
    expect(await prisma.announcementDelivery.count({ where: { announcementId: row.id } })).toBe(0);
    expect(sendAnnouncementEmail).not.toHaveBeenCalled();
  });
  it('soft deletes idempotently, revokes access and keeps audit and delivery history', async () => {
    const row = await publish();
    const notification = await prisma.notification.findUniqueOrThrow({ where: { userId_announcementId: { userId: member.id, announcementId: row.id } } });
    expect((await act(row, 'delete')).status).toBe(422);
    const input = { confirmed: true, requestId: crypto.randomUUID(), expectedRevision: row.revision };
    expect((await call(admin, 'post', `${base}/${row.id}/delete`).send(input)).status).toBe(200);
    expect((await call(admin, 'post', `${base}/${row.id}/delete`).send(input)).status).toBe(200);
    expect((await visible(member, row.id)).status).toBe(404);
    expect((await call(member, 'get', `/api/v1/notifications/${notification.id}`)).status).toBe(404);
    expect((await call(admin, 'get', `${base}/${row.id}`)).status).toBe(404);
    expect(await prisma.announcementDelivery.count({ where: { announcementId: row.id, status: 'SENT' } })).toBeGreaterThan(0);
    expect(await prisma.auditLog.count({ where: { entity: `Announcement ${row.id}`, action: 'Announcementdelete' } })).toBe(1);
  });
  it('publishes an overdue schedule after restart only when it is still live', async () => {
    const row = await draft({ channel: 'In-App Only', scheduledAt: '2035-06-10T09:00', expiresAt: '2035-06-10T10:00' });
    await act(row, 'schedule');
    await prisma.announcement.update({ where: { id: row.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
    await tick(row.id);
    expect((await visible(member, row.id)).status).toBe(200);
    expect(await prisma.notification.count({ where: { announcementId: row.id, userId: member.id } })).toBe(1);
  });
  it('stops queued retries after expiry without sending email', async () => {
    vi.mocked(sendAnnouncementEmail).mockResolvedValue(false);
    const row = await publish({ channel: 'Email + In-App' });
    await prisma.announcement.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    await prisma.announcementDelivery.updateMany({ where: { announcementId: row.id, status: 'UNCONFIGURED' }, data: { dueAt: new Date(0) } });
    vi.mocked(sendAnnouncementEmail).mockClear();
    await tick(row.id);
    expect(sendAnnouncementEmail).not.toHaveBeenCalled();
    expect(await prisma.announcementDelivery.count({ where: { announcementId: row.id, status: { in: ['QUEUED', 'PROCESSING', 'UNCONFIGURED'] } } })).toBe(0);
    expect((await visible(member, row.id)).status).toBe(404);
  });
  it('serializes deletion against concurrent workers and never delivers after deletion returns', async () => {
    const row = await draft({ channel: 'In-App Only' }); await act(row, 'send');
    await Promise.all([act(row, 'delete', { confirmed: true }), tick(row.id), tick(row.id)]);
    const before = await prisma.notification.count({ where: { announcementId: row.id } });
    await tick(row.id);
    expect(await prisma.notification.count({ where: { announcementId: row.id } })).toBe(before);
    expect((await visible(member, row.id)).status).toBe(404);
  });
  it('preserves legacy content, creates read state only on interaction, and hides orphan notifications', async () => {
    const row = await prisma.announcement.create({ data: { subject: `${prefix} legacy`, body: valid.body, audience: 'Members Only', channel: 'In-App Only', status: 'SENT', sentAt: new Date() } });
    announcements.push(row.id);
    expect((await visible(member, row.id)).body.data.status).toBe('UNREAD');
    expect(await prisma.notification.count({ where: { announcementId: row.id } })).toBe(0);
    await call(member, 'post', `${memberBase}/${row.id}/read`);
    expect(await prisma.notification.count({ where: { announcementId: row.id, status: 'READ' } })).toBe(1);
    expect(await prisma.announcementDelivery.count({ where: { announcementId: row.id } })).toBe(0);
    await prisma.announcement.delete({ where: { id: row.id } });
    const inbox = (await call(member, 'get', '/api/v1/notifications?limit=100')).body.data;
    expect(inbox.items.some((item: { title: string }) => item.title === row.subject)).toBe(false);
  });
  it('filters before pagination beyond 100 records and clamps removed pages', async () => {
    const ids = Array.from({ length: 105 }, (_, i) => `${prefix}-member-page-${i}`); announcements.push(...ids);
    await prisma.announcement.createMany({ data: ids.map((id, i) => ({ id, subject: `${prefix} searchable ${i}`, body: 'Pagination fixture', audience: 'Members Only', channel: 'In-App Only', status: 'SENT', sentAt: new Date() })) });
    const first = (await call(member, 'get', memberBase).query({ q: `${prefix} searchable`, limit: 50 })).body.data;
    const third = (await call(member, 'get', memberBase).query({ q: `${prefix} searchable`, limit: 50, page: 3 })).body.data;
    expect(first.pagination.total).toBe(105); expect(first.items).toHaveLength(50); expect(third.items).toHaveLength(5);
    const id = third.items[0].id;
    await call(member, 'post', `${memberBase}/${id}/read`);
    const read = (await call(member, 'get', memberBase).query({ q: `${prefix} searchable`, status: 'READ', page: 3 })).body.data;
    expect(read.pagination).toMatchObject({ total: 1, page: 1 }); expect(read.items[0].id).toBe(id);
    expect((await call(member, 'get', memberBase).query({ q: `${prefix} absent` })).body.data.items).toEqual([]);
  });
});

describe('SAB review and notifications', () => {
  it('requires successful current-revision previews and manual sign-off; edits invalidate approval', async () => {
    const row = await draft({ sendSABPreview: true });
    expect((await act(row, 'send')).status).toBe(409);
    expect((await act(row, 'sign-off', { confirmed: true })).status).toBe(409);
    expect((await act(row, 'preview')).status).toBe(200); await tick(row.id);
    expect(sendAnnouncementEmail).toHaveBeenCalledWith(expect.objectContaining({ preview: true, to: 'reviewer@example.test', unsubscribeUrl: undefined }));
    expect((await act(row, 'sign-off')).status).toBe(422);
    expect((await act(row, 'sign-off', { confirmed: true })).body.data.signedOff).toBe(true);
    const edited = await call(admin, 'patch', `${base}/${row.id}`).send({ subject: 'Revised announcement', expectedRevision: 1, requestId: crypto.randomUUID() });
    expect(edited.body.data).toMatchObject({ revision: 2, signedOff: false, previewReady: false });
    expect((await act(edited.body.data, 'send')).status).toBe(409);
    expect(edited.body.data.recipients).toBe(0);
  });
  it('enforces notification ownership, read idempotency and actual receipt engagement', async () => {
    const row = await draft({ audience: 'Professionals Track', channel: 'In-App Only' }); await act(row, 'send'); await tick(row.id);
    const inbox = (await call(other, 'get', `/api/v1/notifications?announcement=${row.id}`)).body.data;
    expect(inbox.items).toHaveLength(1); const item = inbox.items[0];
    expect((await call(member, 'get', `/api/v1/notifications/${item.id}`)).status).toBe(404);
    expect((await call(admin, 'post', `/api/v1/notifications/${item.id}/read`)).status).toBe(404);
    expect((await call(applicant, 'get', '/api/v1/notifications')).status).toBe(403);
    expect((await call(other, 'get', `/api/v1/notifications/${item.id}`)).body.data.body).toBe(valid.body);
    const before = await prisma.announcementDelivery.findFirstOrThrow({ where: { announcementId: row.id } }); expect(before.openedAt).toBeNull();
    expect((await call(other, 'post', `/api/v1/notifications/${item.id}/read`)).body.data.read).toBe(1);
    expect((await call(other, 'post', `/api/v1/notifications/${item.id}/read`)).body.data.read).toBe(0);
    expect((await prisma.announcementDelivery.findUniqueOrThrow({ where: { id: before.id } })).openedAt).not.toBeNull();
    const exchange = await call(other, 'get', '/api/v1/members/me/document-exchange/items?type=announcements&limit=100');
    expect(exchange.body.data.items.some((a: { id: string }) => a.id === row.id)).toBe(true);
    const snapshot = (await call(other, 'get', '/api/v1/notifications')).body.data;
    await prisma.notification.create({ data: { userId: other.id, title: 'Support notification', body: 'Existing support behavior', type: 'support', createdAt: new Date(Date.parse(snapshot.asOf) + 1000) } });
    expect((await call(other, 'post', '/api/v1/notifications/read-all').send({ through: snapshot.asOf })).status).toBe(200);
    expect((await call(other, 'get', '/api/v1/notifications')).body.data.unread).toBe(1);
  });
  it('renders Markdown safely without HTML, remote images, or executable links', () => {
    const html = renderAnnouncement('<script>alert(1)</script> **Bold** [unsafe](javascript:alert(1)) ![pixel](https://example.test/pixel) [safe](https://example.test)');
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img'); expect(html).not.toContain('href="javascript:');
    expect(html).toContain('<strong>Bold</strong>'); expect(html).toContain('rel="noopener noreferrer"');
  });
});
