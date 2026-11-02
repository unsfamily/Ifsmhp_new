ALTER TABLE `FileObject` ADD COLUMN `awardMediaManaged` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `AwardEventMedia` (
    `id` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,
    `mediaType` VARCHAR(191) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `published` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AwardEventMedia_fileId_key`(`fileId`),
    INDEX `AwardEventMedia_published_mediaType_displayOrder_idx`(`published`, `mediaType`, `displayOrder`),
    INDEX `AwardEventMedia_mediaType_displayOrder_idx`(`mediaType`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AwardEventMedia` ADD CONSTRAINT `AwardEventMedia_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
