import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Nothing in these tests should send mail; stubbed so the suite never touches SMTP.
vi.mock('../services/mail.service', () => ({
  sendOtpEmail: vi.fn(async () => undefined),
  verifyTransport: vi.fn(async () => undefined),
  sendApprovalEmail: vi.fn(async () => undefined),
}));

import { createApp } from '../app';
import { prisma } from '../config/database';
import { sha256, signAccessToken } from '../utils/security';

/**
 * Covers the member-owned publication surface: listing, filtering, stats, and
 * the submission path added for the Published Works page. Fixtures are
 * namespaced by this prefix and removed afterwards, so seeded data is untouched.
 */
const app = createApp();
const PREFIX = 'member-publications-test';
const email = (n: string) => `${PREFIX}.${n}@example.test`;

let ownerId: string;
let ownerToken: string;
let strangerId: string;
let strangerToken: string;
let adminToken: string;

async function makeUser(key: string, role: 'MEMBER' | 'ADMIN') {
  const user = await prisma.user.create({
    data: {
      email: email(key),
      passwordHash: null,
      fullName: `Publications Test ${key}`,
      role,
      status: 'ACTIVE',
    },
  });
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(`${PREFIX}-${user.id}-${Date.now()}-${Math.random()}`),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { id: user.id, token: signAccessToken({ sub: user.id, sessionId: session.id, role }) };
}

async function makePublication(userId: string, overrides: {
  title?: string;
  category?: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  views?: number;
  downloads?: number;
} = {}) {
  return prisma.publication.create({
    data: {
      authorId: userId,
      title: overrides.title ?? `${PREFIX} manuscript`,
      abstract: 'A sufficiently long abstract for validation purposes, repeated to clear the minimum length rule set on the submission form.',
      category: overrides.category ?? 'Mental Health',
      researchType: 'Original Research',
      venue: 'IFSMHP Psychology of Well-Being',
      status: overrides.status ?? 'SUBMITTED',
      viewCount: overrides.views ?? 0,
      downloadCount: overrides.downloads ?? 0,
      submittedAt: new Date(),
    },
  });
}

/** Uploads a real file as `userId`, returning the FileObject id the API accepts. */
async function uploadFile(token: string, name = 'manuscript.pdf') {
  const response = await request(app)
    .post('/api/v1/files/upload')
    .set('Authorization', `Bearer ${token}`)
    // A real %PDF magic-byte header: the upload route cross-checks the declared
    // MIME against the file's actual contents and rejects a mismatch.
    .attach('file', Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\n', 'latin1'), {
      filename: name,
      contentType: 'application/pdf',
    });
  expect(response.status).toBe(201);
  return response.body.data.id as string;
}

const validBody = (overrides: Record<string, unknown> = {}) => ({
  title: `${PREFIX} a brand new manuscript`,
  category: 'Mental Health',
  researchType: 'Original Research',
  venue: 'IFSMHP Psychology of Well-Being',
  authors: 'A. Author, B. Author',
  correspondingAuthor: 'A. Author',
  correspondingEmail: 'a.author@example.test',
  abstract: 'A sufficiently long abstract for validation purposes, repeated to clear the one hundred character minimum that the submission form enforces.',
  keywords: 'telehealth, anxiety, clinical trial',
  conflicts: 'None',
  confirmOriginal: true,
  confirmPolicy: true,
  ...overrides,
});

async function wipe() {
  const users = await prisma.user.findMany({ where: { email: { contains: PREFIX } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  // FileObject.uploader is optional, so deleting the user only nulls the column.
  await prisma.fileObject.deleteMany({ where: { originalName: { startsWith: PREFIX } } });
}

beforeAll(wipe);

beforeEach(async () => {
  await wipe();
  const owner = await makeUser('owner', 'MEMBER');
  const stranger = await makeUser('stranger', 'MEMBER');
  const admin = await makeUser('admin', 'ADMIN');
  ownerId = owner.id;
  ownerToken = owner.token;
  strangerId = stranger.id;
  strangerToken = stranger.token;
  adminToken = admin.token;
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const asOwner = (method: 'get' | 'post', url: string) =>
  request(app)[method](url).set('Authorization', `Bearer ${ownerToken}`);

describe('GET /api/v1/members/me/publications', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await request(app).get('/api/v1/members/me/publications');
    expect(response.status).toBe(401);
  });

  it("returns only the caller's own publications", async () => {
    await makePublication(ownerId, { title: `${PREFIX} mine` });
    await makePublication(strangerId, { title: `${PREFIX} theirs` });

    const response = await asOwner('get', '/api/v1/members/me/publications');

    expect(response.status).toBe(200);
    const titles = response.body.data.items.map((p: { title: string }) => p.title);
    expect(titles).toContain(`${PREFIX} mine`);
    expect(titles).not.toContain(`${PREFIX} theirs`);
    expect(response.body.data.pagination.total).toBe(1);
  });

  it('filters by status label, category and search term', async () => {
    await makePublication(ownerId, { title: `${PREFIX} alpha`, status: 'DRAFT', category: 'Mental Health' });
    await makePublication(ownerId, { title: `${PREFIX} beta`, status: 'PUBLISHED', category: 'Service Analysis' });

    const published = await asOwner('get', '/api/v1/members/me/publications?status=Published');
    expect(published.body.data.items).toHaveLength(1);
    expect(published.body.data.items[0].status).toBe('Published');
    // The count must describe the filtered set, not the whole table.
    expect(published.body.data.pagination.total).toBe(1);

    const byCategory = await asOwner('get', '/api/v1/members/me/publications?category=Service%20Analysis');
    expect(byCategory.body.data.items).toHaveLength(1);
    expect(byCategory.body.data.items[0].title).toBe(`${PREFIX} beta`);

    const searched = await asOwner('get', `/api/v1/members/me/publications?q=${PREFIX}%20alpha`);
    expect(searched.body.data.items).toHaveLength(1);
    expect(searched.body.data.items[0].title).toBe(`${PREFIX} alpha`);
  });

  it('reports stats across every row regardless of the active filter', async () => {
    await makePublication(ownerId, { title: `${PREFIX} one`, status: 'PUBLISHED', views: 100, downloads: 10 });
    await makePublication(ownerId, { title: `${PREFIX} two`, status: 'SUBMITTED', views: 5, downloads: 1 });

    const response = await asOwner('get', '/api/v1/members/me/publications?status=Published');

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.stats).toMatchObject({
      total: 2,
      published: 1,
      views: 105,
      downloads: 11,
    });
  });

  it('leaves the readership trend null when there is no prior window', async () => {
    await makePublication(ownerId);
    const response = await asOwner('get', '/api/v1/members/me/publications');
    expect(response.body.data.stats.readershipTrend).toBeNull();
  });
});

describe('POST /api/v1/members/me/publications', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await request(app).post('/api/v1/members/me/publications').send(validBody());
    expect(response.status).toBe(401);
  });

  it('stores the manuscript as SUBMITTED with its history and attachment', async () => {
    const fileId = await uploadFile(ownerToken, `${PREFIX}-manuscript.pdf`);

    const response = await asOwner('post', '/api/v1/members/me/publications')
      .send(validBody({ manuscriptFileId: fileId }));

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('Submitted');

    const stored = await prisma.publication.findUnique({
      where: { id: response.body.data.id },
      include: { files: true, histories: true },
    });
    expect(stored?.authorId).toBe(ownerId);
    expect(stored?.status).toBe('SUBMITTED');
    expect(stored?.submittedAt).not.toBeNull();
    // The form's extra fields need somewhere to land, not to be silently dropped.
    expect(stored?.authors).toBe('A. Author, B. Author');
    expect(stored?.keywords).toBe('telehealth, anxiety, clinical trial');
    expect(stored?.files).toHaveLength(1);
    expect(stored?.files[0]?.kind).toBe('MANUSCRIPT');
    expect(stored?.histories[0]?.toStatus).toBe('SUBMITTED');
  });

  it('attaches a supplementary file under its own kind', async () => {
    const manuscriptFileId = await uploadFile(ownerToken, `${PREFIX}-manuscript.pdf`);
    const supplementaryFileId = await uploadFile(ownerToken, `${PREFIX}-supplement.pdf`);

    const response = await asOwner('post', '/api/v1/members/me/publications')
      .send(validBody({ manuscriptFileId, supplementaryFileId }));

    expect(response.status).toBe(201);
    const stored = await prisma.publicationFile.findMany({ where: { publicationId: response.body.data.id } });
    expect(stored.map((f) => f.kind).sort()).toEqual(['MANUSCRIPT', 'SUPPLEMENTARY']);
  });

  it("404s on another member's file rather than revealing it exists", async () => {
    const theirs = await uploadFile(strangerToken, `${PREFIX}-theirs.pdf`);

    const response = await asOwner('post', '/api/v1/members/me/publications')
      .send(validBody({ manuscriptFileId: theirs }));

    // 404 not 403 — "not yours" must read the same as "no such file" (R5).
    expect(response.status).toBe(404);
    expect(await prisma.publication.count({ where: { authorId: ownerId } })).toBe(0);
  });

  it('rejects an incomplete submission with field-level errors', async () => {
    const fileId = await uploadFile(ownerToken, `${PREFIX}-manuscript.pdf`);

    const response = await asOwner('post', '/api/v1/members/me/publications')
      .send(validBody({ manuscriptFileId: fileId, abstract: 'Too short.', keywords: '' }));

    expect(response.status).toBe(422);
    const fields = response.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toContain('abstract');
    expect(fields).toContain('keywords');
  });

  it('refuses a submission whose declarations are unticked', async () => {
    const fileId = await uploadFile(ownerToken, `${PREFIX}-manuscript.pdf`);

    const response = await asOwner('post', '/api/v1/members/me/publications')
      .send(validBody({ manuscriptFileId: fileId, confirmPolicy: false }));

    expect(response.status).toBe(422);
    expect(response.body.errors.map((e: { field: string }) => e.field)).toContain('confirmPolicy');
  });

  it('refuses a second submission of the same title', async () => {
    const fileId = await uploadFile(ownerToken, `${PREFIX}-manuscript.pdf`);
    const first = await asOwner('post', '/api/v1/members/me/publications').send(validBody({ manuscriptFileId: fileId }));
    expect(first.status).toBe(201);

    const second = await asOwner('post', '/api/v1/members/me/publications').send(validBody({ manuscriptFileId: fileId }));

    expect(second.status).toBe(409);
    expect(await prisma.publication.count({ where: { authorId: ownerId } })).toBe(1);
  });

  it('is visible to the member on a fresh read and moves through the CRO queue', async () => {
    const fileId = await uploadFile(ownerToken, `${PREFIX}-manuscript.pdf`);
    const created = await asOwner('post', '/api/v1/members/me/publications').send(validBody({ manuscriptFileId: fileId }));
    const id = created.body.data.id as string;

    // Persistence, as the page sees it after a refresh.
    const listed = await asOwner('get', '/api/v1/members/me/publications');
    expect(listed.body.data.items.map((p: { id: string }) => p.id)).toContain(id);

    const queue = await request(app)
      .get('/api/v1/admin/publications')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(queue.body.data.items.map((p: { id: string }) => p.id)).toContain(id);

    for (const step of ['approve', 'publish']) {
      const moved = await request(app)
        .post(`/api/v1/admin/publications/${id}/${step}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: 'Looks good.' });
      expect(moved.status).toBe(200);
    }

    const after = await asOwner('get', '/api/v1/members/me/publications');
    const row = after.body.data.items.find((p: { id: string }) => p.id === id);
    expect(row.status).toBe('Published');
    // Publishing mints the slug the member's "View Public Page" link needs.
    expect(row.slug).toBeTruthy();
  });
});
