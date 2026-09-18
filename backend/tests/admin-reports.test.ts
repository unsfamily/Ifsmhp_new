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
import { REPORTS } from '../domain/reports';
import { toCsv } from '../utils/csv';

/**
 * Covers admin reporting: the catalog with its live KPIs, per-report rows,
 * CSV export, and the run log. Fixtures are namespaced by this prefix and
 * removed afterwards, so seeded data is never touched — but note the catalog
 * aggregates the WHOLE database, so assertions here check shape, permissions
 * and relative movement rather than absolute totals.
 */
const app = createApp();
const PREFIX = 'admin-reports-test';
const email = (n: string) => `${PREFIX}.${n}@example.test`;
const base = '/api/v1/admin/reports';

let adminToken: string;
let memberToken: string;
let memberId: string;

async function makeUser(key: string, role: 'ADMIN' | 'MEMBER') {
  const user = await prisma.user.create({
    data: { email: email(key), passwordHash: null, fullName: `${PREFIX} ${key}`, role, status: 'ACTIVE', lastLoginAt: new Date() },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, tokenHash: sha256(`${PREFIX}-${user.id}-${Date.now()}-${Math.random()}`), expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return { id: user.id, token: signAccessToken({ sub: user.id, sessionId: session.id, role }) };
}

async function wipe() {
  const users = await prisma.user.findMany({ where: { email: { contains: PREFIX } }, select: { id: true } });
  const ids = users.map(u => u.id);
  const definitions = await prisma.reportDefinition.findMany({ select: { id: true, key: true } });
  await prisma.reportRun.deleteMany({ where: { definitionId: { in: definitions.map(d => d.id) } } });
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.publication.deleteMany({ where: { authorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

const asAdmin = (method: 'get' | 'post', url: string) => request(app)[method](url).set('Authorization', `Bearer ${adminToken}`);

beforeAll(async () => { await wipe(); });
beforeEach(async () => {
  await wipe();
  const admin = await makeUser('admin', 'ADMIN');
  const member = await makeUser('member', 'MEMBER');
  adminToken = admin.token;
  memberToken = member.token;
  memberId = member.id;
});
afterAll(async () => { await wipe(); await prisma.$disconnect(); });

describe('admin reports access control', () => {
  it('rejects anonymous and non-admin callers on every reporting route', async () => {
    const routes: [('get' | 'post'), string][] = [
      ['get', base],
      ['get', `${base}/membership-monthly`],
      ['get', `${base}/membership-monthly/export`],
      ['post', `${base}/membership-monthly/run`],
    ];
    for (const [method, url] of routes) {
      expect((await request(app)[method](url)).status, `${method} ${url} anonymous`).toBe(401);
      expect((await request(app)[method](url).set('Authorization', `Bearer ${memberToken}`)).status, `${method} ${url} as member`).toBe(403);
    }
  });

  it('404s an unknown report key rather than revealing the catalog', async () => {
    expect((await asAdmin('get', `${base}/not-a-report`)).status).toBe(404);
    expect((await asAdmin('get', `${base}/not-a-report/export`)).status).toBe(404);
    expect((await asAdmin('post', `${base}/not-a-report/run`)).status).toBe(404);
  });
});

describe('report catalog', () => {
  it('returns four KPIs and every registered report with a live trend', async () => {
    const response = await asAdmin('get', base);
    expect(response.status).toBe(200);
    const { kpis, reports, range, attention } = response.body.data;

    expect(kpis).toHaveLength(4);
    for (const kpi of kpis) {
      expect(kpi).toMatchObject({ label: expect.any(String), value: expect.any(String), sub: expect.any(String), trendValue: expect.any(String) });
      expect(['up', 'down', 'flat']).toContain(kpi.trend);
    }

    expect(reports.map((r: { key: string }) => r.key).sort()).toEqual(REPORTS.map(s => s.key).sort());
    for (const report of reports) {
      expect(['up', 'down', 'flat']).toContain(report.trend);
      expect(report.metric).toEqual(expect.any(String));
      expect(report.samplePeriod).toEqual(expect.any(String));
    }
    expect(range).toMatchObject({ from: expect.any(String), to: expect.any(String) });
    expect(Array.isArray(attention)).toBe(true);
  });

  it('labels the member KPI with the requested window and defaults to 30 days', async () => {
    const wide = await asAdmin('get', `${base}?from=2020-01-01&to=2020-01-08`);
    expect(wide.body.data.kpis[0].label).toBe('Active Members (7d)');
    const fallback = await asAdmin('get', base);
    expect(fallback.body.data.kpis[0].label).toBe('Active Members (30d)');
  });

  it('rejects a reversed range and a malformed date', async () => {
    expect((await asAdmin('get', `${base}?from=2026-02-01&to=2026-01-01`)).status).toBe(422);
    expect((await asAdmin('get', `${base}?from=01-02-2026`)).status).toBe(422);
  });
});

describe('report rows and date filtering', () => {
  async function publication(title: string, submittedAt: Date) {
    return prisma.publication.create({
      data: {
        authorId: memberId, title: `${PREFIX} ${title}`, abstract: 'Fixture abstract.',
        category: 'Policy', researchType: 'Review', status: 'UNDER_REVIEW', submittedAt,
      },
    });
  }

  it('narrows rows to the requested window', async () => {
    await publication('inside', new Date('2026-03-15T12:00:00Z'));
    await publication('outside', new Date('2026-06-15T12:00:00Z'));

    const inside = await asAdmin('get', `${base}/review-sla?from=2026-03-01&to=2026-03-31&limit=100`);
    expect(inside.status).toBe(200);
    const titles = inside.body.data.items.map((r: { title: string }) => r.title);
    expect(titles).toContain(`${PREFIX} inside`);
    expect(titles).not.toContain(`${PREFIX} outside`);

    const wider = await asAdmin('get', `${base}/review-sla?from=2026-03-01&to=2026-06-30&limit=100`);
    const widerTitles = wider.body.data.items.map((r: { title: string }) => r.title);
    expect(widerTitles).toEqual(expect.arrayContaining([`${PREFIX} inside`, `${PREFIX} outside`]));
  });

  it('paginates against the filtered total and exposes its columns', async () => {
    for (let i = 0; i < 3; i++) await publication(`page-${i}`, new Date('2026-04-10T12:00:00Z'));

    const first = await asAdmin('get', `${base}/review-sla?from=2026-04-01&to=2026-04-30&page=1&limit=2`);
    expect(first.body.data.items).toHaveLength(2);
    expect(first.body.data.pagination).toMatchObject({ page: 1, limit: 2, total: 3, pages: 2 });
    expect(first.body.data.columns.map((c: { key: string }) => c.key)).toContain('reviewDays');

    const second = await asAdmin('get', `${base}/review-sla?from=2026-04-01&to=2026-04-30&page=2&limit=2`);
    expect(second.body.data.items).toHaveLength(1);
  });

  it('serves every registered report without error', async () => {
    for (const spec of REPORTS) {
      const response = await asAdmin('get', `${base}/${spec.key}?limit=5`);
      expect(response.status, `${spec.key} responded ${response.status}`).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.columns.length).toBeGreaterThan(0);
    }
  });
});

describe('CSV export', () => {
  it('streams a CSV attachment rather than the JSON envelope', async () => {
    const response = await asAdmin('get', `${base}/membership-monthly/export?from=2026-01-01&to=2026-12-31`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('membership-monthly-2026-01-01-to-2026-12-31.csv');
    expect(response.text.startsWith('﻿')).toBe(true);
    expect(response.text.split('\r\n')[0]).toContain('Application');
    expect(response.text).not.toContain('"success"');
  });

  it('quotes separators and neutralises spreadsheet formulas', () => {
    const csv = toCsv(
      [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
      [{ a: 'has, comma', b: 'say "hi"' }, { a: 'line\nbreak', b: '=1+1' }, { a: '+44', b: null }],
    );
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('A,B');
    expect(lines[1]).toBe('"has, comma","say ""hi"""');
    // The embedded newline stays inside its quoted field.
    expect(csv).toContain('"line\nbreak"');
    expect(csv).toContain(`'=1+1`);
    // Neutralised but not quoted — an apostrophe needs no quoting of its own.
    // A null renders as an empty field, not the string "null".
    expect(lines.at(-1)).toBe(`'+44,`);
  });
});

describe('running a report', () => {
  it('persists exactly one run, writes an audit entry, and surfaces it as Last Run', async () => {
    const before = await asAdmin('get', base);
    expect(before.body.data.reports.find((r: { key: string }) => r.key === 'events').lastRun).toBeUndefined();

    const run = await asAdmin('post', `${base}/events/run?from=2026-01-01&to=2026-12-31`);
    expect(run.status).toBe(200);
    expect(run.body.data).toMatchObject({ key: 'events', status: 'Generated', rows: expect.any(Number) });

    const definition = await prisma.reportDefinition.findUniqueOrThrow({ where: { key: 'events' }, include: { runs: true } });
    expect(definition.runs).toHaveLength(1);
    expect(definition.category).toBe('Engagement');

    const audits = await prisma.auditLog.count({ where: { action: 'ReportGenerated', entity: 'Report events' } });
    expect(audits).toBe(1);

    const after = await asAdmin('get', base);
    expect(after.body.data.reports.find((r: { key: string }) => r.key === 'events').lastRun).toEqual(expect.any(String));
  });

  it('is not reachable as a GET, so a crawl cannot generate reports', async () => {
    expect((await asAdmin('get', `${base}/events/run`)).status).toBe(404);
  });
});
