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
import { parseProjectTimeline, validProjectDate } from '../domain/project-timeline';
import { validProjectDate as validFrontendDate, projectToDateError } from '../../frontend/src/utils/projectTimeline';

/**
 * Covers the member-owned project surface: listing, filtering, and the
 * edit/delete rules. Fixtures are namespaced by this prefix and removed
 * afterwards, so seeded data is never touched.
 */
const app = createApp();
const PREFIX = 'member-projects-test';
const email = (n: string) => `${PREFIX}.${n}@example.test`;
const dates = { fromDate: '2026-01-01', toDate: '2026-12-31' };
let rejectProjectAudit = false;
prisma.$use(async (params, next) => {
  if (rejectProjectAudit && params.model === 'AuditLog' && params.action === 'create' && ['ProjectCreated', 'ProjectSubmitted', 'ProjectUpdated'].includes(params.args.data.action)) {
    throw new Error('Injected project audit failure');
  }
  return next(params);
});

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
  timeline?: string | null;
} = {}) {
  return prisma.project.create({
    data: {
      ownerId: userId,
      title: overrides.title ?? `${PREFIX} project`,
      category: overrides.category ?? 'Neuroscience',
      description: 'A sufficiently long description for validation purposes.',
      status: overrides.status ?? 'DRAFT',
      timeline: overrides.timeline === undefined ? '2026-01-01 / 2026-12-31' : overrides.timeline,
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
  rejectProjectAudit = false;
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
    ...dates,
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

describe('project calendar timelines', () => {
  const body = (extra: Record<string, unknown> = {}) => ({ title: `${PREFIX} dated`, category: 'Neuroscience', description: 'A sufficiently long description for validation purposes.', ...dates, ...extra });
  const create = (extra: Record<string, unknown> = {}) => request(app).post('/api/v1/members/me/projects').auth(ownerToken, { type: 'bearer' }).send(body(extra));

  it.each([
    undefined, null, 0, '0', '', false, [], {}, '2026', '2026-01', '2026-1-01', '2026-01-1',
    '0000-01-01', '10000-01-01', '2026-00-01', '2026-13-01', '2026-01-00', '2026-01-32',
    '2026-04-31', '2026-02-29', '1900-02-29', '2024-02-30', '2026-01-01T00:00:00Z',
    ' 2026-01-01', '2026-01-01 ', '2026-01-01\n', '２０２６-０１-０１', '01/02/2026',
  ])('rejects invalid calendar value %j on each field for both create buttons and edits', async invalid => {
    const project = await makeProject(ownerId, { support: ['MORAL'] });
    const before = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    for (const field of ['fromDate', 'toDate']) {
      for (const submit of [false, true]) {
        const response = await create({ [field]: invalid, submit });
        expect(response.status).toBe(422);
        expect(response.body.errors.some((e: { field: string }) => e.field === field)).toBe(true);
      }
      const response = await asOwner('patch', `/api/v1/members/me/projects/${project.id}`)
        .send({ ...dates, [field]: invalid, title: 'Must not persist', supportTypes: ['Funding'], submit: true });
      expect(response.status).toBe(422);
    }
    expect(await prisma.project.count({ where: { ownerId } })).toBe(1);
    expect(await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).toEqual(before);
    expect(await prisma.projectSupportType.findMany({ where: { projectId: project.id } })).toMatchObject([{ kind: 'MORAL' }]);
    expect(await prisma.projectStatusHistory.count({ where: { projectId: project.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { actorId: ownerId } })).toBe(0);
    if (typeof invalid === 'string') {
      expect(validProjectDate(invalid)).toBe(false);
      expect(validFrontendDate(invalid)).toBe(false);
    }
  });

  it.each([
    ['0001-01-01', '9999-12-31'], ['0099-12-31', '0100-01-01'], ['2000-02-29', '2000-02-29'],
    ['2024-02-29', '2024-03-01'], ['2026-12-31', '2027-01-01'], ['2026-04-30', '2026-04-30'],
  ])('persists date-only range %s through %s without timezone conversion', async (fromDate, toDate) => {
    for (const submit of [false, true]) {
      const response = await create({ fromDate, toDate, submit, budget: 'USD 100', supportTypes: ['Moral'] });
      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe(submit ? 'Submitted' : 'Draft');
      const detail = await asOwner('get', `/api/v1/members/me/projects/${response.body.data.id}`);
      expect(detail.body.data.project).toMatchObject({ fromDate, toDate, timeline: `${fromDate} / ${toDate}`, budget: 'USD 100', support: ['Moral'] });
    }
    expect(validFrontendDate(fromDate)).toBe(true);
    expect(validFrontendDate(toDate)).toBe(true);
    expect(projectToDateError(fromDate, toDate)).toBeUndefined();
  });

  it('rejects reversed ranges, incomplete replacement pairs and the old free-text mutation field', async () => {
    const project = await makeProject(ownerId);
    for (const extra of [{ fromDate: '2026-12-31', toDate: '2026-01-01' }, { timeline: '0' }, { timeline: '2026 Q3-Q4' }]) {
      expect((await create(extra)).status).toBe(422);
      expect((await asOwner('patch', `/api/v1/members/me/projects/${project.id}`).send(extra)).status).toBe(422);
    }
    expect(projectToDateError('2026-12-31', '2026-01-01')).toBe('To Date must be on or after From Date');
    for (const extra of [{ fromDate: dates.fromDate }, { toDate: dates.toDate }]) {
      const response = await asOwner('patch', `/api/v1/members/me/projects/${project.id}`).send(extra);
      expect(response.status).toBe(422);
      expect(response.body.errors[0].field).toBe('fromDate' in extra ? 'toDate' : 'fromDate');
    }
    expect(await prisma.auditLog.count({ where: { actorId: ownerId } })).toBe(0);
  });

  it.each([null, '', '0', '2026 Q3-Q4', '2026-02-30 / 2026-03-01', '2026-12-31 / 2026-01-01'])('preserves legacy timeline %j until explicit replacement, but blocks promotion', async timeline => {
    const project = await makeProject(ownerId, { timeline });
    const patch = (body: Record<string, unknown>) => asOwner('patch', `/api/v1/members/me/projects/${project.id}`).send(body);
    expect((await patch({ title: 'Unrelated edit' })).status).toBe(200);
    const detail = await asOwner('get', `/api/v1/members/me/projects/${project.id}`);
    expect(detail.body.data.project).toMatchObject({ timeline, fromDate: null, toDate: null });
    expect(parseProjectTimeline(timeline)).toEqual({ fromDate: null, toDate: null });
    const rejected = await patch({ submit: true, title: 'Must not persist' });
    expect(rejected.status).toBe(422);
    expect(rejected.body.errors.map((e: { field: string }) => e.field)).toEqual(['fromDate', 'toDate']);
    expect(await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({ title: 'Unrelated edit', status: 'DRAFT', timeline });
    expect((await patch({ ...dates, submit: true })).status).toBe(200);
    expect(await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({ status: 'SUBMITTED', timeline: '2026-01-01 / 2026-12-31' });
  });

  it('rolls back timeline, support types, promotion and history when audit insertion fails', async () => {
    const project = await makeProject(ownerId, { timeline: 'Legacy schedule', support: ['MORAL'] });
    rejectProjectAudit = true;
    try {
      expect((await create({ submit: false })).status).toBe(500);
      expect((await asOwner('patch', `/api/v1/members/me/projects/${project.id}`).send({ ...dates, submit: true, supportTypes: ['Funding'] })).status).toBe(500);
    } finally { rejectProjectAudit = false; }
    expect(await prisma.project.count({ where: { ownerId } })).toBe(1);
    expect(await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({ status: 'DRAFT', timeline: 'Legacy schedule' });
    expect(await prisma.projectSupportType.findMany({ where: { projectId: project.id } })).toMatchObject([{ kind: 'MORAL' }]);
    expect(await prisma.projectStatusHistory.count({ where: { projectId: project.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { actorId: ownerId } })).toBe(0);
  });

  it('does not duplicate submission history or audits when valid promotion is retried', async () => {
    const project = await makeProject(ownerId);
    for (let i = 0; i < 2; i++) expect((await asOwner('patch', `/api/v1/members/me/projects/${project.id}`).send({ submit: true })).status).toBe(200);
    expect(await prisma.projectStatusHistory.count({ where: { projectId: project.id, toStatus: 'SUBMITTED' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { actorId: ownerId, action: 'ProjectSubmitted' } })).toBe(1);
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
