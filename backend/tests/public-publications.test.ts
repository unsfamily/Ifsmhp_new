import fs from 'node:fs';
import path from 'node:path';
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
import { uploadRoot } from '../utils/fileStorage';
import { sha256, signAccessToken } from '../utils/security';

/**
 * The public research surface, exercised the way an anonymous visitor hits it —
 * no Authorization header anywhere except the regression checks at the end.
 *
 * The manuscript route is the only path in the API that serves bytes without a
 * token, so the tests that matter most here are the negative ones: an
 * unpublished paper, and the authenticated route staying shut.
 */
const app = createApp();
const PREFIX = 'public-pubs-test';
const email = (n: string) => `${PREFIX}.${n}@example.test`;

const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

let authorId: string;
let authorToken: string;
let strangerToken: string;
const storageKeys: string[] = [];

async function makeUser(key: string) {
  const user = await prisma.user.create({
    data: { email: email(key), passwordHash: null, fullName: `Public Pubs ${key}`, role: 'MEMBER', status: 'ACTIVE' },
  });
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(`${PREFIX}-${user.id}-${Date.now()}-${Math.random()}`),
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return { id: user.id, token: signAccessToken({ sub: user.id, sessionId: session.id, role: 'MEMBER' }) };
}

/** Writes real bytes to the upload root so the stream has something to read. */
async function makeFile(name: string) {
  const storageKey = `${PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
  fs.writeFileSync(path.join(uploadRoot, storageKey), pdf);
  storageKeys.push(storageKey);
  return prisma.fileObject.create({
    data: {
      uploaderId: authorId,
      storageKey,
      originalName: name,
      mimeType: 'application/pdf',
      sizeBytes: pdf.length,
      // Deliberately PRIVATE: publishing the paper is what grants public access,
      // not the file's own visibility flag.
      visibility: 'PRIVATE',
    },
  });
}

type PubStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';

async function makePublication(opts: {
  title?: string;
  status?: PubStatus;
  slug?: string | null;
  fullText?: string | null;
  doi?: string | null;
  manuscript?: boolean;
  supplementary?: boolean;
} = {}) {
  const files: { fileId: string; kind: string }[] = [];
  if (opts.manuscript) files.push({ fileId: (await makeFile(`${PREFIX}-manuscript.pdf`)).id, kind: 'MANUSCRIPT' });
  if (opts.supplementary) files.push({ fileId: (await makeFile(`${PREFIX}-extra.pdf`)).id, kind: 'SUPPLEMENTARY' });

  return prisma.publication.create({
    data: {
      authorId,
      title: opts.title ?? `${PREFIX} paper`,
      abstract: 'A public abstract, long enough to look like the real thing on a research card.',
      fullText: opts.fullText ?? null,
      category: 'Mental Health',
      researchType: 'Original Research',
      status: opts.status ?? 'PUBLISHED',
      slug: opts.slug === undefined ? `${PREFIX}-slug-${Math.random().toString(36).slice(2, 8)}` : opts.slug,
      doi: opts.doi ?? null,
      publishedAt: (opts.status ?? 'PUBLISHED') === 'PUBLISHED' ? new Date() : null,
      submittedAt: new Date(),
      ...(files.length ? { files: { create: files } } : {}),
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
  await prisma.fileObject.deleteMany({ where: { storageKey: { startsWith: PREFIX } } });
  for (const key of storageKeys.splice(0)) {
    fs.rmSync(path.join(uploadRoot, key), { force: true });
  }
}

beforeAll(wipe);

beforeEach(async () => {
  await wipe();
  const author = await makeUser('author');
  const stranger = await makeUser('stranger');
  authorId = author.id;
  authorToken = author.token;
  strangerToken = stranger.token;
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

/** Only this suite's fixtures — the database also holds seeded publications. */
const ours = (rows: { title: string }[]) => rows.filter((r) => r.title.startsWith(PREFIX));

describe('GET /api/v1/public/publications (anonymous)', () => {
  it('lists only published papers', async () => {
    await makePublication({ title: `${PREFIX} live`, status: 'PUBLISHED' });
    await makePublication({ title: `${PREFIX} queued`, status: 'SUBMITTED' });

    const response = await request(app).get('/api/v1/public/publications');

    expect(response.status).toBe(200);
    const titles = ours(response.body.data.items).map((p: { title: string }) => p.title);
    expect(titles).toContain(`${PREFIX} live`);
    expect(titles).not.toContain(`${PREFIX} queued`);
  });

  it('does not ship the full text to the listing', async () => {
    await makePublication({ title: `${PREFIX} heavy`, fullText: 'The entire body of the paper.' });

    const response = await request(app).get('/api/v1/public/publications');
    const row = ours(response.body.data.items)[0];

    // A LongText column on every card, for a view that only renders the abstract.
    expect(row).not.toHaveProperty('fullText');
    expect(row.abstract).toBeTruthy();
  });

  it('reports whether a manuscript is attached', async () => {
    await makePublication({ title: `${PREFIX} with-file`, manuscript: true });
    await makePublication({ title: `${PREFIX} without` });

    const rows = ours((await request(app).get('/api/v1/public/publications')).body.data.items);
    const byTitle = Object.fromEntries(rows.map((r: { title: string; hasManuscript: boolean }) => [r.title, r.hasManuscript]));

    expect(byTitle[`${PREFIX} with-file`]).toBe(true);
    expect(byTitle[`${PREFIX} without`]).toBe(false);
  });

  it('does not count a supplementary file as the manuscript', async () => {
    await makePublication({ title: `${PREFIX} extras-only`, supplementary: true });

    const row = ours((await request(app).get('/api/v1/public/publications')).body.data.items)[0];
    expect(row.hasManuscript).toBe(false);
  });
});

describe('GET /api/v1/public/publications/:slugOrId (anonymous)', () => {
  it('resolves by slug and by id, and counts the view', async () => {
    const pub = await makePublication({ slug: `${PREFIX}-readable`, fullText: 'Body text.' });

    const bySlug = await request(app).get(`/api/v1/public/publications/${PREFIX}-readable`);
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.data.publication.fullText).toBe('Body text.');

    const byId = await request(app).get(`/api/v1/public/publications/${pub.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.data.publication.id).toBe(pub.id);

    const stored = await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } });
    expect(stored.viewCount).toBeGreaterThan(0);
  });

  it('gives the manuscript a URL the caller can actually follow', async () => {
    const pub = await makePublication({ slug: `${PREFIX}-linked`, manuscript: true, supplementary: true });

    const response = await request(app).get(`/api/v1/public/publications/${pub.id}`);
    const files = response.body.data.publication.files;

    const manuscript = files.find((f: { kind: string }) => f.kind === 'MANUSCRIPT');
    expect(manuscript.url).toBe(`/public/publications/${PREFIX}-linked/file`);
    // The raw FileObject id only addresses the authenticated route, so it is
    // no longer handed to anonymous callers.
    expect(manuscript).not.toHaveProperty('id');
    // Supplementary material has no public route of its own.
    expect(files.find((f: { kind: string }) => f.kind === 'SUPPLEMENTARY').url).toBeNull();
  });

  it('404s an unpublished paper', async () => {
    const pub = await makePublication({ status: 'SUBMITTED' });
    const response = await request(app).get(`/api/v1/public/publications/${pub.id}`);
    expect(response.status).toBe(404);
  });
});

describe('GET /api/v1/public/publications/:slugOrId/file (anonymous)', () => {
  it('serves the manuscript with no token at all', async () => {
    const pub = await makePublication({ slug: `${PREFIX}-open`, manuscript: true });

    const response = await request(app).get(`/api/v1/public/publications/${PREFIX}-open/file`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.body.length).toBe(pdf.length);

    const stored = await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } });
    expect(stored.downloadCount).toBe(1);
  });

  it('renders inline when asked, for reading in the browser', async () => {
    await makePublication({ slug: `${PREFIX}-inline`, manuscript: true });

    const response = await request(app).get(`/api/v1/public/publications/${PREFIX}-inline/file?inline=1`);

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('inline');
  });

  it('serves it even though the file itself is PRIVATE', async () => {
    const pub = await makePublication({ slug: `${PREFIX}-private-file`, manuscript: true });
    const link = await prisma.publicationFile.findFirstOrThrow({ where: { publicationId: pub.id }, include: { file: true } });

    // Publishing granted the access, not the visibility flag.
    expect(link.file.visibility).toBe('PRIVATE');
    expect((await request(app).get(`/api/v1/public/publications/${PREFIX}-private-file/file`)).status).toBe(200);
  });

  it('404s an unpublished paper rather than revealing it exists', async () => {
    await makePublication({ slug: `${PREFIX}-hidden`, status: 'SUBMITTED', manuscript: true });

    const response = await request(app).get(`/api/v1/public/publications/${PREFIX}-hidden/file`);

    // Identical to the response for a slug that was never used at all.
    expect(response.status).toBe(404);
    const unknown = await request(app).get(`/api/v1/public/publications/${PREFIX}-no-such-paper/file`);
    expect(response.body.message).toBe(unknown.body.message);
  });

  it('404s a published paper that has no manuscript, while its detail still resolves', async () => {
    await makePublication({ slug: `${PREFIX}-textonly`, fullText: 'Read me here instead.' });

    expect((await request(app).get(`/api/v1/public/publications/${PREFIX}-textonly/file`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/public/publications/${PREFIX}-textonly`)).status).toBe(200);
  });

  it('does not serve supplementary material', async () => {
    await makePublication({ slug: `${PREFIX}-supp`, supplementary: true });
    expect((await request(app).get(`/api/v1/public/publications/${PREFIX}-supp/file`)).status).toBe(404);
  });
});

describe('the authenticated file route is unchanged', () => {
  it('still refuses an anonymous caller', async () => {
    const pub = await makePublication({ manuscript: true });
    const link = await prisma.publicationFile.findFirstOrThrow({ where: { publicationId: pub.id } });

    const response = await request(app).get(`/api/v1/files/${link.fileId}/download`);

    expect(response.status).toBe(401);
  });

  it('still lets the author through and keeps everyone else out', async () => {
    const pub = await makePublication({ manuscript: true });
    const link = await prisma.publicationFile.findFirstOrThrow({ where: { publicationId: pub.id } });

    const mine = await request(app)
      .get(`/api/v1/files/${link.fileId}/download`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(mine.status).toBe(200);

    const theirs = await request(app)
      .get(`/api/v1/files/${link.fileId}/download`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(theirs.status).toBe(404);
  });
});
