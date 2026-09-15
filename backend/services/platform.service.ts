import crypto from 'node:crypto';
import type { Request } from 'express';
import * as supportService from './support.service';
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
      // `files` only to answer "is there a manuscript" — selecting the ids
      // alone keeps this cheap for a 20-card page.
      include: { author: { include: { memberProfile: true } }, files: { select: { kind: true } } },
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
      // `fullText` is deliberately absent: it is a LongText column and the
      // listing only ever renders the abstract. Read it from the detail route.
      views: p.viewCount,
      downloads: p.downloadCount,
      doi: p.doi,
      featured: p.featured,
      slug: p.slug,
      /** Lets a card offer a PDF action without loading every attachment. */
      hasManuscript: p.files.some((f) => f.kind === MANUSCRIPT_KIND),
    })),
    total,
    pagination,
  );
}

/** The attachment kind the member submission form stores the paper itself under. */
const MANUSCRIPT_KIND = 'MANUSCRIPT';

/**
 * Locates the downloadable manuscript of a *published* paper.
 *
 * Publishing is what makes a manuscript public — the FileObject itself stays
 * PRIVATE and the authenticated `/files/:id/download` ACL is untouched. Anything
 * unpublished, unknown, or without a manuscript returns null so the caller can
 * 404 uniformly: whether a paper exists but is unpublished must not be
 * inferable from the response.
 */
export async function publicPublicationManuscript(slugOrId: string) {
  const publication = await prisma.publication.findFirst({
    where: { status: 'PUBLISHED', OR: [{ id: slugOrId }, { slug: slugOrId }] },
    select: {
      id: true,
      files: {
        where: { kind: MANUSCRIPT_KIND },
        include: { file: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  const attachment = publication?.files[0];
  if (!attachment || attachment.file.deletedAt) return null;

  return { publicationId: publication!.id, file: attachment.file };
}

/** Records that a published paper's manuscript was served. */
export async function recordPublicationDownload(publicationId: string) {
  await prisma.publication
    .update({ where: { id: publicationId }, data: { downloadCount: { increment: 1 } } })
    .catch(() => undefined);
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
    // The raw FileObject id used to be exposed here, but it only addresses the
    // authenticated download route — a reference an anonymous reader could not
    // follow. `url` points at the public route that will actually serve it.
    files: publication.files
      .filter((f) => !f.file.deletedAt)
      .map((f) => ({
        kind: f.kind,
        name: f.file.originalName,
        sizeBytes: f.file.sizeBytes,
        mimeType: f.file.mimeType,
        url: f.kind === MANUSCRIPT_KIND
          ? `/public/publications/${publication.slug ?? publication.id}/file`
          : null,
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
    deletedAt: null,
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
    where: { deletedAt: null, OR: [{ id: slugOrId }, { slug: slugOrId }], status: { in: ['PUBLISHED', 'PAST'] }, audience: { in: ['Public', 'All Members'] } },
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
    prisma.event.findMany({ where: { deletedAt: null, status: 'PUBLISHED' }, orderBy: { date: 'asc' }, take: 3 }),
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
      unreadMessages: await unreadMessageTotal(userId),
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
      memberProfile: { include: { education: true, interests: true, credentials: { include: { file: true } } } },
      membershipApplication: { select: { status: true } },
      publications: {
        where: { status: 'PUBLISHED' }, take: 10, orderBy: { publishedAt: 'desc' },
        include: { files: { where: { file: { deletedAt: null } }, include: { file: true }, take: 1 } },
      },
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
    status: user.status,
    applicationStatus: user.membershipApplication?.status ?? null,
    approvedAt: user.memberProfile.approvedAt,
    websiteUrl: user.memberProfile.websiteUrl,
    scholarUrl: user.memberProfile.scholarUrl,
    orcid: user.memberProfile.orcid,
    education: user.memberProfile.education.map(({ id, degree, institution, field, startYear, endYear, detail }) => ({
      id, degree, institution, field, startYear, endYear, detail,
    })),
    credentials: user.memberProfile.credentials.filter((c) => !c.file?.deletedAt).map((c) => ({
      id: c.id,
      title: c.title,
      issuer: c.issuer,
      year: c.year,
      referenceNumber: c.referenceNumber,
      type: c.credentialType,
      fileId: c.fileId,
      fileName: c.file?.originalName ?? null,
      mimeType: c.file?.mimeType ?? null,
      sizeBytes: c.file?.sizeBytes ?? null,
      fileSize: c.file ? c.file.sizeBytes < 1024 ? `${c.file.sizeBytes} B` : `${Math.round(c.file.sizeBytes / 1024)} KB` : 'No file',
      uploadedAt: c.file?.createdAt ?? c.createdAt,
    })),
    researchInterests: user.memberProfile.interests.map((i) => i.name),
    stats: user._count,
    publications: user.publications.map(({ id, title, venue, publishedAt, doi, files }) => ({
      id, title, venue, publishedAt, doi,
      fileId: files[0]?.fileId ?? null,
      fileName: files[0]?.file.originalName ?? null,
      mimeType: files[0]?.file.mimeType ?? null,
    })),
  };
}

export async function updateMemberProfile(userId: string, input: {
  phone?: string | null;
  websiteUrl?: string | null;
  scholarUrl?: string | null;
  orcid?: string | null;
}) {
  const result = await prisma.memberProfile.updateMany({
    where: { userId },
    data: { phone: input.phone, websiteUrl: input.websiteUrl, scholarUrl: input.scholarUrl, orcid: input.orcid },
  });
  if (!result.count) throw ApiError.notFound('Profile not found');
  return memberProfile(userId);
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
  const support = String(req.query.support ?? 'All');
  const q = String(req.query.q ?? req.query.search ?? '').trim();
  const where: Prisma.ProjectWhereInput = {
    ownerId: userId,
    deletedAt: null,
    ...(status !== 'All' ? { status: labelToProjectStatus(status) } : {}),
    // Filtered here rather than on the client so `total` counts the same rows
    // the grid shows — a page-local filter would misreport the count.
    ...(support !== 'All' ? { supportTypes: { some: { kind: labelToSupportKind(support) } } } : {}),
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
    include: { supportTypes: true, histories: true, files: { include: { file: true } }, resourceLinks: true },
  });
  if (!project) throw ApiError.notFound('Project not found');
  return {
    ...serializeProject(project),
    // Not in the list serializer, but the detail view and the edit form need them.
    timeline: project.timeline,
    budget: project.budget,
    files: project.files.map((f) => ({ id: f.fileId, name: f.file.originalName, kind: f.kind, size: f.file.sizeBytes })),
    resourceLinks: project.resourceLinks.map((l) => ({ id: l.id, url: l.url, label: l.label })),
    history: project.histories,
  };
}

/**
 * Confirms every id belongs to an upload the caller made themselves.
 *
 * Without this a member could attach someone else's fileId to their own project
 * and gain download rights through the project-owner branch of the file ACL.
 */
async function assertOwnedFiles(userId: string, fileIds: string[]) {
  if (!fileIds.length) return [];
  const unique = [...new Set(fileIds)];
  const owned = await prisma.fileObject.findMany({
    where: { id: { in: unique }, uploaderId: userId, deletedAt: null },
    select: { id: true },
  });
  if (owned.length !== unique.length) throw ApiError.notFound('Attachment not found');
  return unique;
}

export async function createProject(userId: string, input: {
  title: string;
  category: string;
  description: string;
  timeline?: string;
  budget?: string;
  supportTypes?: string[];
  fileIds?: string[];
  resourceLinks?: { url: string; label?: string }[];
  submit?: boolean;
}) {
  const status = input.submit ? 'SUBMITTED' : 'DRAFT';
  const fileIds = await assertOwnedFiles(userId, input.fileIds ?? []);
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
      files: { create: fileIds.map((fileId) => ({ fileId, kind: 'PROJECT_DOCUMENT' })) },
      resourceLinks: { create: (input.resourceLinks ?? []).map(({ url, label }) => ({ url, label: label ?? null })) },
      histories: { create: { toStatus: status, actorId: userId, note: input.submit ? 'Project submitted for review' : 'Project draft saved' } },
    },
    include: { supportTypes: true },
  });
  return serializeProject(project);
}

/**
 * Statuses a member may still change themselves. Once the CRO has picked the
 * project up, edits and deletes belong to the admin transition machine.
 */
const MEMBER_EDITABLE: ProjectStatus[] = ['DRAFT', 'SUBMITTED'];

/** Loads a project the caller owns, or throws 404 — "not yours" must not leak (R5). */
async function loadOwnedProject(userId: string, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, ownerId: userId, deletedAt: null },
    include: { supportTypes: true },
  });
  if (!project) throw ApiError.notFound('Project not found');
  return project;
}

export async function updateMemberProject(userId: string, id: string, input: {
  title?: string;
  category?: string;
  description?: string;
  timeline?: string;
  budget?: string;
  supportTypes?: string[];
  submit?: boolean;
}) {
  const existing = await loadOwnedProject(userId, id);
  if (!MEMBER_EDITABLE.includes(existing.status)) {
    throw ApiError.conflict('Projects under review can no longer be edited');
  }

  const promoting = input.submit === true && existing.status === 'DRAFT';
  const scalars = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.timeline !== undefined ? { timeline: input.timeline } : {}),
    ...(input.budget !== undefined ? { budget: input.budget } : {}),
    ...(promoting ? { status: 'SUBMITTED' as const, submittedAt: new Date() } : {}),
  };

  const project = await prisma.$transaction(async (tx) => {
    // @@unique([projectId, kind]) means the set has to be cleared before it is
    // rewritten, so replacement happens in the same transaction as the update.
    if (input.supportTypes) {
      await tx.projectSupportType.deleteMany({ where: { projectId: id } });
      const kinds = [...new Set(input.supportTypes.map(labelToSupportKind))];
      if (kinds.length) {
        await tx.projectSupportType.createMany({ data: kinds.map((kind) => ({ projectId: id, kind })) });
      }
    }
    if (promoting) {
      await tx.projectStatusHistory.create({
        data: { projectId: id, fromStatus: existing.status, toStatus: 'SUBMITTED', actorId: userId, note: 'Project submitted for review' },
      });
    }
    return tx.project.update({ where: { id }, data: scalars, include: { supportTypes: true } });
  });

  return serializeProject(project);
}

export async function deleteMemberProject(userId: string, id: string) {
  const existing = await loadOwnedProject(userId, id);
  if (!MEMBER_EDITABLE.includes(existing.status)) {
    throw ApiError.conflict('Projects under review can no longer be deleted');
  }

  // Soft delete: every list query already filters on `deletedAt: null`, and the
  // history row keeps the audit trail intact.
  await prisma.$transaction([
    prisma.project.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.projectStatusHistory.create({
      data: { projectId: id, fromStatus: existing.status, toStatus: existing.status, actorId: userId, note: 'Project deleted by owner' },
    }),
  ]);

  return { id };
}

export async function memberSupport(userId: string, req: Request) {
  return supportService.listSupport(req, userId);
}

export async function createSupport(userId: string, input: unknown) {
  return supportService.createSupport(userId, supportService.createBody.parse(input));
}

export async function memberPublications(userId: string, req: Request) {
  const pagination = parsePage(req);
  const status = String(req.query.status ?? 'All');
  const category = String(req.query.category ?? 'All');
  const q = String(req.query.q ?? req.query.search ?? '').trim();

  const where: Prisma.PublicationWhereInput = {
    authorId: userId,
    ...(status !== 'All' ? { status: labelToPublicationStatus(status) } : {}),
    ...(category !== 'All' ? { category } : {}),
    // Filtered here rather than on the client so `total` counts the same rows
    // the list shows — a page-local filter would misreport the count.
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { venue: { contains: q } },
            { doi: { contains: q } },
            { authors: { contains: q } },
          ],
        }
      : {}),
  };

  const [items, total, stats] = await Promise.all([
    prisma.publication.findMany({
      where,
      // serializePublication reads all three; without the includes the author,
      // member id and attachment list come back undefined. `reviews` is what
      // carries the editor's decision back to the person who submitted.
      include: {
        author: { include: { memberProfile: true } },
        files: { include: { file: true } },
        reviews: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.publication.count({ where }),
    memberPublicationStats(userId),
  ]);

  const rows = items.map((row) => ({
    ...serializePublication(row),
    // The most recent editorial decision, so a rejected author sees why rather
    // than a bare red badge. Null until an editor has acted.
    decisionNote: row.reviews[0]
      ? {
          decision: publicationStatusLabel[row.reviews[0].decision as PublicationStatus] ?? row.reviews[0].decision,
          comment: row.reviews[0].comment,
          at: row.reviews[0].createdAt,
        }
      : null,
  }));

  return { ...buildPaginatedResult(rows, total, pagination), stats };
}

/**
 * Headline counters for the Published Works page.
 *
 * Deliberately unfiltered: these are totals for the member, so the cards stay
 * still while the list below them is filtered. Scoping them to the active
 * filter would make "Total Views" mean something different on every keystroke.
 */
async function memberPublicationStats(userId: string) {
  const now = Date.now();
  const last30 = new Date(now - 30 * 86_400_000);
  const previous30 = new Date(now - 60 * 86_400_000);
  const mine = { publication: { authorId: userId } };

  const [total, published, totals, recentViews, priorViews] = await Promise.all([
    prisma.publication.count({ where: { authorId: userId } }),
    prisma.publication.count({ where: { authorId: userId, status: 'PUBLISHED' } }),
    prisma.publication.aggregate({
      where: { authorId: userId },
      _sum: { viewCount: true, downloadCount: true },
    }),
    prisma.publicationView.count({ where: { ...mine, viewedAt: { gte: last30 } } }),
    prisma.publicationView.count({ where: { ...mine, viewedAt: { gte: previous30, lt: last30 } } }),
  ]);

  return {
    total,
    published,
    views: totals._sum.viewCount ?? 0,
    downloads: totals._sum.downloadCount ?? 0,
    // Null rather than +100% when there is no prior window to compare against —
    // a percentage change from zero is not a number the member can act on.
    readershipTrend: priorViews === 0 ? null : Math.round(((recentViews - priorViews) / priorViews) * 100),
  };
}

/**
 * Categories and article types the member submission form offers. Kept as the
 * single source of truth so the route's zod enum and any future admin filter
 * agree with what the page can actually produce.
 */
export const PUBLICATION_CATEGORIES = [
  'Mental Health',
  'Scientific Research',
  'Product Reviews',
  'Service Analysis',
] as const;

export const PUBLICATION_RESEARCH_TYPES = [
  'Original Research',
  'Review Article',
  'Systematic Review / Meta-analysis',
  'Case Study',
  'Short Communication',
  'Commentary',
] as const;

export interface CreatePublicationInput {
  title: string;
  category: string;
  researchType: string;
  venue: string;
  authors: string;
  correspondingAuthor: string;
  correspondingEmail: string;
  orcid?: string;
  abstract: string;
  keywords: string;
  funding?: string;
  conflicts: string;
  ethicsApproval?: string;
  coverLetter?: string;
  manuscriptFileId: string;
  supplementaryFileId?: string;
}

/**
 * Submits a new manuscript on behalf of its author.
 *
 * Goes straight to SUBMITTED — the form has no "save as draft" affordance, and
 * a member-visible DRAFT that nothing can move on would just look stuck. The
 * CRO queue picks it up from there via `transitionPublication`.
 */
export async function createPublication(userId: string, input: CreatePublicationInput) {
  // Re-checks that both uploads belong to the caller. Without this a member
  // could attach someone else's fileId and gain download rights through the
  // publication-author branch of the file ACL.
  const manuscript = (await assertOwnedFiles(userId, [input.manuscriptFileId]))[0]!;
  const supplementary = input.supplementaryFileId
    ? (await assertOwnedFiles(userId, [input.supplementaryFileId]))[0]
    : undefined;

  // Double-submits are the common case here: a slow upload, an impatient
  // second click. The client disables the button, but only the server can
  // catch a retry that arrives on a fresh request.
  const duplicate = await prisma.publication.findFirst({
    where: { authorId: userId, title: input.title.trim(), status: { not: 'REJECTED' } },
    select: { id: true },
  });
  if (duplicate) {
    throw ApiError.conflict('You have already submitted a paper with this title.');
  }

  const files = [{ fileId: manuscript, kind: 'MANUSCRIPT' }];
  // A member may pick the same file for both slots; @@unique would reject the
  // second row, so collapse it to one attachment instead of failing the submit.
  if (supplementary && supplementary !== manuscript) {
    files.push({ fileId: supplementary, kind: 'SUPPLEMENTARY' });
  }

  const publication = await prisma.publication.create({
    data: {
      authorId: userId,
      title: input.title.trim(),
      category: input.category,
      researchType: input.researchType,
      venue: input.venue,
      abstract: input.abstract,
      authors: input.authors,
      correspondingAuthor: input.correspondingAuthor,
      correspondingEmail: input.correspondingEmail,
      orcid: input.orcid ?? null,
      keywords: input.keywords,
      funding: input.funding ?? null,
      conflicts: input.conflicts,
      ethicsApproval: input.ethicsApproval ?? null,
      coverLetter: input.coverLetter ?? null,
      status: 'SUBMITTED',
      submittedAt: new Date(),
      files: { create: files },
      histories: { create: { toStatus: 'SUBMITTED', actorId: userId, note: 'Manuscript submitted for review' } },
    },
    include: { author: { include: { memberProfile: true } }, files: { include: { file: true } } },
  });

  // Written here rather than through `transitionPublication`, which hardcodes
  // actorRole ADMIN and would misattribute a member's own submission.
  await writeAudit({
    actorId: userId,
    actorLabel: userId,
    actorRole: 'MEMBER',
    action: 'PublicationSubmitted',
    entity: `Publication ${publication.id}`,
    severity: 'SUCCESS',
    description: `Submitted "${publication.title}" for review`,
  });

  return serializePublication(publication);
}

export async function memberDocuments(userId: string, req: Request) {
  const pagination = parsePage(req);
  // Paginate over attachments, not messages: one message can carry several, so
  // paging the parent overflows the requested limit and reports a total that
  // counts the wrong thing. `internal: false` matters most — without it this
  // route hands the member the body of every admin-only note that has a file.
  const where: Prisma.MessageAttachmentWhereInput = {
    file: { deletedAt: null },
    message: {
      internal: false,
      conversation: { participants: { some: { userId } } },
    },
  };

  const [rows, total] = await Promise.all([
    prisma.messageAttachment.findMany({
      where,
      include: { file: true, message: true },
      orderBy: { message: { createdAt: 'desc' } },
      ...toSkipTake(pagination),
    }),
    prisma.messageAttachment.count({ where }),
  ]);

  const items = rows.map((a) => ({
    id: a.fileId,
    name: a.file.originalName,
    type: a.file.mimeType,
    size: a.file.sizeBytes,
    sender: a.message.senderName,
    direction: a.message.senderId === userId ? 'outgoing' : 'incoming',
    date: a.message.createdAt,
    note: a.message.body,
  }));
  return buildPaginatedResult(items, total, pagination);
}

export async function memberConversations(userId: string, req: Request) {
  const pagination = parsePage(req);
  const where = { participants: { some: { userId } } };
  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: conversationListInclude,
      orderBy: { updatedAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.conversation.count({ where }),
  ]);
  const unread = await unreadCountsFor(userId, rows.map((r) => r.id));
  return buildPaginatedResult(rows.map((r) => serializeConversation(r, unread)), total, pagination);
}

/**
 * Unread messages per conversation for one reader.
 *
 * Each participant row carries its own `lastReadAt`, so this cannot be a single
 * shared cutoff — it becomes one OR clause per conversation, which still runs as
 * a single grouped query for the page being rendered. Your own messages never
 * count as unread, and internal admin notes are invisible to members.
 */
async function unreadCountsFor(userId: string, conversationIds: string[]): Promise<Map<string, number>> {
  if (!conversationIds.length) return new Map();

  const participants = await prisma.conversationParticipant.findMany({
    where: { userId, conversationId: { in: conversationIds } },
    select: { conversationId: true, lastReadAt: true },
  });
  if (!participants.length) return new Map();

  const groups = await prisma.message.groupBy({
    by: ['conversationId'],
    where: {
      OR: participants.map((p) => ({
        conversationId: p.conversationId,
        senderId: { not: userId },
        internal: false,
        ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
      })),
    },
    _count: { _all: true },
  });

  return new Map(groups.map((g) => [g.conversationId, g._count._all]));
}

/** Total unread across every thread this user takes part in — the sidebar badge. */
export async function unreadMessageTotal(userId: string) {
  const participants = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });
  if (!participants.length) return 0;
  return prisma.message.count({
    where: {
      OR: participants.map((p) => ({
        conversationId: p.conversationId,
        senderId: { not: userId },
        internal: false,
        ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
      })),
    },
  });
}

/** Marks everything in a thread read for one participant. */
export async function markConversationRead(userId: string, conversationId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  if (!participant) throw ApiError.notFound('Conversation not found');
  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });
  return { ok: true };
}

/**
 * Writes a message and everything that must move with it.
 *
 * Creating a Message does not touch the Conversation row, so `@updatedAt` never
 * fires on its own — without the explicit touch here both inboxes stay sorted by
 * creation order and a reply never lifts its thread to the top.
 */
async function writeMessage(opts: {
  conversationId: string;
  sender: { id: string; fullName: string; role: string; memberProfile: { memberId: string | null } | null };
  body: string;
  internal: boolean;
  subject: string;
  recipientIds: string[];
  /** Already ownership-checked and de-duplicated by assertOwnedFiles. */
  fileIds?: string[];
  links?: { url: string; label?: string }[];
}) {
  const { conversationId, sender, body, internal, subject, recipientIds } = opts;
  const fileIds = opts.fileIds ?? [];
  const links = opts.links ?? [];
  const senderName = memberName(sender);
  const linkedSupport = await prisma.supportRequest.findUnique({ where: { conversationId } });
  const recipients = await prisma.user.findMany({ where: { id: { in: recipientIds }, status: 'ACTIVE', deletedAt: null }, select: { id: true, role: true } });

  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.message.create({
      data: {
        conversationId,
        senderId: sender.id,
        senderName,
        senderRole: sender.role,
        body,
        internal,
        // Nested rather than separate entries: this $transaction takes an array
        // of promises, which cannot see the new message's id.
        attachments: { create: fileIds.map((fileId) => ({ fileId })) },
        sharedLinks: { create: links.map(({ url, label }) => ({ url, label: label ?? null })) },
      },
    }),
    prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    // You have read what you just wrote.
    prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: sender.id },
      data: { lastReadAt: new Date() },
    }),
  ];

  // Internal notes are admin-only and must never surface to the member.
  if (!internal) {
    if (linkedSupport) writes.push(prisma.supportRequest.update({ where: { id: linkedSupport.id }, data: { updatedAt: new Date() } }));
    for (const recipient of recipients) {
      const userId = recipient.id;
      writes.push(
        prisma.notification.create({
          data: {
            userId,
            title: `New message from ${sender.fullName}`,
            body: body.length > 160 ? `${body.slice(0, 157)}...` : body,
            type: 'message',
            link: linkedSupport ? `${recipient.role === 'ADMIN' ? '/admin' : '/dashboard'}/support/${linkedSupport.id}` : recipient.role === 'ADMIN' ? `/admin/messages/${conversationId}` : '/dashboard/messages',
          },
        }),
      );
    }
  }

  if (linkedSupport) writes.push(prisma.auditLog.create({ data: {
    actorId: sender.id, actorLabel: sender.fullName, actorRole: sender.role,
    action: internal ? 'SupportInternalNoteAdded' : 'SupportReplySent', entity: `SupportRequest ${linkedSupport.id}`,
    severity: 'INFO', description: internal ? 'Internal note added' : 'Reply sent',
  } }));

  await prisma.$transaction(writes);
  return { conversationId, subject, senderName };
}

async function loadSender(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { memberProfile: true } });
  if (!user) throw new ApiError(401, 'Invalid session');
  return user;
}

/** What a caller may attach to a message. */
export interface MessagePayload {
  body: string;
  fileIds?: string[];
  links?: { url: string; label?: string }[];
}

export async function postMemberMessage(userId: string, conversationId: string, input: MessagePayload) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, participants: { some: { userId } } },
    include: { participants: { select: { userId: true } } },
  });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  const sender = await loadSender(userId);
  // Throws 404 if any id is not an upload this caller made, and returns the
  // de-duplicated set — the only guard against duplicate attachment rows, since
  // MessageAttachment has no unique index.
  const fileIds = await assertOwnedFiles(userId, input.fileIds ?? []);
  return writeMessage({
    conversationId,
    sender,
    body: input.body,
    internal: false,
    subject: conversation.subject,
    recipientIds: conversation.participants.map((p) => p.userId).filter((id) => id !== userId),
    fileIds,
    links: input.links,
  });
}

/**
 * Admin reply. Unlike the member path this does not require prior membership of
 * the thread — any CRO can pick up any conversation — so the admin is added as a
 * participant on first reply. The @@unique([conversationId, userId]) makes that
 * an upsert rather than a duplicate.
 */
export async function postAdminMessage(
  adminId: string,
  conversationId: string,
  input: MessagePayload & { internal?: boolean },
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { select: { userId: true } } },
  });
  if (!conversation) throw ApiError.notFound('Conversation not found');

  const sender = await loadSender(adminId);
  // Same rule as the member path: you may only attach your own uploads.
  const fileIds = await assertOwnedFiles(adminId, input.fileIds ?? []);

  await prisma.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId, userId: adminId } },
    create: { conversationId, userId: adminId, roleLabel: 'CRO Office' },
    update: {},
  });

  return writeMessage({
    conversationId,
    sender,
    body: input.body,
    internal: input.internal ?? false,
    subject: conversation.subject,
    recipientIds: conversation.participants.map((p) => p.userId).filter((id) => id !== adminId),
    fileIds,
    links: input.links,
  });
}

/** Members open threads with the CRO; every active admin joins so any can reply. */
export async function createMemberConversation(
  userId: string,
  input: MessagePayload & { subject: string; category: string },
) {
  const sender = await loadSender(userId);
  // Checked before the conversation is created: this function and writeMessage
  // are not one transaction, so a late throw would leave an empty thread.
  const fileIds = await assertOwnedFiles(userId, input.fileIds ?? []);
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });

  const conversation = await prisma.conversation.create({
    data: {
      subject: input.subject,
      category: input.category,
      status: 'Open',
      priority: 'Standard',
      participants: {
        create: [
          { userId, roleLabel: 'Member' },
          ...admins.map((a) => ({ userId: a.id, roleLabel: 'CRO Office' })),
        ],
      },
    },
  });

  await writeMessage({
    conversationId: conversation.id,
    sender,
    body: input.body,
    internal: false,
    subject: conversation.subject,
    recipientIds: admins.map((a) => a.id),
    fileIds,
    links: input.links,
  });

  return { id: conversation.id, subject: conversation.subject, category: conversation.category };
}

/** How recently a sign-in still counts as "online" on the community page. */
const ONLINE_WINDOW_MINUTES = 15;

/** Category given to threads started from the page, which has no category control. */
const DEFAULT_THREAD_CATEGORY = 'General';

/**
 * Shortest discussion title worth putting in front of the community.
 *
 * Exported so the route schema and the form enforce one number: when only the
 * server knew it, the Publish button stayed enabled below the limit and every
 * short title became a 422 the member could not see or predict.
 */
export const DISCUSSION_TITLE_MIN = 8;
export const DISCUSSION_TITLE_MAX = 220;

/**
 * Resolves the caller's member profile — the id space connections and group
 * memberships are keyed on. A member always has one; the throw is a guard
 * against an ADMIN reaching member routes through the role bypass.
 */
async function loadMemberProfile(userId: string) {
  const profile = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw ApiError.notFound('Member profile not found');
  return profile;
}

export async function memberCommunity(userId: string, req: Request) {
  const pagination = parsePage(req);
  const q = String(req.query.q ?? '').trim();
  const interest = String(req.query.interest ?? '').trim();
  const me = await loadMemberProfile(userId);

  const where: Prisma.MemberProfileWhereInput = {
    user: { status: 'ACTIVE', role: 'MEMBER' },
    // You are not a peer to connect with, so you never appear in your own directory.
    id: { not: me.id },
    ...(interest ? { interests: { some: { name: interest } } } : {}),
    ...(q
      ? {
          OR: [
            { user: { fullName: { contains: q } } },
            { institution: { contains: q } },
            { country: { contains: q } },
            { professionalType: { contains: q } },
            { professionalTitle: { contains: q } },
            { interests: { some: { name: { contains: q } } } },
          ],
        }
      : {}),
  };

  const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60_000);

  const [profiles, total, groups, threads, connections, stats] = await Promise.all([
    prisma.memberProfile.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, _count: { select: { projects: true, publications: true } } } },
        interests: true,
      },
      ...toSkipTake(pagination),
      orderBy: { approvedAt: 'desc' },
    }),
    // Same `where` as the rows: counting the unfiltered table reported a page
    // count for a result set the directory was not showing.
    prisma.memberProfile.count({ where }),
    prisma.interestGroup.findMany({
      include: { _count: { select: { members: true } }, members: { where: { profileId: me.id }, select: { id: true } } },
      orderBy: { createdAt: 'asc' },
      take: 12,
    }),
    prisma.discussionThread.findMany({
      include: { _count: { select: { replies: true } }, author: { select: { fullName: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
    // Every connection touching me, in either direction — the button's state
    // depends on who asked whom.
    prisma.memberConnection.findMany({
      where: { OR: [{ requesterId: me.id }, { addresseeId: me.id }] },
      select: { requesterId: true, addresseeId: true, status: true },
    }),
    communityStats(onlineSince),
  ]);

  const statusFor = (profileId: string): 'none' | 'requested' | 'connected' => {
    const row = connections.find(
      (c) =>
        (c.requesterId === me.id && c.addresseeId === profileId)
        || (c.addresseeId === me.id && c.requesterId === profileId),
    );
    if (!row) return 'none';
    return row.status === 'Accepted' ? 'connected' : 'requested';
  };

  return {
    members: buildPaginatedResult(
      profiles.map((p) => ({
        // Connections are keyed on the profile; direct messages on the user.
        // The page needs both, so both are named rather than overloading `id`.
        id: p.id,
        userId: p.user.id,
        name: p.user.fullName,
        title: p.professionalTitle ?? p.professionalType,
        institution: p.institution,
        country: p.country,
        type: p.professionalType,
        interests: p.interests.map((i) => i.name),
        projects: p.user._count.projects,
        pubs: p.user._count.publications,
        connectionStatus: statusFor(p.id),
      })),
      total,
      pagination,
    ),
    // `id` and `joined` are what let the UI address a group at all — the
    // previous payload carried neither.
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      members: g._count.members,
      tag: g.tag,
      joined: g.members.length > 0,
    })),
    threads: threads.map((t) => ({
      id: t.id,
      title: t.title,
      replies: t._count.replies,
      lastPost: t.updatedAt,
      category: t.category,
      author: t.author?.fullName ?? 'Former member',
    })),
    stats,
  };
}

/** Headline counters for the community page, computed over the whole platform. */
async function communityStats(onlineSince: Date) {
  const activeMember = { status: 'ACTIVE' as const, role: 'MEMBER' as const };
  const [totalMembers, countries, groups, online] = await Promise.all([
    prisma.user.count({ where: activeMember }),
    prisma.memberProfile.findMany({
      where: { user: activeMember, country: { not: null } },
      distinct: ['country'],
      select: { country: true },
    }),
    prisma.interestGroup.count(),
    // There is no presence tracking on the platform; a recent sign-in is the
    // closest honest proxy.
    prisma.user.count({ where: { ...activeMember, lastLoginAt: { gte: onlineSince } } }),
  ]);
  return { totalMembers, countries: countries.length, groups, online };
}

/**
 * Requests a connection, or completes one.
 *
 * The page has no accept/decline inbox, so a connection forms when both people
 * have asked for it: the reverse request flips the pair to Accepted. The unique
 * index is directional, so the mirrored row has to be caught here.
 */
export async function requestConnection(userId: string, profileId: string) {
  const me = await loadMemberProfile(userId);
  if (profileId === me.id) throw new ApiError(422, 'You cannot connect with yourself');

  const target = await prisma.memberProfile.findFirst({
    where: { id: profileId, user: { status: 'ACTIVE', role: 'MEMBER' } },
    select: { id: true },
  });
  if (!target) throw ApiError.notFound('Member not found');

  const existing = await prisma.memberConnection.findFirst({
    where: {
      OR: [
        { requesterId: me.id, addresseeId: profileId },
        { requesterId: profileId, addresseeId: me.id },
      ],
    },
  });

  if (existing?.requesterId === me.id) {
    throw ApiError.conflict('You have already sent this member a request');
  }

  if (existing) {
    // They asked first; this request is the acceptance.
    await prisma.memberConnection.update({ where: { id: existing.id }, data: { status: 'Accepted' } });
    return { status: 'connected' as const };
  }

  await prisma.memberConnection.create({ data: { requesterId: me.id, addresseeId: profileId, status: 'Pending' } });
  return { status: 'requested' as const };
}

/** Cancels a pending request or removes an existing connection, either direction. */
export async function removeConnection(userId: string, profileId: string) {
  const me = await loadMemberProfile(userId);
  const { count } = await prisma.memberConnection.deleteMany({
    where: {
      OR: [
        { requesterId: me.id, addresseeId: profileId },
        { requesterId: profileId, addresseeId: me.id },
      ],
    },
  });
  if (!count) throw ApiError.notFound('Connection not found');
  return { status: 'none' as const };
}

export async function joinGroup(userId: string, groupId: string) {
  const me = await loadMemberProfile(userId);
  const group = await prisma.interestGroup.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) throw ApiError.notFound('Group not found');

  // Idempotent: joining a group twice is the same as being in it once.
  await prisma.interestGroupMember
    .create({ data: { groupId, profileId: me.id } })
    .catch(() => undefined);
  return { joined: true };
}

export async function leaveGroup(userId: string, groupId: string) {
  const me = await loadMemberProfile(userId);
  const { count } = await prisma.interestGroupMember.deleteMany({ where: { groupId, profileId: me.id } });
  if (!count) throw ApiError.notFound('You are not a member of this group');
  return { joined: false };
}

export async function createDiscussionThread(userId: string, input: { title: string; category?: string }) {
  await loadMemberProfile(userId);
  const thread = await prisma.discussionThread.create({
    data: {
      authorId: userId,
      title: input.title.trim(),
      // The page's form is a single title field, so everything it starts lands
      // in one bucket rather than inventing a category the member never chose.
      category: input.category?.trim() || DEFAULT_THREAD_CATEGORY,
    },
  });
  return { id: thread.id, title: thread.title, category: thread.category };
}

export async function threadDetail(userId: string, threadId: string) {
  await loadMemberProfile(userId);
  const thread = await prisma.discussionThread.findUnique({
    where: { id: threadId },
    include: {
      author: { select: { fullName: true } },
      replies: { orderBy: { createdAt: 'asc' }, include: { author: { select: { fullName: true } } } },
    },
  });
  if (!thread) throw ApiError.notFound('Discussion not found');
  return {
    id: thread.id,
    title: thread.title,
    category: thread.category,
    author: thread.author?.fullName ?? 'Former member',
    lastPost: thread.updatedAt,
    replies: thread.replies.map((r) => ({
      id: r.id,
      body: r.body,
      author: r.author?.fullName ?? 'Former member',
      at: r.createdAt,
      mine: r.authorId === userId,
    })),
  };
}

export async function replyToThread(userId: string, threadId: string, body: string) {
  await loadMemberProfile(userId);
  const thread = await prisma.discussionThread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!thread) throw ApiError.notFound('Discussion not found');

  await prisma.$transaction([
    prisma.discussionReply.create({ data: { threadId, authorId: userId, body: body.trim() } }),
    // Touched so the thread rises to the top of the list, which orders by it.
    prisma.discussionThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } }),
  ]);
  return threadDetail(userId, threadId);
}

/** Conversations between two members, kept out of the CRO queue. */
const DIRECT_KIND = 'DIRECT';

/** Resolves the other member of a direct conversation, or 404s. */
async function loadDirectPeer(userId: string, peerUserId: string) {
  if (peerUserId === userId) throw new ApiError(422, 'You cannot message yourself');
  const peer = await prisma.user.findFirst({
    where: { id: peerUserId, status: 'ACTIVE', role: 'MEMBER', deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!peer) throw ApiError.notFound('Member not found');
  return peer;
}

/**
 * The one-to-one thread between two members, if it exists.
 *
 * Matched on participants rather than a key column: a direct conversation is
 * defined by exactly who is in it.
 */
async function findDirectConversation(userId: string, peerUserId: string) {
  return prisma.conversation.findFirst({
    where: {
      kind: DIRECT_KIND,
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: peerUserId } } },
      ],
    },
    select: { id: true, subject: true },
  });
}

/** The direct thread with one member, newest last. Empty when none has started. */
export async function directConversation(userId: string, peerUserId: string) {
  await loadMemberProfile(userId);
  const peer = await loadDirectPeer(userId, peerUserId);
  const conversation = await findDirectConversation(userId, peerUserId);
  if (!conversation) return { peer, conversationId: null, messages: [] };

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id, internal: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true, body: true, senderId: true, senderName: true, createdAt: true },
  });

  return {
    peer,
    conversationId: conversation.id,
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      author: m.senderName,
      at: m.createdAt,
      mine: m.senderId === userId,
    })),
  };
}

/**
 * Sends a direct message, starting the thread on first send.
 *
 * Reuses `writeMessage` so notifications, read state and attachments behave
 * exactly as they do for CRO threads; only the participants and `kind` differ.
 */
export async function sendDirectMessage(userId: string, peerUserId: string, body: string) {
  await loadMemberProfile(userId);
  const peer = await loadDirectPeer(userId, peerUserId);
  const sender = await loadSender(userId);

  let conversation = await findDirectConversation(userId, peerUserId);
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        subject: `${sender.fullName} & ${peer.fullName}`,
        category: 'Community',
        kind: DIRECT_KIND,
        status: 'Open',
        priority: 'Standard',
        participants: {
          create: [
            { userId, roleLabel: 'Member' },
            { userId: peer.id, roleLabel: 'Member' },
          ],
        },
      },
      select: { id: true, subject: true },
    });
  }

  await writeMessage({
    conversationId: conversation.id,
    sender,
    body: body.trim(),
    internal: false,
    subject: conversation.subject,
    recipientIds: [peer.id],
  });

  return directConversation(userId, peerUserId);
}

/**
 * Threads whose newest visible message came from a member — i.e. the CRO owes a
 * reply. The previous version counted every non-internal message ever sent, so
 * the sidebar badge only ever grew.
 */
export async function conversationsAwaitingReply() {
  const rows = await prisma.conversation.findMany({
    where: { status: { not: 'Closed' } },
    select: { messages: { where: { internal: false }, orderBy: { createdAt: 'desc' }, take: 1, select: { senderRole: true } } },
  });
  return rows.filter((r) => r.messages[0]?.senderRole === 'MEMBER').length;
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
    conversationsAwaitingReply(),
    prisma.event.count({ where: { deletedAt: null, status: 'PUBLISHED', date: { gte: new Date() } } }),
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
      fileName: c.file?.originalName ?? null,
      mimeType: c.file?.mimeType ?? null,
      sizeBytes: c.file?.sizeBytes ?? null,
      fileSize: c.file ? `${Math.round(c.file.sizeBytes / 1024)} KB` : 'No file',
      uploadedAt: c.file?.createdAt ?? c.createdAt,
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

/** Days a queued project may sit before the review SLA is considered breached. */
const PROJECT_SLA_DAYS = 7;

/** Shortest review note that counts as an explanation for a rejection. */
export const REJECTION_NOTE_MIN = 10;

/** Project outcomes worth notifying the owner about. */
const MEMBER_VISIBLE_TRANSITIONS: ProjectStatus[] = ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED'];

/** Statuses that still count as waiting on the CRO. */
const PROJECT_QUEUE_STATUSES: ProjectStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];

function optionalQuery(req: Request, key: string): string {
  const value = req.query[key];
  const text = String(value ?? '').trim();
  return text && text !== 'All' ? text : '';
}

/**
 * Headline counts for the admin projects screen. Deliberately computed over the
 * whole table rather than the filtered page — these are standing KPIs, so they
 * must not move when an admin narrows the grid.
 */
async function adminProjectCounts() {
  const live: Prisma.ProjectWhereInput = { deletedAt: null };
  const slaCutoff = new Date(Date.now() - PROJECT_SLA_DAYS * 86_400_000);

  const [byStatus, slaBreach, urgent] = await Promise.all([
    prisma.project.groupBy({ by: ['status'], where: live, _count: { _all: true } }),
    prisma.project.count({
      where: { ...live, status: { in: PROJECT_QUEUE_STATUSES }, submittedAt: { lte: slaCutoff } },
    }),
    prisma.project.count({ where: { ...live, priority: 'Urgent' } }),
  ]);

  const of = (status: ProjectStatus) => byStatus.find((row) => row.status === status)?._count._all ?? 0;

  return {
    total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
    inReview: of('SUBMITTED') + of('UNDER_REVIEW'),
    approved: of('APPROVED'),
    published: of('PUBLISHED'),
    slaBreach,
    urgent,
  };
}

export async function adminProjects(req: Request) {
  const pagination = parsePage(req);
  const q = String(req.query.q ?? req.query.search ?? '').trim();
  const status = optionalQuery(req, 'status');
  const category = optionalQuery(req, 'category');
  const priority = optionalQuery(req, 'priority');
  const member = optionalQuery(req, 'member');
  const submittedFrom = parseDateBound(optionalQuery(req, 'submittedFrom'));
  const submittedTo = parseDateBound(optionalQuery(req, 'submittedTo'), true);

  const where: Prisma.ProjectWhereInput = {
    // Soft-deleted projects are gone as far as the member is concerned, so the
    // review queue must not resurrect them either.
    deletedAt: null,
    ...(status ? { status: labelToProjectStatus(status) } : {}),
    ...(category ? { category } : {}),
    ...(priority ? { priority } : {}),
    ...(member
      ? {
          owner: {
            OR: [
              { fullName: { contains: member } },
              { memberProfile: { memberId: { contains: member } } },
            ],
          },
        }
      : {}),
    ...(submittedFrom || submittedTo
      ? { submittedAt: { ...(submittedFrom ? { gte: submittedFrom } : {}), ...(submittedTo ? { lte: submittedTo } : {}) } }
      : {}),
    ...(q
      ? { OR: [{ title: { contains: q } }, { category: { contains: q } }, { owner: { fullName: { contains: q } } }] }
      : {}),
  };

  // `total` has to use the same `where` as the rows, or the pager reports a
  // page count for a result set the grid is not showing.
  const [rows, total, counts, categories] = await Promise.all([
    prisma.project.findMany({
      where,
      include: { supportTypes: true, owner: { include: { memberProfile: true } } },
      orderBy: { updatedAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.project.count({ where }),
    adminProjectCounts(),
    prisma.project.findMany({
      where: { deletedAt: null },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    }),
  ]);

  return {
    ...buildPaginatedResult(rows.map(serializeProject), total, pagination),
    counts,
    categories: categories.map((row) => row.category),
  };
}

/**
 * Turns raw status-history rows into something a reviewer can read: display
 * labels instead of enum values, and actor names instead of bare ids.
 *
 * `ProjectStatusHistory.actorId` has no FK relation to User, so the actors are
 * resolved with one extra query rather than an `include`.
 */
async function serializeHistory(
  histories: { id: string; fromStatus: ProjectStatus | null; toStatus: ProjectStatus; note: string | null; actorId: string | null; createdAt: Date }[],
) {
  const actorIds = [...new Set(histories.map((h) => h.actorId).filter((id): id is string => Boolean(id)))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true } })
    : [];
  const nameById = new Map(actors.map((a) => [a.id, a.fullName]));

  return histories.map((h) => ({
    id: h.id,
    from: h.fromStatus ? projectStatusLabel[h.fromStatus] : null,
    to: projectStatusLabel[h.toStatus],
    note: h.note,
    actor: h.actorId ? nameById.get(h.actorId) ?? 'Unknown user' : 'System',
    at: h.createdAt,
  }));
}

export async function adminProjectDetail(id: string) {
  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    include: {
      supportTypes: true,
      owner: { include: { memberProfile: true } },
      histories: { orderBy: { createdAt: 'asc' } },
      files: { include: { file: true } },
      resourceLinks: true,
      supportRequests: true,
    },
  });
  if (!project) throw ApiError.notFound('Project not found');
  return {
    ...serializeProject(project),
    // The review screen needs the same depth the member's own detail view has.
    timeline: project.timeline,
    budget: project.budget,
    files: project.files.map((f) => ({ id: f.fileId, name: f.file.originalName, kind: f.kind, size: f.file.sizeBytes })),
    resourceLinks: project.resourceLinks.map((l) => ({ id: l.id, url: l.url, label: l.label })),
    history: await serializeHistory(project.histories),
    linkedSupport: project.supportRequests[0] ?? null,
  };
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
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) throw ApiError.notFound('Project not found');
  if (!allowed[project.status].includes(next)) throw new ApiError(409, `Invalid transition from ${project.status} to ${next}`);

  // A rejection the member cannot act on is worse than no rejection at all, so
  // the reason is required here and not only in the route schema.
  const trimmedNote = note?.trim() ?? '';
  if (next === 'REJECTED' && trimmedNote.length < REJECTION_NOTE_MIN) {
    throw new ApiError(422, `A rejection needs at least ${REJECTION_NOTE_MIN} characters of review notes`, [
      { field: 'reviewNotes', message: `Explain the decision in at least ${REJECTION_NOTE_MIN} characters` },
    ]);
  }

  const label = projectStatusLabel[next];
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.project.update({ where: { id }, data: { status: next, ...(next === 'PUBLISHED' ? { publishedAt: new Date() } : {}) } }),
    prisma.projectStatusHistory.create({ data: { projectId: id, fromStatus: project.status, toStatus: next, actorId, note: trimmedNote || null } }),
    prisma.auditLog.create({ data: { actorId, actorLabel: actorId, actorRole: 'ADMIN', action: 'ProjectStatusChanged', entity: `Project ${id}`, severity: next === 'REJECTED' ? 'DANGER' : 'SUCCESS', description: trimmedNote || `Project moved to ${next}` } }),
  ];

  // Outcomes the owner should hear about. Housekeeping moves (ARCHIVED, or a
  // reopen back to DRAFT) stay silent.
  if (MEMBER_VISIBLE_TRANSITIONS.includes(next)) {
    writes.push(
      prisma.notification.create({
        data: {
          userId: project.ownerId,
          title: `Project ${label.toLowerCase()}`,
          body: trimmedNote || `Your project "${project.title}" is now ${label}.`,
          type: 'project',
          link: '/dashboard/projects',
        },
      }),
    );
  }

  await prisma.$transaction(writes);
  return { ok: true, to: label };
}

/**
 * Statuses still waiting on an editorial decision. `APPROVED` counts as worked
 * rather than queued — it is done being reviewed and is waiting to be published.
 */
const PUBLICATION_QUEUE_STATUSES: PublicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];

/** The three tabs on the admin queue, expressed as publication statuses. */
const PUBLICATION_QUEUES: Record<string, PublicationStatus[]> = {
  review: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'],
  published: ['PUBLISHED'],
};

/**
 * Shortest editorial note that counts as an explanation for rejecting a paper.
 *
 * Publication-owned on purpose: the projects module has its own threshold, and
 * one review policy must not silently move because the other changed.
 */
export const PUBLICATION_REJECTION_NOTE_MIN = 10;

/** Outcomes the author should hear about. Excludes the DRAFT/SUBMITTED moves they make themselves. */
const PUBLICATION_AUTHOR_VISIBLE: PublicationStatus[] = ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED'];

export async function adminPublications(req: Request) {
  const pagination = parsePage(req);
  const q = String(req.query.q ?? req.query.search ?? '').trim();
  const status = optionalQuery(req, 'status');
  const category = optionalQuery(req, 'category');
  const member = optionalQuery(req, 'member');
  const queue = PUBLICATION_QUEUES[String(req.query.queue ?? '')];

  const where: Prisma.PublicationWhereInput = {
    // An explicit status filter is narrower than the tab, so it wins.
    ...(status ? { status: labelToPublicationStatus(status) } : queue ? { status: { in: queue } } : {}),
    ...(category ? { category } : {}),
    ...(member
      ? {
          author: {
            OR: [
              { fullName: { contains: member } },
              { memberProfile: { memberId: { contains: member } } },
            ],
          },
        }
      : {}),
    // Searches the manuscript's own identifiers plus its author, which is what
    // an editor actually has to hand when chasing a paper.
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { venue: { contains: q } },
            { doi: { contains: q } },
            { authors: { contains: q } },
            { author: { fullName: { contains: q } } },
            { author: { memberProfile: { memberId: { contains: q } } } },
          ],
        }
      : {}),
  };

  // `total` has to use the same `where` as the rows, or the pager reports a
  // page count for a result set the grid is not showing.
  const [rows, total, counts, categories] = await Promise.all([
    prisma.publication.findMany({
      where,
      include: { author: { include: { memberProfile: true } }, files: { include: { file: true } } },
      orderBy: { updatedAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.publication.count({ where }),
    adminPublicationCounts(),
    prisma.publication.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
  ]);

  return {
    ...buildPaginatedResult(rows.map(serializePublication), total, pagination),
    counts,
    categories: categories.map((row) => row.category),
  };
}

/**
 * Headline figures for the publications queue.
 *
 * Deliberately computed over the whole table rather than the filtered page —
 * these are standing editorial KPIs and must not move when an admin narrows
 * the grid. Every metric is publication-specific: a manuscript's public
 * readership and the time it spends in review have no project equivalent.
 */
async function adminPublicationCounts() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [byStatus, publishedThisMonth, views, decided] = await Promise.all([
    prisma.publication.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.publication.count({ where: { status: 'PUBLISHED', publishedAt: { gte: monthStart } } }),
    prisma.publication.aggregate({ _sum: { viewCount: true }, where: { status: 'PUBLISHED' } }),
    prisma.publication.findMany({
      where: { submittedAt: { not: null }, approvedAt: { not: null } },
      select: { submittedAt: true, approvedAt: true },
    }),
  ]);

  const of = (status: PublicationStatus) => byStatus.find((row) => row.status === status)?._count._all ?? 0;

  // Mean days from submission to the approval decision. Null rather than 0 when
  // nothing has been decided — "no data yet" is not a 0-day review time.
  const reviewDays = decided.map((p) => (p.approvedAt!.getTime() - p.submittedAt!.getTime()) / 86_400_000);
  const avgReviewDays = reviewDays.length
    ? Math.round((reviewDays.reduce((sum, d) => sum + d, 0) / reviewDays.length) * 10) / 10
    : null;

  return {
    total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
    inReview: PUBLICATION_QUEUE_STATUSES.reduce((sum, status) => sum + of(status), 0),
    approved: of('APPROVED'),
    published: of('PUBLISHED'),
    rejected: of('REJECTED'),
    publishedThisMonth,
    totalViews: views._sum.viewCount ?? 0,
    avgReviewDays,
  };
}

function serializePublication(row: Prisma.PublicationGetPayload<object> & {
  author?: { fullName: string; memberProfile?: { memberId: string | null } | null };
  files?: Array<{ fileId: string; kind: string; file: { originalName: string; sizeBytes: number } }>;
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
    // Submission metadata — only set on manuscripts sent through the member
    // form, so every one of these may legitimately be null.
    authors: row.authors,
    correspondingAuthor: row.correspondingAuthor,
    correspondingEmail: row.correspondingEmail,
    orcid: row.orcid,
    keywords: row.keywords,
    funding: row.funding,
    conflicts: row.conflicts,
    ethicsApproval: row.ethicsApproval,
    coverLetter: row.coverLetter,
    // Absent unless the caller included `files`; an empty array would claim the
    // publication has no attachments, which is a different statement.
    files: row.files?.map((f) => ({
      id: f.fileId,
      name: f.file.originalName,
      kind: f.kind,
      size: f.file.sizeBytes,
    })),
  };
}

/**
 * Turns publication status history into something a reviewer can read.
 *
 * The projects module has its own version of this; they are not interchangeable
 * — that one is typed to `ProjectStatus` and maps through `projectStatusLabel`,
 * which carries an `ARCHIVED` state publications do not have.
 */
async function serializePublicationHistory(
  histories: { id: string; fromStatus: PublicationStatus | null; toStatus: PublicationStatus; note: string | null; actorId: string | null; createdAt: Date }[],
) {
  const actorIds = [...new Set(histories.map((h) => h.actorId).filter((id): id is string => Boolean(id)))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true } })
    : [];
  const nameById = new Map(actors.map((a) => [a.id, a.fullName]));

  return histories.map((h) => ({
    id: h.id,
    from: h.fromStatus ? publicationStatusLabel[h.fromStatus] : null,
    to: publicationStatusLabel[h.toStatus],
    note: h.note,
    actor: h.actorId ? nameById.get(h.actorId) ?? 'Unknown user' : 'System',
    at: h.createdAt,
  }));
}

export async function adminPublicationDetail(id: string) {
  const pub = await prisma.publication.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      author: { include: { memberProfile: true } },
      files: { include: { file: true } },
      reviews: { orderBy: { createdAt: 'desc' } },
      histories: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!pub) throw ApiError.notFound('Publication not found');

  const reviewerIds = [...new Set(pub.reviews.map((r) => r.reviewerId).filter((v): v is string => Boolean(v)))];
  const reviewers = reviewerIds.length
    ? await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, fullName: true } })
    : [];
  const reviewerName = new Map(reviewers.map((r) => [r.id, r.fullName]));

  return {
    ...serializePublication(pub),
    // The review screen shows where the author works, which the list serializer
    // has no reason to carry.
    institution: pub.author?.memberProfile?.institution ?? null,
    files: pub.files.map((f) => ({ id: f.fileId, name: f.file.originalName, kind: f.kind, size: f.file.sizeBytes })),
    reviews: pub.reviews.map((r) => ({
      id: r.id,
      decision: publicationStatusLabel[r.decision as PublicationStatus] ?? r.decision,
      comment: r.comment,
      by: r.reviewerId ? reviewerName.get(r.reviewerId) ?? 'Unknown user' : 'System',
      at: r.createdAt,
    })),
    history: await serializePublicationHistory(pub.histories),
  };
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

  // A rejection the author cannot act on is worse than no rejection at all, so
  // the reason is required here and not only in the route schema.
  const note = comment?.trim() ?? '';
  if (next === 'REJECTED' && note.length < PUBLICATION_REJECTION_NOTE_MIN) {
    throw new ApiError(422, `A rejection needs at least ${PUBLICATION_REJECTION_NOTE_MIN} characters of reviewer notes`, [
      { field: 'comment', message: `Explain the decision in at least ${PUBLICATION_REJECTION_NOTE_MIN} characters` },
    ]);
  }

  const label = publicationStatusLabel[next];
  const slug = next === 'PUBLISHED' && !pub.slug ? slugify(pub.title) : pub.slug;

  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.publication.update({ where: { id }, data: { status: next, slug, ...(next === 'APPROVED' ? { approvedAt: new Date() } : {}), ...(next === 'PUBLISHED' ? { publishedAt: new Date() } : {}) } }),
    prisma.publicationStatusHistory.create({ data: { publicationId: id, fromStatus: pub.status, toStatus: next, actorId, note: note || null } }),
    prisma.publicationReview.create({ data: { publicationId: id, reviewerId: actorId, decision: next, comment: note || `Moved to ${label}` } }),
    prisma.auditLog.create({ data: { actorId, actorLabel: actorId, actorRole: 'ADMIN', action: `Publication${next}`, entity: `Publication ${id}`, severity: next === 'REJECTED' ? 'DANGER' : 'SUCCESS', description: note || `Publication moved to ${label}` } }),
  ];

  // Editorial outcomes the author should hear about. The moves they make
  // themselves (submitting, resubmitting) are not news to them.
  if (PUBLICATION_AUTHOR_VISIBLE.includes(next)) {
    writes.push(
      prisma.notification.create({
        data: {
          userId: pub.authorId,
          title: `Publication ${label.toLowerCase()}`,
          body: note || `Your paper "${pub.title}" is now ${label}.`,
          type: 'publication',
          link: '/dashboard/publications',
        },
      }),
    );
  }

  await prisma.$transaction(writes);
  return { ok: true, to: label, slug };
}

export async function adminSupport(req: Request) {
  return supportService.listSupport(req);
}

export async function transitionSupport(id: string, actorId: string, next: SupportStatus, response?: string, expectedUpdatedAt?: string) {
  return supportService.transitionSupport(id, actorId, next, response, expectedUpdatedAt);
}

/** Shared shape for both inboxes: newest message for the preview, plus a true message count. */
const conversationListInclude = {
  participants: { include: { user: { include: { memberProfile: true } } } },
  messages: { orderBy: { createdAt: 'desc' }, take: 1 },
  _count: { select: { messages: true } },
} satisfies Prisma.ConversationInclude;

export async function adminConversations(userId: string, req: Request) {
  const pagination = parsePage(req);
  // Member-to-member threads are private to their two participants. Without
  // this the CRO queue would list every direct message on the platform.
  const where: Prisma.ConversationWhereInput = { kind: { not: DIRECT_KIND } };
  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: conversationListInclude,
      orderBy: { updatedAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.conversation.count({ where }),
  ]);
  const unread = await unreadCountsFor(userId, rows.map((r) => r.id));
  return buildPaginatedResult(rows.map((r) => serializeConversation(r, unread)), total, pagination);
}

function serializeConversation(
  row: Prisma.ConversationGetPayload<{
    include: {
      participants: { include: { user: { include: { memberProfile: true } } } };
      messages: true;
      _count: { select: { messages: true } };
    };
  }>,
  unread?: Map<string, number>,
) {
  const member = row.participants.find((p) => p.user.role === 'MEMBER')?.user;
  return {
    id: row.id,
    subject: row.subject,
    from: member?.fullName ?? 'CRO Office',
    memberId: member?.memberProfile?.memberId ?? '',
    category: row.category,
    lastActivity: row.updatedAt,
    unreadCount: unread?.get(row.id) ?? 0,
    participantCount: row.participants.length,
    // From _count, not row.messages — the list query truncates to one message.
    totalMessages: row._count.messages,
    lastPreview: row.messages[0]?.body ?? '',
    status: row.status,
    priority: row.priority,
  };
}

/**
 * Turnaround metrics for one thread. A "response" is a message whose sender role
 * differs from the previous one — i.e. an actual reply rather than a follow-up
 * from the same side.
 */
function conversationAnalytics(messages: { createdAt: Date; senderRole: string }[]) {
  const gaps: number[] = [];
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1]!;
    const current = messages[i]!;
    if (prev.senderRole !== current.senderRole) {
      gaps.push((current.createdAt.getTime() - prev.createdAt.getTime()) / 60_000);
    }
  }
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    firstResponseMinutes: gaps.length ? round(gaps[0]!) : null,
    avgResponseMinutes: gaps.length ? round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
    responseCount: gaps.length,
  };
}

/**
 * One thread in full.
 *
 * `viewerId` scopes access: pass it for a member (a non-participant gets 404,
 * never 403 — R5) and omit it for an admin, who may read any thread.
 * `includeInternal` keeps admin-only notes away from members.
 */
export async function adminConversationDetail(
  id: string,
  viewerId?: string,
  options: { includeInternal?: boolean } = {},
) {
  const includeInternal = options.includeInternal ?? true;
  const row = await prisma.conversation.findUnique({
    where: { id },
    include: {
      participants: { include: { user: { include: { memberProfile: true } } } },
      messages: {
        where: includeInternal ? {} : { internal: false },
        include: { attachments: { include: { file: true } }, sharedLinks: true },
        orderBy: { createdAt: 'asc' },
      },
      linkedRecords: true,
      _count: { select: { messages: true } },
    },
  });
  if (!row) throw ApiError.notFound('Conversation not found');
  if (viewerId && !row.participants.some((p) => p.userId === viewerId)) {
    throw ApiError.notFound('Conversation not found');
  }

  const member = row.participants.find((p) => p.user.role === 'MEMBER')?.user;
  const unread = viewerId ? await unreadCountsFor(viewerId, [row.id]) : undefined;

  return {
    ...serializeConversation({ ...row, messages: row.messages }, unread),
    // The list serializer counts every message; a member must not learn that
    // internal notes exist from a count that does not match what they can see.
    totalMessages: includeInternal ? row._count.messages : row.messages.length,
    fromName: member?.fullName,
    fromEmail: member?.email,
    fromMemberId: member?.memberProfile?.memberId,
    fromInstitution: member?.memberProfile?.institution,
    assignee: row.assignee,
    createdAt: row.createdAt,
    participants: row.participants.map((p) => ({ name: p.user.fullName, role: p.roleLabel ?? p.user.role, joinedAt: p.joinedAt, email: p.user.email })),
    messages: row.messages.map((m) => ({
      id: m.id,
      who: m.senderRole.toLowerCase(),
      name: m.senderName,
      at: m.createdAt,
      text: m.body,
      internal: m.internal,
      attachments: m.attachments.map((a) => ({ id: a.fileId, name: a.file.originalName, size: a.file.sizeBytes, type: a.file.mimeType })),
      links: m.sharedLinks.map((l) => ({ id: l.id, url: l.url, label: l.label })),
    })),
    linkedRecords: row.linkedRecords,
    analytics: {
      ...conversationAnalytics(row.messages),
      participantCount: row.participants.length,
      linkedRecordCount: row.linkedRecords.length,
      lastActivityAt: row.updatedAt,
    },
  };
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

function labelToPublicationStatus(label: string): PublicationStatus {
  const found = Object.entries(publicationStatusLabel).find(([, value]) => value === label);
  return (found?.[0] ?? 'DRAFT') as PublicationStatus;
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
