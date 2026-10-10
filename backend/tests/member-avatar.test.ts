import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/database';
import { createApp } from '../app';
import { signAccessToken } from '../utils/security';
import { assertSafePath, uploadRoot } from '../utils/fileStorage';
import { memberAvatarPolicy } from '../domain/member-avatar';
import { purgeAvatars } from '../services/avatar-storage.service';

vi.setConfig({ testTimeout: 15000 });
const app = createApp(), base = '/api/v1/members/me/profile', endpoint = `${base}/avatar`;
const ids: string[] = [];
type Actor = { id: string; token: string; sessionId: string };
let member: Actor, other: Actor, admin: Actor, applicant: Actor;
let png: Buffer, rejectAudit = false;
prisma.$use(async (params, next) => {
  if (rejectAudit && params.model === 'AuditLog' && params.action === 'create') throw new Error('Injected avatar persistence failure');
  return next(params);
});
async function session(id: string, role: 'MEMBER' | 'ADMIN' | 'APPLICANT' = 'MEMBER') {
  const row = await prisma.session.create({ data: { userId: id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3600000) } });
  return { id, sessionId: row.id, token: signAccessToken({ sub: id, role, sessionId: row.id }) };
}
async function actor(role: 'MEMBER' | 'ADMIN' | 'APPLICANT', profile = true) {
  const row = await prisma.user.create({ data: { email: `avatar-${randomUUID()}@example.test`, fullName: 'Avatar Test Member', role, status: 'ACTIVE',
    ...(profile ? { memberProfile: { create: { professionalType: 'Scientist', institution: 'Avatar Test', phone: null } } } : {}) } });
  ids.push(row.id);
  return session(row.id, role);
}
const api = (method: 'get' | 'post', path = endpoint, who = member) => request(app)[method](path).auth(who.token, { type: 'bearer' });
const upload = (bytes = png, name = 'avatar.png', type = 'image/png', who = member) => api('post', endpoint, who).attach('file', bytes, { filename: name, contentType: type });
const profile = async () => (await api('get', base)).body.data;
const disk = async () => (await fs.readdir(uploadRoot)).sort();

beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test') || !uploadRoot.includes('test')) throw new Error('Use an isolated *_test database and test storage directory');
  member = await actor('MEMBER'); other = await actor('MEMBER'); admin = await actor('ADMIN', false); applicant = await actor('APPLICANT');
  png = await sharp({ create: { width: 1400, height: 700, channels: 3, background: 'red' } }).png().toBuffer();
});
afterEach(() => { rejectAudit = false; });
afterAll(async () => {
  const files = await prisma.fileObject.findMany({ where: { uploaderId: { in: ids } } });
  await prisma.memberProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.adminProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.fileObject.deleteMany({ where: { uploaderId: { in: ids } } });
  await Promise.all(files.map(f => fs.unlink(assertSafePath(f.storageKey)).catch(() => undefined)));
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe('member profile images', () => {
  it('loads a legacy profile with initials fallback and the upload policy', async () => {
    expect(await profile()).toMatchObject({ avatarFileId: null, avatarPolicy: memberAvatarPolicy, phone: null });
    expect((await api('get')).status).toBe(404);
  });
  it.each(['png', 'jpeg', 'webp'] as const)('uploads and normalizes %s, replaces and persists across sessions', async format => {
    const before = (await profile()).avatarFileId;
    const bytes = await sharp(png).toFormat(format).toBuffer();
    const response = await upload(bytes, `avatar.${format}`, `image/${format}`);
    expect(response.status).toBe(200);
    const id = response.body.data.avatarFileId;
    const stored = await prisma.fileObject.findUniqueOrThrow({ where: { id } });
    expect(stored).toMatchObject({ uploaderId: member.id, avatarManaged: true, visibility: 'PRIVATE', mimeType: 'image/webp' });
    expect(await sharp(assertSafePath(stored.storageKey)).metadata()).toMatchObject({ format: 'webp', width: 1024, height: 512 });
    const fresh = await session(member.id);
    expect((await api('get', base, fresh)).body.data.avatarFileId).toBe(id);
    const image = await api('get', endpoint, fresh);
    expect(image.status).toBe(200); expect(image.headers['content-type']).toBe('image/webp');
    expect(image.headers['cache-control']).toBe('private, no-store');
    expect(image.headers['x-content-type-options']).toBe('nosniff');
    if (before) {
      const previous = await prisma.fileObject.findUniqueOrThrow({ where: { id: before } });
      expect(previous.deletedAt).not.toBeNull(); expect(previous.purgedAt).not.toBeNull();
      await expect(fs.access(assertSafePath(previous.storageKey))).rejects.toThrow();
      expect((await api('get', `/api/v1/files/${before}/download`)).status).toBe(404);
    }
  });
  it('allows only the owner to download, including through the generic endpoint', async () => {
    const id = (await profile()).avatarFileId;
    expect((await api('get', `/api/v1/files/${id}/download`)).status).toBe(200);
    for (const who of [other, admin, applicant]) expect((await api('get', `/api/v1/files/${id}/download`, who)).status).toBe(404);
    expect((await api('get', endpoint, other)).status).toBe(404);
    expect((await request(app).get(`/api/v1/files/${id}/download`)).status).toBe(401);
  });
  it('rejects missing, empty, malformed, spoofed and unsupported files without side effects', async () => {
    const before = await profile(), files = await disk();
    const gif = await sharp(png).gif().toBuffer();
    const animated = await sharp(Buffer.from([...Array(12).fill([255, 0, 0]).flat(), ...Array(12).fill([0, 0, 255]).flat()]), { raw: { width: 4, height: 6, channels: 3, pageHeight: 3 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(animated).metadata()).pages).toBe(2);
    expect((await api('post')).status).toBe(422);
    for (const [bytes, name, mime] of [
      [Buffer.alloc(0), 'empty.png', 'image/png'], [Buffer.from('invalid'), 'broken.png', 'image/png'],
      [Buffer.from([0xff, 0xd8, 0xff, 0xd9]), 'truncated.jpg', 'image/jpeg'],
      [png, 'spoof.jpg', 'image/jpeg'], [png, 'wrong.png', 'image/jpeg'], [png, 'wrong.txt', 'image/png'],
      [Buffer.from('<svg/>'), 'image.svg', 'image/svg+xml'], [gif, 'image.gif', 'image/gif'],
      [animated, 'animated.webp', 'image/webp'],
    ] as const) expect((await upload(bytes, name, mime)).status, name).toBe(422);
    expect((await api('post').attach('file', png, 'first.png').attach('file', png, 'second.png')).status).toBe(422);
    expect((await api('post').attach('photo', png, 'photo.png')).status).toBe(422);
    expect((await profile()).avatarFileId).toBe(before.avatarFileId);
    expect(await disk()).toEqual(files);
  });
  it('accepts exactly the size limit and rejects one byte over', async () => {
    const bytes = Buffer.concat([png, Buffer.alloc(memberAvatarPolicy.maxBytes - png.length)]);
    expect((await upload(bytes)).status).toBe(200);
    const id = (await profile()).avatarFileId, files = await disk();
    expect((await upload(Buffer.concat([bytes, Buffer.from('x')]))).status).toBe(422);
    expect((await profile()).avatarFileId).toBe(id); expect(await disk()).toEqual(files);
  });
  it('rejects identity fields and other member paths without modifying either profile', async () => {
    const id = (await profile()).avatarFileId;
    for (const field of ['userId', 'profileId', 'avatarFileId']) {
      expect((await api('post').field(field, other.id).attach('file', png, 'avatar.png')).status).toBe(422);
      expect((await api('post').query({ [field]: other.id }).attach('file', png, 'avatar.png')).status).toBe(422);
    }
    expect((await api('post', `/api/v1/members/${other.id}/profile/avatar`).attach('file', png, 'avatar.png')).status).toBe(404);
    expect((await profile()).avatarFileId).toBe(id);
    expect((await api('get', base, other)).body.data.avatarFileId).toBeNull();
  });
  it('rejects unauthorized requests before writing upload bytes', async () => {
    const files = await disk();
    for (const method of ['get', 'post'] as const) {
      expect((await request(app)[method](endpoint)).status).toBe(401);
      expect((await request(app)[method](endpoint).set('Authorization', 'Bearer invalid')).status).toBe(401);
      for (const who of [admin, applicant]) expect((await api(method, endpoint, who)).status).toBe(403);
    }
    for (const state of ['expired', 'revoked', 'inactive', 'deleted'] as const) {
      const who = await actor('MEMBER');
      if (state === 'expired') await prisma.session.update({ where: { id: who.sessionId }, data: { expiresAt: new Date(0) } });
      if (state === 'revoked') await prisma.session.update({ where: { id: who.sessionId }, data: { revokedAt: new Date() } });
      if (state === 'inactive') await prisma.user.update({ where: { id: who.id }, data: { status: 'SUSPENDED' } });
      if (state === 'deleted') await prisma.user.update({ where: { id: who.id }, data: { deletedAt: new Date() } });
      expect((await upload(png, 'avatar.png', 'image/png', who)).status).toBe(401);
      expect((await api('get', endpoint, who)).status).toBe(401);
    }
    expect(await disk()).toEqual(files);
  });
  it('rejects development-header identities without a verified session', async () => {
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      expect((await request(app).post(endpoint).set('X-Test-Role', 'MEMBER').set('X-Test-User-Id', member.id).attach('file', png, 'avatar.png')).status).toBe(401);
    } finally { process.env.NODE_ENV = previous; }
  });
  it('rolls back persistence failures and cleans files for missing profiles', async () => {
    const id = (await profile()).avatarFileId, files = await disk();
    rejectAudit = true;
    expect((await upload()).status).toBe(500);
    rejectAudit = false;
    expect((await profile()).avatarFileId).toBe(id); expect(await disk()).toEqual(files);
    const noProfile = await actor('MEMBER', false);
    expect((await upload(png, 'avatar.png', 'image/png', noProfile)).status).toBe(404);
    expect(await disk()).toEqual(files);
  });
  it('serializes simultaneous replacements and purges only superseded images', async () => {
    const responses = await Promise.all([upload(), upload()]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    const id = (await profile()).avatarFileId;
    expect(responses.map(r => r.body.data.avatarFileId)).toContain(id);
    const active = await prisma.fileObject.findMany({ where: { uploaderId: member.id, avatarManaged: true, deletedAt: null } });
    expect(active.map(f => f.id)).toEqual([id]);
    await purgeAvatars();
    await expect(fs.access(assertSafePath(active[0]!.storageKey))).resolves.toBeUndefined();
    expect((await api('get')).status).toBe(200);
  });
  it('keeps administrator uploads and ownership working', async () => {
    const response = await api('post', '/api/v1/admin/profile/avatar', admin).field('expectedRevision', 0).attach('file', png, 'admin.png');
    expect(response.status).toBe(200);
    await purgeAvatars();
    const id = response.body.data.avatarFileId;
    expect((await api('get', '/api/v1/admin/profile/avatar', admin)).status).toBe(200);
    expect((await api('get', `/api/v1/files/${id}/download`, member)).status).toBe(404);
    expect((await api('get', `/api/v1/files/${id}/download`, admin)).status).toBe(200);
  });
});
