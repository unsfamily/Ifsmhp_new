import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { createApp } from '../app';
import { prisma } from '../config/database';
import { sha256, signAccessToken } from '../utils/security';
import { assertSafePath } from '../utils/fileStorage';
import { HOME_CAROUSEL_LIMIT } from '../services/home-carousel.service';

const app = createApp();
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });
const prefix = 'home-carousel-test';
const base = '/api/v1/admin/home-carousel';
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
  const slides = await prisma.homeCarouselSlide.findMany({ where: { file: { uploaderId: { in: actorIds } } }, include: { file: true } });
  const fillers = await prisma.fileObject.findMany({ where: { storageKey: { startsWith: `${prefix}-` } } });
  const files = [...slides.map(slide => slide.file), ...fillers];
  await prisma.homeCarouselSlide.deleteMany({ where: { OR: [{ file: { uploaderId: { in: actorIds } } }, { file: { storageKey: { startsWith: `${prefix}-` } } }] } });
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

describe('Home carousel photographs', () => {
  it('lets an administrator publish photographs and hides drafts from the public carousel', async () => {
    expect((await request(app).get(base)).status).toBe(401);
    expect((await as('get', base, member.token)).status).toBe(403);
    expect((await upload(Buffer.from('not-an-image'), 'notes.txt', 'text/plain')).status).toBe(422);

    const created = await upload();
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.data.published).toBe(true);
    const id = created.body.data.id as string;

    const image = await request(app).get(`/api/v1/public/home-carousel/${id}/image`);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/jpeg');
    expect(Number(image.headers['content-length'])).toBeGreaterThan(10);

    const listed = await request(app).get('/api/v1/public/home-carousel');
    expect(listed.body.data.items.map((item: { id: string }) => item.id)).toContain(id);

    expect((await as('patch', `${base}/${id}`).send({ altText: 'Laureates on stage', published: false })).body.data).toMatchObject({ altText: 'Laureates on stage', published: false });
    expect((await request(app).get('/api/v1/public/home-carousel')).body.data.items.some((item: { id: string }) => item.id === id)).toBe(false);
    expect((await request(app).get(`/api/v1/public/home-carousel/${id}/image`)).status).toBe(404);
    expect((await as('get', `${base}/${id}/image`)).status).toBe(200);

    const second = await upload();
    expect(second.status).toBe(201);
    const reordered = await as('post', `${base}/${second.body.data.id}/reorder`).send({ direction: -1 });
    expect(reordered.status).toBe(200);
    const ids = reordered.body.data.items.filter((item: { id: string }) => [id, second.body.data.id].includes(item.id)).map((item: { id: string }) => item.id);
    expect(ids[0]).toBe(second.body.data.id);

    expect((await as('delete', `${base}/${id}`)).status).toBe(200);
    expect((await as('get', `${base}/${id}/image`)).status).toBe(404);
  });

  it('stops at the photograph limit', async () => {
    const existing = await prisma.homeCarouselSlide.count();
    for (let index = existing; index < HOME_CAROUSEL_LIMIT; index += 1) {
      const file = await prisma.fileObject.create({
        data: {
          storageKey: `${prefix}-slot-${index}-${Date.now()}`,
          originalName: 'slot.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1,
          visibility: 'PRIVATE',
          carouselManaged: true,
        },
      });
      await prisma.homeCarouselSlide.create({ data: { fileId: file.id, displayOrder: index + 1, altText: '' } });
    }
    const rejected = await upload();
    expect(rejected.status).toBe(422);
    expect(rejected.body.message).toMatch(/12/);
  });
});
