import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
vi.mock('../services/mail.service', () => ({ sendEventEmail: vi.fn(async () => true), verifyTransport: vi.fn(), sendOtpEmail: vi.fn(), sendApprovalEmail: vi.fn() }));
vi.mock('../../frontend/src/api/client', () => ({ apiClient: {} }));
import { sendEventEmail } from '../services/mail.service';
import { prisma } from '../config/database';
import { createApp } from '../app';
import { sha256, signAccessToken } from '../utils/security';
import { processEventJobs } from '../services/event-jobs.service';
import { eventSchema } from '../domain/event-input';
import { eventPayload, eventToForm } from '../../frontend/src/api/events';

const app = createApp();
const prefix = `events-test-${randomUUID().slice(0, 8)}`;
let adminId: string, adminToken: string, memberId: string, memberToken: string;
const ids: string[] = [];
const fileIds: string[] = [];
const full = (overrides = {}) => ({ title: `${prefix} Workshop`, shortDescription: 'A complete research workshop for members.', longDescription: 'A detailed description of the research workshop with an agenda and invited speakers.', date: '2030-06-12', timeStart: '14:00', timeEnd: '16:00', timezone: 'UTC', location: 'Online meeting room', organizer: 'Events Team', organizerEmail: 'events@example.test', audience: 'Public', status: 'PUBLISHED', sendReminder: false, ...overrides });
const api = (method: 'get' | 'post' | 'patch' | 'delete', suffix = '') => request(app)[method](`/api/v1/admin/events${suffix}`).set('Authorization', `Bearer ${adminToken}`);
async function create(payload = full()) {
  const response = await api('post').send(payload);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  ids.push(response.body.data.id); return response.body.data;
}
beforeAll(async () => {
  for (const role of ['ADMIN', 'MEMBER'] as const) {
    const user = await prisma.user.create({ data: { email: `${prefix}-${role}@example.test`, fullName: `Event Test ${role}`, role, status: 'ACTIVE' } });
    const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
    const token = signAccessToken({ sub: user.id, sessionId: session.id, role });
    if (role === 'ADMIN') { adminId = user.id; adminToken = token; } else { memberId = user.id; memberToken = token; }
  }
});
beforeEach(() => { vi.mocked(sendEventEmail).mockReset().mockResolvedValue(true); });
afterAll(async () => {
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: fileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminId, memberId] } } });
  await prisma.$disconnect();
});

describe('admin events', () => {
  it('requires an authenticated administrator', async () => {
    expect((await request(app).get('/api/v1/admin/events')).status).toBe(401);
    expect((await request(app).post('/api/v1/admin/events').set('Authorization', `Bearer ${memberToken}`).send(full())).status).toBe(403);
  });
  it('saves a title-only draft and reads it after another request', async () => {
    const e = await create({ title: `${prefix} incomplete` } as ReturnType<typeof full>);
    expect(e.status).toBe('DRAFT'); expect(e.date).toBe(''); expect(e.creatorId).toBe(adminId);
    expect((await api('get', `/${e.id}`)).body.data.title).toBe(e.title);
    expect((await api('post', `/${e.id}/publish`)).status).toBe(422);
  });
  it('persists all editable fields and atomically replaces speakers and tags', async () => {
    const e = await create(full({ speakers: ['First', 'Second'], tags: ['Custom legacy tag', 'Workshop', 'Workshop'], capacity: 0, featured: true, registrationRequired: false, waitlistEnabled: false, recordingProvided: true }));
    expect(e.tags).toEqual(['Custom legacy tag', 'Workshop']); expect(e.capacity).toBe(0);
    const update = await api('patch', `/${e.id}`).send({ speakers: ['Third'], tags: [], capacity: null });
    expect(update.status).toBe(200); expect(update.body.data.speakers).toEqual(['Third']); expect(update.body.data.tags).toEqual([]); expect(update.body.data.slug).toBe(e.slug);
    expect(update.body.data.title).toBe(e.title); expect(update.body.data.capacity).toBeNull();
  });
  it('validates merged published records and rejects unknown fields', async () => {
    const e = await create();
    expect((await api('patch', `/${e.id}`).send({ longDescription: '' })).status).toBe(422);
    expect((await api('patch', `/${e.id}`).send({ creatorId: memberId })).status).toBe(422);
    expect((await api('get', '/missing')).status).toBe(404);
  });
  it('round-trips the editor without sending read-only metadata', async () => {
    const e = await create();
    const payload = eventPayload(eventToForm(e), 'submit');
    expect(payload).not.toHaveProperty('id'); expect(payload).not.toHaveProperty('agenda');
    expect((await api('patch', `/${e.id}`).send(payload)).status).toBe(200);
  });
  it.each([{ date: '2030-02-30' }, { timeEnd: '13:00' }, { timezone: 'Wrong/Zone' }, { organizerEmail: 'bad' }, { externalUrl: 'javascript:alert(1)' }, { capacity: 1.5 }, { capacity: -1 }, { tags: ['1', '2', '3', '4', '5', '6'] }])('rejects invalid input %j', async invalid => {
    expect((await api('post').send(full(invalid))).status).toBe(422);
  });
  it('uses timezone offsets and rejects nonexistent/ambiguous local times', async () => {
    const e = await create(full({ timezone: 'Asia/Kolkata (IST)' }));
    expect(e.timezone).toBe('Asia/Kolkata'); expect(e.startsAt).toBe('2030-06-12T08:30:00.000Z');
    expect(eventSchema().safeParse(full({ date: '2030-03-10', timeStart: '02:30', timezone: 'America/New_York' })).success).toBe(false);
    expect(eventSchema().safeParse(full({ date: '2030-11-03', timeStart: '01:30', timezone: 'America/New_York' })).success).toBe(false);
  });
  it('filters, paginates, counts registrations, and distinguishes drafts from upcoming', async () => {
    const key = `${prefix} paging`;
    const first = await create(full({ title: `${key} one` }));
    await create(full({ title: `${key} two` }));
    await create(full({ title: `${key} draft`, status: 'DRAFT' }));
    await prisma.eventRegistration.createMany({ data: [{ eventId: first.id, status: 'Registered' }, { eventId: first.id, status: 'Waitlisted' }] });
    const response = await api('get', `?q=${encodeURIComponent(key)}&limit=1&page=2`);
    expect(response.body.data.pagination).toEqual({ page: 2, limit: 1, total: 2, pages: 2 });
    expect(response.body.data.items[0]).not.toHaveProperty('registrations');
    expect((await api('get', `/${first.id}`)).body.data.attendees).toBe(1);
    expect((await api('get', `?q=${encodeURIComponent(key)}&tab=drafts`)).body.data.pagination.total).toBe(1);
    expect((await api('get', '?page=0')).status).toBe(422);
  });
  it('validates cover ownership/type and preserves the cover on edits', async () => {
    const file = await prisma.fileObject.create({ data: { uploaderId: adminId, storageKey: randomUUID(), originalName: 'cover.png', mimeType: 'image/png', sizeBytes: 50, visibility: 'PRIVATE' } }); fileIds.push(file.id);
    const foreign = await prisma.fileObject.create({ data: { uploaderId: memberId, storageKey: randomUUID(), originalName: 'cover.png', mimeType: 'image/png', sizeBytes: 50, visibility: 'PRIVATE' } }); fileIds.push(foreign.id);
    expect((await api('post').send(full({ coverFileId: foreign.id }))).status).toBe(422);
    const e = await create(full({ coverFileId: file.id }));
    expect((await api('patch', `/${e.id}`).send({ title: `${prefix} changed title` })).body.data.coverFile.id).toBe(file.id);
  });
  it('keeps drafts/invite-only/cancelled/deleted events out of public detail', async () => {
    const e = await create();
    const publicDetail = () => request(app).get(`/api/v1/public/events/${e.slug}`);
    expect((await publicDetail()).status).toBe(200);
    await api('patch', `/${e.id}`).send({ audience: 'CRO Invite' }); expect((await publicDetail()).status).toBe(404);
    await api('patch', `/${e.id}`).send({ status: 'DRAFT' }); expect((await publicDetail()).status).toBe(404);
    await api('post', `/${e.id}/publish`); await api('post', `/${e.id}/cancel`).send({ emailAttendees: false });
    expect((await api('get', `/${e.id}`)).body.data.status).toBe('CANCELLED'); expect((await publicDetail()).status).toBe(404);
    expect((await api('delete', `/${e.id}`)).status).toBe(200); expect((await api('get', `/${e.id}`)).status).toBe(404);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: e.id } })).deletedAt).not.toBeNull();
  });
});

describe('event worker', () => {
  it('publishes overdue schedules after restart, once', async () => {
    const e = await create(full({ status: 'DRAFT', scheduledPublishDate: '2030-06-11T12:00' }));
    const now = new Date('2030-06-11T13:00:00Z');
    await processEventJobs(now, e.id); await processEventJobs(now, e.id);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: e.id } })).status).toBe('PUBLISHED');
    expect(await prisma.eventJob.count({ where: { eventId: e.id, kind: 'PUBLISH', status: 'SENT' } })).toBe(1);
  });
  it('refuses invalid schedules and does not publish events that ended during downtime', async () => {
    expect((await api('post').send(full({ status: 'DRAFT', scheduledPublishDate: '2030-06-12T15:00' }))).status).toBe(422);
    const e = await create(full({ status: 'DRAFT', scheduledPublishDate: '2030-06-11T12:00' }));
    await processEventJobs(new Date('2030-06-13T00:00:00Z'), e.id);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: e.id } })).status).toBe('DRAFT');
    expect(await prisma.eventJob.count({ where: { eventId: e.id, status: 'FAILED' } })).toBe(1);
  });
  it('sends reminders once, resolves member email, excludes waitlisted attendees', async () => {
    const e = await create(full({ sendReminder: true, reminderDays: 0 }));
    await prisma.eventRegistration.createMany({ data: [{ eventId: e.id, userId: memberId }, { eventId: e.id, email: 'wait@example.test', status: 'Waitlisted' }] });
    const now = new Date('2030-06-12T11:01:00Z');
    await processEventJobs(now, e.id); await processEventJobs(now, e.id);
    expect(sendEventEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEventEmail).mock.calls[0]?.[0]).toBe(`${prefix}-MEMBER@example.test`.toLowerCase());
  });
  it('reports unconfigured mail truthfully and retries transport failures', async () => {
    const e = await create(full({ sendReminder: true }));
    await prisma.eventRegistration.create({ data: { eventId: e.id, email: 'test@example.test' } });
    vi.mocked(sendEventEmail).mockResolvedValueOnce(false);
    await processEventJobs(new Date('2030-06-11T15:00:00Z'), e.id);
    expect(await prisma.eventJob.count({ where: { eventId: e.id, status: 'UNCONFIGURED', sentAt: null } })).toBe(1);
    vi.mocked(sendEventEmail).mockRejectedValueOnce(new Error('SMTP failed'));
    await processEventJobs(new Date('2030-06-11T15:02:00Z'), e.id);
    expect(await prisma.eventJob.count({ where: { eventId: e.id, status: 'QUEUED', attempts: 1 } })).toBe(1);
    await processEventJobs(new Date('2030-06-11T15:04:00Z'), e.id);
    expect(await prisma.eventJob.count({ where: { eventId: e.id, status: 'SENT' } })).toBe(1);
  });
  it('reconciles reminders on edit and cancellation, queues optional cancellation emails', async () => {
    const e = await create(full({ sendReminder: true, featured: true }));
    await prisma.eventRegistration.create({ data: { eventId: e.id, email: 'test@example.test' } });
    await api('patch', `/${e.id}`).send({ reminderDays: 3 });
    expect(await prisma.eventJob.count({ where: { eventId: e.id, kind: 'REMINDER', status: 'QUEUED' } })).toBe(1);
    const result = await api('post', `/${e.id}/cancel`).send({ reason: 'Speaker unavailable', emailAttendees: true });
    expect(result.body.data.featured).toBe(false);
    expect(await prisma.eventJob.count({ where: { eventId: e.id, kind: 'REMINDER', status: 'QUEUED' } })).toBe(0);
    await processEventJobs(new Date(), e.id);
    expect(sendEventEmail).toHaveBeenCalledTimes(1); expect(vi.mocked(sendEventEmail).mock.calls[0]?.[2]).toBe(true);
    await api('post', `/${e.id}/cancel`).send({ emailAttendees: true }); await processEventJobs(new Date(), e.id);
    expect(sendEventEmail).toHaveBeenCalledTimes(1);
  });
  it('claims jobs atomically across simultaneous workers', async () => {
    const e = await create(full({ sendReminder: true }));
    await prisma.eventRegistration.create({ data: { eventId: e.id, email: 'concurrent@example.test' } });
    await api('patch', `/${e.id}`).send({ reminderDays: 1 });
    await Promise.all([processEventJobs(new Date('2030-06-11T15:00:00Z'), e.id), processEventJobs(new Date('2030-06-11T15:00:00Z'), e.id)]);
    expect(sendEventEmail).toHaveBeenCalledTimes(1);
  });
});
