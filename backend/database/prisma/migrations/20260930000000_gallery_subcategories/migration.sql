-- Additive migration: existing gallery records and photo assignments are preserved.
CREATE TABLE `GallerySubcategory` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `GallerySubcategory_categoryId_name_key` (`categoryId`, `name`),
    PRIMARY KEY (`id`),
    CONSTRAINT `GallerySubcategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `GalleryAlbum` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GalleryItem` ADD COLUMN `subcategoryId` VARCHAR(191) NULL;
CREATE INDEX `GalleryItem_subcategoryId_idx` ON `GalleryItem` (`subcategoryId`);
ALTER TABLE `GalleryItem` ADD CONSTRAINT `GalleryItem_subcategoryId_fkey` FOREIGN KEY (`subcategoryId`) REFERENCES `GallerySubcategory` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
