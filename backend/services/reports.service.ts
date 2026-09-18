/**
 * Admin reporting.
 *
 * The catalog lives in `domain/reports.ts`; this module turns it into what the
 * Reports screen needs — headline KPIs, per-report tiles with a trend measured
 * against the preceding window, paginated rows, CSV, and a persisted run log.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResult, toSkipTake, type PaginationQuery } from '../utils/pagination';
import { toCsv, csvFilename, type CsvColumn } from '../utils/csv';
import {
  REPORTS, PUBLICATION_SLA_DAYS, previousWindow, reportByKey, reportDefinitionSeed,
  type ReportRange, type ReportRow, type ReportSpec,
} from '../domain/reports';

const DAY = 86_400_000;
const MINUS = '−'; // U+2212, matching the typography already used on the page.

const dayLabel = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
const shortDay = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' });
const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Duration of a range in whole days, for the "(30d)" suffix on the KPI cards.
 *
 * Floored, not rounded: `to` is an end-of-day bound, so a "last 7 days" window
 * spans 7 days and 23:59:59.999 — rounding would label it "8d" and contradict
 * the period the admin actually picked.
 */
const spanDays = ({ from, to }: ReportRange) => Math.max(1, Math.floor((to.getTime() - from.getTime()) / DAY));

/**
 * The window a request is reporting on.
 *
 * Defaults to the trailing 30 days, matching the page's default period. Bounds
 * arrive already shape-validated (YYYY-MM-DD) from the route.
 */
export function resolveRange(query: { from?: string; to?: string }): ReportRange {
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date();
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : new Date(to.getTime() - 30 * DAY);
  if (from > to) throw ApiError.unprocessable('The start date must fall before the end date', [{ field: 'from', message: 'Start date is after the end date.' }]);
  return { from, to };
}

export const rangeLabel = (range: ReportRange) =>
  `${shortDay(range.from)} ${MINUS} ${shortDay(range.to)}, ${range.to.getUTCFullYear()}`;

/** Formats a change between two windows the way the tile's trend chip reads. */
function trendOf(spec: Pick<ReportSpec, 'direction' | 'delta'>, current: number, previous: number) {
  const diff = current - previous;
  const sign = diff > 0 ? '+' : MINUS;
  const magnitude = Math.abs(diff);

  let trendValue: string;
  if (spec.delta === 'percent') {
    // No baseline means no percentage — say "new" rather than invent an infinity.
    if (previous === 0) trendValue = current === 0 ? 'no change' : 'new';
    else trendValue = `${sign}${Math.round((magnitude / previous) * 100)}%`;
  } else if (spec.delta === 'days') {
    trendValue = `${sign}${round1(magnitude)}d`;
  } else {
    trendValue = `${sign}${round1(magnitude)}%`;
  }

  const flat = spec.delta === 'percent' ? previous !== 0 && Math.round((magnitude / previous) * 100) === 0 : round1(magnitude) === 0;
  if (flat || diff === 0) return { trend: 'flat' as const, trendValue: spec.delta === 'percent' ? 'no change' : `${MINUS}0${spec.delta === 'days' ? 'd' : '%'}` };

  const improved = spec.direction === 'higher-better' ? diff > 0 : diff < 0;
  return { trend: improved ? ('up' as const) : ('down' as const), trendValue };
}

/** When a cadence would next produce this report, given its last run. */
function nextRun(cadence: ReportSpec['cadence'], last: Date | null): string | null {
  if (cadence === 'On-demand' || cadence === 'Real-time') return null;
  const base = last ?? new Date();
  const next = new Date(base);
  if (cadence === 'Weekly') next.setUTCDate(next.getUTCDate() + 7);
  else if (cadence === 'Monthly') next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 3);
  return dayLabel(next);
}

async function lastRunByKey() {
  const rows = await prisma.reportRun.findMany({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, definition: { select: { key: true } } },
  });
  const latest = new Map<string, Date>();
  for (const row of rows) if (!latest.has(row.definition.key)) latest.set(row.definition.key, row.createdAt);
  return latest;
}

/** The four headline cards, each measured over `range` and against the window before it. */
async function kpis(range: ReportRange) {
  const previous = previousWindow(range);
  const window = `${spanDays(range)}d`;
  const activeMembers = { role: 'MEMBER' as const, status: 'ACTIVE' as const, deletedAt: null };

  const concluded: Prisma.SupportRequestWhereInput = { status: { in: ['APPROVED', 'COMPLETED', 'REJECTED'] } };
  const reviewSelect = { submittedAt: true, approvedAt: true, publishedAt: true } as const;

  const [active, totalMembers, activeBefore, inReview, reviewSpans, reviewSpansBefore, published, publishedBefore, views, closed, closedBefore] = await Promise.all([
    prisma.user.count({ where: { ...activeMembers, lastLoginAt: { gte: range.from, lte: range.to } } }),
    prisma.user.count({ where: activeMembers }),
    prisma.user.count({ where: { ...activeMembers, lastLoginAt: { gte: previous.from, lte: previous.to } } }),
    prisma.publication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.publication.findMany({ where: { submittedAt: { gte: range.from, lte: range.to } }, select: reviewSelect }),
    prisma.publication.findMany({ where: { submittedAt: { gte: previous.from, lte: previous.to } }, select: reviewSelect }),
    prisma.publication.count({ where: { status: 'PUBLISHED', publishedAt: { gte: range.from, lte: range.to } } }),
    prisma.publication.count({ where: { status: 'PUBLISHED', publishedAt: { gte: previous.from, lte: previous.to } } }),
    prisma.publicationView.count({ where: { viewedAt: { gte: range.from, lte: range.to } } }),
    prisma.supportRequest.findMany({ where: { ...concluded, updatedAt: { gte: range.from, lte: range.to } }, select: { requiredBy: true, updatedAt: true } }),
    prisma.supportRequest.findMany({ where: { ...concluded, updatedAt: { gte: previous.from, lte: previous.to } }, select: { requiredBy: true, updatedAt: true } }),
  ]);

  const now = new Date();
  const avgDays = (rows: { submittedAt: Date | null; approvedAt: Date | null; publishedAt: Date | null }[]) => {
    const spans = rows.filter(r => r.submittedAt).map(r => ((r.approvedAt ?? r.publishedAt ?? now).getTime() - r.submittedAt!.getTime()) / DAY);
    return round1(spans.length ? spans.reduce((a, b) => a + b, 0) / spans.length : 0);
  };
  const avgReview = avgDays(reviewSpans);
  const share = totalMembers ? Math.round((active / totalMembers) * 1000) / 10 : 0;

  // Compliance is the share of concluded cases closed by their requested-by
  // date; a case with no deadline cannot breach one, so it counts as met.
  const met = (rows: { requiredBy: Date | null; updatedAt: Date }[]) =>
    rows.filter(r => !r.requiredBy || r.updatedAt <= r.requiredBy).length;
  const compliance = closed.length ? Math.round((met(closed) / closed.length) * 1000) / 10 : 0;
  const complianceBefore = closedBefore.length ? (met(closedBefore) / closedBefore.length) * 100 : 0;
  const resolved = met(closed);

  return [
    {
      label: `Active Members (${window})`, value: `${active.toLocaleString()} / ${totalMembers.toLocaleString()}`, sub: `${share}%`,
      ...trendOf({ direction: 'higher-better', delta: 'percent' }, active, activeBefore),
    },
    {
      label: 'Publications In Review', value: inReview.toLocaleString(), sub: `SLA ${avgReview} / ${PUBLICATION_SLA_DAYS}d`,
      ...trendOf({ direction: 'lower-better', delta: 'days' }, avgReview, avgDays(reviewSpansBefore)),
    },
    {
      label: `New Publications (${window})`, value: published.toLocaleString(), sub: `Public views ${views.toLocaleString()}`,
      ...trendOf({ direction: 'higher-better', delta: 'percent' }, published, publishedBefore),
    },
    {
      label: 'Support SLA Compliance', value: `${compliance}%`, sub: `${resolved.toLocaleString()} resolved`,
      ...trendOf({ direction: 'higher-better', delta: 'points' }, compliance, complianceBefore),
    },
  ];
}

/**
 * Real items for the "Reports Requiring CRO Attention" panel; empty when all is
 * well. Deliberately not range-scoped: a backlog is what is outstanding now,
 * not what was outstanding during some past window.
 */
async function attention() {
  const slaCutoff = new Date(Date.now() - PUBLICATION_SLA_DAYS * DAY);
  const [breaching, overdueSupport, stalePending] = await Promise.all([
    prisma.publication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }, submittedAt: { lte: slaCutoff } } }),
    prisma.supportRequest.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] }, requiredBy: { lt: new Date() } } }),
    prisma.membershipApplication.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] }, submittedAt: { lte: new Date(Date.now() - 14 * DAY) } } }),
  ]);

  const items: { when: string; title: string; issue: string; severity: 'warning' | 'danger' | 'default' }[] = [];
  if (breaching) items.push({ when: 'Due today', title: 'Review SLA Performance', issue: `${breaching} publication${breaching === 1 ? '' : 's'} over the ${PUBLICATION_SLA_DAYS}-day SLA threshold`, severity: 'warning' });
  if (overdueSupport) items.push({ when: 'Past due', title: 'Support Request Case Report', issue: `${overdueSupport} support request${overdueSupport === 1 ? '' : 's'} past the requested-by date`, severity: 'danger' });
  if (stalePending) items.push({ when: 'This week', title: 'Membership Monthly Review', issue: `${stalePending} application${stalePending === 1 ? '' : 's'} pending review for over 14 days`, severity: 'default' });
  return items;
}

/** The catalog with live figures — what the Reports page loads. */
export async function reportCatalog(range: ReportRange) {
  const previous = previousWindow(range);
  const [latest, cards, attentionItems] = await Promise.all([lastRunByKey(), kpis(range), attention()]);
  const sample = rangeLabel(range);

  const reports = await Promise.all(REPORTS.map(async spec => {
    const [current, before] = await Promise.all([spec.measure(range), spec.measure(previous)]);
    const last = latest.get(spec.key) ?? null;
    return {
      id: spec.key,
      key: spec.key,
      title: spec.title,
      category: spec.category,
      description: spec.description,
      cadence: spec.cadence,
      format: spec.format,
      recipient: spec.recipient,
      metric: current.label,
      samplePeriod: sample,
      lastRun: last ? dayLabel(last) : undefined,
      nextRun: nextRun(spec.cadence, last) ?? undefined,
      ...trendOf(spec, current.value, before.value),
    };
  }));

  return { range: { from: range.from.toISOString().slice(0, 10), to: range.to.toISOString().slice(0, 10), label: sample }, kpis: cards, reports, attention: attentionItems };
}

function spec(key: string): ReportSpec {
  const found = reportByKey(key);
  // One 404 for "no such report" so the route cannot be probed for the catalog.
  if (!found) throw ApiError.notFound('Report not found');
  return found;
}

/** Paginated rows for the viewer modal. */
export async function reportRows(key: string, range: ReportRange, pagination: PaginationQuery) {
  const found = spec(key);
  const rows = await found.rows(range);
  const { skip, take } = toSkipTake(pagination);
  return {
    key: found.key,
    title: found.title,
    format: found.format,
    samplePeriod: rangeLabel(range),
    columns: found.columns,
    ...buildPaginatedResult(rows.slice(skip, skip + take), rows.length, pagination),
  };
}

/** Generates the CSV body and the name it should download under. */
export async function reportCsv(key: string, range: ReportRange) {
  const found = spec(key);
  const rows = await found.rows(range);
  const columns = found.columns as CsvColumn<ReportRow>[];
  return {
    filename: csvFilename(found.key, range.from.toISOString().slice(0, 10), range.to.toISOString().slice(0, 10)),
    body: toCsv(columns, rows),
    rows: rows.length,
  };
}

/**
 * Executes a report and records the run.
 *
 * The `ReportDefinition` row is upserted from the registry first — it is the
 * FK target for `ReportRun`, and keeping it in step means the catalog table
 * never drifts from the code that actually produces the data.
 */
export async function runReport(key: string, range: ReportRange, actorId: string) {
  const found = spec(key);
  const meta = reportDefinitionSeed.find(entry => entry.key === key)!;
  const rows = await found.rows(range);

  const run = await prisma.$transaction(async tx => {
    const definition = await tx.reportDefinition.upsert({ where: { key }, create: meta, update: meta });
    return tx.reportRun.create({
      data: { definitionId: definition.id, status: 'Generated', rowsJson: rows as unknown as Prisma.InputJsonValue },
      select: { id: true, createdAt: true, status: true },
    });
  });

  await prisma.auditLog.create({
    data: {
      actorId, actorLabel: actorId, actorRole: 'ADMIN', action: 'ReportGenerated',
      entity: `Report ${key}`, severity: 'INFO',
      description: `Generated ${found.title} for ${rangeLabel(range)} (${rows.length} rows).`,
    },
  });

  return { key, runId: run.id, status: run.status, rows: rows.length, lastRun: dayLabel(run.createdAt), nextRun: nextRun(found.cadence, run.createdAt) };
}
