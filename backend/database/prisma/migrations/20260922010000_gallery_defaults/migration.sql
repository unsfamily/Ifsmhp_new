-- Backfill defaults from the preceding migration are no longer needed.
-- Prisma supplies updatedAt; the gallery service supplies an empty altText.
ALTER TABLE `GalleryAlbum` ALTER COLUMN `updatedAt` DROP DEFAULT;
ALTER TABLE `GalleryItem` ALTER COLUMN `updatedAt` DROP DEFAULT, ALTER COLUMN `altText` DROP DEFAULT;
