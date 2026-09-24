-- AlterTable
ALTER TABLE `User` ADD COLUMN `passwordChangedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `FileObject` ADD COLUMN `avatarManaged` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `AdminProfile` (
    `userId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `displayName` VARCHAR(191) NULL,
    `designation` VARCHAR(191) NULL,
    `jobTitle` VARCHAR(200) NULL,
    `workEmail` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `institution` VARCHAR(200) NULL,
    `country` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'UTC',
    `orcid` VARCHAR(191) NULL,
    `website` VARCHAR(2048) NULL,
    `bio` TEXT NULL,
    `avatarFileId` VARCHAR(191) NULL,
    `appNewMember` BOOLEAN NOT NULL DEFAULT true,
    `supportUrgent` BOOLEAN NOT NULL DEFAULT true,
    `supportAll` BOOLEAN NOT NULL DEFAULT false,
    `inquiryNew` BOOLEAN NOT NULL DEFAULT false,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminProfile_avatarFileId_key`(`avatarFileId`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminEmailJob` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `priority` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `link` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `dueAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedAt` DATETIME(3) NULL,
    `claimToken` VARCHAR(191) NULL,
    `error` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AdminEmailJob_key_key`(`key`),
    INDEX `AdminEmailJob_status_dueAt_idx`(`status`, `dueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminProfile` ADD CONSTRAINT `AdminProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminProfile` ADD CONSTRAINT `AdminProfile_avatarFileId_fkey` FOREIGN KEY (`avatarFileId`) REFERENCES `FileObject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminEmailJob` ADD CONSTRAINT `AdminEmailJob_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

