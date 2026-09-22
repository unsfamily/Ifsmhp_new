import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { createApp } from '../app';
import { prisma } from '../config/database';
import { sha256, signAccessToken } from '../utils/security';
import { assertSafePath, uploadRoot } from '../utils/fileStorage';
import { galleryPolicy } from '../services/gallery-upload.service';
import { purgeGalleryFiles } from '../services/gallery.service';
const app = createApp();
const prefix = 'gallery-workflow-test';
const base = '/api/v1/admin/gallery';
let admin: { id: string; token: string }, member: { id: string; token: string };
let png: Buffer, jpeg: Buffer, webp: Buffer;
const actorIds: string[] = [];
const as = (method: 'get' | 'post' | 'patch' | 'delete', path: string, token = admin.token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);
async function actor(role: 'ADMIN' | 'MEMBER') {
  const user = await prisma.user.create({ data: { fullName: role, email: `${prefix}-${role}@example.test`, role, status: 'ACTIVE' } }); actorIds.push(user.id);
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(user.id), expiresAt: new Date(Date.now() + 3600000) } });
  return { id: user.id, token: signAccessToken({ sub: user.id, role, sessionId: session.id }) };
}
async function category(name = 'One') {
  const response = await as('post', `${base}/categories`).send({ name: `${prefix}-${name}`, description: 'Collection', published: true });
  expect(response.status, JSON.stringify(response.body)).toBe(201); return response.body.data;
}
async function upload(id: string, bytes = png, filename = 'photo.png', mime = 'image/png') {
  return as('post', `${base}/photos`).field('categoryId', id).attach('file', bytes, { filename, contentType: mime });
}
async function clean() {
  await prisma.galleryAlbum.deleteMany({ where: { label: { startsWith: prefix } } });
  const files = await prisma.fileObject.findMany({ where: { uploaderId: { in: actorIds } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: files.map(f => f.id) } } });
  await Promise.all(files.map(f => fs.unlink(assertSafePath(f.storageKey)).catch(() => undefined)));
}
beforeAll(async () => {
  admin = await actor('ADMIN'); member = await actor('MEMBER');
  const raw = { create: { width: 12, height: 8, channels: 3 as const, background: '#447799' } };
  png = await sharp(raw).png().toBuffer(); jpeg = await sharp(raw).jpeg().toBuffer(); webp = await sharp(raw).webp().toBuffer();
});
beforeEach(clean);
afterAll(async () => { await clean(); await prisma.auditLog.deleteMany({ where: { actorId: { in: actorIds } } }); await prisma.user.deleteMany({ where: { id: { in: actorIds } } }); await prisma.$disconnect(); });

describe('Gallery workflow with real storage and authentication', () => {
  it('enforces roles and returns the configured 100 MB default policy', async () => {
    expect((await request(app).get(`${base}/categories`)).status).toBe(401);
    expect((await as('get', `${base}/categories`, member.token)).status).toBe(403);
    expect((await as('post', `${base}/categories`, member.token).send({ name: 'Forbidden' })).status).toBe(403);
    expect((await as('get', `${base}/options`)).body.data).toEqual(galleryPolicy);
    expect(galleryPolicy.maxBytes).toBe(100 * 1024 * 1024);
  });
  it('creates, validates, edits and reorders collections', async () => {
    const first = await category(); const second = await category('Two');
    expect((await as('post', `${base}/categories`).send({ name: first.name.toUpperCase() })).status).toBe(409);
    expect((await as('post', `${base}/categories`).send({ name: ' ' })).status).toBe(422);
    expect((await as('patch', `${base}/categories/${first.id}`).send({ displayOrder: -1 })).status).toBe(422);
    expect((await as('patch', `${base}/categories/missing`).send({ published: false })).status).toBe(404);
    expect((await as('patch', `${base}/categories/${first.id}`).send({ description: 'Updated', published: false })).body.data.published).toBe(false);
    await as('post', `${base}/categories/${second.id}/reorder`).send({ direction: -1 });
    const rows = (await as('get', `${base}/categories`)).body.data.items;
    expect(rows.findIndex((c: { id: string }) => c.id === second.id)).toBeLessThan(rows.findIndex((c: { id: string }) => c.id === first.id));
    expect((await request(app).get('/api/v1/public/gallery/categories')).body.data.items.some((c: { id: string }) => c.id === first.id)).toBe(false);
  });
  it('stores valid image formats and metadata, with real authenticated previews', async () => {
    const c = await category();
    for (const [bytes, name, mime] of [[png, 'photo.png', 'image/png'], [jpeg, 'photo.jpg', 'image/jpeg'], [webp, 'photo.webp', 'image/webp']] as const) {
      const result = await upload(c.id, bytes, name, mime); expect(result.status, JSON.stringify(result.body)).toBe(201);
      const p = result.body.data; expect(p).toMatchObject({ categoryId: c.id, width: 12, height: 8, aspect: 'landscape', fileSizeBytes: bytes.length, published: false });
      const stored = await prisma.galleryItem.findUniqueOrThrow({ where: { id: p.id }, include: { file: true } });
      expect(stored.file!.checksum).toHaveLength(64); expect(stored.file!.uploaderId).toBe(admin.id);
      expect(await fs.readFile(assertSafePath(stored.file!.storageKey))).toEqual(bytes);
      const preview = await as('get', `/api/v1${p.imageUrl}`); expect(preview.status).toBe(200); expect(preview.headers['content-type']).toBe(mime);
      expect((await as('get', `/api/v1${p.imageUrl}`, member.token)).status).toBe(403);
    }
  });
  it('revokes public and generic file access on photo and collection unpublish and deletion', async () => {
    const c = await category(); const p = (await upload(c.id)).body.data;
    const row = await prisma.galleryItem.findUniqueOrThrow({ where: { id: p.id } });
    const image = `/api/v1/public/gallery/photos/${p.id}/image`; const generic = `/api/v1/files/${row.fileId}/download`;
    expect((await request(app).get(image)).status).toBe(404);
    expect((await as('get', generic, member.token)).status).toBe(404);
    await as('patch', `${base}/photos/${p.id}`).send({ published: true });
    expect((await request(app).get(image)).status).toBe(200);
    expect((await as('get', generic, member.token)).status).toBe(200);
    await as('patch', `${base}/categories/${c.id}`).send({ published: false });
    expect((await request(app).get(image)).status).toBe(404);
    expect((await as('get', generic, member.token)).status).toBe(404);
    expect((await request(app).get('/api/v1/public/gallery/photos')).body.data.items.some((i: { id: string }) => i.id === p.id)).toBe(false);
    const legacy = (await request(app).get('/api/v1/public/gallery')).body.data;
    expect(legacy.items.some((i: { id: string }) => i.id === p.id)).toBe(false);
    expect(legacy.albums.some((i: { label: string }) => i.label === c.name)).toBe(false);
    await as('patch', `${base}/categories/${c.id}`).send({ published: true });
    await as('patch', `${base}/photos/${p.id}`).send({ published: false });
    expect((await request(app).get(image)).status).toBe(404);
    await as('delete', `${base}/photos/${p.id}`);
    expect((await as('get', generic)).status).toBe(404);
  });
  it('edits and moves photos atomically, searches fields, and maintains order', async () => {
    const a = await category(); const b = await category('Two');
    const one = (await upload(a.id)).body.data; const two = (await upload(a.id)).body.data;
    await as('post', `${base}/photos/${two.id}/reorder`).send({ direction: -1 });
    expect((await as('get', `${base}/photos?categoryId=${a.id}`)).body.data.items[0].id).toBe(two.id);
    const updated = await as('patch', `${base}/photos/${one.id}`).send({ title: 'Updated title', caption: 'Research meeting', altText: 'Blue rectangle', categoryId: b.id, published: true, displayOrder: 1 });
    expect(updated.status).toBe(200); expect(updated.body.data.categoryId).toBe(b.id);
    for (const search of ['Updated', 'Research', 'Blue']) expect((await as('get', `${base}/photos?categoryId=${b.id}&search=${search}`)).body.data.items[0].id).toBe(one.id);
    expect((await as('get', `${base}/photos?categoryId=${a.id}&search=Updated`)).body.data.items).toHaveLength(0);
    expect((await as('patch', `${base}/photos/${one.id}`).send({ categoryId: 'missing', title: 'Must not save' })).status).toBe(404);
    expect((await prisma.galleryItem.findUniqueOrThrow({ where: { id: one.id } })).title).toBe('Updated title');
    await as('delete', `${base}/photos/${two.id}`);
    expect((await as('get', `${base}/categories`)).body.data.items.find((c: { id: string }) => c.id === a.id).photoCount).toBe(0);
  });
  it('rejects invalid images and metadata without leaving files or records', async () => {
    const c = await category(); const before = await fs.readdir(uploadRoot);
    for (const [bytes, name, mime] of [[Buffer.alloc(0), 'empty.png', 'image/png'], [Buffer.from('not an image'), 'fake.png', 'image/png'], [png, 'fake.jpg', 'image/jpeg'], [png.subarray(0, 40), 'broken.png', 'image/png'], [png, 'file.svg', 'image/svg+xml']] as const) expect((await upload(c.id, bytes, name, mime)).status).toBe(422);
    expect((await upload('missing')).status).toBe(404);
    expect(await fs.readdir(uploadRoot)).toEqual(before);
    expect(await prisma.galleryItem.count({ where: { albumId: c.id } })).toBe(0);
    expect((await as('get', `${base}/photos?limit=101`)).status).toBe(422);
    expect((await as('get', `${base}/photos?page=0`)).status).toBe(422);
  });
  it('enforces upload size and allows the next valid request', async () => {
    const c = await category(); const before = await fs.readdir(uploadRoot);
    const result = await upload(c.id, Buffer.alloc(galleryPolicy.maxBytes + 1)); expect(result.status).toBe(422);
    expect(await fs.readdir(uploadRoot)).toEqual(before);
    expect((await upload(c.id)).status).toBe(201);
  }, 30000);
  it('paginates beyond 100 records without losing order or counts', async () => {
    const c = await category(); const p = (await upload(c.id)).body.data;
    const row = await prisma.galleryItem.findUniqueOrThrow({ where: { id: p.id } });
    const { id: _id, ...fields } = row; void _id;
    await prisma.galleryItem.createMany({ data: Array.from({ length: 104 }, (_, n) => ({ ...fields, title: `Photo ${n}`, displayOrder: n + 2 })) });
    const first = (await as('get', `${base}/photos?categoryId=${c.id}&limit=100`)).body.data;
    const second = (await as('get', `${base}/photos?categoryId=${c.id}&limit=100&page=2`)).body.data;
    expect(first.pagination.total).toBe(105); expect(first.items).toHaveLength(100); expect(second.items).toHaveLength(5);
    expect(new Set([...first.items, ...second.items].map(i => i.id)).size).toBe(105);
  });
  it('cascades collection deletion, purges bytes and audits mutations', async () => {
    const c = await category(); const p = (await upload(c.id)).body.data;
    const row = await prisma.galleryItem.findUniqueOrThrow({ where: { id: p.id }, include: { file: true } });
    expect((await as('delete', `${base}/categories/${c.id}`)).status).toBe(200);
    expect(await prisma.galleryItem.findUnique({ where: { id: p.id } })).toBeNull();
    const file = await prisma.fileObject.findUniqueOrThrow({ where: { id: row.fileId! } }); expect(file.deletedAt).not.toBeNull(); expect(file.purgedAt).not.toBeNull();
    await expect(fs.access(assertSafePath(file.storageKey))).rejects.toThrow();
    expect(await prisma.auditLog.count({ where: { actorId: admin.id, action: 'GalleryCollectionDeleted' } })).toBeGreaterThan(0);
  });
  it('retains shared legacy files and retries failed physical cleanup', async () => {
    const a = await category(); const b = await category('Two'); const p = (await upload(a.id)).body.data;
    const row = await prisma.galleryItem.findUniqueOrThrow({ where: { id: p.id } }); const { id: _id, ...fields } = row; void _id;
    const shared = await prisma.galleryItem.create({ data: { ...fields, albumId: b.id } });
    await as('delete', `${base}/categories/${a.id}`);
    expect((await prisma.fileObject.findUniqueOrThrow({ where: { id: row.fileId! } })).deletedAt).toBeNull();
    const unlink = vi.spyOn(fs, 'unlink').mockRejectedValueOnce(new Error('Temporarily unavailable'));
    expect((await as('delete', `${base}/photos/${shared.id}`)).status).toBe(200); unlink.mockRestore();
    expect((await prisma.fileObject.findUniqueOrThrow({ where: { id: row.fileId! } })).purgedAt).toBeNull();
    await purgeGalleryFiles();
    expect((await prisma.fileObject.findUniqueOrThrow({ where: { id: row.fileId! } })).purgedAt).not.toBeNull();
  });
  it('rolls back a failed database transaction and cleans its upload', async () => {
    const c = await category(); const before = await fs.readdir(uploadRoot);
    const original = prisma.$transaction.bind(prisma);
    const transaction = vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (operation, options) => original(async db => {
      await (operation as (db: Prisma.TransactionClient) => Promise<unknown>)(db);
      throw new Error('Simulated failure after database writes');
    }, options));
    const result = await upload(c.id); transaction.mockRestore();
    expect(result.status).toBe(500); expect(await fs.readdir(uploadRoot)).toEqual(before);
    expect(await prisma.fileObject.count({ where: { uploaderId: admin.id } })).toBe(0);
    expect(await prisma.galleryItem.count({ where: { albumId: c.id } })).toBe(0);
  });
  it('handles concurrent collection creation and photo ordering consistently', async () => {
    const name = `${prefix}-Concurrent`;
    const result = await Promise.all([as('post', `${base}/categories`).send({ name }), as('post', `${base}/categories`).send({ name })]);
    expect(result.map(r => r.status).sort()).toEqual([201, 409]);
    const c = result.find(r => r.status === 201)!.body.data;
    const uploads = await Promise.all([upload(c.id), upload(c.id), upload(c.id)]); expect(uploads.map(r => r.status)).toEqual([201, 201, 201]);
    const rows = (await as('get', `${base}/photos?categoryId=${c.id}`)).body.data.items;
    expect(rows.map((p: { displayOrder: number }) => p.displayOrder)).toEqual([1, 2, 3]);
  });
});
