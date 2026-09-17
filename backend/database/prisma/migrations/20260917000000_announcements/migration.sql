ALTER TABLE `Announcement`
  MODIFY `status` ENUM('DRAFT','SCHEDULED','SENDING','SENT','CANCELLED','PARTIAL','FAILED','SUPPRESSED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `managed` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `senderAsCRO` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `timezone` VARCHAR(191) NOT NULL DEFAULT 'UTC',
  ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `sendSABPreview` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `previewRevision` INTEGER NULL,
  ADD COLUMN `signedOffRevision` INTEGER NULL,
  ADD COLUMN `signedOffBy` VARCHAR(191) NULL,
  ADD COLUMN `signedOffAt` DATETIME(3) NULL,
  ADD COLUMN `dispatchStartedAt` DATETIME(3) NULL,
  ADD COLUMN `completedAt` DATETIME(3) NULL,
  ADD INDEX `Announcement_managed_status_scheduledAt_idx` (`managed`, `status`, `scheduledAt`);

ALTER TABLE `AnnouncementDelivery`
  ADD COLUMN `key` VARCHAR(191) NULL,
  ADD COLUMN `channel` VARCHAR(191) NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN `purpose` VARCHAR(191) NOT NULL DEFAULT 'BROADCAST',
  ADD COLUMN `revision` INTEGER NULL,
  ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `dueAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `lockedAt` DATETIME(3) NULL,
  ADD COLUMN `claimToken` VARCHAR(191) NULL,
  ADD COLUMN `deliveredAt` DATETIME(3) NULL,
  ADD COLUMN `error` TEXT NULL,
  ADD UNIQUE INDEX `AnnouncementDelivery_key_key` (`key`),
  ADD INDEX `AnnouncementDelivery_status_dueAt_idx` (`status`, `dueAt`),
  ADD INDEX `AnnouncementDelivery_announcementId_purpose_revision_idx` (`announcementId`, `purpose`, `revision`),
  ADD INDEX `AnnouncementDelivery_recipientUserId_channel_status_idx` (`recipientUserId`, `channel`, `status`);

CREATE TABLE `AnnouncementOperation` (
  `id` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `requestId` VARCHAR(191) NOT NULL,
  `fingerprint` VARCHAR(191) NOT NULL,
  `announcementId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AnnouncementOperation_actorId_requestId_key` (`actorId`, `requestId`),
  CONSTRAINT `AnnouncementOperation_announcementId_fkey` FOREIGN KEY (`announcementId`) REFERENCES `Announcement` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AnnouncementPreference` (
  `userId` VARCHAR(191) NOT NULL,
  `emailEnabled` BOOLEAN NOT NULL DEFAULT true,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`userId`),
  CONSTRAINT `AnnouncementPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Notification`
  ADD COLUMN `announcementDeliveryId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `Notification_announcementDeliveryId_key` (`announcementDeliveryId`),
  ADD CONSTRAINT `Notification_announcementDeliveryId_fkey` FOREIGN KEY (`announcementDeliveryId`) REFERENCES `AnnouncementDelivery` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
