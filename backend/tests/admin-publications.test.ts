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
 * Covers the editorial review surface for publications: the filtered queue, the
 * payload the review screen needs, and the publication state machine including
 * the two moves projects have no equivalent of — unpublishing a live paper and
 * resubmitting a rejected one.
 *
 * Fixtures are namespaced by this prefix and removed afterwards, so seeded data
 * is never touched.
 */
const app = createApp();
const PREFIX = 'admin-publications-test';
const email = (n: string) => `${PREFIX}.${n}@example.test`;

let adminToken: string;
let authorId: string;
let authorToken: string;

async function makeUser(key: string, role: 'ADMIN' | 'MEMBER') {
  const user = await prisma.user.create({
    data: {
      email: email(key),
      passwordHash: null,
      fullName: `Admin Publications ${key}`,
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

type PubStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';

async function makePublication(overrides: {
  title?: string;
  status?: PubStatus;
  category?: string;
  venue?: string;
  doi?: string;
  authors?: string;
  views?: number;
  submittedAt?: Date;
  approvedAt?: Date;
  publishedAt?: Date;
} = {}) {
  return prisma.publication.create({
    data: {
      authorId,
      title: overrides.title ?? `${PREFIX} manuscript`,
      abstract: 'A sufficiently long abstract for validation purposes, repeated so it clears the minimum length the submission form enforces.',
      category: overrides.category ?? 'Mental Health',
      researchType: 'Original Research',
      venue: overrides.venue ?? 'IFSMHP Psychology of Well-Being',
      status: overrides.status ?? 'SUBMITTED',
      doi: overrides.doi ?? null,
      authors: overrides.authors ?? 'A. Author',
      viewCount: overrides.views ?? 0,
      submittedAt: overrides.submittedAt ?? new Date(),
      approvedAt: overrides.approvedAt ?? null,
      publishedAt: overrides.publishedAt ?? null,
    },
  });
}

async function wipe() {
  const users = await prisma.user.findMany({ where: { email: { contains: PREFIX } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeAll(wipe);

beforeEach(async () => {
  await wipe();
  const admin = await makeUser('admin', 'ADMIN');
  const author = await makeUser('author', 'MEMBER');
  adminToken = admin.token;
  authorId = author.id;
  authorToken = author.token;
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const asAdmin = (method: 'get' | 'post' | 'patch', url: string) =>
  request(app)[method](url).set('Authorization', `Bearer ${adminToken}`);

/** Only the fixtures this suite created — the DB also holds seeded publications. */
const ours = (rows: { title: string }[]) => rows.filter((r) => r.title.startsWith(PREFIX));

describe('GET /api/v1/admin/publications', () => {
  it('rejects an unauthenticated caller', async () => {
    const response = await request(app).get('/api/v1/admin/publications');
    expect(response.status).toBe(401);
  });

  it('refuses a MEMBER with 403', async () => {
    const response = await request(app)
      .get('/api/v1/admin/publications')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(response.status).toBe(403);
  });

  it('lists submissions with their author and member id', async () => {
    await makePublication({ title: `${PREFIX} listed` });

    const response = await asAdmin('get', '/api/v1/admin/publications');

    expect(response.status).toBe(200);
    const row = ours(response.body.data.items)[0];
    expect(row.author).toBe('Admin Publications author');
    expect(row.status).toBe('Submitted');
  });

  it('filters by publication status label and counts only the filtered rows', async () => {
    await makePublication({ title: `${PREFIX} alpha`, status: 'SUBMITTED' });
    await makePublication({ title: `${PREFIX} beta`, status: 'PUBLISHED', publishedAt: new Date() });

    const response = await asAdmin('get', '/api/v1/admin/publications?status=Published&member=Admin%20Publications%20author');

    expect(ours(response.body.data.items)).toHaveLength(1);
    expect(response.body.data.items[0].status).toBe('Published');
    expect(response.body.data.pagination.total).toBe(1);
  });

  it('rejects an unknown status label instead of silently returning drafts', async () => {
    const response = await asAdmin('get', '/api/v1/admin/publications?status=Retracted');
    expect(response.status).toBe(422);
  });

  it('narrows to the review queue by tab', async () => {
    await makePublication({ title: `${PREFIX} queued`, status: 'UNDER_REVIEW' });
    await makePublication({ title: `${PREFIX} live`, status: 'PUBLISHED', publishedAt: new Date() });

    const review = await asAdmin('get', '/api/v1/admin/publications?queue=review');
    const titles = ours(review.body.data.items).map((p: { title: string }) => p.title);
    expect(titles).toContain(`${PREFIX} queued`);
    expect(titles).not.toContain(`${PREFIX} live`);
  });

  it('searches publication identifiers — venue and DOI, not just the title', async () => {
    await makePublication({ title: `${PREFIX} findable`, doi: '10.9999/pub.test.001' });
    await makePublication({ title: `${PREFIX} other` });

    const byDoi = await asAdmin('get', '/api/v1/admin/publications?q=10.9999%2Fpub.test.001');
    expect(ours(byDoi.body.data.items)).toHaveLength(1);
    expect(byDoi.body.data.items[0].title).toBe(`${PREFIX} findable`);
  });

  it('reports editorial counts over every row regardless of the active filter', async () => {
    await makePublication({ title: `${PREFIX} one`, status: 'SUBMITTED' });
    await makePublication({ title: `${PREFIX} two`, status: 'PUBLISHED', publishedAt: new Date(), views: 40 });

    const response = await asAdmin('get', '/api/v1/admin/publications?status=Submitted');

    expect(ours(response.body.data.items)).toHaveLength(1);
    const counts = response.body.data.counts;
    expect(counts.inReview).toBeGreaterThanOrEqual(1);
    expect(counts.published).toBeGreaterThanOrEqual(1);
    expect(counts.totalViews).toBeGreaterThanOrEqual(40);
    expect(counts).toHaveProperty('publishedThisMonth');
    expect(counts).toHaveProperty('avgReviewDays');
  });

  it('averages review time from submission to approval', async () => {
    const submittedAt = new Date(Date.now() - 4 * 86_400_000);
    await makePublication({ title: `${PREFIX} decided`, status: 'APPROVED', submittedAt, approvedAt: new Date() });

    const response = await asAdmin('get', '/api/v1/admin/publications');
    expect(response.body.data.counts.avgReviewDays).not.toBeNull();
  });
});

describe('GET /api/v1/admin/publications/:id', () => {
  it('returns the review payload with readable history and the author institution', async () => {
    await prisma.memberProfile.create({
      data: { userId: authorId, professionalType: 'Research Scholar / Scientist', institution: `${PREFIX} Institute` },
    });
    const pub = await makePublication({ title: `${PREFIX} detail` });
    await asAdmin('patch', `/api/v1/admin/publications/${pub.id}/status`).send({ status: 'UNDER_REVIEW', comment: 'Assigned to the panel.' });

    const response = await asAdmin('get', `/api/v1/admin/publications/${pub.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.institution).toBe(`${PREFIX} Institute`);
    // Readable labels and an actor name, not raw enum values and an id.
    expect(response.body.data.history.at(-1)).toMatchObject({
      from: 'Submitted',
      to: 'Under Review',
      actor: 'Admin Publications admin',
    });
    expect(response.body.data.reviews[0].decision).toBe('Under Review');
  });

  it('404s an unknown id', async () => {
    const response = await asAdmin('get', '/api/v1/admin/publications/does-not-exist');
    expect(response.status).toBe(404);
  });

  it('refuses a MEMBER with 403', async () => {
    const pub = await makePublication();
    const response = await request(app)
      .get(`/api/v1/admin/publications/${pub.id}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(response.status).toBe(403);
  });
});

describe('the publication review workflow', () => {
  it('runs submitted → under review → approved → published, notifying the author', async () => {
    const pub = await makePublication({ title: `${PREFIX} workflow` });

    const started = await asAdmin('patch', `/api/v1/admin/publications/${pub.id}/status`).send({ status: 'UNDER_REVIEW' });
    expect(started.status).toBe(200);

    const approved = await asAdmin('post', `/api/v1/admin/publications/${pub.id}/approve`).send({ comment: 'Methods are sound.' });
    expect(approved.status).toBe(200);

    const published = await asAdmin('post', `/api/v1/admin/publications/${pub.id}/publish`).send({});
    expect(published.status).toBe(200);
    // Publishing mints the slug the public research page resolves by.
    expect(published.body.data.slug).toBeTruthy();

    const stored = await prisma.publication.findUniqueOrThrow({
      where: { id: pub.id },
      include: { histories: true, reviews: true },
    });
    expect(stored.status).toBe('PUBLISHED');
    expect(stored.approvedAt).not.toBeNull();
    expect(stored.publishedAt).not.toBeNull();
    expect(stored.histories).toHaveLength(3);
    // Each decision leaves a PublicationReview row — the publication module's
    // own review record, which projects have no analogue for.
    expect(stored.reviews).toHaveLength(3);

    const notifications = await prisma.notification.findMany({ where: { userId: authorId } });
    expect(notifications).toHaveLength(3);
    expect(notifications.every((n) => n.type === 'publication')).toBe(true);
    expect(notifications.every((n) => n.link === '/dashboard/publications')).toBe(true);
  });

  it('approves straight from submitted without a separate review step', async () => {
    const pub = await makePublication();
    const response = await asAdmin('post', `/api/v1/admin/publications/${pub.id}/approve`).send({});
    expect(response.status).toBe(200);
    expect((await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } })).status).toBe('APPROVED');
  });

  it('unpublishes a live paper back to approved', async () => {
    const pub = await makePublication({ status: 'PUBLISHED', publishedAt: new Date() });

    const response = await asAdmin('post', `/api/v1/admin/publications/${pub.id}/unpublish`).send({ comment: 'Pulled pending correction.' });

    expect(response.status).toBe(200);
    expect((await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } })).status).toBe('APPROVED');
  });

  it('lets a rejected manuscript be resubmitted', async () => {
    const pub = await makePublication({ status: 'REJECTED' });
    const response = await asAdmin('patch', `/api/v1/admin/publications/${pub.id}/status`).send({ status: 'SUBMITTED' });
    expect(response.status).toBe(200);
  });

  it('refuses a rejection with no reviewer notes', async () => {
    const pub = await makePublication();
    const response = await asAdmin('post', `/api/v1/admin/publications/${pub.id}/reject`).send({});
    expect(response.status).toBe(422);
    expect((await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } })).status).toBe('SUBMITTED');
  });

  it('refuses a rejection whose notes are too short', async () => {
    const pub = await makePublication();
    const response = await asAdmin('post', `/api/v1/admin/publications/${pub.id}/reject`).send({ comment: 'no' });
    expect(response.status).toBe(422);
  });

  it('refuses a short rejection through the status route too', async () => {
    const pub = await makePublication();
    const response = await asAdmin('patch', `/api/v1/admin/publications/${pub.id}/status`).send({ status: 'REJECTED', comment: 'no' });
    expect(response.status).toBe(422);
  });

  it('rejects with notes, and the author sees the reason on their own page', async () => {
    const pub = await makePublication({ title: `${PREFIX} rejected` });

    const response = await asAdmin('post', `/api/v1/admin/publications/${pub.id}/reject`)
      .send({ comment: 'Add the sample size and the ethics approval number before resubmitting.' });
    expect(response.status).toBe(200);

    const mine = await request(app)
      .get('/api/v1/members/me/publications')
      .set('Authorization', `Bearer ${authorToken}`);
    const row = mine.body.data.items.find((p: { id: string }) => p.id === pub.id);
    expect(row.status).toBe('Rejected');
    expect(row.decisionNote.comment).toContain('ethics approval number');
    expect(row.decisionNote.decision).toBe('Rejected');
  });

  it('refuses an illegal transition with 409', async () => {
    const pub = await makePublication({ status: 'SUBMITTED' });
    const response = await asAdmin('post', `/api/v1/admin/publications/${pub.id}/publish`).send({});
    expect(response.status).toBe(409);
  });

  it('refuses a decision from a MEMBER', async () => {
    const pub = await makePublication();
    const response = await request(app)
      .post(`/api/v1/admin/publications/${pub.id}/approve`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({});
    expect(response.status).toBe(403);
  });
});
