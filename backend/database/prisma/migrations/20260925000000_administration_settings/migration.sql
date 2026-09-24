-- Additive only: preserve all existing settings and historical records.
CREATE TABLE `SettingRevision` (
  `section` VARCHAR(191) NOT NULL,
  `revision` INTEGER NOT NULL DEFAULT 0,
  `updatedBy` VARCHAR(191) NULL,
  `updatedAt` DATETIME(3) NULL,
  PRIMARY KEY (`section`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
