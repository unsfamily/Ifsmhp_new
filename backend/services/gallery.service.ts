import { writeAudit, changesBetween } from './audit.service';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import { prisma } from '../config/database';
import type { AuthenticatedUser } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResult, paginationQuerySchema, toSkipTake } from '../utils/pagination';
import { assertSafePath } from '../utils/fileStorage';
import { logger } from '../utils/logger';
import { galleryPolicy, inspectMedia } from './gallery-upload.service';

type DB = Prisma.TransactionClient;
const text = (max: number) => z.string().trim().max(max);
const identifier = z.string().trim().min(1).max(191);
export const subcategoryBody = z.object({ name: text(191).min(1), categoryId: identifier }).strict();
const order = z.number().int().min(1).max(1000000);
export const categoryBody = z.object({ name: text(191).min(1), description: text(10000).default(''), published: z.boolean().default(true), displayOrder: order.optional() }).strict();
export const photoBody = z.object({ title: text(191).min(1), caption: text(10000), altText: text(2000), categoryId: identifier, subcategoryId: identifier.nullable(), published: z.boolean(), displayOrder: order }).partial().strict();
export const reorderBody = z.object({ direction: z.union([z.literal(-1), z.literal(1)]) }).strict();
const categoryVisibilityBody = z.object({ categoryIds: z.array(identifier).min(1), published: z.boolean() }).strict();
const listQuery = paginationQuerySchema.extend({ categoryId: z.string().max(191).optional(), subcategoryId: identifier.optional(), search: text(200).default('') });
export const publicPhotoScope = { visibility: 'PUBLIC', album: { visibility: 'PUBLIC' }, type: { in: ['image', 'video'] }, file: { is: { deletedAt: null, mimeType: { in: galleryPolicy.mimeTypes } } } } satisfies Prisma.GalleryItemWhereInput;
const categorySort = [{ displayOrder: 'asc' }, { id: 'asc' }] satisfies Prisma.GalleryAlbumOrderByWithRelationInput[];
const photoSort = [{ album: { displayOrder: 'asc' } }, { albumId: 'asc' }, { displayOrder: 'asc' }, { id: 'asc' }] satisfies Prisma.GalleryItemOrderByWithRelationInput[];

function categoryDto(c: Prisma.GalleryAlbumGetPayload<{ include: { _count: { select: { items: true } } } }>) {
  return { id: c.id, name: c.label, description: c.description, displayOrder: c.displayOrder, published: c.visibility === 'PUBLIC', createdAt: c.createdAt, updatedAt: c.updatedAt, photoCount: c._count.items };
}
function photoDto(p: Prisma.GalleryItemGetPayload<{ include: { file: true } }>, admin: boolean) {
  return { id: p.id, categoryId: p.albumId, subcategoryId: p.subcategoryId, title: p.title, caption: p.caption, altText: p.altText, displayOrder: p.displayOrder, published: p.visibility === 'PUBLIC', uploadedAt: p.createdAt, updatedAt: p.updatedAt,
    type: p.type, mediaUrl: p.file && !p.file.deletedAt ? `/${admin ? 'admin' : 'public'}/gallery/photos/${p.id}/media` : '',
    imageUrl: p.file && !p.file.deletedAt ? `/${admin ? 'admin' : 'public'}/gallery/photos/${p.id}/image` : '', fileSizeBytes: p.file?.sizeBytes, width: p.width ?? undefined, height: p.height ?? undefined, aspect: p.aspect };
}
export async function categories(query: unknown, admin: boolean) {
  const page = paginationQuerySchema.parse(query);
  const where: Prisma.GalleryAlbumWhereInput = admin ? {} : { visibility: 'PUBLIC' };
  const [items, total] = await prisma.$transaction([
    prisma.galleryAlbum.findMany({ where, orderBy: categorySort, ...toSkipTake(page), include: { _count: { select: { items: admin ? true : { where: publicPhotoScope } } } } }),
    prisma.galleryAlbum.count({ where }),
  ]);
  return buildPaginatedResult(items.map(categoryDto), total, page);
}
export async function photos(query: unknown, admin: boolean) {
  const parsed = listQuery.parse(query);
  const where: Prisma.GalleryItemWhereInput = { ...(admin ? {} : publicPhotoScope), ...(parsed.categoryId && parsed.categoryId !== 'all' ? { albumId: parsed.categoryId } : {}), ...(parsed.subcategoryId && parsed.subcategoryId !== 'all' ? { subcategoryId: parsed.subcategoryId === 'none' ? null : parsed.subcategoryId } : {}), ...(parsed.search ? { OR: [{ title: { contains: parsed.search } }, { caption: { contains: parsed.search } }, { altText: { contains: parsed.search } }] } : {}) };
  const [items, total] = await prisma.$transaction([prisma.galleryItem.findMany({ where, include: { file: true }, orderBy: photoSort, ...toSkipTake(parsed) }), prisma.galleryItem.count({ where })]);
  return buildPaginatedResult(items.map(p => photoDto(p, admin)), total, parsed);
}
// Every gallery mutation locks the collection range in the same order. Serializable
// retry also handles two first-collection inserts into an initially empty gallery.
async function mutate<T>(actor: AuthenticatedUser, action: string, kind: 'categories' | 'subcategories' | 'photos', entity: string, work: (db: DB) => Promise<T>): Promise<T> {
  if (actor.role !== 'ADMIN') throw ApiError.forbidden();
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async db => {
        await db.$queryRaw`SELECT id FROM GalleryAlbum ORDER BY id FOR UPDATE`;
        const read = (id: string) => kind === 'categories' ? db.galleryAlbum.findUnique({ where: { id } }) : kind === 'subcategories' ? db.gallerySubcategory.findUnique({ where: { id } }) : db.galleryItem.findUnique({ where: { id } });
        const before = await read(entity);
        const result = await work(db);
        const entityId = result && typeof result === 'object' && 'id' in result ? String(result.id) : entity;
        const after = await read(entityId);
        const comparable = (row: object | null) => row ? Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'updatedAt')) : null;
        if (JSON.stringify(comparable(before)) !== JSON.stringify(comparable(after))) await writeAudit({ actorId: actor.id, action: `Gallery${action}`, entity: `${kind === 'categories' ? 'GalleryAlbum' : kind === 'subcategories' ? 'GallerySubcategory' : 'GalleryItem'} ${entityId}`, changes: changesBetween(before, after), metadata: { changedFields: Object.keys(after ?? before ?? {}).filter(key => key !== 'updatedAt' && JSON.stringify(before?.[key as keyof typeof before]) !== JSON.stringify(after?.[key as keyof typeof after])) } }, db);
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 3) continue;
      throw error;
    }
  }
}
async function album(db: DB, id: string) { const result = await db.galleryAlbum.findUnique({ where: { id } }); if (!result) throw ApiError.notFound('Collection not found'); return result; }
async function photo(db: DB, id: string) { const result = await db.galleryItem.findUnique({ where: { id }, include: { file: true } }); if (!result) throw ApiError.notFound('Photograph not found'); return result; }
async function normalize(db: DB, albumId?: string, movedId?: string, position?: number) {
  const rows: { id: string; displayOrder: number }[] = albumId === undefined ? await db.galleryAlbum.findMany({ orderBy: categorySort }) : await db.galleryItem.findMany({ where: { albumId }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
  if (movedId && position !== undefined) { const idx = rows.findIndex(r => r.id === movedId); if (idx >= 0) { const [row] = rows.splice(idx, 1); rows.splice(Math.min(position - 1, rows.length), 0, row!); } }
  for (const [idx, row] of rows.entries()) {
    if (row.displayOrder === idx + 1) continue;
    if (albumId === undefined) await db.galleryAlbum.update({ where: { id: row.id }, data: { displayOrder: idx + 1 } });
    else await db.galleryItem.update({ where: { id: row.id }, data: { displayOrder: idx + 1 } });
  }
}
export async function setCategoryVisibility(actor: AuthenticatedUser, input: unknown) {
  const body = categoryVisibilityBody.parse(input);
  const categoryIds = [...new Set(body.categoryIds)];
  return mutate(actor, 'CollectionUpdated', 'categories', 'Gallery', async db => {
    const before = await db.galleryAlbum.findMany({ where: { id: { in: categoryIds } }, orderBy: categorySort });
    if (before.length !== categoryIds.length) throw ApiError.notFound('One or more collections no longer exist. Refresh the gallery and try again.');
    const visibility = body.published ? 'PUBLIC' as const : 'PRIVATE' as const;
    const changed = before.filter(row => row.visibility !== visibility);
    if (changed.length) {
      await db.galleryAlbum.updateMany({ where: { id: { in: changed.map(row => row.id) } }, data: { visibility } });
      for (const row of changed) {
        await writeAudit({ actorId: actor.id, action: 'GalleryCollectionUpdated', entity: `GalleryAlbum ${row.id}`, changes: changesBetween(row, { ...row, visibility }), metadata: { changedFields: ['visibility'] } }, db);
      }
    }
    const items = await db.galleryAlbum.findMany({ where: { id: { in: categoryIds } }, orderBy: categorySort, include: { _count: { select: { items: true } } } });
    return { items: items.map(categoryDto), updatedCount: changed.length };
  });
}
export async function saveCategory(actor: AuthenticatedUser, input: unknown, id?: string) {
  const body = (id ? categoryBody.partial() : categoryBody).parse(input);
  return mutate(actor, id ? 'CollectionUpdated' : 'CollectionCreated', 'categories', id ?? 'Gallery', async db => {
    if (id) await album(db, id);
    if (body.name && await db.galleryAlbum.findFirst({ where: { label: body.name, ...(id ? { id: { not: id } } : {}) } })) throw new ApiError(409, 'A collection with this name already exists.', [{ field: 'name', message: 'Choose a unique collection name.' }]);
    const data = { label: body.name, description: body.description, visibility: body.published === undefined ? undefined : body.published ? 'PUBLIC' as const : 'PRIVATE' as const };
    const record = id ? await db.galleryAlbum.update({ where: { id }, data }) : await db.galleryAlbum.create({ data: { ...data, label: body.name!, description: body.description ?? '', key: crypto.randomUUID(), coverGradient: 'from-forum-700 to-slateteal-500', displayOrder: await db.galleryAlbum.count() + 1 } });
    await normalize(db, undefined, record.id, body.displayOrder);
    return categoryDto(await db.galleryAlbum.findUniqueOrThrow({ where: { id: record.id }, include: { _count: { select: { items: true } } } }));
  });
}
function subcategoryDto(row: Prisma.GallerySubcategoryGetPayload<{ include: { _count: { select: { items: true } } } }>) {
  const { _count, ...fields } = row;
  return { ...fields, photoCount: _count.items };
}
async function subcategory(db: DB, id: string) {
  const row = await db.gallerySubcategory.findUnique({ where: { id } });
  if (!row) throw ApiError.notFound('Subcategory not found');
  return row;
}
async function validateAssignment(db: DB, categoryId: string, subcategoryId?: string | null) {
  if (!subcategoryId) return;
  if ((await subcategory(db, subcategoryId)).categoryId !== categoryId) throw new ApiError(422, 'Subcategory must belong to the selected category.', [{ field: 'subcategoryId', message: 'Choose a subcategory of the selected category.' }]);
}
export async function subcategories(query: unknown, admin: boolean) {
  const page = paginationQuerySchema.extend({ categoryId: identifier.optional() }).parse(query);
  const where: Prisma.GallerySubcategoryWhereInput = {
    ...(admin ? {} : { category: { visibility: 'PUBLIC' } }),
    ...(page.categoryId && page.categoryId !== 'all' ? { categoryId: page.categoryId } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.gallerySubcategory.findMany({ where, ...toSkipTake(page), orderBy: [{ category: { displayOrder: 'asc' } }, { categoryId: 'asc' }, { name: 'asc' }, { id: 'asc' }], include: { _count: { select: { items: admin ? true : { where: publicPhotoScope } } } } }),
    prisma.gallerySubcategory.count({ where }),
  ]);
  return buildPaginatedResult(items.map(subcategoryDto), total, page);
}
const duplicateSubcategory = () => new ApiError(409, 'A subcategory with this name already exists in this category.', [{ field: 'name', message: 'Choose a unique subcategory name within this category.' }]);
export async function saveSubcategory(actor: AuthenticatedUser, input: unknown, id?: string) {
  const body = (id ? subcategoryBody.partial() : subcategoryBody).parse(input);
  try {
    return await mutate(actor, id ? 'SubcategoryUpdated' : 'SubcategoryCreated', 'subcategories', id ?? 'Gallery', async db => {
      const current = id ? await subcategory(db, id) : null;
      const categoryId = body.categoryId ?? current!.categoryId;
      const name = body.name ?? current!.name;
      await album(db, categoryId);
      if (await db.gallerySubcategory.findFirst({ where: { categoryId, name, ...(id ? { id: { not: id } } : {}) } })) throw duplicateSubcategory();
      const record = id ? await db.gallerySubcategory.update({ where: { id }, data: { categoryId, name } }) : await db.gallerySubcategory.create({ data: { categoryId, name } });
      if (current && current.categoryId !== categoryId) {
        await normalize(db, categoryId);
        const items = await db.galleryItem.findMany({ where: { subcategoryId: record.id }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
        const offset = await db.galleryItem.count({ where: { albumId: categoryId } });
        for (const [index, item] of items.entries()) {
          const updated = await db.galleryItem.update({ where: { id: item.id }, data: { albumId: categoryId, displayOrder: offset + index + 1 } });
          await writeAudit({ actorId: actor.id, action: 'GalleryPhotoUpdated', entity: `GalleryItem ${item.id}`, changes: changesBetween(item, updated) }, db);
        }
        await normalize(db, current.categoryId);
      }
      return subcategoryDto(await db.gallerySubcategory.findUniqueOrThrow({ where: { id: record.id }, include: { _count: { select: { items: true } } } }));
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw duplicateSubcategory();
    throw error;
  }
}
export async function removeSubcategory(actor: AuthenticatedUser, id: string) {
  return mutate(actor, 'SubcategoryDeleted', 'subcategories', id, async db => {
    await subcategory(db, id);
    if (await db.galleryItem.count({ where: { subcategoryId: id } })) throw new ApiError(409, 'Move or delete this subcategory’s photographs before deleting it.');
    await db.gallerySubcategory.delete({ where: { id } });
    return { removed: true };
  });
}

export async function uploadPhoto(actor: AuthenticatedUser, input: unknown, file?: Express.Multer.File) {
  const body = z.object({
    categoryId: identifier,
    subcategoryId: identifier.nullable().optional(),
    title: z.string().trim().max(191, 'Name must be 191 characters or fewer.').optional(),
    caption: z.string().trim().max(10000, 'Description must be 10,000 characters or fewer.').optional(),
  }).strict().parse(input);
  const metadata = await inspectMedia(file);
  return mutate(actor, 'PhotoUploaded', 'photos', body.categoryId, async db => {
    await album(db, body.categoryId);
    await validateAssignment(db, body.categoryId, body.subcategoryId);
    const stored = await db.fileObject.create({ data: { uploaderId: actor.id, storageKey: file!.filename, originalName: file!.originalname.slice(0, 191), mimeType: file!.mimetype, sizeBytes: file!.size, checksum: metadata.checksum, visibility: 'PRIVATE', galleryManaged: true } });
    const record = await db.galleryItem.create({ data: { albumId: body.categoryId, subcategoryId: body.subcategoryId, fileId: stored.id, type: metadata.type, visibility: 'PRIVATE', title: body.title || file!.originalname.replace(/\.[^.]+$/, '').slice(0, 191) || 'Photograph', caption: body.caption ?? '', altText: '', capturedAt: new Date(), location: '', photographer: '', creditLine: '', sizeMB: file!.size / 1024 / 1024, width: metadata.width, height: metadata.height, aspect: metadata.aspect, resolution: `${metadata.width}x${metadata.height}`, displayOrder: await db.galleryItem.count({ where: { albumId: body.categoryId } }) + 1 }, include: { file: true } });
    return photoDto(record, true);
  });
}
export async function savePhoto(actor: AuthenticatedUser, id: string, input: unknown) {
  const body = photoBody.parse(input);
  return mutate(actor, 'PhotoUpdated', 'photos', id, async db => {
    const current = await photo(db, id); const destination = body.categoryId ?? current.albumId;
    await album(db, destination);
    const moving = destination !== current.albumId;
    const subcategoryId = body.subcategoryId === undefined ? moving ? null : current.subcategoryId : body.subcategoryId;
    await validateAssignment(db, destination, subcategoryId);
    await db.galleryItem.update({ where: { id }, data: { title: body.title, caption: body.caption, altText: body.altText, visibility: body.published === undefined ? undefined : body.published ? 'PUBLIC' : 'PRIVATE', albumId: destination, subcategoryId, ...(moving ? { displayOrder: await db.galleryItem.count({ where: { albumId: destination } }) + 1 } : {}) } });
    if (moving) await normalize(db, current.albumId);
    await normalize(db, destination, id, body.displayOrder);
    return photoDto(await photo(db, id), true);
  });
}
export async function reorder(actor: AuthenticatedUser, kind: 'categories' | 'photos', id: string, input: unknown) {
  const { direction } = reorderBody.parse(input);
  return mutate(actor, 'Reordered', kind, id, async db => {
    const current = kind === 'categories' ? await album(db, id) : await photo(db, id);
    const albumId = 'albumId' in current ? current.albumId : undefined;
    await normalize(db, albumId);
    const rows: { id: string; displayOrder: number }[] = albumId === undefined ? await db.galleryAlbum.findMany({ orderBy: categorySort }) : await db.galleryItem.findMany({ where: { albumId }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
    const target = rows.findIndex(r => r.id === id) + direction;
    if (target >= 0 && target < rows.length) await normalize(db, albumId, id, target + 1);
    return { reordered: true };
  });
}
// A tombstone is a durable cleanup queue; the retry script can resume unlinking
// after a process crash. Shared legacy files are retained until unreferenced.
const unreferenced = { communityEvidence: { none: {} }, galleryItems: { none: {} }, credentials: { none: {} }, projectFiles: { none: {} }, publicationFiles: { none: {} }, messageAttachments: { none: {} }, eventCovers: { none: {} }, inquiryAttachments: { none: {} }, communityImages: { none: {} }, communityBanners: { none: {} }, communityAttachments: { none: {} } } satisfies Prisma.FileObjectWhereInput;
export async function purgeGalleryFiles() {
  const files = await prisma.fileObject.findMany({ where: { galleryManaged: true, deletedAt: { not: null }, purgedAt: null, ...unreferenced } });
  for (const file of files) {
    try {
      await fs.unlink(assertSafePath(file.storageKey)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      await prisma.fileObject.update({ where: { id: file.id }, data: { purgedAt: new Date() } });
    } catch (error) { logger.error('Gallery file cleanup pending retry', { fileId: file.id, error: String(error) }); }
  }
}
export async function remove(actor: AuthenticatedUser, kind: 'categories' | 'photos', id: string) {
  const result = await mutate(actor, kind === 'categories' ? 'CollectionDeleted' : 'PhotoDeleted', kind, id, async db => {
    const ids: string[] = [];
    if (kind === 'categories') {
      await album(db, id);
      if (await db.gallerySubcategory.count({ where: { categoryId: id } })) throw new ApiError(409, 'Move or delete this category’s subcategories before deleting it.');
      const items = await db.galleryItem.findMany({ where: { albumId: id } }); ids.push(...items.flatMap(i => i.fileId ? [i.fileId] : []));
      await db.galleryAlbum.delete({ where: { id } }); await normalize(db);
    } else { const item = await photo(db, id); if (item.fileId) ids.push(item.fileId); await db.galleryItem.delete({ where: { id } }); await normalize(db, item.albumId); }
    await db.fileObject.updateMany({ where: { id: { in: ids }, ...unreferenced }, data: { galleryManaged: true, deletedAt: new Date() } });
    return { removed: true };
  });
  await purgeGalleryFiles();
  return result;
}
export async function mediaFile(id: string, admin: boolean) {
  const item = await prisma.galleryItem.findFirst({ where: { id, ...(admin ? {} : publicPhotoScope) }, include: { file: true } });
  if (!item?.file || item.file.deletedAt || !galleryPolicy.mimeTypes.includes(item.file.mimeType)) throw ApiError.notFound('Media not found');
  return item.file;
}
export async function authorizeGalleryFile(fileId: string, admin: boolean) {
  const item = await prisma.galleryItem.findFirst({ where: { fileId, ...(admin ? {} : publicPhotoScope) } });
  if (!item) throw ApiError.notFound('File not found');
}
