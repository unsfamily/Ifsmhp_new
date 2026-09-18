import request from 'supertest';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../services/mail.service', () => ({ sendEventEmail: vi.fn(async () => true), verifyTransport: vi.fn(), sendOtpEmail: vi.fn(), sendApprovalEmail: vi.fn() }));
import { createApp } from '../app';
import { prisma } from '../config/database';
import { sha256, signAccessToken } from '../utils/security';
import { assertSafePath } from '../utils/fileStorage';
import { listPublicEvents } from '../services/public-events.service';
import { processEventJobs } from '../services/event-jobs.service';

const app = createApp();
const prefix = `public-events-${randomUUID().slice(0, 8)}`;
const base = '/api/v1/public/events';
const ids: string[] = [], files: { id: string; storageKey: string }[] = [];
let adminId: string, token: string;
const full = (overrides = {}) => ({ title: `${prefix} workshop`, shortDescription: 'Research workshop with a complete public description.', longDescription: 'Complete event agenda: research findings and discussion followed by a question and answer session.', date: '2035-06-10', timeStart: '00:30', timeEnd: '02:30', timezone: 'Asia/Kolkata', location: 'Research Institute, Chennai', organizer: 'Events Office', organizerEmail: 'events@example.test', audience: 'Public', status: 'PUBLISHED', sendReminder: false, ...overrides });
const admin = (method: 'post' | 'patch' | 'delete', path = '') => request(app)[method](`/api/v1/admin/events${path}`).set('Authorization', `Bearer ${token}`);
async function create(overrides = {}) {
  const result = await admin('post').send(full(overrides)); expect(result.status, JSON.stringify(result.body)).toBe(201);
  ids.push(result.body.data.id); return result.body.data;
}
const listing = (query = {}) => request(app).get(base).query({ q: prefix, ...query });
beforeAll(async () => {
  const user = await prisma.user.create({ data: { fullName: 'Public event test admin', email: `${prefix}@example.test`, role: 'ADMIN', status: 'ACTIVE' } }); adminId = user.id;
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  token = signAccessToken({ sub: user.id, sessionId: session.id, role: 'ADMIN' });
});
afterAll(async () => {
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: files.map(f => f.id) } } });
  await prisma.auditLog.deleteMany({ where: { actorId: adminId } });
  await prisma.user.deleteMany({ where: { id: adminId } });
  for (const file of files) await fs.unlink(assertSafePath(file.storageKey)).catch(() => undefined);
  await prisma.$disconnect();
});

describe('live public events', () => {
  it('round-trips admin fields and exposes safe public detail by slug and ID', async () => {
    const row = await create({ capacity: 0, tags: ['Custom topic', 'Workshop'], speakers: ['First speaker', 'Second speaker'], externalUrl: 'https://example.test/register' });
    await prisma.eventRegistration.createMany({ data: [{ eventId: row.id, name: 'PRIVATE ATTENDEE', email: 'private@example.test' }, { eventId: row.id, status: 'Waitlisted', email: 'waitlisted@example.test' }] });
    const result = await request(app).get(`${base}/${row.slug}`); expect(result.status).toBe(200);
    expect(result.body.data.event).toMatchObject({ id: row.slug, date: '2035-06-10', type: 'Workshop', category: 'Custom topic', seats: 0, attendees: 1, speakers: ['First speaker', 'Second speaker'], timezone: 'Asia/Kolkata', startsAt: '2035-06-09T19:00:00.000Z', externalUrl: 'https://example.test/register', longDescription: full().longDescription });
    expect((await request(app).get(`${base}/${row.id}`)).body.data).toEqual(result.body.data);
    const serialized = JSON.stringify(result.body);
    for (const secret of ['PRIVATE ATTENDEE', 'private@example.test', 'waitlisted@example.test', 'creatorId', 'registrations', 'jobs', 'scheduledPublishAt', 'storageKey']) expect(serialized).not.toContain(secret);
    expect(result.body.data.event).not.toHaveProperty('feedback'); expect(result.body.data.event).not.toHaveProperty('takeaways');
    await admin('patch', `/${row.id}`).send({ title: `${prefix} revised`, speakers: ['Replacement speaker'], capacity: null });
    const changed = (await request(app).get(`${base}/${row.slug}`)).body.data.event;
    expect(changed).toMatchObject({ title: `${prefix} revised`, speakers: ['Replacement speaker'], seats: null });
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it.each([{ status: 'DRAFT' }, { audience: 'CRO Invite' }, { status: 'CANCELLED' }, { deletedAt: new Date() }])('excludes inaccessible records across every public endpoint: %j', async hidden => {
    const row = await create();
    await prisma.event.update({ where: { id: row.id }, data: hidden });
    expect((await request(app).get(`${base}/${row.slug}`)).status).toBe(404);
    expect((await request(app).get(`${base}/${row.slug}/cover`)).status).toBe(404);
    expect((await listing()).body.data.items.some((e: { id: string }) => e.id === row.slug)).toBe(false);
    const uniqueDate = '2035-07-25'; await prisma.event.update({ where: { id: row.id }, data: { date: new Date(`${uniqueDate}T00:00:00Z`) } });
    expect((await request(app).get(`${base}/calendar?month=2035-07`)).body.data.days.some((d: { date: string }) => d.date === uniqueDate)).toBe(false);
  });
  it('allows member-wide events and applies publication, cancellation and deletion immediately', async () => {
    const row = await create({ audience: 'All Members', status: 'DRAFT' });
    expect((await request(app).get(`${base}/${row.slug}`)).status).toBe(404);
    await admin('post', `/${row.id}/publish`); expect((await request(app).get(`${base}/${row.slug}`)).status).toBe(200);
    await admin('post', `/${row.id}/cancel`).send({ reason: 'Unavailable', emailAttendees: false }); expect((await request(app).get(`${base}/${row.slug}`)).status).toBe(404);
    const deleted = await create(); await admin('delete', `/${deleted.id}`); expect((await request(app).get(`${base}/${deleted.slug}`)).status).toBe(404);
  });
  it('keeps scheduled drafts hidden until the existing worker publishes them', async () => {
    const row = await create({ date: '2035-06-12', status: 'DRAFT', scheduledPublishDate: '2035-06-11T12:00' });
    expect((await request(app).get(`${base}/${row.slug}`)).status).toBe(404);
    await processEventJobs(new Date('2035-06-11T07:00:00Z'), row.id);
    expect((await request(app).get(`${base}/${row.slug}`)).status).toBe(200);
  });
  it('moves published events to the archive at the precise UTC end, including legacy local dates', async () => {
    const key = `${prefix} boundary`;
    const row = await create({ title: key });
    expect((await listPublicEvents({ q: key, tab: 'upcoming' }, new Date('2035-06-09T20:59:59Z'))).items.map(e => e.id)).toEqual([row.slug]);
    expect((await listPublicEvents({ q: key, tab: 'past' }, new Date('2035-06-09T21:00:00Z'))).items.map(e => e.id)).toEqual([row.slug]);
    expect((await listPublicEvents({ q: key, tab: 'upcoming' }, new Date('2035-06-09T21:00:00Z'))).pagination.total).toBe(0);
    await prisma.event.update({ where: { id: row.id }, data: { endsAt: null, startsAt: null } });
    expect((await listPublicEvents({ q: key, tab: 'past' }, new Date('2035-06-09T21:00:00Z'))).pagination.total).toBe(1);
    await admin('patch', `/${row.id}`).send({ status: 'PAST' });
    expect((await listing({ q: key, tab: 'past' })).body.data.pagination.total).toBe(1);
  });
  it('returns event-local calendar days independent of list pages, with major markers', async () => {
    const row = await create({ date: '2035-08-31', tags: ['Symposium'] });
    await create({ date: '2035-08-31', featured: false });
    await create({ date: '2035-08-05', featured: true });
    const calendar = (await request(app).get(`${base}/calendar?month=2035-08`)).body.data;
    expect(calendar.days).toEqual([{ date: '2035-08-05', count: 1, major: true }, { date: '2035-08-31', count: 2, major: true }]);
    const list = (await listing({ date: '2035-08-31', limit: 1 })).body.data;
    expect(list.pagination).toMatchObject({ total: 2, pages: 2 });
    await admin('delete', `/${row.id}`);
    expect((await request(app).get(`${base}/calendar?month=2035-08`)).body.data.days[1]).toMatchObject({ count: 1, major: false });
  });
  it('paginates beyond 100 records, filters before counting and clamps deleted final pages', async () => {
    const sample = await create({ title: `${prefix} pagination seed` });
    const source = await prisma.event.findUniqueOrThrow({ where: { id: sample.id } });
    const data = Array.from({ length: 104 }, (_, i) => ({ ...source, id: `${prefix}-page-${i}`, slug: `${prefix}-page-${i}`, title: `${prefix} pagination ${i}` }));
    await prisma.event.createMany({ data }); ids.push(...data.map(e => e.id));
    const pages = [];
    for (const page of [1, 2, 3]) pages.push((await listing({ q: `${prefix} pagination`, tab: 'upcoming', limit: 50, page })).body.data);
    expect(pages.map(p => p.items.length)).toEqual([50, 50, 5]);
    expect(new Set(pages.flatMap(p => p.items.map((e: { id: string }) => e.id))).size).toBe(105);
    const beyond = (await listing({ q: `${prefix} pagination`, limit: 50, page: 99 })).body.data;
    expect(beyond.pagination.page).toBe(3);
    expect((await listing({ q: `${prefix}-missing` })).body.data.pagination).toMatchObject({ total: 0, pages: 1 });
  });
  it.each([{ tab: 'drafts' }, { date: '2035-02-30' }, { page: 0 }, { limit: 101 }, { q: 'x'.repeat(201) }])('validates list query %j', async query => {
    expect((await listing(query)).status).toBe(422);
  });
  it('validates real calendar months', async () => {
    for (const month of ['2035-13', 'bad', '2035-02-01']) expect((await request(app).get(`${base}/calendar`).query({ month })).status).toBe(422);
    expect((await request(app).get(`${base}/calendar?month=2036-02`)).status).toBe(200);
  });
  it('preserves stored resource kinds and titles but only returns safe external URLs', async () => {
    const row = await create({ status: 'PAST', tags: [] });
    await prisma.eventResource.createMany({ data: [
      { eventId: row.id, kind: 'Recording', title: 'Recording', url: 'https://example.test/recording' },
      { eventId: row.id, kind: 'proceedings', title: 'Proceedings', url: 'https://example.test/paper' },
      { eventId: row.id, kind: 'link', title: 'Research brief', url: 'https://example.test/brief' },
      { eventId: row.id, kind: 'pdf', title: 'Private file', fileId: 'private-file-id' },
      ...['javascript:alert(1)', 'data:text/html,unsafe', 'https://user:password@example.test'].map(url => ({ eventId: row.id, kind: 'link', title: 'Unsafe link', url })),
    ] });
    await prisma.event.update({ where: { id: row.id }, data: { externalUrl: 'javascript:alert(1)' } });
    const event = (await request(app).get(`${base}/${row.slug}`)).body.data.event;
    expect(event.type).toBe('Event'); expect(event.category).toBe('Virtual'); expect(event.externalUrl).toBeNull();
    expect(event.resources.filter((r: { url: string | null }) => r.url)).toHaveLength(3);
    expect(event.resources.find((r: { title: string }) => r.title === 'Recording').kind).toBe('recording');
    expect(JSON.stringify(event)).not.toContain('private-file-id'); expect(event).not.toHaveProperty('feedback');
  });
  it('serves only the attached visible-event cover and revokes access after unpublishing', async () => {
    const uploaded = await request(app).post('/api/v1/files/upload').set('Authorization', `Bearer ${token}`).attach('file', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64'), { filename: 'cover.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);
    const file = await prisma.fileObject.findUniqueOrThrow({ where: { id: uploaded.body.data.id } }); files.push(file);
    const row = await create({ coverFileId: file.id }); const url = `${base}/${row.slug}/cover`;
    const cover = await request(app).get(url); expect(cover.status).toBe(200); expect(cover.headers['content-type']).toContain('image/png'); expect(cover.headers['cache-control']).toBe('no-store');
    expect((await request(app).get(`/api/v1/files/${file.id}/download`)).status).toBe(401);
    const detail = (await request(app).get(`${base}/${row.slug}`)).body.data.event; expect(detail.cover.name).toBe('cover.png'); expect(JSON.stringify(detail)).not.toContain(file.storageKey);
    await admin('patch', `/${row.id}`).send({ status: 'DRAFT' }); expect((await request(app).get(url)).status).toBe(404);
    await admin('post', `/${row.id}/publish`);
    await prisma.fileObject.update({ where: { id: file.id }, data: { mimeType: 'text/html' } }); expect((await request(app).get(url)).status).toBe(404);
    await prisma.fileObject.update({ where: { id: file.id }, data: { mimeType: 'image/png', deletedAt: new Date() } }); expect((await request(app).get(url)).status).toBe(404);
    await prisma.fileObject.update({ where: { id: file.id }, data: { deletedAt: null } }); await fs.unlink(assertSafePath(file.storageKey)); expect((await request(app).get(url)).status).toBe(404);
    expect((await request(app).get(`${base}/missing/cover`)).status).toBe(404);
  });
});
