ALTER TABLE `Event`
  MODIFY `date` DATETIME(3) NULL,
  ADD COLUMN `startsAt` DATETIME(3) NULL,
  ADD COLUMN `endsAt` DATETIME(3) NULL,
  ADD COLUMN `scheduledPublishAt` DATETIME(3) NULL,
  ADD COLUMN `sendReminder` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `reminderDays` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `cancellationReason` TEXT NULL,
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 0;
CREATE INDEX `Event_deletedAt_status_endsAt_idx` ON `Event` (`deletedAt`, `status`, `endsAt`);
CREATE TABLE `EventJob` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `recipient` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
  `dueAt` DATETIME(3) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `lockedAt` DATETIME(3) NULL,
  `claimToken` VARCHAR(191) NULL,
  `sentAt` DATETIME(3) NULL,
  `error` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `EventJob_key_key` (`key`),
  INDEX `EventJob_status_dueAt_idx` (`status`, `dueAt`),
  INDEX `EventJob_eventId_kind_idx` (`eventId`, `kind`),
  PRIMARY KEY (`id`),
  CONSTRAINT `EventJob_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
