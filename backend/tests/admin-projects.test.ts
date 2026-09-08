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
 * Covers the CRO-facing project review surface: the filtered queue, the detail
 * payload the review screen needs, and the approve/reject state machine.
 * Fixtures are namespaced by this prefix and removed afterwards, so seeded data
 * is never touched.
 */
const app = createApp();
const PREFIX = 'admin-projects-test';
const email = (n: string) => `${PREFIX}.${n}@example.test`;

let adminId: string;
let adminToken: string;
let memberId: string;
let memberToken: string;

async function makeUser(key: string, role: 'ADMIN' | 'MEMBER') {
  const user = await prisma.user.create({
    data: {
      email: email(key),
      passwordHash: null,
      fullName: `Admin Projects ${key}`,
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

async function makeProject(overrides: {
  title?: string;
  category?: string;
  priority?: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';
  submittedAt?: Date | null;
  deletedAt?: Date | null;
} = {}) {
  return prisma.project.create({
    data: {
      ownerId: memberId,
      title: overrides.title ?? `${PREFIX} project`,
      category: overrides.category ?? 'Neuroscience',
      description: 'A sufficiently long description for validation purposes.',
      priority: overrides.priority ?? 'Standard',
      status: overrides.status ?? 'SUBMITTED',
      submittedAt: overrides.submittedAt === undefined ? new Date() : overrides.submittedAt,
      deletedAt: overrides.deletedAt ?? null,
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
}

beforeAll(async () => {
  await wipe();
});

beforeEach(async () => {
  await wipe();
  const admin = await makeUser('admin', 'ADMIN');
  const member = await makeUser('member', 'MEMBER');
  adminId = admin.id;
  adminToken = admin.token;
  memberId = member.id;
  memberToken = member.token;
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const asAdmin = (method: 'get' | 'post' | 'patch', url: string) =>
  request(app)[method](url).set('Authorization', `Bearer ${adminToken}`);

/** Only the fixtures this suite created — the DB also holds seeded projects. */
const ours = (rows: { title: string }[]) => rows.filter((r) => r.title.startsWith(PREFIX));

describe('GET /api/v1/admin/projects', () => {
  it('rejects an unauthenticated caller', async () => {
    const res = await request(app).get('/api/v1/admin/projects');
    expect(res.status).toBe(401);
  });

  it('refuses a MEMBER with 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/projects')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it("lists another member's projects with owner details", async () => {
    await makeProject({ title: `${PREFIX} visible` });

    const res = await asAdmin('get', '/api/v1/admin/projects?limit=100');
    expect(res.status).toBe(200);

    const row = res.body.data.items.find((p: { title: string }) => p.title === `${PREFIX} visible`);
    expect(row).toBeDefined();
    expect(row.status).toBe('Submitted');
    expect(row.member).toBe('Admin Projects member');
  });

  it('omits soft-deleted projects', async () => {
    await makeProject({ title: `${PREFIX} deleted`, deletedAt: new Date() });

    const res = await asAdmin('get', '/api/v1/admin/projects?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((p: { title: string }) => p.title === `${PREFIX} deleted`)).toBe(false);
  });

  it('counts only the filtered rows in pagination.total', async () => {
    await makeProject({ title: `${PREFIX} a`, category: `${PREFIX}-cat` });
    await makeProject({ title: `${PREFIX} b`, category: `${PREFIX}-cat` });
    await makeProject({ title: `${PREFIX} c`, category: 'Some Other Category' });

    const res = await asAdmin('get', `/api/v1/admin/projects?category=${PREFIX}-cat&limit=100`);
    expect(res.status).toBe(200);
    // The pre-fix implementation counted the whole table here.
    expect(res.body.data.pagination.total).toBe(2);
    expect(res.body.data.items).toHaveLength(2);
  });

  it('filters by status label', async () => {
    await makeProject({ title: `${PREFIX} queued`, status: 'SUBMITTED' });
    await makeProject({ title: `${PREFIX} reviewing`, status: 'UNDER_REVIEW' });

    const res = await asAdmin('get', '/api/v1/admin/projects?status=Under%20Review&limit=100');
    expect(res.status).toBe(200);
    const titles = ours(res.body.data.items).map((p) => p.title);
    expect(titles).toContain(`${PREFIX} reviewing`);
    expect(titles).not.toContain(`${PREFIX} queued`);
  });

  it('rejects an unknown status label instead of silently returning drafts', async () => {
    const res = await asAdmin('get', '/api/v1/admin/projects?status=Bogus');
    expect(res.status).toBe(422);
  });

  it('searches by member name', async () => {
    await makeProject({ title: `${PREFIX} by member` });

    const res = await asAdmin('get', '/api/v1/admin/projects?member=Admin%20Projects%20member&limit=100');
    expect(res.status).toBe(200);
    expect(ours(res.body.data.items).map((p) => p.title)).toContain(`${PREFIX} by member`);
  });

  it('returns headline counts and the category list', async () => {
    await makeProject({ title: `${PREFIX} urgent`, priority: 'Urgent', category: `${PREFIX}-cat` });

    const res = await asAdmin('get', '/api/v1/admin/projects');
    expect(res.status).toBe(200);
    expect(res.body.data.counts.total).toBeGreaterThan(0);
    expect(res.body.data.counts.urgent).toBeGreaterThan(0);
    expect(res.body.data.categories).toContain(`${PREFIX}-cat`);
  });

  it('flags a project past the review SLA', async () => {
    await makeProject({
      title: `${PREFIX} stale`,
      status: 'SUBMITTED',
      submittedAt: new Date(Date.now() - 10 * 86_400_000),
    });

    const res = await asAdmin('get', '/api/v1/admin/projects');
    expect(res.body.data.counts.slaBreach).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/admin/projects/:id', () => {
  it('returns the review payload with readable history', async () => {
    const project = await makeProject({ title: `${PREFIX} detail` });
    await prisma.projectStatusHistory.create({
      data: { projectId: project.id, fromStatus: 'DRAFT', toStatus: 'SUBMITTED', actorId: memberId, note: 'Submitted' },
    });

    const res = await asAdmin('get', `/api/v1/admin/projects/${project.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe(`${PREFIX} detail`);
    expect(res.body.data).toHaveProperty('timeline');
    expect(res.body.data).toHaveProperty('budget');
    expect(res.body.data.resourceLinks).toEqual([]);

    // Labels, not raw enum values, and a name instead of a bare actor id.
    const entry = res.body.data.history.at(-1);
    expect(entry.from).toBe('Draft');
    expect(entry.to).toBe('Submitted');
    expect(entry.actor).toBe('Admin Projects member');
  });

  it('404s an unknown id', async () => {
    const res = await asAdmin('get', '/api/v1/admin/projects/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('404s a soft-deleted project', async () => {
    const project = await makeProject({ deletedAt: new Date() });
    const res = await asAdmin('get', `/api/v1/admin/projects/${project.id}`);
    expect(res.status).toBe(404);
  });
});

describe('project decisions', () => {
  it('approves, recording history, audit and a member notification', async () => {
    const project = await makeProject({ status: 'SUBMITTED' });

    const res = await asAdmin('post', `/api/v1/admin/projects/${project.id}/approve`).send({
      reviewNotes: 'Strong methodology, approved for the next cycle.',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.to).toBe('Approved');

    const stored = await prisma.project.findUnique({ where: { id: project.id } });
    expect(stored?.status).toBe('APPROVED');

    const history = await prisma.projectStatusHistory.findFirst({
      where: { projectId: project.id, toStatus: 'APPROVED' },
    });
    expect(history?.fromStatus).toBe('SUBMITTED');
    expect(history?.actorId).toBe(adminId);

    const audit = await prisma.auditLog.findFirst({
      where: { actorId: adminId, action: 'ProjectStatusChanged' },
    });
    expect(audit?.severity).toBe('SUCCESS');

    const note = await prisma.notification.findFirst({ where: { userId: memberId, type: 'project' } });
    expect(note?.link).toBe('/dashboard/projects');
    expect(note?.body).toContain('Strong methodology');
  });

  it('refuses a rejection with no review notes', async () => {
    const project = await makeProject({ status: 'SUBMITTED' });

    const res = await asAdmin('post', `/api/v1/admin/projects/${project.id}/reject`).send({});
    expect(res.status).toBe(422);

    const stored = await prisma.project.findUnique({ where: { id: project.id } });
    expect(stored?.status).toBe('SUBMITTED');
    expect(await prisma.notification.count({ where: { userId: memberId } })).toBe(0);
  });

  it('refuses a rejection whose notes are too short', async () => {
    const project = await makeProject({ status: 'SUBMITTED' });

    const res = await asAdmin('post', `/api/v1/admin/projects/${project.id}/reject`).send({ reviewNotes: 'no' });
    expect(res.status).toBe(422);
    expect((await prisma.project.findUnique({ where: { id: project.id } }))?.status).toBe('SUBMITTED');
  });

  it('rejects with notes and notifies the member', async () => {
    const project = await makeProject({ status: 'UNDER_REVIEW' });

    const res = await asAdmin('post', `/api/v1/admin/projects/${project.id}/reject`).send({
      reviewNotes: 'The sample size is too small for the stated conclusions.',
    });
    expect(res.status).toBe(200);

    expect((await prisma.project.findUnique({ where: { id: project.id } }))?.status).toBe('REJECTED');

    const audit = await prisma.auditLog.findFirst({ where: { actorId: adminId, action: 'ProjectStatusChanged' } });
    expect(audit?.severity).toBe('DANGER');

    const note = await prisma.notification.findFirst({ where: { userId: memberId, type: 'project' } });
    expect(note?.body).toContain('sample size');
  });

  it('refuses an invalid transition with 409', async () => {
    const project = await makeProject({ status: 'ARCHIVED' });

    const res = await asAdmin('patch', `/api/v1/admin/projects/${project.id}/status`).send({ status: 'APPROVED' });
    expect(res.status).toBe(409);
    expect((await prisma.project.findUnique({ where: { id: project.id } }))?.status).toBe('ARCHIVED');
  });

  it('moves a submitted project into review', async () => {
    const project = await makeProject({ status: 'SUBMITTED' });

    const res = await asAdmin('patch', `/api/v1/admin/projects/${project.id}/status`).send({ status: 'UNDER_REVIEW' });
    expect(res.status).toBe(200);
    expect((await prisma.project.findUnique({ where: { id: project.id } }))?.status).toBe('UNDER_REVIEW');
  });

  it('refuses a rejection through the status route without notes', async () => {
    const project = await makeProject({ status: 'SUBMITTED' });

    const res = await asAdmin('patch', `/api/v1/admin/projects/${project.id}/status`).send({ status: 'REJECTED' });
    expect(res.status).toBe(422);
    expect((await prisma.project.findUnique({ where: { id: project.id } }))?.status).toBe('SUBMITTED');
  });

  it('refuses a decision from a MEMBER', async () => {
    const project = await makeProject({ status: 'SUBMITTED' });

    const res = await request(app)
      .post(`/api/v1/admin/projects/${project.id}/approve`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({});
    expect(res.status).toBe(403);
    expect((await prisma.project.findUnique({ where: { id: project.id } }))?.status).toBe('SUBMITTED');
  });
});
