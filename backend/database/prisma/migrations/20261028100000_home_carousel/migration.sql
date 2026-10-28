ALTER TABLE `FileObject` ADD COLUMN `carouselManaged` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `HomeCarouselSlide` (
    `id` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,
    `altText` VARCHAR(191) NOT NULL DEFAULT '',
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `published` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HomeCarouselSlide_fileId_key`(`fileId`),
    INDEX `HomeCarouselSlide_published_displayOrder_idx`(`published`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `HomeCarouselSlide` ADD CONSTRAINT `HomeCarouselSlide_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
