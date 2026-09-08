import crypto from 'node:crypto';
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
 * Covers the member-owned project surface: listing, filtering, and the
 * edit/delete rules. Fixtures are namespaced by this prefix and removed
 * afterwards, so seeded data is never touched.
 */
const app = createApp();
const PREFIX = 'member-projects-test';
const email = (n: string) => `${PREFIX}.${n}@example.test`;

let ownerId: string;
let ownerToken: string;
let strangerId: string;
let strangerToken: string;

async function makeMember(key: string) {
  const user = await prisma.user.create({
    data: {
      email: email(key),
      passwordHash: null,
      fullName: `Projects Test ${key}`,
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  });
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(`${PREFIX}-${user.id}-${Date.now()}`),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { id: user.id, token: signAccessToken({ sub: user.id, sessionId: session.id, role: 'MEMBER' }) };
}

async function makeProject(userId: string, overrides: {
  title?: string;
  category?: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'REJECTED';
  support?: Array<'MORAL' | 'OFFICIAL' | 'FUNDING'>;
} = {}) {
  return prisma.project.create({
    data: {
      ownerId: userId,
      title: overrides.title ?? `${PREFIX} project`,
      category: overrides.category ?? 'Neuroscience',
      description: 'A sufficiently long description for validation purposes.',
      status: overrides.status ?? 'DRAFT',
      ...(overrides.support?.length
        ? { supportTypes: { create: overrides.support.map((kind) => ({ kind })) } }
        : {}),
    },
  });
}

async function wipe() {
  const users = await prisma.user.findMany({ where: { email: { contains: PREFIX } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  // FileObject.uploader is optional, so deleting the user only nulls the column.
  await prisma.fileObject.deleteMany({ where: { storageKey: { startsWith: `${PREFIX}/` } } });
}

beforeAll(async () => {
  await wipe();
});

beforeEach(async () => {
  await wipe();
  const owner = await makeMember('owner');
  const stranger = await makeMember('stranger');
  ownerId = owner.id;
  ownerToken = owner.token;
  strangerId = stranger.id;
  strangerToken = stranger.token;
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const asOwner = (method: 'get' | 'patch' | 'delete', url: string) =>
  request(app)[method](url).set('Authorization', `Bearer ${ownerToken}`);

describe('GET /api/v1/members/me/projects', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await request(app).get('/api/v1/members/me/projects');
    expect(response.status).toBe(401);
  });

  it('returns only the caller\'s own projects', async () => {
    await makeProject(ownerId, { title: `${PREFIX} mine` });
    await makeProject(strangerId, { title: `${PREFIX} theirs` });

    const response = await asOwner('get', '/api/v1/members/me/projects');

    expect(response.status).toBe(200);
    const titles = response.body.data.items.map((p: { title: string }) => p.title);
    expect(titles).toContain(`${PREFIX} mine`);
    expect(titles).not.toContain(`${PREFIX} theirs`);
    expect(response.body.data.pagination.total).toBe(1);
  });

  it('filters by status label and by search term', async () => {
    await makeProject(ownerId, { title: `${PREFIX} alpha`, status: 'DRAFT' });
    await makeProject(ownerId, { title: `${PREFIX} beta`, status: 'UNDER_REVIEW' });

    const underReview = await asOwner('get', '/api/v1/members/me/projects?status=Under%20Review');
    expect(underReview.body.data.items).toHaveLength(1);
    expect(underReview.body.data.items[0].status).toBe('Under Review');

    const searched = await asOwner('get', `/api/v1/members/me/projects?q=${PREFIX}%20alpha`);
    expect(searched.body.data.items).toHaveLength(1);
    expect(searched.body.data.items[0].title).toBe(`${PREFIX} alpha`);
  });

  it('filters by support type so the total matches the rows returned', async () => {
    await makeProject(ownerId, { title: `${PREFIX} funded`, support: ['FUNDING'] });
    await makeProject(ownerId, { title: `${PREFIX} moral`, support: ['MORAL'] });

    const response = await asOwner('get', '/api/v1/members/me/projects?support=Funding');

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].title).toBe(`${PREFIX} funded`);
    // The count must reflect the same filter, not every project the member owns.
    expect(response.body.data.pagination.total).toBe(1);
  });
});

describe('GET /api/v1/members/me/projects/:id', () => {
  it('returns detail for an owned project', async () => {
    const project = await makeProject(ownerId, { support: ['MORAL'] });

    const response = await asOwner('get', `/api/v1/members/me/projects/${project.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.project.id).toBe(project.id);
    expect(response.body.data.project.support).toEqual(['Moral']);
    expect(response.body.data.project).toHaveProperty('timeline');
    expect(response.body.data.project).toHaveProperty('history');
  });

  it('returns 404 — not 403 — for someone else\'s project', async () => {
    const theirs = await makeProject(strangerId);

    const response = await asOwner('get', `/api/v1/members/me/projects/${theirs.id}`);

    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/v1/members/me/projects/:id', () => {
  it('updates an owned draft and replaces its support types', async () => {
    const project = await makeProject(ownerId, { support: ['MORAL'] });

    const response = await asOwner('patch', `/api/v1/members/me/projects/${project.id}`)
      .send({ title: `${PREFIX} renamed`, supportTypes: ['Funding', 'Official'] });

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe(`${PREFIX} renamed`);
    expect(response.body.data.support.sort()).toEqual(['Funding', 'Official']);
  });

  it('promotes a draft to Submitted and records the history', async () => {
    const project = await makeProject(ownerId, { status: 'DRAFT' });

    const response = await asOwner('patch', `/api/v1/members/me/projects/${project.id}`)
      .send({ submit: true });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('Submitted');
    expect(response.body.data.submitted).not.toBeNull();

    const history = await prisma.projectStatusHistory.findMany({ where: { projectId: project.id } });
    expect(history.some((h) => h.toStatus === 'SUBMITTED')).toBe(true);
  });

  it('refuses to edit a project already under review', async () => {
    const project = await makeProject(ownerId, { status: 'UNDER_REVIEW' });

    const response = await asOwner('patch', `/api/v1/members/me/projects/${project.id}`)
      .send({ title: `${PREFIX} sneaky edit` });

    expect(response.status).toBe(409);

    const unchanged = await prisma.project.findUnique({ where: { id: project.id } });
    expect(unchanged?.title).not.toBe(`${PREFIX} sneaky edit`);
  });

  it('returns 404 when editing someone else\'s project', async () => {
    const theirs = await makeProject(strangerId, { title: `${PREFIX} theirs` });

    const response = await asOwner('patch', `/api/v1/members/me/projects/${theirs.id}`)
      .send({ title: `${PREFIX} hijacked` });

    expect(response.status).toBe(404);

    const unchanged = await prisma.project.findUnique({ where: { id: theirs.id } });
    expect(unchanged?.title).toBe(`${PREFIX} theirs`);
  });

  it('rejects an empty payload', async () => {
    const project = await makeProject(ownerId);
    const response = await asOwner('patch', `/api/v1/members/me/projects/${project.id}`).send({});
    expect(response.status).toBe(422);
  });
});

describe('POST /api/v1/members/me/projects — attachments and links', () => {
  /** A stored upload owned by `userId`, standing in for POST /files/upload. */
  async function makeFile(userId: string, name = `${PREFIX}-doc.pdf`) {
    return prisma.fileObject.create({
      data: {
        uploaderId: userId,
        storageKey: `${PREFIX}/${crypto.randomUUID()}.pdf`,
        originalName: name,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      },
    });
  }

  const body = (extra: Record<string, unknown>) => ({
    title: `${PREFIX} with attachments`,
    category: 'Neuroscience',
    description: 'A sufficiently long description for validation purposes.',
    ...extra,
  });

  it('persists owned files and resource links, and returns them from the detail route', async () => {
    const file = await makeFile(ownerId);

    const created = await request(app)
      .post('/api/v1/members/me/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(body({
        fileIds: [file.id],
        resourceLinks: [{ url: 'https://osf.io/abc123' }, { url: 'http://example.test/data' }],
      }));

    expect(created.status).toBe(201);

    const detail = await asOwner('get', `/api/v1/members/me/projects/${created.body.data.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.project.files).toHaveLength(1);
    expect(detail.body.data.project.files[0].id).toBe(file.id);
    expect(detail.body.data.project.resourceLinks.map((l: { url: string }) => l.url).sort())
      .toEqual(['http://example.test/data', 'https://osf.io/abc123']);
  });

  it('refuses to attach a file uploaded by someone else, and links nothing', async () => {
    const theirFile = await makeFile(strangerId, `${PREFIX}-theirs.pdf`);

    const response = await request(app)
      .post('/api/v1/members/me/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(body({ fileIds: [theirFile.id] }));

    // 404, not 403 — the caller must not learn the file exists.
    expect(response.status).toBe(404);

    // And crucially the project must not have been created with that link.
    const links = await prisma.projectFile.findMany({ where: { fileId: theirFile.id } });
    expect(links).toHaveLength(0);
  });

  it('de-duplicates repeated file ids rather than violating the unique index', async () => {
    const file = await makeFile(ownerId);

    const response = await request(app)
      .post('/api/v1/members/me/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(body({ fileIds: [file.id, file.id, file.id] }));

    expect(response.status).toBe(201);
    const rows = await prisma.projectFile.findMany({ where: { projectId: response.body.data.id } });
    expect(rows).toHaveLength(1);
  });

  it('rejects a malformed or non-http link', async () => {
    for (const url of ['notaurl', 'ftp://example.test/x']) {
      const response = await request(app)
        .post('/api/v1/members/me/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(body({ resourceLinks: [{ url }] }));
      expect(response.status).toBe(422);
    }
  });

  it('still accepts a project with no files and no links', async () => {
    const response = await request(app)
      .post('/api/v1/members/me/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(body({}));

    expect(response.status).toBe(201);
  });
});

describe('DELETE /api/v1/members/me/projects/:id', () => {
  it('soft-deletes an owned draft and drops it from the list', async () => {
    const project = await makeProject(ownerId);

    const response = await asOwner('delete', `/api/v1/members/me/projects/${project.id}`);
    expect(response.status).toBe(200);

    // The row survives for audit; only `deletedAt` is set.
    const row = await prisma.project.findUnique({ where: { id: project.id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();

    const list = await asOwner('get', '/api/v1/members/me/projects');
    expect(list.body.data.items).toHaveLength(0);
  });

  it('refuses to delete a project already under review', async () => {
    const project = await makeProject(ownerId, { status: 'UNDER_REVIEW' });

    const response = await asOwner('delete', `/api/v1/members/me/projects/${project.id}`);

    expect(response.status).toBe(409);
    const row = await prisma.project.findUnique({ where: { id: project.id } });
    expect(row?.deletedAt).toBeNull();
  });

  it('returns 404 when deleting someone else\'s project', async () => {
    const theirs = await makeProject(strangerId);

    const response = await asOwner('delete', `/api/v1/members/me/projects/${theirs.id}`);

    expect(response.status).toBe(404);
    const row = await prisma.project.findUnique({ where: { id: theirs.id } });
    expect(row?.deletedAt).toBeNull();
  });

  it('does not let a stranger delete via their own valid session', async () => {
    const mine = await makeProject(ownerId);

    const response = await request(app)
      .delete(`/api/v1/members/me/projects/${mine.id}`)
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(response.status).toBe(404);
    const row = await prisma.project.findUnique({ where: { id: mine.id } });
    expect(row?.deletedAt).toBeNull();
  });
});
