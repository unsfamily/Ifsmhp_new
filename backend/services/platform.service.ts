import crypto from 'node:crypto';
import type { Request } from 'express';
import type {
  ApplicationStatus,
  Prisma,
  ProjectStatus,
  PublicationStatus,
  SupportStatus,
} from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResult, type PaginationQuery, toSkipTake } from '../utils/pagination';
import { logger } from '../utils/logger';
import { writeAudit } from './audit.service';
import { sendApprovalEmail } from './mail.service';

const projectStatusLabel: Record<ProjectStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

const supportStatusLabel: Record<SupportStatus, string> = {
  PENDING: 'Open',
  UNDER_REVIEW: 'In Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Closed',
};

const publicationStatusLabel: Record<PublicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PUBLISHED: 'Published',
};

const applicationStatusLabel: Record<ApplicationStatus, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

function daysSince(date: Date | null): number {
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 90);
}

function page(query: Record<string, unknown>): PaginationQuery {
  return {
    page: Math.max(1, Number(query.page ?? 1)),
    limit: Math.max(1, Math.min(100, Number(query.limit ?? 20))),
  };
}

function memberName(user: { fullName: string; memberProfile: { memberId: string | null } | null }) {
  return `${user.fullName}${user.memberProfile?.memberId ? ` (${user.memberProfile.memberId})` : ''}`;
}

export function parsePage(req: Request): PaginationQuery {
  return page(req.query as Record<string, unknown>);
}

export async function publicStats() {
  const [members, countries, publications, views] = await Promise.all([
    prisma.user.count({ where: { role: 'MEMBER', status: 'ACTIVE' } }),
    prisma.memberProfile.findMany({
      where: { user: { role: 'MEMBER', status: 'ACTIVE' }, country: { not: null } },
      select: { country: true },
      distinct: ['country'],
    }),
    prisma.publication.count({ where: { status: 'PUBLISHED' } }),
    prisma.publication.aggregate({ _sum: { viewCount: true }, where: { status: 'PUBLISHED' } }),
  ]);
  const latest = await prisma.publication.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 3,
    select: { title: true, publishedAt: true, slug: true },
  });
  return {
    platform: {
      totalMembers: members,
      countriesRepresented: countries.length,
      publicationsPublished: publications,
      publicLifetimeViews: views._sum.viewCount ?? 0,
    },
    latest,
  };
}

export async function publicPublications(req: Request) {
  const pagination = parsePage(req);
  const q = String(req.query.q ?? req.query.search ?? '').trim();
  const category = String(req.query.category ?? 'All');
  const researchType = String(req.query.researchType ?? 'All');
  const where: Prisma.PublicationWhereInput = {
    status: 'PUBLISHED',
    ...(category && category !== 'All' ? { category } : {}),
    ...(researchType && researchType !== 'All' ? { researchType } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { abstract: { contains: q } },
            { author: { fullName: { contains: q } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.publication.findMany({
      where,
      ...toSkipTake(pagination),
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
      include: { author: { include: { memberProfile: true } } },
    }),
    prisma.publication.count({ where }),
  ]);
  return buildPaginatedResult(
    items.map((p) => ({
      id: p.slug ?? p.id,
      title: p.title,
      author: p.author.fullName,
      memberId: p.author.memberProfile?.memberId ?? '',
      date: p.publishedAt ?? p.createdAt,
      category: p.category,
      researchType: p.researchType,
      abstract: p.abstract,
      fullText: p.fullText,
      views: p.viewCount,
      downloads: p.downloadCount,
      doi: p.doi,
      featured: p.featured,
      slug: p.slug,
    })),
    total,
    pagination,
  );
}

export async function publicPublicationDetail(slugOrId: string, req: Request) {
  const publication = await prisma.publication.findFirst({
    where: { status: 'PUBLISHED', OR: [{ id: slugOrId }, { slug: slugOrId }] },
    include: { author: { include: { memberProfile: true } }, files: { include: { file: true } } },
  });
  if (!publication) throw ApiError.notFound('Publication not found');
  const visitorHash = crypto
    .createHash('sha256')
    .update(`${req.ip}|${req.get('user-agent') ?? ''}|${publication.id}`)
    .digest('hex');
  await prisma.publicationView
    .create({ data: { publicationId: publication.id, visitorHash } })
    .then(() => prisma.publication.update({ where: { id: publication.id }, data: { viewCount: { increment: 1 } } }))
    .catch(() => undefined);
  return {
    id: publication.id,
    slug: publication.slug,
    title: publication.title,
    author: publication.author.fullName,
    memberId: publication.author.memberProfile?.memberId,
    category: publication.category,
    researchType: publication.researchType,
    abstract: publication.abstract,
    fullText: publication.fullText,
    date: publication.publishedAt,
    views: publication.viewCount,
    downloads: publication.downloadCount,
    doi: publication.doi,
    files: publication.files.map((f) => ({
      id: f.fileId,
      kind: f.kind,
      name: f.file.originalName,
      sizeBytes: f.file.sizeBytes,
    })),
  };
}

export async function productReviews(req: Request) {
  const pagination = parsePage(req);
  const category = String(req.query.category ?? 'all');
  const q = String(req.query.q ?? '').trim();
  const where: Prisma.ProductReviewWhereInput = {
    ...(category !== 'all' ? { category } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { summary: { contains: q } }, { author: { contains: q } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.productReview.findMany({ where, ...toSkipTake(pagination), orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }] }),
    prisma.productReview.count({ where }),
  ]);
  return buildPaginatedResult(items, total, pagination);
}

export async function publicEvents(req: Request) {
  const pagination = parsePage(req);
  const q = String(req.query.q ?? '').trim();
  const where: Prisma.EventWhereInput = {
    status: { in: ['PUBLISHED', 'PAST'] },
    audience: { in: ['Public', 'All Members'] },
    ...(q ? { title: { contains: q } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.event.findMany({
      where,
      ...toSkipTake(pagination),
      orderBy: { date: 'asc' },
      include: { speakers: true, tags: true, registrations: true, resources: true },
    }),
    prisma.event.count({ where }),
  ]);
  return buildPaginatedResult(
    items.map((event) => ({
      id: event.slug,
      title: event.title,
      date: event.date,
      time: `${event.timeStart} - ${event.timeEnd} ${event.timezone}`,
      location: event.location,
      type: event.tags[0]?.name ?? 'Event',
      category: event.tags[1]?.name ?? event.format,
      description: event.shortDescription,
      speakers: event.speakers.map((s) => s.name),
      seats: event.capacity,
      status: event.status,
      feedback: event.status === 'PAST' ? 4.8 : undefined,
      takeaways: event.resources.map((r) => r.title),
      attendees: event.registrations.length,
    })),
    total,
    pagination,
  );
}

export async function eventDetail(slugOrId: string) {
  const event = await prisma.event.findFirst({
    where: { OR: [{ id: slugOrId }, { slug: slugOrId }], status: { in: ['PUBLISHED', 'PAST'] } },
    include: { speakers: true, tags: true, registrations: true, resources: true },
  });
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

export async function gallery(req: Request, admin = false) {
  const pagination = parsePage(req);
  const albumKey = String(req.query.album ?? 'all');
  const type = String(req.query.type ?? 'all');
  const q = String(req.query.q ?? '').trim();
  const where: Prisma.GalleryItemWhereInput = {
    ...(admin ? {} : { visibility: 'PUBLIC' }),
    ...(type !== 'all' ? { type } : {}),
    ...(albumKey !== 'all' ? { album: { key: albumKey } } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { caption: { contains: q } }, { location: { contains: q } }] } : {}),
  };
  const [items, total, albums, banners] = await Promise.all([
    prisma.galleryItem.findMany({
      where,
      ...toSkipTake(pagination),
      include: { album: true, tags: true },
      orderBy: { capturedAt: 'desc' },
    }),
    prisma.galleryItem.count({ where }),
    prisma.galleryAlbum.findMany({ include: { _count: { select: { items: true } } } }),
    prisma.galleryBanner.findMany({ include: { album: true } }),
  ]);
  return {
    albums: albums.map((a) => ({ key: a.key, label: a.label, count: a._count.items, coverGradient: a.coverGradient })),
    banners,
    ...buildPaginatedResult(
      items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        caption: item.caption,
        albumKey: item.album.key,
        albumLabel: item.album.label,
        capturedAt: item.capturedAt,
        location: item.location,
        photographer: item.photographer,
        tags: item.tags.map((t) => t.name),
        aspect: item.aspect,
        sizeMB: item.sizeMB,
        resolution: item.resolution,
        views: item.views,
        downloads: item.downloads,
        starred: item.starred,
        creditLine: item.creditLine,
      })),
      total,
      pagination,
    ),
  };
}

export async function createContactInquiry(input: {
  name: string;
  email: string;
  organization?: string;
  country?: string;
  phone?: string;
  topic: string;
  subject: string;
  message: string;
}) {
  const inquiry = await prisma.contactInquiry.create({
    data: {
      ...input,
      status: 'NEW',
      histories: { create: { toStatus: 'NEW', reason: 'Submitted from public contact form' } },
    },
  });
  return { inquiryId: inquiry.id, status: inquiry.status, next: 'Our team will respond within two working days.' };
}

export async function memberDashboard(userId: string) {
  const [user, projects, publications, support, events] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { memberProfile: true } }),
    prisma.project.groupBy({ by: ['status'], where: { ownerId: userId }, _count: true }),
    prisma.publication.groupBy({ by: ['status'], where: { authorId: userId }, _count: true }),
    prisma.supportRequest.groupBy({ by: ['status'], where: { requesterId: userId }, _count: true }),
    prisma.event.findMany({ where: { status: 'PUBLISHED' }, orderBy: { date: 'asc' }, take: 3 }),
  ]);
  if (!user) throw new ApiError(401, 'Invalid session');
  const count = <T extends string>(rows: Array<{ status: T; _count: number }>, status: T) =>
    rows.find((row) => row.status === status)?._count ?? 0;
  const recentProjects = await prisma.project.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: 'desc' },
    take: 4,
    include: { supportTypes: true },
  });
  const recentMessages = await prisma.message.findMany({
    where: { conversation: { participants: { some: { userId } } }, internal: false },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  return {
    member: {
      id: user.id,
      name: user.fullName,
      memberId: user.memberProfile?.memberId,
      memberSince: user.memberProfile?.approvedAt ?? user.createdAt,
    },
    stats: {
      projects: { total: projects.reduce((a, b) => a + b._count, 0), approved: count(projects, 'APPROVED'), inReview: count(projects, 'UNDER_REVIEW'), draft: count(projects, 'DRAFT') },
      publications: { total: publications.reduce((a, b) => a + b._count, 0), published: count(publications, 'PUBLISHED'), inReview: count(publications, 'UNDER_REVIEW') },
      supportTickets: { open: count(support, 'PENDING') + count(support, 'UNDER_REVIEW'), resolved: count(support, 'COMPLETED') },
      unreadMessages: 0,
    },
    recentProjects: recentProjects.map(serializeProject),
    recentMessages,
    upcomingEvents: events,
  };
}

export async function memberProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberProfile: { include: { education: true, interests: true } },
      publications: { where: { status: 'PUBLISHED' }, take: 10, orderBy: { publishedAt: 'desc' } },
      _count: { select: { projects: true, publications: true, supportRequests: true } },
    },
  });
  if (!user?.memberProfile) throw ApiError.notFound('Profile not found');
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.memberProfile.phone,
    memberId: user.memberProfile.memberId,
    professionalTitle: user.memberProfile.professionalTitle,
    professionalType: user.memberProfile.professionalType,
    institution: user.memberProfile.institution,
    country: user.memberProfile.country,
    biography: user.memberProfile.biography,
    education: user.memberProfile.education,
    researchInterests: user.memberProfile.interests.map((i) => i.name),
    stats: user._count,
    publications: user.publications,
  };
}

function serializeProject(project: Prisma.ProjectGetPayload<{ include: { supportTypes: true } }> & {
  owner?: { fullName: string; memberProfile?: { memberId: string | null } | null };
}) {
  return {
    id: project.id,
    title: project.title,
    category: project.category,
    status: projectStatusLabel[project.status],
    support: project.supportTypes.map((s) => s.kind[0] + s.kind.slice(1).toLowerCase()),
    submitted: project.submittedAt,
    updated: project.updatedAt,
    views: project.viewCount,
    priority: project.priority,
    description: project.description,
    member: project.owner?.fullName,
    memberId: project.owner?.memberProfile?.memberId,
    queueDays: daysSince(project.submittedAt),
  };
}

export async function memberProjects(userId: string, req: Request) {
  const pagination = parsePage(req);
  const status = String(req.query.status ?? 'All');
  const q = String(req.query.q ?? req.query.search ?? '').trim();
  const where: Prisma.ProjectWhereInput = {
    ownerId: userId,
    deletedAt: null,
    ...(status !== 'All' ? { status: labelToProjectStatus(status) } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { category: { contains: q } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.project.findMany({ where, include: { supportTypes: true }, orderBy: { updatedAt: 'desc' }, ...toSkipTake(pagination) }),
    prisma.project.count({ where }),
  ]);
  return buildPaginatedResult(items.map(serializeProject), total, pagination);
}

export async function memberProjectDetail(userId: string, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, ownerId: userId, deletedAt: null },
    include: { supportTypes: true, histories: true, files: { include: { file: true } } },
  });
  if (!project) throw ApiError.notFound('Project not found');
  return {
    ...serializeProject(project),
    files: project.files.map((f) => ({ id: f.fileId, name: f.file.originalName, kind: f.kind, size: f.file.sizeBytes })),
    history: project.histories,
  };
}

export async function createProject(userId: string, input: {
  title: string;
  category: string;
  description: string;
  timeline?: string;
  budget?: string;
  supportTypes?: string[];
  submit?: boolean;
}) {
  const status = input.submit ? 'SUBMITTED' : 'DRAFT';
  const project = await prisma.project.create({
    data: {
      ownerId: userId,
      title: input.title,
      category: input.category,
      description: input.description,
      timeline: input.timeline,
      budget: input.budget,
      status,
      submittedAt: input.submit ? new Date() : null,
      supportTypes: { create: (input.supportTypes ?? []).map((kind) => ({ kind: labelToSupportKind(kind) })) },
      histories: { create: { toStatus: status, actorId: userId, note: input.submit ? 'Project submitted for review' : 'Project draft saved' } },
    },
    include: { supportTypes: true },
  });
  return serializeProject(project);
}

export async function memberSupport(userId: string, req: Request) {
  const pagination = parsePage(req);
  const rows = await prisma.supportRequest.findMany({
    where: { requesterId: userId },
    include: { types: true, project: true },
    orderBy: { updatedAt: 'desc' },
    ...toSkipTake(pagination),
  });
  const total = await prisma.supportRequest.count({ where: { requesterId: userId } });
  return buildPaginatedResult(rows.map(serializeSupport), total, pagination);
}

export async function createSupport(userId: string, input: {
  projectId?: string;
  subject: string;
  description: string;
  priority?: string;
  types: string[];
  requiredBy?: string;
}) {
  const support = await prisma.supportRequest.create({
    data: {
      requesterId: userId,
      projectId: input.projectId || null,
      subject: input.subject,
      description: input.description,
      priority: input.priority ?? 'Standard',
      requiredBy: input.requiredBy ? new Date(input.requiredBy) : null,
      types: { create: input.types.map((kind) => ({ kind: labelToSupportKind(kind) })) },
      histories: { create: { toStatus: 'PENDING', actorId: userId, note: 'Support request submitted' } },
    },
    include: { types: true, project: true },
  });
  return serializeSupport(support);
}

function serializeSupport(row: Prisma.SupportRequestGetPayload<{ include: { types: true; project: true } }> & {
  requester?: { fullName: string; memberProfile?: { memberId: string | null } | null };
}) {
  return {
    id: row.id,
    subject: row.subject,
    project: row.project?.title ?? 'Not project-linked',
    type: row.types.map((t) => `${t.kind[0]}${t.kind.slice(1).toLowerCase()}`),
    supportType: row.types[0] ? `${row.types[0].kind[0]}${row.types[0].kind.slice(1).toLowerCase()} Support` : 'Moral Support',
    submitted: row.createdAt,
    lastUpdate: row.updatedAt,
    status: supportStatusLabel[row.status],
    priority: row.priority,
    messages: 0,
    queueDays: daysSince(row.createdAt),
    member: row.requester?.fullName,
    memberId: row.requester?.memberProfile?.memberId,
    assignedAdmin: row.assignedAdmin ?? 'Unassigned',
    lastMessage: row.adminResponse ?? row.description,
  };
}

export async function memberPublications(userId: string, req: Request) {
  const pagination = parsePage(req);
  const [items, total] = await Promise.all([
    prisma.publication.findMany({ where: { authorId: userId }, orderBy: { updatedAt: 'desc' }, ...toSkipTake(pagination) }),
    prisma.publication.count({ where: { authorId: userId } }),
  ]);
  return buildPaginatedResult(items.map(serializePublication), total, pagination);
}

export async function memberDocuments(userId: string, req: Request) {
  const pagination = parsePage(req);
  const messages = await prisma.message.findMany({
    where: { conversation: { participants: { some: { userId } } }, attachments: { some: {} } },
    include: { attachments: { include: { file: true } } },
    orderBy: { createdAt: 'desc' },
    ...toSkipTake(pagination),
  });
  const items = messages.flatMap((message) =>
    message.attachments.map((a) => ({
      id: a.fileId,
      name: a.file.originalName,
      type: a.file.mimeType,
      size: a.file.sizeBytes,
      sender: message.senderName,
      direction: message.senderId === userId ? 'outgoing' : 'incoming',
      date: message.createdAt,
      note: message.body,
    })),
  );
  return buildPaginatedResult(items, items.length, pagination);
}

export async function memberConversations(userId: string, req: Request) {
  const pagination = parsePage(req);
  const rows = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    include: { participants: { include: { user: { include: { memberProfile: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { updatedAt: 'desc' },
    ...toSkipTake(pagination),
  });
  const total = await prisma.conversation.count({ where: { participants: { some: { userId } } } });
  return buildPaginatedResult(rows.map(serializeConversation), total, pagination);
}

export async function postMemberMessage(userId: string, conversationId: string, body: string) {
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, participants: { some: { userId } } } });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { memberProfile: true } });
  if (!user) throw new ApiError(401, 'Invalid session');
  return prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      senderName: memberName(user),
      senderRole: user.role,
      body,
    },
  });
}

export async function memberCommunity(req: Request) {
  const pagination = parsePage(req);
  const q = String(req.query.q ?? '').trim();
  const [profiles, total, groups, threads] = await Promise.all([
    prisma.memberProfile.findMany({
      where: {
        user: { status: 'ACTIVE', role: 'MEMBER' },
        ...(q ? { OR: [{ user: { fullName: { contains: q } } }, { institution: { contains: q } }, { interests: { some: { name: { contains: q } } } }] } : {}),
      },
      include: { user: true, interests: true, _count: { select: { credentials: true } } },
      ...toSkipTake(pagination),
      orderBy: { approvedAt: 'desc' },
    }),
    prisma.memberProfile.count({ where: { user: { status: 'ACTIVE', role: 'MEMBER' } } }),
    prisma.interestGroup.findMany({ include: { members: true }, take: 12 }),
    prisma.discussionThread.findMany({ include: { replies: true }, orderBy: { updatedAt: 'desc' }, take: 8 }),
  ]);
  return {
    members: buildPaginatedResult(
      profiles.map((p) => ({
        id: p.id,
        name: p.user.fullName,
        title: p.professionalTitle ?? p.professionalType,
        institution: p.institution,
        country: p.country,
        type: p.professionalType,
        interests: p.interests.map((i) => i.name),
        projects: 0,
        pubs: 0,
      })),
      total,
      pagination,
    ),
    groups: groups.map((g) => ({ name: g.name, members: g.members.length, active: '0 online', tag: g.tag })),
    threads: threads.map((t) => ({ title: t.title, replies: t.replies.length, lastPost: t.updatedAt, category: t.category, author: 'Member' })),
  };
}

export async function adminStats() {
  const [totalMembers, directoryTotal, applications, projects, publications, support, messages, events, inquiries] = await Promise.all([
    prisma.user.count({ where: { role: 'MEMBER', status: 'ACTIVE' } }),
    // Every row the members directory lists, so the sidebar badge matches that
    // page rather than counting only active members.
    prisma.user.count({ where: { role: { in: ['APPLICANT', 'MEMBER'] } } }),
    prisma.membershipApplication.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
    prisma.project.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.publication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] } } }),
    prisma.supportRequest.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
    prisma.message.count({ where: { internal: false } }),
    prisma.event.count({ where: { status: 'PUBLISHED', date: { gte: new Date() } } }),
    prisma.contactInquiry.count({ where: { status: 'NEW' } }),
  ]);
  return {
    totalMembers,
    directoryTotal,
    membershipPending: applications,
    activeProjects: projects,
    publicationsQueue: publications,
    openSupportTickets: support,
    messagesAwaitingReply: messages,
    upcomingEvents: events,
    newInquiries: inquiries,
    reviewBacklog: { membershipPending: applications, projectsInReview: projects, publicationsInReview: publications, supportOpen: support },
  };
}

/**
 * The ACCOUNT lifecycle, distinct from the application status.
 *
 * The membership queue cares whether an application is Pending or Approved; the
 * members directory cares whether the account is Active or Suspended. Conflating
 * the two is why an approved member could not be filtered correctly.
 */
const userStatusLabel: Record<string, string> = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Deactivated',
};

/** Maps a queue label back onto the application status enum. */
function labelToApplicationStatus(label: string): ApplicationStatus | null {
  const entry = Object.entries(applicationStatusLabel).find(([, value]) => value === label);
  return entry ? (entry[0] as ApplicationStatus) : null;
}

/** Parses a YYYY-MM-DD filter bound, ignoring anything unparseable. */
function parseDateBound(value: unknown, endOfDay = false): Date | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const date = new Date(endOfDay ? `${raw}T23:59:59.999Z` : `${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function adminMembers(req: Request) {
  const pagination = parsePage(req);
  const status = String(req.query.status ?? 'All');
  const q = String(req.query.q ?? req.query.search ?? '').trim();

  // `status` filters the USER lifecycle; `applicationStatus` filters the
  // APPLICATION. They are different axes — the serialized `status` below is the
  // application's — so the review queue must filter on the latter.
  const applicationStatus = String(req.query.applicationStatus ?? 'All');
  const professionalType = String(req.query.professionalType ?? 'All');
  const priority = String(req.query.priority ?? 'All');
  const submittedFrom = parseDateBound(req.query.submittedFrom);
  const submittedTo = parseDateBound(req.query.submittedTo, true);

  // Field-specific filters used by the members directory.
  const memberId = String(req.query.memberId ?? '').trim();
  const emailTerm = String(req.query.email ?? '').trim();
  const institution = String(req.query.institution ?? '').trim();
  const country = String(req.query.country ?? '').trim();
  const registeredFrom = parseDateBound(req.query.registeredFrom);
  const registeredTo = parseDateBound(req.query.registeredTo, true);

  const profileWhere: Prisma.MemberProfileWhereInput = {
    ...(professionalType !== 'All' ? { professionalType } : {}),
    ...(memberId ? { memberId: { contains: memberId } } : {}),
    ...(institution ? { institution: { contains: institution } } : {}),
    ...(country ? { country: { contains: country } } : {}),
  };
  const hasProfileFilter = Object.keys(profileWhere).length > 0;

  const applicationWhere: Prisma.MembershipApplicationWhereInput = {
    ...(applicationStatus !== 'All'
      ? { status: labelToApplicationStatus(applicationStatus) ?? undefined }
      : {}),
    ...(priority !== 'All' ? { priority } : {}),
    ...(submittedFrom || submittedTo
      ? { submittedAt: { ...(submittedFrom ? { gte: submittedFrom } : {}), ...(submittedTo ? { lte: submittedTo } : {}) } }
      : {}),
  };
  const hasApplicationFilter = Object.keys(applicationWhere).length > 0;

  const where: Prisma.UserWhereInput = {
    role: { in: ['APPLICANT', 'MEMBER'] },
    ...(status !== 'All' ? { status: labelToUserStatus(status) } : {}),
    ...(hasApplicationFilter ? { membershipApplication: { is: applicationWhere } } : {}),
    ...(hasProfileFilter ? { memberProfile: { is: profileWhere } } : {}),
    ...(emailTerm ? { email: { contains: emailTerm } } : {}),
    ...(registeredFrom || registeredTo
      ? { createdAt: { ...(registeredFrom ? { gte: registeredFrom } : {}), ...(registeredTo ? { lte: registeredTo } : {}) } }
      : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { email: { contains: q } },
            { memberProfile: { institution: { contains: q } } },
            { memberProfile: { memberId: { contains: q } } },
          ],
        }
      : {}),
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [rows, total, pending, underReview, urgent, approvedToday, typeGroups, statusGroups] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { memberProfile: { include: { credentials: true, education: true } }, membershipApplication: true },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.user.count({ where }),
    // Queue totals are counted across the whole queue, not the current page, so
    // the summary tiles stay correct once paging happens server-side.
    prisma.membershipApplication.count({ where: { status: 'PENDING' } }),
    prisma.membershipApplication.count({ where: { status: 'UNDER_REVIEW' } }),
    prisma.membershipApplication.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] }, priority: 'Urgent' } }),
    prisma.membershipApplication.count({ where: { status: 'APPROVED', reviewedAt: { gte: startOfToday } } }),
    // Real professional types in use, so the filter offers what applicants
    // actually selected rather than a hard-coded list.
    prisma.memberProfile.findMany({ distinct: ['professionalType'], select: { professionalType: true }, orderBy: { professionalType: 'asc' } }),
    // Account-lifecycle totals for the members directory, counted across the
    // whole directory rather than the returned page.
    prisma.user.groupBy({ by: ['status'], where: { role: { in: ['APPLICANT', 'MEMBER'] } }, _count: true }),
  ]);

  const accountCounts = statusGroups.reduce<Record<string, number>>((acc, group) => {
    acc[userStatusLabel[group.status] ?? group.status] = group._count;
    return acc;
  }, {});

  return {
    ...buildPaginatedResult(rows.map(serializeMember), total, pagination),
    counts: { pending, underReview, urgent, approvedToday, inQueue: pending + underReview },
    accountCounts: {
      total: statusGroups.reduce((sum, g) => sum + g._count, 0),
      active: accountCounts.Active ?? 0,
      pending: accountCounts.Pending ?? 0,
      suspended: accountCounts.Suspended ?? 0,
      deactivated: accountCounts.Deactivated ?? 0,
      rejected: accountCounts.Rejected ?? 0,
    },
    professionalTypes: typeGroups.map((t) => t.professionalType).filter(Boolean),
  };
}

function serializeMember(
  user: Prisma.UserGetPayload<{
    include: { memberProfile: { include: { credentials: true; education: true } }; membershipApplication: true };
  }>,
) {
  return {
    id: user.membershipApplication?.id ?? user.id,
    userId: user.id,
    name: user.fullName,
    email: user.email,
    memberId: user.memberProfile?.memberId,
    role: user.memberProfile?.professionalTitle ?? user.role,
    professionalType: user.memberProfile?.professionalType ?? 'Applicant',
    institution: user.memberProfile?.institution ?? '',
    country: user.memberProfile?.country ?? '',
    registrationDate: user.createdAt,
    submittedAt: user.membershipApplication?.submittedAt,
    /** Application status — what the review queue filters and displays. */
    status: applicationStatusLabel[user.membershipApplication?.status ?? (user.status === 'ACTIVE' ? 'APPROVED' : 'PENDING')],
    /** Account lifecycle — what the members directory filters and displays. */
    accountStatus: userStatusLabel[user.status] ?? user.status,
    approvedAt: user.memberProfile?.approvedAt ?? null,
    approvalEmailSentAt: user.membershipApplication?.approvalEmailSentAt ?? null,
    approvalEmailError: user.membershipApplication?.approvalEmailError ?? null,
    credentials: user.memberProfile?.credentials.length ?? 0,
    priority: user.membershipApplication?.priority ?? 'Standard',
    applicationId: user.membershipApplication?.applicationCode,
    professionalTitle: user.memberProfile?.professionalTitle ?? null,
    /** Days the application has been waiting — drives the queue's ageing column. */
    slaDays: daysSince(user.membershipApplication?.submittedAt ?? null),
    highestDegree: user.memberProfile?.education?.[0]?.degree ?? null,
  };
}

export async function adminMemberDetail(id: string) {
  const application = await prisma.membershipApplication.findFirst({
    where: { OR: [{ id }, { userId: id }, { applicationCode: id }] },
    include: {
      user: true,
      profile: { include: { education: true, credentials: { include: { file: true } }, interests: true } },
      histories: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!application) throw ApiError.notFound('Member application not found');
  return {
    id: application.id,
    applicationId: application.applicationCode,
    fullName: application.user.fullName,
    email: application.user.email,
    phone: application.profile.phone,
    professionalTitle: application.profile.professionalTitle,
    professionalType: application.profile.professionalType,
    institution: application.profile.institution,
    country: application.profile.country,
    biography: application.profile.biography,
    researchInterests: application.profile.interests.map((i) => i.name),
    education: application.profile.education,
    credentials: application.profile.credentials.map((c) => ({
      id: c.id,
      title: c.title,
      issuer: c.issuer,
      year: c.year,
      referenceNumber: c.referenceNumber,
      type: c.credentialType,
      fileSize: c.file ? `${Math.round(c.file.sizeBytes / 1024)} KB` : 'No file',
      uploadedAt: c.createdAt,
      fileId: c.fileId,
    })),
    // The free-text answers the applicant actually submitted at registration —
    // the substance an admin reviews. Registration stores them here rather than
    // as ProfessionalCredential rows.
    credentialsText: application.credentialsText,
    educationText: application.educationText,
    researchText: application.researchText,
    submittedAt: application.submittedAt,
    // Labelled to match the list endpoint; the raw enum is kept alongside for
    // callers that need to branch on it.
    status: applicationStatusLabel[application.status],
    statusValue: application.status,
    reviewNotes: application.reviewNotes,
    rejectionReason: application.rejectionReason,
    reviewedAt: application.reviewedAt,
    approvedAt: application.profile.approvedAt,
    // Lets the review screen show whether the member was actually notified, and
    // offer a retry when they were not.
    approvalEmailSentAt: application.approvalEmailSentAt,
    approvalEmailError: application.approvalEmailError,
    approvalEmailAttempts: application.approvalEmailAttempts,
    slaDays: daysSince(application.submittedAt),
    statusHistory: application.histories,
    memberId: application.profile.memberId,
  };
}

/**
 * Claims an application for review: PENDING -> UNDER_REVIEW.
 *
 * Idempotent — re-opening an application already under review is not an error,
 * it just does not write a second history entry.
 */
export async function reviewMember(id: string, actorId: string, note?: string) {
  const app = await prisma.membershipApplication.findFirst({
    where: { OR: [{ id }, { userId: id }, { applicationCode: id }] },
    include: { user: true },
  });
  if (!app) throw ApiError.notFound('Member application not found');

  if (app.status === 'UNDER_REVIEW') {
    return { status: applicationStatusLabel[app.status], changed: false };
  }
  if (app.status !== 'PENDING') {
    throw new ApiError(409, 'Only a pending application can be moved to review');
  }

  await prisma.$transaction([
    prisma.membershipApplication.update({ where: { id: app.id }, data: { status: 'UNDER_REVIEW' } }),
    prisma.applicationStatusHistory.create({
      data: { applicationId: app.id, fromStatus: 'PENDING', toStatus: 'UNDER_REVIEW', actorId, note },
    }),
    prisma.auditLog.create({
      data: {
        actorId,
        actorLabel: actorId,
        actorRole: 'ADMIN',
        action: 'MembershipReviewStarted',
        entity: `MembershipApplication ${app.applicationCode}`,
        severity: 'INFO',
        description: `Review started for ${app.user.fullName}.`,
      },
    }),
  ]);

  return { status: applicationStatusLabel.UNDER_REVIEW, changed: true };
}

export async function approveMember(id: string, actorId: string, note?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const app = await tx.membershipApplication.findFirst({ where: { OR: [{ id }, { userId: id }] }, include: { user: true, profile: true } });
    if (!app) throw ApiError.notFound('Member application not found');
    if (!['PENDING', 'UNDER_REVIEW'].includes(app.status)) throw new ApiError(409, 'Application is not pending review');
    const year = new Date().getFullYear();
    const seq = await tx.memberIdSequence.upsert({
      where: { year },
      create: { year, nextNumber: 2 },
      update: { nextNumber: { increment: 1 } },
    });
    const number = seq.nextNumber - 1;
    const memberId = `IFSMHP-${year}-${number.toString().padStart(6, '0')}`;
    await tx.memberProfile.update({ where: { id: app.profileId }, data: { memberId, approvedAt: new Date() } });
    await tx.user.update({ where: { id: app.userId }, data: { role: 'MEMBER', status: 'ACTIVE' } });
    await tx.membershipApplication.update({ where: { id: app.id }, data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById: actorId, reviewNotes: note } });
    await tx.applicationStatusHistory.create({ data: { applicationId: app.id, fromStatus: app.status, toStatus: 'APPROVED', actorId, note } });
    await tx.notification.create({ data: { userId: app.userId, title: 'Membership approved', body: `Your member ID is ${memberId}.`, type: 'membership', link: '/dashboard' } });
    await tx.auditLog.create({ data: { actorId, actorLabel: actorId, actorRole: 'ADMIN', action: 'MembershipApproved', entity: `User ${app.userId} / ${memberId}`, severity: 'SUCCESS', description: `Approved membership application for ${app.user.fullName}. Issued ${memberId}.` } });
    return { memberId, applicationId: app.id, email: app.user.email, fullName: app.user.fullName };
  });

  // Deliberately outside the transaction: the approval is already committed and
  // a member ID has been issued, so a mail failure must not undo any of it. The
  // outcome is recorded instead, and the admin is offered a retry.
  const delivery = await deliverApprovalEmail(result);

  return { issued: true, memberId: result.memberId, ...delivery };
}

interface ApprovalRecipient {
  memberId: string;
  applicationId: string;
  email: string;
  fullName: string;
}

/**
 * Sends the acknowledgement and records the outcome on the application.
 *
 * Never throws: the caller has already approved the member, and losing that
 * because the mail server is down would be far worse than an unsent email.
 */
async function deliverApprovalEmail(
  recipient: ApprovalRecipient,
): Promise<{ emailSent: boolean; emailError?: string }> {
  try {
    await sendApprovalEmail(recipient.email, recipient.fullName, recipient.memberId);
    await prisma.membershipApplication.update({
      where: { id: recipient.applicationId },
      data: {
        approvalEmailSentAt: new Date(),
        approvalEmailError: null,
        approvalEmailAttempts: { increment: 1 },
      },
    });
    return { emailSent: true };
  } catch (error) {
    const emailError = error instanceof Error ? error.message : String(error);
    logger.error('Approval email failed', { email: recipient.email, error: emailError });
    await prisma.membershipApplication
      .update({
        where: { id: recipient.applicationId },
        data: { approvalEmailError: emailError, approvalEmailAttempts: { increment: 1 } },
      })
      .catch(() => undefined);
    return { emailSent: false, emailError };
  }
}

/**
 * Retries a failed acknowledgement.
 *
 * Refused once one has been sent, which is what makes a duplicate
 * acknowledgement impossible however many times the button is pressed.
 */
export async function resendApprovalEmail(id: string, actorId: string) {
  const app = await prisma.membershipApplication.findFirst({
    where: { OR: [{ id }, { userId: id }, { applicationCode: id }] },
    include: { user: true, profile: true },
  });
  if (!app) throw ApiError.notFound('Member application not found');
  if (app.status !== 'APPROVED') {
    throw new ApiError(409, 'Only an approved application has an acknowledgement to send');
  }
  if (app.approvalEmailSentAt) {
    throw new ApiError(409, 'An acknowledgement has already been sent to this member');
  }
  if (!app.profile.memberId) {
    throw new ApiError(409, 'This member has no Member ID yet');
  }

  const delivery = await deliverApprovalEmail({
    memberId: app.profile.memberId,
    applicationId: app.id,
    email: app.user.email,
    fullName: app.user.fullName,
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      actorLabel: actorId,
      actorRole: 'ADMIN',
      action: 'MembershipApprovalEmailResent',
      entity: `MembershipApplication ${app.applicationCode}`,
      severity: delivery.emailSent ? 'SUCCESS' : 'WARNING',
      description: delivery.emailSent
        ? `Acknowledgement re-sent to ${app.user.email}.`
        : `Acknowledgement retry failed for ${app.user.email}: ${delivery.emailError}`,
    },
  });

  return delivery;
}

export async function rejectMember(id: string, actorId: string, reason: string, note?: string) {
  const app = await prisma.membershipApplication.findFirst({ where: { OR: [{ id }, { userId: id }] } });
  if (!app) throw ApiError.notFound('Member application not found');
  await prisma.$transaction([
    prisma.user.update({ where: { id: app.userId }, data: { status: 'REJECTED' } }),
    prisma.membershipApplication.update({ where: { id: app.id }, data: { status: 'REJECTED', reviewedAt: new Date(), reviewedById: actorId, rejectionReason: reason, reviewNotes: note } }),
    prisma.applicationStatusHistory.create({ data: { applicationId: app.id, fromStatus: app.status, toStatus: 'REJECTED', actorId, note: reason } }),
    prisma.auditLog.create({ data: { actorId, actorLabel: actorId, actorRole: 'ADMIN', action: 'MembershipRejected', entity: `MembershipApplication ${app.id}`, severity: 'DANGER', description: reason } }),
  ]);
  return { status: 'REJECTED', reason };
}

export async function adminProjects(req: Request) {
  const pagination = parsePage(req);
  const q = String(req.query.q ?? req.query.search ?? '').trim();
  const rows = await prisma.project.findMany({
    where: q ? { OR: [{ title: { contains: q } }, { category: { contains: q } }, { owner: { fullName: { contains: q } } }] } : {},
    include: { supportTypes: true, owner: { include: { memberProfile: true } } },
    orderBy: { updatedAt: 'desc' },
    ...toSkipTake(pagination),
  });
  const total = await prisma.project.count();
  return buildPaginatedResult(rows.map(serializeProject), total, pagination);
}

export async function adminProjectDetail(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { supportTypes: true, owner: { include: { memberProfile: true } }, histories: true, files: { include: { file: true } }, supportRequests: true },
  });
  if (!project) throw ApiError.notFound('Project not found');
  return { ...serializeProject(project), files: project.files.map((f) => ({ id: f.fileId, name: f.file.originalName, kind: f.kind, size: f.file.sizeBytes })), history: project.histories, linkedSupport: project.supportRequests[0] ?? null };
}

export async function transitionProject(id: string, actorId: string, next: ProjectStatus, note?: string) {
  const allowed: Record<ProjectStatus, ProjectStatus[]> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED: ['PUBLISHED', 'ARCHIVED'],
    PUBLISHED: ['ARCHIVED'],
    REJECTED: ['ARCHIVED', 'DRAFT'],
    ARCHIVED: [],
  };
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw ApiError.notFound('Project not found');
  if (!allowed[project.status].includes(next)) throw new ApiError(409, `Invalid transition from ${project.status} to ${next}`);
  await prisma.$transaction([
    prisma.project.update({ where: { id }, data: { status: next, ...(next === 'PUBLISHED' ? { publishedAt: new Date() } : {}) } }),
    prisma.projectStatusHistory.create({ data: { projectId: id, fromStatus: project.status, toStatus: next, actorId, note } }),
    prisma.auditLog.create({ data: { actorId, actorLabel: actorId, actorRole: 'ADMIN', action: 'ProjectStatusChanged', entity: `Project ${id}`, severity: next === 'REJECTED' ? 'DANGER' : 'SUCCESS', description: note ?? `Project moved to ${next}` } }),
  ]);
  return { ok: true, to: projectStatusLabel[next] };
}

export async function adminPublications(req: Request) {
  const pagination = parsePage(req);
  const rows = await prisma.publication.findMany({
    include: { author: { include: { memberProfile: true } }, files: { include: { file: true } } },
    orderBy: { updatedAt: 'desc' },
    ...toSkipTake(pagination),
  });
  const total = await prisma.publication.count();
  return buildPaginatedResult(rows.map(serializePublication), total, pagination);
}

function serializePublication(row: Prisma.PublicationGetPayload<object> & {
  author?: { fullName: string; memberProfile?: { memberId: string | null } | null };
  files?: Array<{ file: { sizeBytes: number } }>;
}) {
  return {
    id: row.id,
    title: row.title,
    author: row.author?.fullName,
    memberId: row.author?.memberProfile?.memberId,
    category: row.category,
    researchType: row.researchType,
    status: publicationStatusLabel[row.status],
    submittedAt: row.submittedAt,
    queueDays: daysSince(row.submittedAt),
    views: row.viewCount,
    downloads: row.downloadCount,
    pdfSize: row.files?.[0]?.file.sizeBytes ?? 0,
    slug: row.slug,
    publishedAt: row.publishedAt,
    abstract: row.abstract,
    fullText: row.fullText,
    venue: row.venue,
    doi: row.doi,
  };
}

export async function adminPublicationDetail(id: string) {
  const pub = await prisma.publication.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: { author: { include: { memberProfile: true } }, files: { include: { file: true } }, reviews: true, histories: true },
  });
  if (!pub) throw ApiError.notFound('Publication not found');
  return { ...serializePublication(pub), files: pub.files.map((f) => ({ id: f.fileId, name: f.file.originalName, kind: f.kind, size: f.file.sizeBytes })), reviews: pub.reviews, history: pub.histories };
}

export async function transitionPublication(id: string, actorId: string, next: PublicationStatus, comment?: string) {
  const pub = await prisma.publication.findUnique({ where: { id } });
  if (!pub) throw ApiError.notFound('Publication not found');
  const allowed: Record<PublicationStatus, PublicationStatus[]> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED: ['PUBLISHED', 'REJECTED'],
    REJECTED: ['SUBMITTED'],
    PUBLISHED: ['APPROVED'],
  };
  if (!allowed[pub.status].includes(next)) throw new ApiError(409, `Invalid transition from ${pub.status} to ${next}`);
  const slug = next === 'PUBLISHED' && !pub.slug ? slugify(pub.title) : pub.slug;
  await prisma.$transaction([
    prisma.publication.update({ where: { id }, data: { status: next, slug, ...(next === 'APPROVED' ? { approvedAt: new Date() } : {}), ...(next === 'PUBLISHED' ? { publishedAt: new Date() } : {}) } }),
    prisma.publicationStatusHistory.create({ data: { publicationId: id, fromStatus: pub.status, toStatus: next, actorId, note: comment } }),
    prisma.publicationReview.create({ data: { publicationId: id, reviewerId: actorId, decision: next, comment: comment ?? `Moved to ${next}` } }),
    prisma.auditLog.create({ data: { actorId, actorLabel: actorId, actorRole: 'ADMIN', action: `Publication${next}`, entity: `Publication ${id}`, severity: next === 'REJECTED' ? 'DANGER' : 'SUCCESS', description: comment ?? `Publication moved to ${next}` } }),
  ]);
  return { ok: true, to: publicationStatusLabel[next], slug };
}

export async function adminSupport(req: Request) {
  const pagination = parsePage(req);
  const rows = await prisma.supportRequest.findMany({
    include: { types: true, project: true, requester: { include: { memberProfile: true } } },
    orderBy: { updatedAt: 'desc' },
    ...toSkipTake(pagination),
  });
  const total = await prisma.supportRequest.count();
  return buildPaginatedResult(rows.map(serializeSupport), total, pagination);
}

export async function transitionSupport(id: string, actorId: string, next: SupportStatus, response?: string) {
  const support = await prisma.supportRequest.findUnique({ where: { id } });
  if (!support) throw ApiError.notFound('Support request not found');
  await prisma.$transaction([
    prisma.supportRequest.update({ where: { id }, data: { status: next, adminResponse: response ?? support.adminResponse } }),
    prisma.supportRequestHistory.create({ data: { requestId: id, fromStatus: support.status, toStatus: next, actorId, note: response } }),
    prisma.auditLog.create({ data: { actorId, actorLabel: actorId, actorRole: 'ADMIN', action: 'SupportRequestStatusChanged', entity: `SupportRequest ${id}`, severity: next === 'REJECTED' ? 'DANGER' : 'SUCCESS', description: response ?? `Support moved to ${next}` } }),
  ]);
  return { ok: true, to: supportStatusLabel[next] };
}

export async function adminConversations(req: Request) {
  const pagination = parsePage(req);
  const rows = await prisma.conversation.findMany({
    include: { participants: { include: { user: { include: { memberProfile: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { updatedAt: 'desc' },
    ...toSkipTake(pagination),
  });
  const total = await prisma.conversation.count();
  return buildPaginatedResult(rows.map(serializeConversation), total, pagination);
}

function serializeConversation(row: Prisma.ConversationGetPayload<{ include: { participants: { include: { user: { include: { memberProfile: true } } } }; messages: true } }>) {
  const member = row.participants.find((p) => p.user.role === 'MEMBER')?.user;
  return {
    id: row.id,
    subject: row.subject,
    from: member?.fullName ?? 'CRO Office',
    memberId: member?.memberProfile?.memberId ?? '',
    category: row.category,
    lastActivity: row.updatedAt,
    unreadCount: 0,
    participantCount: row.participants.length,
    totalMessages: row.messages.length,
    lastPreview: row.messages[0]?.body ?? '',
    status: row.status,
    priority: row.priority,
  };
}

export async function adminConversationDetail(id: string, userId?: string) {
  const row = await prisma.conversation.findUnique({
    where: { id },
    include: {
      participants: { include: { user: { include: { memberProfile: true } } } },
      messages: { include: { attachments: { include: { file: true } }, sharedLinks: true }, orderBy: { createdAt: 'asc' } },
      linkedRecords: true,
    },
  });
  if (!row) throw ApiError.notFound('Conversation not found');
  const hasAccess = !userId || row.participants.some((p) => p.userId === userId);
  if (userId && !hasAccess) throw ApiError.notFound('Conversation not found');
  const member = row.participants.find((p) => p.user.role === 'MEMBER')?.user;
  return {
    ...serializeConversation({ ...row, messages: row.messages }),
    fromName: member?.fullName,
    fromEmail: member?.email,
    fromMemberId: member?.memberProfile?.memberId,
    fromInstitution: member?.memberProfile?.institution,
    participants: row.participants.map((p) => ({ name: p.user.fullName, role: p.roleLabel ?? p.user.role, joinedAt: p.joinedAt, email: p.user.email })),
    messages: row.messages.map((m) => ({ id: m.id, who: m.senderRole.toLowerCase(), name: m.senderName, at: m.createdAt, text: m.body, internal: m.internal, attachments: m.attachments.map((a) => ({ id: a.fileId, name: a.file.originalName, size: a.file.sizeBytes, type: a.file.mimeType })) })),
    linkedRecords: row.linkedRecords,
  };
}

export async function adminEvents(req: Request) {
  const pagination = parsePage(req);
  const rows = await prisma.event.findMany({ include: { tags: true, registrations: true }, orderBy: { date: 'asc' }, ...toSkipTake(pagination) });
  const total = await prisma.event.count();
  return buildPaginatedResult(rows.map((e) => ({ ...e, tags: e.tags.map((t) => t.name), attendees: e.registrations.length })), total, pagination);
}

export async function upsertEvent(input: Prisma.EventCreateInput, id?: string) {
  if (id) {
    return prisma.event.update({ where: { id }, data: input });
  }
  return prisma.event.create({ data: input });
}

export async function adminInquiries(req: Request) {
  const pagination = parsePage(req);
  const rows = await prisma.contactInquiry.findMany({ include: { notes: true, replies: true, histories: true, attachments: true }, orderBy: { updatedAt: 'desc' }, ...toSkipTake(pagination) });
  const total = await prisma.contactInquiry.count();
  return buildPaginatedResult(rows.map((i) => ({ ...i, replies: i.replies.length, attachmentCount: i.attachments.length, internalNotes: i.notes, replyThread: i.replies, statusHistory: i.histories })), total, pagination);
}

export async function replyInquiry(id: string, actorId: string, text: string) {
  const inquiry = await prisma.contactInquiry.findUnique({ where: { id } });
  if (!inquiry) throw ApiError.notFound('Inquiry not found');
  await prisma.$transaction([
    prisma.inquiryReply.create({ data: { inquiryId: id, authorId: actorId, author: 'CRO Office', text } }),
    prisma.contactInquiry.update({ where: { id }, data: { status: 'RESPONDED' } }),
    prisma.auditLog.create({ data: { actorId, actorLabel: actorId, actorRole: 'ADMIN', action: 'InquiryReplied', entity: `ContactInquiry ${id}`, severity: 'INFO', description: 'Admin replied to inquiry.' } }),
  ]);
  return { ok: true };
}

export async function changeInquiryStatus(id: string, actorId: string, status: 'CLOSED' | 'SPAM' | 'ASSIGNED', reason?: string) {
  const inquiry = await prisma.contactInquiry.findUnique({ where: { id } });
  if (!inquiry) throw ApiError.notFound('Inquiry not found');
  await prisma.$transaction([
    prisma.contactInquiry.update({ where: { id }, data: { status } }),
    prisma.inquiryStatusHistory.create({ data: { inquiryId: id, fromStatus: inquiry.status, toStatus: status, actorId, reason } }),
    prisma.auditLog.create({ data: { actorId, actorLabel: actorId, actorRole: 'ADMIN', action: 'InquiryStatusChanged', entity: `ContactInquiry ${id}`, severity: status === 'SPAM' ? 'WARNING' : 'INFO', description: reason ?? `Inquiry moved to ${status}` } }),
  ]);
  return { status };
}

export async function adminAnnouncements(req: Request) {
  const pagination = parsePage(req);
  const rows = await prisma.announcement.findMany({ include: { author: true, deliveries: true }, orderBy: { updatedAt: 'desc' }, ...toSkipTake(pagination) });
  const total = await prisma.announcement.count();
  return buildPaginatedResult(rows.map((a) => ({ ...a, preview: a.body.slice(0, 180), recipients: a.deliveries.length.toString(), author: a.author?.fullName ?? 'System' })), total, pagination);
}

export async function createAnnouncement(actorId: string, input: { subject: string; body: string; audience: string; channel: string; scheduleMode?: string; scheduledAt?: string; appendUnsubscribe?: boolean }) {
  const status = input.scheduleMode === 'now' ? 'SENT' : input.scheduleMode === 'scheduled' ? 'SCHEDULED' : 'DRAFT';
  const announcement = await prisma.announcement.create({
    data: {
      authorId: actorId,
      subject: input.subject,
      body: input.body,
      audience: input.audience,
      channel: input.channel,
      status,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      sentAt: status === 'SENT' ? new Date() : null,
      appendUnsubscribe: input.appendUnsubscribe ?? true,
    },
  });
  await writeAudit({ actorId, actorLabel: actorId, actorRole: 'ADMIN', action: 'AnnouncementCreated', entity: `Announcement ${announcement.id}`, severity: status === 'SENT' ? 'SUCCESS' : 'INFO', description: announcement.subject });
  return announcement;
}

export async function adminAuditLog(req: Request) {
  const pagination = parsePage(req);
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, ...toSkipTake(pagination) });
  const total = await prisma.auditLog.count();
  return buildPaginatedResult(rows, total, pagination);
}

export async function adminReports() {
  return prisma.reportDefinition.findMany({ include: { runs: { orderBy: { createdAt: 'desc' }, take: 1 } } });
}

export async function adminSettings() {
  return prisma.platformSetting.findMany({ orderBy: [{ section: 'asc' }, { key: 'asc' }] });
}

function labelToProjectStatus(label: string): ProjectStatus {
  const found = Object.entries(projectStatusLabel).find(([, value]) => value === label);
  return (found?.[0] ?? 'DRAFT') as ProjectStatus;
}

function labelToSupportKind(label: string) {
  if (label.toLowerCase().includes('funding')) return 'FUNDING' as const;
  if (label.toLowerCase().includes('official')) return 'OFFICIAL' as const;
  return 'MORAL' as const;
}

function labelToUserStatus(label: string) {
  const map: Record<string, 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'DEACTIVATED'> = {
    Pending: 'PENDING',
    Active: 'ACTIVE',
    Rejected: 'REJECTED',
    Suspended: 'SUSPENDED',
    Deactivated: 'DEACTIVATED',
    'Under Review': 'PENDING',
  };
  return map[label] ?? 'ACTIVE';
}
