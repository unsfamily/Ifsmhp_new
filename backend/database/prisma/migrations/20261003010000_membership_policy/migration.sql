-- Additive: historical applications retain NULL policy snapshots and legacy rules.
ALTER TABLE `MembershipApplication`
 ADD COLUMN `policySnapshot` JSON NULL,
 ADD COLUMN `policyRevision` INTEGER NULL,
 ADD COLUMN `evidenceReviewedAt` DATETIME(3) NULL,
 ADD COLUMN `evidenceReviewedBy` VARCHAR(191) NULL,
 ADD COLUMN `archivedAt` DATETIME(3) NULL,
 ADD COLUMN `archiveSuppressed` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `MembershipApplication_status_archivedAt_idx` ON `MembershipApplication` (`status`, `archivedAt`);
CREATE TABLE `MembershipReferral` (
 `id` VARCHAR(191) NOT NULL, `applicationId` VARCHAR(191) NOT NULL,
 `name` VARCHAR(191) NOT NULL, `email` VARCHAR(191) NOT NULL, `organization` VARCHAR(200) NOT NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `MembershipReferral_applicationId_email_key` (`applicationId`, `email`),
 CONSTRAINT `MembershipReferral_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `MembershipApplication` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `MembershipReferenceLetter` (
 `id` VARCHAR(191) NOT NULL, `applicationId` VARCHAR(191) NOT NULL, `fileId` VARCHAR(191) NOT NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `MembershipReferenceLetter_fileId_key` (`fileId`), INDEX `MembershipReferenceLetter_applicationId_idx` (`applicationId`),
 CONSTRAINT `MembershipReferenceLetter_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `MembershipApplication` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `MembershipReferenceLetter_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `MembershipCharge` (
 `id` VARCHAR(191) NOT NULL, `applicationId` VARCHAR(191) NOT NULL, `kind` VARCHAR(20) NOT NULL, `periodYear` INTEGER NOT NULL,
 `amount` DECIMAL(10,2) NOT NULL, `currency` VARCHAR(3) NOT NULL, `dueAt` DATETIME(3) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`), UNIQUE INDEX `MembershipCharge_applicationId_kind_periodYear_key` (`applicationId`, `kind`, `periodYear`),
 CONSTRAINT `MembershipCharge_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `MembershipApplication` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `MembershipPayment` (
 `id` VARCHAR(191) NOT NULL, `chargeId` VARCHAR(191) NOT NULL, `requestId` VARCHAR(191) NOT NULL, `reference` VARCHAR(191) NOT NULL,
 `recordedBy` VARCHAR(191) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `reversedAt` DATETIME(3) NULL, `reversedBy` VARCHAR(191) NULL, `correctionReason` TEXT NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `MembershipPayment_requestId_key` (`requestId`), INDEX `MembershipPayment_chargeId_idx` (`chargeId`),
 CONSTRAINT `MembershipPayment_chargeId_fkey` FOREIGN KEY (`chargeId`) REFERENCES `MembershipCharge` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `MembershipWaiver` (
 `id` VARCHAR(191) NOT NULL, `chargeId` VARCHAR(191) NOT NULL, `requestId` VARCHAR(191) NOT NULL, `reason` TEXT NOT NULL,
 `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING', `requestedBy` VARCHAR(191) NOT NULL, `decidedBy` VARCHAR(191) NULL,
 `decisionReason` TEXT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `decidedAt` DATETIME(3) NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `MembershipWaiver_requestId_key` (`requestId`), INDEX `MembershipWaiver_chargeId_idx` (`chargeId`),
 CONSTRAINT `MembershipWaiver_chargeId_fkey` FOREIGN KEY (`chargeId`) REFERENCES `MembershipCharge` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
