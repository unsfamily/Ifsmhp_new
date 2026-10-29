import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { createApp } from '../app';
import { prisma } from '../config/database';
import { sha256, signAccessToken } from '../utils/security';
import { assertSafePath } from '../utils/fileStorage';

const app = createApp();
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });
const prefix = 'award-event-media-test';
const base = '/api/v1/admin/award-event-media';
const actorIds: string[] = [];
let admin: { id: string; token: string };
let member: { id: string; token: string };
let jpeg: Buffer;

const as = (method: 'get' | 'post' | 'patch' | 'delete', path: string, token = admin.token) =>
  request(app)[method](path).set('Authorization', `Bearer ${token}`);

async function actor(role: 'ADMIN' | 'MEMBER') {
  const user = await prisma.user.create({ data: { fullName: role, email: `${prefix}-${role}@example.test`, role, status: 'ACTIVE' } });
  actorIds.push(user.id);
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(user.id), expiresAt: new Date(Date.now() + 3600000) } });
  return { id: user.id, token: signAccessToken({ sub: user.id, role, sessionId: session.id }) };
}

async function upload(bytes = jpeg, filename = 'conclave.jpg', mime = 'image/jpeg') {
  return as('post', base).attach('file', bytes, { filename, contentType: mime });
}

async function clean() {
  const items = await prisma.awardEventMedia.findMany({ where: { file: { uploaderId: { in: actorIds } } }, include: { file: true } });
  const fillers = await prisma.fileObject.findMany({ where: { storageKey: { startsWith: `${prefix}-` } } });
  const files = [...items.map(item => item.file), ...fillers];
  await prisma.awardEventMedia.deleteMany({ where: { OR: [{ file: { uploaderId: { in: actorIds } } }, { file: { storageKey: { startsWith: `${prefix}-` } } }] } });
  await prisma.fileObject.deleteMany({ where: { id: { in: files.map(file => file.id) } } });
  await Promise.all(files.map(file => fs.unlink(assertSafePath(file.storageKey)).catch(() => undefined)));
}

beforeAll(async () => {
  admin = await actor('ADMIN');
  member = await actor('MEMBER');
  jpeg = await sharp({ create: { width: 16, height: 9, channels: 3, background: '#123456' } }).jpeg().toBuffer();
});
beforeEach(clean);
afterAll(async () => {
  await clean();
  await prisma.auditLog.deleteMany({ where: { actorId: { in: actorIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: actorIds } } });
  await prisma.user.deleteMany({ where: { id: { in: actorIds } } });
  await prisma.$disconnect();
});

describe('Award event media', () => {
  it('lets an administrator upload photographs without a fixed limit and hide drafts from the public gallery', async () => {
    expect((await request(app).get(base)).status).toBe(401);
    expect((await as('get', base, member.token)).status).toBe(403);
    expect((await upload(Buffer.from('not-an-image'), 'notes.txt', 'text/plain')).status).toBe(422);

    const created = await upload();
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.data).toMatchObject({ mediaType: 'image', published: true });
    const id = created.body.data.id as string;

    const media = await request(app).get(`/api/v1/public/award-event-media/${id}/media`);
    expect(media.status).toBe(200);
    expect(media.headers['content-type']).toBe('image/jpeg');
    expect(Number(media.headers['content-length'])).toBeGreaterThan(10);

    const listed = await request(app).get('/api/v1/public/award-event-media');
    expect(listed.body.data.items.map((item: { id: string }) => item.id)).toContain(id);

    expect((await as('patch', `${base}/${id}`).send({ published: false })).body.data.published).toBe(false);
    expect((await request(app).get('/api/v1/public/award-event-media')).body.data.items.some((item: { id: string }) => item.id === id)).toBe(false);
    expect((await request(app).get(`/api/v1/public/award-event-media/${id}/media`)).status).toBe(404);
    expect((await as('get', `${base}/${id}/media`)).status).toBe(200);

    const second = await upload();
    expect(second.status).toBe(201);
    const secondId = second.body.data.id as string;
    const reordered = (await as('post', `${base}/${secondId}/reorder`).send({ direction: -1 })).body.data.items.map((item: { id: string }) => item.id) as string[];
    expect(reordered.indexOf(secondId)).toBeGreaterThanOrEqual(0);
    expect(reordered.indexOf(id)).toBeGreaterThan(reordered.indexOf(secondId));

    expect((await as('delete', `${base}/${id}`)).body.data.removed).toBe(true);
    const remaining = (await as('get', `${base}?type=image`)).body.data.items.map((item: { id: string }) => item.id) as string[];
    expect(remaining).not.toContain(id);
    expect(remaining).toContain(secondId);
  });

  it('accepts Windows-style JPEG MIME aliases and .jfif photographs', async () => {
    const aliased = await as('post', base).attach('file', jpeg, { filename: 'phone.jpg', contentType: 'image/jpg' });
    expect(aliased.status, JSON.stringify(aliased.body)).toBe(201);
    expect(aliased.body.data.mediaType).toBe('image');

    const jfif = await as('post', base).attach('file', jpeg, { filename: 'camera.jfif', contentType: 'application/octet-stream' });
    expect(jfif.status, JSON.stringify(jfif.body)).toBe(201);
    expect(jfif.body.data.mediaType).toBe('image');
  });
});
