/**
 * The report catalog.
 *
 * Deliberately code rather than rows in `ReportDefinition`: a report is a query,
 * and a row in a table cannot execute one. `ReportDefinition`/`ReportRun` remain
 * the execution log, upserted from this registry when a report is run.
 *
 * Each spec supplies `rows()` for the viewer and CSV export, and `measure()` for
 * the tile headline. `measure` returns a display `label` *and* a numeric `value`
 * kept separately, because the trend chip is computed by re-running `measure`
 * over the preceding window of equal length — a percentage cannot be derived
 * from a string like "EUR 12,400 approved".
 */
import { prisma } from '../config/database';

export interface ReportRange {
  from: Date;
  to: Date;
}

export interface ReportColumn {
  key: string;
  label: string;
}

export type ReportRow = Record<string, string | number | null>;

/** How to read a change in `measure().value`. */
type Direction = 'higher-better' | 'lower-better';
/** How to render the delta between two windows. */
type DeltaUnit = 'percent' | 'days' | 'points';

export interface ReportSpec {
  key: string;
  title: string;
  category: 'Membership' | 'Publications' | 'Support' | 'Engagement' | 'Platform' | 'Finance';
  description: string;
  cadence: 'Monthly' | 'Weekly' | 'Quarterly' | 'On-demand' | 'Real-time';
  format: 'PDF' | 'XLSX' | 'Both';
  recipient: string;
  columns: ReportColumn[];
  rows(range: ReportRange): Promise<ReportRow[]>;
  measure(range: ReportRange): Promise<{ value: number; label: string }>;
  direction: Direction;
  delta: DeltaUnit;
}

/** SLA the publication queue is measured against, mirrored by the review-sla report. */
export const PUBLICATION_SLA_DAYS = 10;

const DAY = 86_400_000;
const within = (from: Date, to: Date) => ({ gte: from, lte: to });
const iso = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : null);
const daysBetween = (start: Date, end: Date) => (end.getTime() - start.getTime()) / DAY;
const round1 = (value: number) => Math.round(value * 10) / 10;
const mean = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);
const money = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** The window of identical length immediately before `range`, for trend comparison. */
export function previousWindow({ from, to }: ReportRange): ReportRange {
  const span = Math.max(DAY, to.getTime() - from.getTime());
  return { from: new Date(from.getTime() - span), to: new Date(from.getTime() - 1) };
}

/**
 * First reply time for a conversation, in days.
 *
 * "Replied" means a non-internal ADMIN message, matching how support.service
 * already measures first response.
 */
async function firstAdminReplies(conversationIds: string[]) {
  if (!conversationIds.length) return new Map<string, Date>();
  const rows = await prisma.message.findMany({
    where: { conversationId: { in: conversationIds }, internal: false, senderRole: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { conversationId: true, createdAt: true },
  });
  const first = new Map<string, Date>();
  for (const row of rows) if (!first.has(row.conversationId)) first.set(row.conversationId, row.createdAt);
  return first;
}

export const REPORTS: ReportSpec[] = [
  {
    key: 'membership-monthly',
    title: 'Membership Monthly Review',
    category: 'Membership',
    description: 'Applications received, approval/rejection counts, member ID issuance, geographic cohort distribution, credential verification statistics, and cohort retention.',
    cadence: 'Monthly',
    format: 'Both',
    recipient: 'CRO + SAB',
    direction: 'higher-better',
    delta: 'percent',
    columns: [
      { key: 'applicationCode', label: 'Application' },
      { key: 'name', label: 'Applicant' },
      { key: 'email', label: 'Email' },
      { key: 'country', label: 'Country' },
      { key: 'profession', label: 'Profession' },
      { key: 'status', label: 'Status' },
      { key: 'submittedAt', label: 'Submitted' },
      { key: 'reviewedAt', label: 'Reviewed' },
      { key: 'decisionDays', label: 'Days to decision' },
    ],
    async rows({ from, to }) {
      const applications = await prisma.membershipApplication.findMany({
        where: { submittedAt: within(from, to) },
        orderBy: { submittedAt: 'desc' },
        select: {
          applicationCode: true, status: true, submittedAt: true, reviewedAt: true,
          user: { select: { fullName: true, email: true } },
          profile: { select: { country: true, professionalType: true } },
        },
      });
      return applications.map(row => ({
        applicationCode: row.applicationCode,
        name: row.user.fullName,
        email: row.user.email,
        country: row.profile?.country ?? null,
        profession: row.profile?.professionalType ?? null,
        status: row.status,
        submittedAt: iso(row.submittedAt),
        reviewedAt: iso(row.reviewedAt),
        decisionDays: row.reviewedAt ? round1(daysBetween(row.submittedAt, row.reviewedAt)) : null,
      }));
    },
    async measure({ from, to }) {
      const approved = await prisma.membershipApplication.count({ where: { status: 'APPROVED', reviewedAt: within(from, to) } });
      return { value: approved, label: `${approved.toLocaleString()} new member${approved === 1 ? '' : 's'}` };
    },
  },

  {
    key: 'review-sla',
    title: 'Review SLA Performance',
    category: 'Publications',
    description: 'SLA compliance for publication review, project review, and support queues. 25/50/75 percentile review times, reviewer backlog, per-category breaching items.',
    cadence: 'Weekly',
    format: 'XLSX',
    recipient: 'CRO Office',
    direction: 'lower-better',
    delta: 'days',
    columns: [
      { key: 'title', label: 'Publication' },
      { key: 'author', label: 'Author' },
      { key: 'category', label: 'Category' },
      { key: 'status', label: 'Status' },
      { key: 'submittedAt', label: 'Submitted' },
      { key: 'decidedAt', label: 'Decided' },
      { key: 'reviewDays', label: 'Review days' },
      { key: 'breachedSla', label: 'Over SLA' },
    ],
    async rows({ from, to }) {
      const publications = await prisma.publication.findMany({
        where: { submittedAt: within(from, to) },
        orderBy: { submittedAt: 'desc' },
        select: {
          title: true, category: true, status: true, submittedAt: true, approvedAt: true, publishedAt: true,
          author: { select: { fullName: true } },
        },
      });
      const now = new Date();
      return publications.map(row => {
        const decided = row.approvedAt ?? row.publishedAt;
        const elapsed = row.submittedAt ? daysBetween(row.submittedAt, decided ?? now) : null;
        return {
          title: row.title,
          author: row.author?.fullName ?? null,
          category: row.category,
          status: row.status,
          submittedAt: iso(row.submittedAt),
          decidedAt: iso(decided),
          reviewDays: elapsed === null ? null : round1(elapsed),
          // Still-open items count against the SLA the moment they pass it.
          breachedSla: elapsed !== null && elapsed > PUBLICATION_SLA_DAYS ? 'Yes' : 'No',
        };
      });
    },
    async measure({ from, to }) {
      const publications = await prisma.publication.findMany({
        where: { submittedAt: within(from, to) },
        select: { submittedAt: true, approvedAt: true, publishedAt: true },
      });
      const now = new Date();
      const spans = publications
        .filter(row => row.submittedAt)
        .map(row => daysBetween(row.submittedAt!, row.approvedAt ?? row.publishedAt ?? now));
      const average = round1(mean(spans));
      return { value: average, label: `Avg. ${average} days (pub)` };
    },
  },

  {
    key: 'funding',
    title: 'Funding & Support Disbursement',
    category: 'Finance',
    description: 'All funding approvals by project, by category, by cohort. Official endorsement counts, moral support pairings opened/closed. Budget utilization per grant line.',
    cadence: 'Quarterly',
    format: 'Both',
    recipient: 'CRO + Finance Board',
    direction: 'higher-better',
    delta: 'percent',
    columns: [
      { key: 'subject', label: 'Request' },
      { key: 'requester', label: 'Requester' },
      { key: 'status', label: 'Status' },
      { key: 'currency', label: 'Currency' },
      { key: 'amount', label: 'Amount' },
      { key: 'decidedAt', label: 'Decided' },
    ],
    async rows({ from, to }) {
      const requests = await prisma.supportRequest.findMany({
        where: { status: { in: ['APPROVED', 'COMPLETED'] }, updatedAt: within(from, to) },
        orderBy: { updatedAt: 'desc' },
        select: {
          subject: true, status: true, requestedAmount: true, currency: true, updatedAt: true,
          requester: { select: { fullName: true } },
        },
      });
      return requests.map(row => ({
        subject: row.subject,
        requester: row.requester?.fullName ?? null,
        status: row.status,
        currency: row.currency ?? null,
        amount: row.requestedAmount === null ? null : Number(row.requestedAmount),
        decidedAt: iso(row.updatedAt),
      }));
    },
    async measure({ from, to }) {
      const requests = await prisma.supportRequest.findMany({
        where: { status: { in: ['APPROVED', 'COMPLETED'] }, updatedAt: within(from, to) },
        select: { requestedAmount: true, currency: true },
      });
      // Currencies are never added together — a mixed total would be meaningless.
      const totals = new Map<string, number>();
      for (const row of requests) {
        if (row.requestedAmount === null) continue;
        const key = row.currency?.trim() || 'Unspecified';
        totals.set(key, (totals.get(key) ?? 0) + Number(row.requestedAmount));
      }
      const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
      const label = entries.length === 0
        ? `${requests.length.toLocaleString()} approved`
        : entries.length === 1
          ? `${entries[0]![0]} ${money(entries[0]![1])} approved`
          : `${entries[0]![0]} ${money(entries[0]![1])} +${entries.length - 1} cur.`;
      // Count, not amount, is the trendable figure: it is currency-independent.
      return { value: requests.length, label };
    },
  },

  {
    key: 'support',
    title: 'Support Request Case Report',
    category: 'Support',
    description: 'All support tickets by category, time-to-first-response, time-to-approve, top requester segments, approval/rejection ratios, linked publications.',
    cadence: 'Monthly',
    format: 'Both',
    recipient: 'CRO Office',
    direction: 'lower-better',
    delta: 'days',
    columns: [
      { key: 'subject', label: 'Request' },
      { key: 'requester', label: 'Requester' },
      { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Opened' },
      { key: 'firstResponseDays', label: 'Days to first response' },
    ],
    async rows({ from, to }) {
      const requests = await prisma.supportRequest.findMany({
        where: { createdAt: within(from, to) },
        orderBy: { createdAt: 'desc' },
        select: {
          subject: true, priority: true, status: true, createdAt: true,
          requester: { select: { fullName: true } },
          histories: { orderBy: { createdAt: 'asc' }, take: 1, select: { createdAt: true, toStatus: true } },
        },
      });
      return requests.map(row => {
        // The seeded opening history shares the request's timestamp; a real
        // response is the first transition that lands after it.
        const responded = row.histories.find(h => h.createdAt.getTime() > row.createdAt.getTime());
        return {
          subject: row.subject,
          requester: row.requester?.fullName ?? null,
          priority: row.priority,
          status: row.status,
          createdAt: iso(row.createdAt),
          firstResponseDays: responded ? round1(daysBetween(row.createdAt, responded.createdAt)) : null,
        };
      });
    },
    async measure({ from, to }) {
      const requests = await prisma.supportRequest.findMany({
        where: { createdAt: within(from, to) },
        select: { createdAt: true, histories: { orderBy: { createdAt: 'asc' }, select: { createdAt: true } } },
      });
      const spans: number[] = [];
      for (const row of requests) {
        const responded = row.histories.find(h => h.createdAt.getTime() > row.createdAt.getTime());
        if (responded) spans.push(daysBetween(row.createdAt, responded.createdAt));
      }
      const average = round1(mean(spans));
      return { value: average, label: `Avg. ${average} days response` };
    },
  },

  {
    key: 'engagement',
    title: 'Platform Engagement Dashboard',
    category: 'Engagement',
    description: 'Active member DAU/MAU, document views, message reply ratios, publication read-through, event attendance, community threads opened.',
    cadence: 'Weekly',
    format: 'PDF',
    recipient: 'CRO Office + Comms',
    direction: 'higher-better',
    delta: 'percent',
    columns: [
      { key: 'name', label: 'Member' },
      { key: 'email', label: 'Email' },
      { key: 'country', label: 'Country' },
      { key: 'lastLoginAt', label: 'Last sign-in' },
      { key: 'threads', label: 'Discussions started' },
      { key: 'publications', label: 'Publications' },
    ],
    async rows({ from, to }) {
      const members = await prisma.user.findMany({
        where: { role: 'MEMBER', status: 'ACTIVE', deletedAt: null, lastLoginAt: within(from, to) },
        orderBy: { lastLoginAt: 'desc' },
        select: {
          fullName: true, email: true, lastLoginAt: true,
          memberProfile: { select: { country: true } },
          _count: { select: { discussionThreads: true, publications: true } },
        },
      });
      return members.map(row => ({
        name: row.fullName,
        email: row.email,
        country: row.memberProfile?.country ?? null,
        lastLoginAt: iso(row.lastLoginAt),
        threads: row._count.discussionThreads,
        publications: row._count.publications,
      }));
    },
    async measure({ from, to }) {
      const [active, total] = await Promise.all([
        prisma.user.count({ where: { role: 'MEMBER', status: 'ACTIVE', deletedAt: null, lastLoginAt: within(from, to) } }),
        prisma.user.count({ where: { role: 'MEMBER', status: 'ACTIVE', deletedAt: null } }),
      ]);
      const share = total ? Math.round((active / total) * 100) : 0;
      return { value: active, label: `MAU ${active.toLocaleString()} (${share}%)` };
    },
  },

  {
    key: 'content',
    title: 'Publications Impact Report',
    category: 'Publications',
    description: 'Publications approved vs. published, public views, external backlinks, citation counts, top downloaded PDFs, subject area performance.',
    cadence: 'Quarterly',
    format: 'Both',
    recipient: 'SAB',
    direction: 'higher-better',
    delta: 'percent',
    columns: [
      { key: 'title', label: 'Publication' },
      { key: 'author', label: 'Author' },
      { key: 'category', label: 'Category' },
      { key: 'publishedAt', label: 'Published' },
      { key: 'viewsInRange', label: 'Views in range' },
      { key: 'totalViews', label: 'Total views' },
      { key: 'downloads', label: 'Downloads' },
    ],
    async rows({ from, to }) {
      const publications = await prisma.publication.findMany({
        where: { status: 'PUBLISHED', publishedAt: within(from, to) },
        orderBy: { viewCount: 'desc' },
        select: {
          id: true, title: true, category: true, publishedAt: true, viewCount: true, downloadCount: true,
          author: { select: { fullName: true } },
          _count: { select: { views: { where: { viewedAt: within(from, to) } } } },
        },
      });
      return publications.map(row => ({
        title: row.title,
        author: row.author?.fullName ?? null,
        category: row.category,
        publishedAt: iso(row.publishedAt),
        viewsInRange: row._count.views,
        totalViews: row.viewCount,
        downloads: row.downloadCount,
      }));
    },
    async measure({ from, to }) {
      const views = await prisma.publicationView.count({
        where: { viewedAt: within(from, to), publication: { status: 'PUBLISHED' } },
      });
      return { value: views, label: `${views.toLocaleString()} public views` };
    },
  },

  {
    key: 'events',
    title: 'Events & Attendance Report',
    category: 'Engagement',
    description: 'Events created, RSVP pipeline, actual attendance vs capacity, speaker stats, geographic participation for virtual events.',
    cadence: 'Monthly',
    format: 'PDF',
    recipient: 'Events Committee',
    direction: 'higher-better',
    delta: 'percent',
    columns: [
      { key: 'title', label: 'Event' },
      { key: 'date', label: 'Date' },
      { key: 'format', label: 'Format' },
      { key: 'location', label: 'Location' },
      { key: 'status', label: 'Status' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'registrations', label: 'RSVPs' },
    ],
    async rows({ from, to }) {
      const events = await prisma.event.findMany({
        where: { deletedAt: null, date: within(from, to) },
        orderBy: { date: 'desc' },
        select: {
          title: true, date: true, format: true, location: true, status: true, capacity: true,
          _count: { select: { registrations: true } },
        },
      });
      return events.map(row => ({
        title: row.title,
        date: iso(row.date),
        format: row.format,
        location: row.location,
        status: row.status,
        capacity: row.capacity ?? null,
        registrations: row._count.registrations,
      }));
    },
    async measure({ from, to }) {
      const [events, rsvps] = await Promise.all([
        prisma.event.count({ where: { deletedAt: null, date: within(from, to) } }),
        prisma.eventRegistration.count({ where: { event: { deletedAt: null, date: within(from, to) } } }),
      ]);
      return { value: rsvps, label: `${events} event${events === 1 ? '' : 's'}, ${rsvps.toLocaleString()} RSVPs` };
    },
  },

  {
    key: 'messages',
    title: 'Messaging & Inquiries Report',
    category: 'Platform',
    description: 'Inbox response times, escalations to SAB, conversation topics, contact-form inquiries triaged, spam detection rate, public inquiry reply time.',
    cadence: 'Weekly',
    format: 'XLSX',
    recipient: 'CRO Office',
    direction: 'higher-better',
    delta: 'points',
    columns: [
      { key: 'subject', label: 'Conversation' },
      { key: 'category', label: 'Category' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Opened' },
      { key: 'messages', label: 'Messages' },
      { key: 'firstResponseHours', label: 'First response (h)' },
      { key: 'withinSla', label: 'Within 24h' },
    ],
    async rows({ from, to }) {
      const conversations = await prisma.conversation.findMany({
        where: { createdAt: within(from, to) },
        orderBy: { createdAt: 'desc' },
        select: { id: true, subject: true, category: true, status: true, createdAt: true, _count: { select: { messages: true } } },
      });
      const replies = await firstAdminReplies(conversations.map(row => row.id));
      return conversations.map(row => {
        const replied = replies.get(row.id);
        const hours = replied ? round1(daysBetween(row.createdAt, replied) * 24) : null;
        return {
          subject: row.subject,
          category: row.category,
          status: row.status,
          createdAt: iso(row.createdAt),
          messages: row._count.messages,
          firstResponseHours: hours,
          withinSla: hours !== null && hours <= 24 ? 'Yes' : 'No',
        };
      });
    },
    async measure({ from, to }) {
      const conversations = await prisma.conversation.findMany({
        where: { createdAt: within(from, to) },
        select: { id: true, createdAt: true },
      });
      const replies = await firstAdminReplies(conversations.map(row => row.id));
      const inSla = conversations.filter(row => {
        const replied = replies.get(row.id);
        return replied ? daysBetween(row.createdAt, replied) * 24 <= 24 : false;
      }).length;
      const share = conversations.length ? Math.round((inSla / conversations.length) * 100) : 0;
      return { value: share, label: `${share}% response within 24h` };
    },
  },
];

export const reportKeys = REPORTS.map(spec => spec.key);
export const reportByKey = (key: string) => REPORTS.find(spec => spec.key === key);

/** Catalog metadata only — what `ReportDefinition` rows should mirror. */
export const reportDefinitionSeed = REPORTS.map(({ key, title, category, description, cadence, format, recipient }) =>
  ({ key, title, category, description, cadence, format, recipient }));
