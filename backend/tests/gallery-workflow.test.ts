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
async function subcategory(categoryId: string, name = 'Workshops') {
  const response = await as('post', `${base}/subcategories`).send({ categoryId, name });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.data;
}
async function uploadAssigned(categoryId: string, subcategoryId: string) {
  return as('post', `${base}/photos`).field('categoryId', categoryId).field('subcategoryId', subcategoryId).attach('file', png, { filename: 'assigned.png', contentType: 'image/png' });
}
async function clean() {
  await prisma.galleryItem.deleteMany({ where: { album: { label: { startsWith: prefix } } } });
  await prisma.gallerySubcategory.deleteMany({ where: { category: { label: { startsWith: prefix } } } });
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

describe('Bulk media status', () => {
  const endpoint = `${base}/photos/status`;
  const update = (photoIds: string[], published: boolean) => as('patch', endpoint).send({ photoIds, published });
  it('validates the contract and requires an administrator', async () => {
    const c = await category(), p = (await upload(c.id)).body.data;
    const body = { photoIds: [p.id], published: true };
    expect((await request(app).patch(endpoint).send(body)).status).toBe(401);
    expect((await as('patch', endpoint, member.token).send(body)).status).toBe(403);
    for (const invalid of [{}, { ...body, photoIds: [] }, { ...body, photoIds: [' '] }, { ...body, photoIds: [123] }, { photoIds: [p.id] }, { ...body, published: 'true' }, { ...body, title: 'Unexpected' }]) {
      expect((await as('patch', endpoint).send(invalid)).status).toBe(422);
    }
    expect((await prisma.galleryItem.findUniqueOrThrow({ where: { id: p.id } })).visibility).toBe('PRIVATE');
    expect((await as('patch', `${base}/categories/visibility`).send({ categoryIds: [c.id], published: false })).status).toBe(422);
    expect((await prisma.galleryAlbum.findUniqueOrThrow({ where: { id: c.id } })).visibility).toBe('PUBLIC');
  });
  it('publishes images and videos, persists both directions, audits changes, and preserves collections and metadata', async () => {
    const a = await category('Bulk A'), b = await category('Hidden parent');
    await as('patch', `${base}/categories/${b.id}`).send({ published: false });
    const sub = await subcategory(a.id);
    const image = (await uploadAssigned(a.id, sub.id)).body.data;
    const bytes = await fs.readFile(new URL('./fixtures/gallery/sample.mp4', import.meta.url));
    const videoResponse = await upload(b.id, bytes, 'video.mp4', 'video/mp4');
    expect(videoResponse.status).toBe(201);
    const video = videoResponse.body.data, untouched = (await upload(a.id)).body.data;
    const ids = [image.id, video.id];
    const before = await prisma.galleryItem.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
    const collections = await prisma.galleryAlbum.findMany({ where: { id: { in: [a.id, b.id] } }, orderBy: { id: 'asc' } });
    const show = await update([...ids, image.id], true);
    expect(show.status).toBe(200); expect(show.body.data.updatedCount).toBe(2);
    expect(show.body.data.items).toHaveLength(2);
    expect(show.body.data.items.every((p: { published: boolean }) => p.published)).toBe(true);
    const list = (await as('get', `${base}/photos`)).body.data.items;
    expect(list.filter((p: { id: string }) => ids.includes(p.id)).every((p: { published: boolean }) => p.published)).toBe(true);
    expect((await prisma.galleryItem.findUniqueOrThrow({ where: { id: untouched.id } })).visibility).toBe('PRIVATE');
    expect((await request(app).get(`/api/v1/public/gallery/photos/${image.id}/media`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/public/gallery/photos/${video.id}/media`)).status).toBe(404);
    const auditWhere = { actorId: admin.id, action: 'GalleryPhotoUpdated', entityId: { in: ids } };
    const audits = await prisma.auditLog.findMany({ where: auditWhere });
    expect(audits).toHaveLength(2);
    for (const audit of audits) expect(audit.changes).toEqual({ visibility: { before: 'PRIVATE', after: 'PUBLIC' } });
    const saved = await prisma.galleryItem.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
    expect((await update(ids, true)).body.data.updatedCount).toBe(0);
    expect(await prisma.galleryItem.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } })).toEqual(saved);
    expect(await prisma.auditLog.count({ where: auditWhere })).toBe(2);
    const hide = await update(ids, false);
    expect(hide.status).toBe(200); expect(hide.body.data.updatedCount).toBe(2);
    const after = await prisma.galleryItem.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
    expect(after.map(({ updatedAt: _updatedAt, ...row }) => row)).toEqual(before.map(({ updatedAt: _updatedAt, ...row }) => row));
    expect(await prisma.galleryAlbum.findMany({ where: { id: { in: [a.id, b.id] } }, orderBy: { id: 'asc' } })).toEqual(collections);
    expect((await request(app).get(`/api/v1/public/gallery/photos/${image.id}/media`)).status).toBe(404);
    await as('patch', `${base}/photos/${image.id}`).send({ published: true });
    const mixed = (await as('get', `${base}/photos`)).body.data.items;
    expect(mixed.find((p: { id: string }) => p.id === image.id).published).toBe(true);
    expect(mixed.find((p: { id: string }) => p.id === video.id).published).toBe(false);
  });
  it('rejects missing IDs without partial writes', async () => {
    const c = await category(), p = (await upload(c.id)).body.data;
    expect((await update([p.id, 'missing'], true)).status).toBe(404);
    expect((await prisma.galleryItem.findUniqueOrThrow({ where: { id: p.id } })).visibility).toBe('PRIVATE');
    expect(await prisma.auditLog.count({ where: { actorId: admin.id, action: 'GalleryPhotoUpdated', entityId: p.id } })).toBe(0);
  });
  it('rolls back status and audits when the transaction fails', async () => {
    const c = await category(), a = (await upload(c.id)).body.data, b = (await upload(c.id)).body.data;
    const original = prisma.$transaction.bind(prisma);
    const transaction = vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (operation, options) => original(async db => {
      await (operation as (db: Prisma.TransactionClient) => Promise<unknown>)(db);
      throw new Error('Simulated bulk status failure after writes');
    }, options));
    try { expect((await update([a.id, b.id], true)).status).toBe(500); }
    finally { transaction.mockRestore(); }
    expect(await prisma.galleryItem.count({ where: { id: { in: [a.id, b.id] }, visibility: 'PRIVATE' } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { actorId: admin.id, action: 'GalleryPhotoUpdated', entityId: { in: [a.id, b.id] } } })).toBe(0);
  });
  it('updates only the supplied filtered media across API page boundaries', async () => {
    const c = await category(), template = (await upload(c.id)).body.data;
    const { id: _id, ...fields } = await prisma.galleryItem.findUniqueOrThrow({ where: { id: template.id } }); void _id;
    const ids = Array.from({ length: 105 }, (_, index) => `${prefix}-bulk-${index}`);
    await prisma.galleryItem.createMany({ data: ids.map((id, index) => ({ ...fields, id, title: `Filtered ${index}`, displayOrder: index + 2 })) });
    const response = await update(ids, true);
    expect(response.status).toBe(200); expect(response.body.data.updatedCount).toBe(105); expect(response.body.data.items).toHaveLength(105);
    for (const page of [1, 2]) {
      const list = (await as('get', `${base}/photos?categoryId=${c.id}&search=Filtered&limit=100&page=${page}`)).body.data.items;
      expect(list).toHaveLength(page === 1 ? 100 : 5);
      expect(list.every((p: { published: boolean }) => p.published)).toBe(true);
    }
    expect((await prisma.galleryItem.findUniqueOrThrow({ where: { id: template.id } })).visibility).toBe('PRIVATE');
  });
});

describe('Gallery subcategory relationships', () => {
  it('requires admin access, validates names and parents, and preserves mappings when renamed', async () => {
    const a = await category(), b = await category('Two');
    expect((await request(app).get(`${base}/subcategories`)).status).toBe(401);
    for (const method of ['get', 'post', 'patch', 'delete'] as const) {
      const url = `${base}/subcategories${['patch', 'delete'].includes(method) ? '/missing' : ''}`;
      expect((await as(method, url, member.token).send({ name: 'No', categoryId: a.id })).status).toBe(403);
    }
    for (const body of [{ name: ' ' , categoryId: a.id }, { name: 'Name' }, { categoryId: a.id }, { name: 'Name', categoryId: '' }, { name: 'x'.repeat(192), categoryId: a.id }]) {
      expect((await as('post', `${base}/subcategories`).send(body)).status).toBe(422);
    }
    expect((await as('post', `${base}/subcategories`).send({ name: 'Name', categoryId: 'missing' })).status).toBe(404);
    const sub = await subcategory(a.id, ' Workshops ');
    expect(sub.name).toBe('Workshops');
    expect((await as('post', `${base}/subcategories`).send({ name: ' workshops ', categoryId: a.id })).status).toBe(409);
    await subcategory(b.id, 'Workshops');
    const p = (await uploadAssigned(a.id, sub.id)).body.data;
    expect((await as('patch', `${base}/categories/${a.id}`).send({ name: `${prefix}-Renamed` })).status).toBe(200);
    expect((await as('patch', `${base}/subcategories/${sub.id}`).send({ name: 'Seminars' })).body.data).toMatchObject({ id: sub.id, categoryId: a.id, photoCount: 1 });
    expect(await prisma.galleryItem.findUnique({ where: { id: p.id } })).toMatchObject({ albumId: a.id, subcategoryId: sub.id });
    const conflict = await subcategory(a.id, 'Conflicting');
    expect((await as('patch', `${base}/subcategories/${conflict.id}`).send({ name: 'seminars' })).status).toBe(409);
    expect((await as('patch', `${base}/subcategories/${sub.id}`).send({ categoryId: 'missing' })).status).toBe(404);
    expect((await as('patch', `${base}/subcategories/missing`).send({ name: 'Name' })).status).toBe(404);
    expect((await as('delete', `${base}/subcategories/missing`)).status).toBe(404);
    expect(await prisma.auditLog.count({ where: { entityId: sub.id, action: 'GallerySubcategoryUpdated' } })).toBe(1);
  });

  it('keeps assignment optional, validates category pairs, and clears or retains assignments correctly', async () => {
    const a = await category(), b = await category('Two');
    const sub = await subcategory(a.id), other = await subcategory(b.id);
    const p = (await upload(a.id)).body.data;
    expect(p.subcategoryId).toBeNull();
    expect((await as('patch', `${base}/photos/${p.id}`).send({ subcategoryId: sub.id })).body.data.subcategoryId).toBe(sub.id);
    expect((await as('patch', `${base}/photos/${p.id}`).send({ title: 'Kept' })).body.data.subcategoryId).toBe(sub.id);
    expect((await as('patch', `${base}/photos/${p.id}`).send({ subcategoryId: other.id, title: 'Must roll back' })).status).toBe(422);
    expect((await as('patch', `${base}/photos/${p.id}`).send({ subcategoryId: 'missing' })).status).toBe(404);
    expect((await as('patch', `${base}/photos/${p.id}`).send({ subcategoryId: null })).body.data.subcategoryId).toBeNull();
    await as('patch', `${base}/photos/${p.id}`).send({ subcategoryId: sub.id });
    expect((await as('patch', `${base}/photos/${p.id}`).send({ categoryId: b.id })).body.data).toMatchObject({ categoryId: b.id, subcategoryId: null, title: 'Kept' });
    expect((await as('patch', `${base}/photos/${p.id}`).send({ categoryId: a.id, subcategoryId: sub.id })).body.data.subcategoryId).toBe(sub.id);
    expect((await as('get', `${base}/photos?categoryId=${a.id}&subcategoryId=${sub.id}`)).body.data.items.map((r: { id: string }) => r.id)).toEqual([p.id]);
    expect((await as('get', `${base}/photos?subcategoryId=none`)).body.data.items).toHaveLength(0);
    const before = await fs.readdir(uploadRoot);
    expect((await uploadAssigned(b.id, sub.id)).status).toBe(422);
    expect((await uploadAssigned(a.id, 'missing')).status).toBe(404);
    expect(await fs.readdir(uploadRoot)).toEqual(before);
    expect(await prisma.galleryItem.count({ where: { albumId: { in: [a.id, b.id] } } })).toBe(1);
  });

  it('moves assigned photos in order, inherits visibility, and preserves all other photo fields', async () => {
    const a = await category(), b = await category('Two');
    const sub = await subcategory(a.id);
    const first = (await uploadAssigned(a.id, sub.id)).body.data;
    const left = (await upload(a.id)).body.data;
    const second = (await uploadAssigned(a.id, sub.id)).body.data;
    const existing = (await upload(b.id)).body.data;
    await as('patch', `${base}/photos/${first.id}`).send({ published: true });
    await as('patch', `${base}/categories/${b.id}`).send({ published: false });
    const before = await prisma.galleryItem.findUniqueOrThrow({ where: { id: first.id } });
    expect((await as('patch', `${base}/subcategories/${sub.id}`).send({ categoryId: b.id })).status).toBe(200);
    const rows = (await as('get', `${base}/photos?categoryId=${b.id}`)).body.data.items;
    expect(rows.map((p: { id: string }) => p.id)).toEqual([existing.id, first.id, second.id]);
    expect(rows.map((p: { displayOrder: number }) => p.displayOrder)).toEqual([1, 2, 3]);
    expect(await prisma.galleryItem.findUnique({ where: { id: left.id } })).toMatchObject({ albumId: a.id, displayOrder: 1 });
    const after = await prisma.galleryItem.findUniqueOrThrow({ where: { id: first.id } });
    expect(after).toEqual({ ...before, albumId: b.id, displayOrder: 2, updatedAt: after.updatedAt });
    const cats = (await as('get', `${base}/categories`)).body.data.items;
    expect(cats.find((c: { id: string }) => c.id === a.id).photoCount).toBe(1);
    expect(cats.find((c: { id: string }) => c.id === b.id).photoCount).toBe(3);
    expect((await request(app).get(`/api/v1/public/gallery/photos/${first.id}/image`)).status).toBe(404);
    expect((await as('get', `/api/v1/files/${after.fileId}/download`, member.token)).status).toBe(404);
    await as('patch', `${base}/categories/${b.id}`).send({ published: true });
    expect((await request(app).get(`/api/v1/public/gallery/photos/${first.id}/image`)).status).toBe(200);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: sub.id, action: 'GallerySubcategoryUpdated' } });
    expect(audit.changes).toMatchObject({ categoryId: { before: a.id, after: b.id } });
  });

  it('rejects destination duplicates and rolls back parent and photos when the transaction fails', async () => {
    const a = await category(), b = await category('Two');
    const sub = await subcategory(a.id), conflict = await subcategory(b.id);
    const p = (await uploadAssigned(a.id, sub.id)).body.data;
    expect((await as('patch', `${base}/subcategories/${sub.id}`).send({ categoryId: b.id })).status).toBe(409);
    await as('delete', `${base}/subcategories/${conflict.id}`);
    const original = prisma.$transaction.bind(prisma);
    const transaction = vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (operation, options) => original(async db => {
      await (operation as (db: Prisma.TransactionClient) => Promise<unknown>)(db);
      throw new Error('Injected failure after subcategory move');
    }, options));
    const response = await as('patch', `${base}/subcategories/${sub.id}`).send({ categoryId: b.id }); transaction.mockRestore();
    expect(response.status).toBe(500);
    expect(await prisma.gallerySubcategory.findUnique({ where: { id: sub.id } })).toMatchObject({ categoryId: a.id });
    expect(await prisma.galleryItem.findUnique({ where: { id: p.id } })).toMatchObject({ albumId: a.id, subcategoryId: sub.id, displayOrder: 1 });
    expect(await prisma.auditLog.count({ where: { entityId: sub.id, action: 'GallerySubcategoryUpdated' } })).toBe(0);
  });

  it('blocks unsafe deletion in the API and database and permits explicit dependency removal', async () => {
    const c = await category(), sub = await subcategory(c.id);
    expect((await as('delete', `${base}/categories/${c.id}`)).status).toBe(409);
    await expect(prisma.galleryAlbum.delete({ where: { id: c.id } })).rejects.toMatchObject({ code: 'P2003' });
    const p = (await uploadAssigned(c.id, sub.id)).body.data;
    expect((await as('delete', `${base}/subcategories/${sub.id}`)).status).toBe(409);
    await expect(prisma.gallerySubcategory.delete({ where: { id: sub.id } })).rejects.toMatchObject({ code: 'P2003' });
    await as('patch', `${base}/photos/${p.id}`).send({ subcategoryId: null });
    expect((await as('delete', `${base}/subcategories/${sub.id}`)).status).toBe(200);
    expect(await prisma.galleryItem.findUnique({ where: { id: p.id } })).not.toBeNull();
    expect((await as('delete', `${base}/categories/${c.id}`)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { entityId: sub.id, action: 'GallerySubcategoryDeleted' } })).toBe(1);
  });

  it('serializes parent deletion against creation and rejects assignments captured before a parent move', async () => {
    const a = await category(), b = await category('Two');
    const race = await Promise.all([
      as('post', `${base}/subcategories`).send({ name: 'Race', categoryId: a.id }),
      as('delete', `${base}/categories/${a.id}`),
    ]);
    expect([[201, 409], [404, 200]]).toContainEqual(race.map(r => r.status));
    const sub = await subcategory(b.id);
    const destination = await category('Destination');
    await as('patch', `${base}/subcategories/${sub.id}`).send({ categoryId: destination.id });
    const before = await fs.readdir(uploadRoot);
    expect((await uploadAssigned(b.id, sub.id)).status).toBe(422);
    expect(await fs.readdir(uploadRoot)).toEqual(before);
    expect((await uploadAssigned(destination.id, sub.id)).status).toBe(201);
  });

  it('paginates subcategories and handles concurrent duplicates and assignment/deletion safely', async () => {
    const a = await category(), b = await category('Two');
    const results = await Promise.all([as('post', `${base}/subcategories`).send({ categoryId: a.id, name: 'Concurrent' }), as('post', `${base}/subcategories`).send({ categoryId: a.id, name: 'concurrent' })]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const sub = results.find(r => r.status === 201)!.body.data;
    const races = await Promise.all([uploadAssigned(a.id, sub.id), as('delete', `${base}/subcategories/${sub.id}`)]);
    expect([[201, 409], [404, 200]]).toContainEqual(races.map(r => r.status));
    await prisma.gallerySubcategory.createMany({ data: Array.from({ length: 105 }, (_, n) => ({ categoryId: b.id, name: `Subcategory ${String(n).padStart(3, '0')}` })) });
    const first = (await as('get', `${base}/subcategories?categoryId=${b.id}&limit=100`)).body.data;
    const second = (await as('get', `${base}/subcategories?categoryId=${b.id}&limit=100&page=2`)).body.data;
    expect(first.pagination.total).toBe(105); expect(first.items).toHaveLength(100); expect(second.items).toHaveLength(5);
    expect(new Set([...first.items, ...second.items].map(r => r.id)).size).toBe(105);
    expect(first.items[0].name).toBe('Subcategory 000');
    expect((await as('get', `${base}/subcategories?limit=101`)).status).toBe(422);
  });
});

describe('Public and member gallery hierarchy', () => {
  it('exposes published parents and empty subcategories with visible-only photo counts', async () => {
    const visible = await category('Visible'), hidden = await category('Hidden');
    await as('patch', `${base}/categories/${hidden.id}`).send({ published: false });
    const empty = await subcategory(visible.id, 'Empty');
    const sub = await subcategory(visible.id, 'Conferences');
    const hiddenSub = await subcategory(hidden.id, 'Private conferences');
    const published = (await uploadAssigned(visible.id, sub.id)).body.data;
    const draft = (await uploadAssigned(visible.id, sub.id)).body.data;
    await as('patch', `${base}/photos/${published.id}`).send({ published: true });
    const hiddenPhoto = (await uploadAssigned(hidden.id, hiddenSub.id)).body.data;
    await as('patch', `${base}/photos/${hiddenPhoto.id}`).send({ published: true });
    const list = '/api/v1/public/gallery/subcategories';
    const response = await request(app).get(list);
    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: empty.id, categoryId: visible.id, photoCount: 0 }),
      expect.objectContaining({ id: sub.id, categoryId: visible.id, photoCount: 1 }),
    ]));
    expect(response.body.data.items.some((s: { id: string }) => s.id === hiddenSub.id)).toBe(false);
    expect((await request(app).get(`${list}?categoryId=${hidden.id}`)).body.data.items).toEqual([]);
    expect((await as('get', list, member.token)).body.data).toEqual(response.body.data);
    expect((await as('get', `${base}/subcategories?categoryId=${visible.id}`)).body.data.items.find((s: { id: string }) => s.id === sub.id).photoCount).toBe(2);
    const photos = (await request(app).get(`/api/v1/public/gallery/photos?subcategoryId=${sub.id}`)).body.data.items;
    expect(photos.map((p: { id: string }) => p.id)).toEqual([published.id]);
    expect(photos.some((p: { id: string }) => p.id === draft.id)).toBe(false);
    expect((await request(app).get(`/api/v1/public/gallery/photos?subcategoryId=${hiddenSub.id}`)).body.data.items).toEqual([]);
    expect((await request(app).post(list).send({ categoryId: visible.id, name: 'Forbidden' })).status).toBe(404);

    await as('patch', `${base}/subcategories/${sub.id}`).send({ categoryId: hidden.id });
    expect((await request(app).get(list)).body.data.items.some((s: { id: string }) => s.id === sub.id)).toBe(false);
    expect((await request(app).get(`/api/v1/public/gallery/photos/${published.id}/image`)).status).toBe(404);
    await as('patch', `${base}/categories/${hidden.id}`).send({ published: true });
    expect((await request(app).get(`${list}?categoryId=${hidden.id}`)).body.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: sub.id, categoryId: hidden.id, photoCount: 1 })]));
  });

  it('paginates the public hierarchy and excludes deleted or unavailable images from counts', async () => {
    const c = await category();
    await prisma.gallerySubcategory.createMany({ data: Array.from({ length: 105 }, (_, n) => ({ categoryId: c.id, name: `Public ${String(n).padStart(3, '0')}` })) });
    const root = `/api/v1/public/gallery/subcategories?categoryId=${c.id}&limit=100`;
    const first = (await request(app).get(root)).body.data;
    const second = (await request(app).get(`${root}&page=2`)).body.data;
    expect(first.items).toHaveLength(100); expect(second.items).toHaveLength(5);
    expect(first.pagination.total).toBe(105);
    const sub = first.items[0];
    const photo = (await uploadAssigned(c.id, sub.id)).body.data;
    await as('patch', `${base}/photos/${photo.id}`).send({ published: true });
    const item = await prisma.galleryItem.findUniqueOrThrow({ where: { id: photo.id } });
    await prisma.fileObject.update({ where: { id: item.fileId! }, data: { deletedAt: new Date() } });
    expect((await request(app).get(root)).body.data.items[0].photoCount).toBe(0);
    expect((await request(app).get(`/api/v1/public/gallery/photos?subcategoryId=${sub.id}`)).body.data.items).toEqual([]);
    await as('delete', `${base}/photos/${photo.id}`);
    expect((await as('delete', `${base}/subcategories/${sub.id}`)).status).toBe(200);
    expect((await request(app).get(root)).body.data.pagination.total).toBe(104);
  });
});

describe('Optional upload name and description', () => {
  const uploadDetails = (categoryId: string, fields: [string, string][], subcategoryId?: string) => {
    const req = as('post', `${base}/photos`).attach('file', png, { filename: 'original-photo.png', contentType: 'image/png' }).field('categoryId', categoryId);
    if (subcategoryId) req.field('subcategoryId', subcategoryId);
    for (const [key, value] of fields) req.field(key, value);
    return req;
  };
  it.each([
    { label: 'both fields', fields: [['title', '  Research meeting  '], ['caption', '  Description\nwith another line  ']], title: 'Research meeting', caption: 'Description\nwith another line' },
    { label: 'only name', fields: [['title', 'A name']], title: 'A name', caption: '' },
    { label: 'only description', fields: [['caption', 'A description']], title: 'original-photo', caption: 'A description' },
    { label: 'neither field', fields: [], title: 'original-photo', caption: '' },
    { label: 'whitespace', fields: [['title', '   '], ['caption', '\n  ']], title: 'original-photo', caption: '' },
  ])('persists $label and retains mappings, draft status and the original filename', async ({ fields, title, caption }) => {
    const c = await category(), sub = await subcategory(c.id);
    const result = await uploadDetails(c.id, fields as [string, string][], sub.id);
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    const saved = result.body.data;
    expect(saved).toMatchObject({ title, caption, categoryId: c.id, subcategoryId: sub.id, published: false });
    const row = await prisma.galleryItem.findUniqueOrThrow({ where: { id: saved.id }, include: { file: true } });
    expect(row).toMatchObject({ title, caption, albumId: c.id, subcategoryId: sub.id, file: { originalName: 'original-photo.png' } });
    expect((await request(app).get(`/api/v1/public/gallery/photos?categoryId=${c.id}`)).body.data.items).toEqual([]);
    await as('patch', `${base}/photos/${saved.id}`).send({ title: 'Edited name', caption: 'Edited description', published: true });
    for (const url of [`${base}/photos?categoryId=${c.id}`, `/api/v1/public/gallery/photos?categoryId=${c.id}`]) {
      expect((await as('get', url)).body.data.items[0]).toMatchObject({ id: saved.id, title: 'Edited name', caption: 'Edited description', subcategoryId: sub.id });
    }
    expect((await as('patch', `${base}/photos/${saved.id}`).send({ caption: '' })).body.data.caption).toBe('');
  });

  it('accepts maximum-length Unicode values beyond the previous multipart byte limit', async () => {
    const c = await category();
    const title = '名'.repeat(191), caption = '説'.repeat(10000);
    const response = await uploadDetails(c.id, [['title', title], ['caption', caption]]);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data).toMatchObject({ title, caption });
    expect(await prisma.galleryItem.findUnique({ where: { id: response.body.data.id } })).toMatchObject({ title, caption });
  });

  it.each([
    { label: 'long name', fields: [['title', 'x'.repeat(192)]], field: 'title' },
    { label: 'long description', fields: [['caption', '説'.repeat(10001)]], field: 'caption' },
    { label: 'multipart text overflow', fields: [['caption', 'x'.repeat(41000)]], field: 'caption' },
    { label: 'repeated name', fields: [['title', 'One'], ['title', 'Two']], field: 'title' },
    { label: 'repeated description', fields: [['caption', 'One'], ['caption', 'Two']], field: 'caption' },
    { label: 'structured name', fields: [['title[nested]', 'Invalid']], field: 'title' },
    { label: 'structured description', fields: [['caption[nested]', 'Invalid']], field: 'caption' },
  ])('rejects $label with field errors and cleans temporary files', async ({ fields, field }) => {
    const c = await category();
    const before = await fs.readdir(uploadRoot);
    const response = await uploadDetails(c.id, fields as [string, string][]);
    expect(response.status, JSON.stringify(response.body)).toBe(422);
    expect(response.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field })]));
    expect(await fs.readdir(uploadRoot)).toEqual(before);
    expect(await prisma.galleryItem.count({ where: { albumId: c.id } })).toBe(0);
    expect(await prisma.fileObject.count({ where: { uploaderId: admin.id } })).toBe(0);
    expect((await uploadDetails(c.id, [['title', 'Recovery'], ['caption', 'Valid description']])).status).toBe(201);
  });

  it('rolls back metadata and removes the image if the transaction fails', async () => {
    const c = await category();
    const before = await fs.readdir(uploadRoot);
    const original = prisma.$transaction.bind(prisma);
    const transaction = vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (operation, options) => original(async db => {
      await (operation as (db: Prisma.TransactionClient) => Promise<unknown>)(db);
      throw new Error('Injected upload metadata rollback');
    }, options));
    const response = await uploadDetails(c.id, [['title', 'Rollback name'], ['caption', 'Rollback description']]);
    transaction.mockRestore();
    expect(response.status).toBe(500);
    expect(await prisma.galleryItem.count({ where: { albumId: c.id } })).toBe(0);
    expect(await prisma.fileObject.count({ where: { uploaderId: admin.id } })).toBe(0);
    expect(await fs.readdir(uploadRoot)).toEqual(before);
  });
});

describe('Video uploads through the existing gallery flow', () => {
  const fixture = (name: string) => fs.readFile(new URL(`./fixtures/gallery/${name}`, import.meta.url));
  it.each(['mp4', 'webm'])('uploads real %s bytes with metadata, mappings and draft visibility', async extension => {
    const c = await category(); const sub = await subcategory(c.id);
    const bytes = await fixture(`sample.${extension}`);
    const result = await as('post', `${base}/photos`).field('categoryId', c.id).field('subcategoryId', sub.id)
      .field('title', ' Video title ').field('caption', ' Video description ')
      .attach('file', bytes, { filename: `sample.${extension}`, contentType: `video/${extension}` });
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    const p = result.body.data;
    expect(p).toMatchObject({ type: 'video', title: 'Video title', caption: 'Video description', categoryId: c.id, subcategoryId: sub.id, width: 160, height: 96, published: false });
    const stored = await prisma.galleryItem.findUniqueOrThrow({ where: { id: p.id }, include: { file: true } });
    expect(stored.type).toBe('video'); expect(stored.file!.mimeType).toBe(`video/${extension}`);
    expect(await fs.readFile(assertSafePath(stored.file!.storageKey))).toEqual(bytes);
    const url = `/api/v1/public/gallery/photos/${p.id}/media`;
    expect((await request(app).get(url)).status).toBe(404);
    expect((await as('get', `/api/v1${p.mediaUrl}`, member.token)).status).toBe(403);
    await as('patch', `${base}/photos/${p.id}`).send({ published: true, title: 'Edited video' });
    expect((await request(app).get('/api/v1/public/gallery/photos')).body.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: p.id, type: 'video', title: 'Edited video' })]));
    expect((await request(app).get(`/api/v1/public/gallery/subcategories?categoryId=${c.id}`)).body.data.items[0].photoCount).toBe(1);
    expect((await request(app).get(url)).headers['content-type']).toBe(`video/${extension}`);
    expect((await as('get', `/api/v1/files/${stored.fileId}/download`, member.token)).status).toBe(200);
    expect((await request(app).get('/api/v1/public/gallery?type=video')).body.data.items.some((item: { id: string }) => item.id === p.id)).toBe(true);
    await as('patch', `${base}/categories/${c.id}`).send({ published: false });
    expect((await request(app).get(url).set('Range', 'bytes=0-9')).status).toBe(404);
    expect((await as('get', `/api/v1/files/${stored.fileId}/download`, member.token)).status).toBe(404);
  });
  it('supports byte ranges, suffixes, HEAD, and current visibility on every request', async () => {
    const c = await category(); const bytes = await fixture('sample.mp4');
    const p = (await upload(c.id, bytes, 'sample.mp4', 'video/mp4')).body.data;
    expect(p?.id).toBeTruthy();
    await as('patch', `${base}/photos/${p.id}`).send({ published: true });
    const url = `/api/v1/public/gallery/photos/${p.id}/media`;
    for (const [range, start, end] of [['bytes=0-9', 0, 9], ['bytes=-10', bytes.length - 10, bytes.length - 1], [`bytes=${bytes.length - 10}-`, bytes.length - 10, bytes.length - 1]] as const) {
      const response = await request(app).get(url).set('Range', range).buffer(true).parse((res, callback) => {
        const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
      expect(response.status).toBe(206); expect(response.headers['content-range']).toBe(`bytes ${start}-${end}/${bytes.length}`);
      expect(response.body).toEqual(bytes.subarray(start, end + 1)); expect(response.headers['cache-control']).toContain('no-store');
    }
    const head = await request(app).head(url); expect(head.status).toBe(200); expect(head.headers['content-length']).toBe(String(bytes.length));
    expect((await request(app).get(url).set('Range', `bytes=${bytes.length}-`)).status).toBe(416);
    expect((await request(app).get(url).set('Range', 'invalid')).status).toBe(200);
    expect((await request(app).get(url).set('Range', 'bytes=0-9').set('If-Range', '"stale"')).status).toBe(200);
    expect((await request(app).get(url.replace('/media', '/image'))).status).toBe(200);
    await as('patch', `${base}/photos/${p.id}`).send({ published: false });
    expect((await request(app).head(url)).status).toBe(404);
  });
  it('rejects spoofed, truncated, unsupported and stale video uploads without leaking files', async () => {
    const c = await category(); const other = await category('Other'); const sub = await subcategory(other.id);
    const bytes = await fixture('sample.mp4'); const before = (await fs.readdir(uploadRoot)).sort();
    for (const [buffer, name, mime] of [[png, 'fake.mp4', 'video/mp4'], [bytes, 'wrong.webm', 'video/webm'], [bytes.subarray(0, 100), 'broken.mp4', 'video/mp4'], [await fixture('unsupported.mp4'), 'codec.mp4', 'video/mp4']] as const) {
      const response = await upload(c.id, buffer, name, mime); expect(response.status, JSON.stringify(response.body)).toBe(422);
      expect(response.body.errors[0].field).toBe('file');
    }
    const stale = await as('post', `${base}/photos`).field('categoryId', c.id).field('subcategoryId', sub.id).attach('file', bytes, { filename: 'sample.mp4', contentType: 'video/mp4' });
    expect(stale.status).toBe(422);
    expect((await fs.readdir(uploadRoot)).sort()).toEqual(before);
    expect(await prisma.galleryItem.count({ where: { albumId: c.id } })).toBe(0);
    expect((await upload(c.id, bytes, 'sample.mp4', 'video/mp4')).status).toBe(201);
  });
  it('moves assigned videos with their subcategory, preserves mixed ordering and deletes files safely', async () => {
    const a = await category(); const b = await category('Destination'); const sub = await subcategory(a.id);
    const image = (await upload(b.id)).body.data;
    const result = await as('post', `${base}/photos`).field('categoryId', a.id).field('subcategoryId', sub.id).attach('file', await fixture('sample.webm'), { filename: 'sample.webm', contentType: 'video/webm' });
    expect(result.status).toBe(201); const p = result.body.data;
    const stored = await prisma.galleryItem.findUniqueOrThrow({ where: { id: p.id }, include: { file: true } });
    expect((await as('delete', `${base}/subcategories/${sub.id}`)).status).toBe(409);
    await as('patch', `${base}/subcategories/${sub.id}`).send({ categoryId: b.id });
    const items = (await as('get', `${base}/photos?categoryId=${b.id}`)).body.data.items;
    expect(items.map((item: { id: string }) => item.id)).toEqual([image.id, p.id]);
    expect(items[1]).toMatchObject({ type: 'video', subcategoryId: sub.id, displayOrder: 2 });
    expect((await as('delete', `${base}/photos/${p.id}`)).status).toBe(200);
    await expect(fs.access(assertSafePath(stored.file!.storageKey))).rejects.toThrow();
    expect((await as('delete', `${base}/subcategories/${sub.id}`)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { actorId: admin.id, entity: `GalleryItem ${p.id}`, action: 'GalleryPhotoUploaded' } })).toBe(1);
  });
});
