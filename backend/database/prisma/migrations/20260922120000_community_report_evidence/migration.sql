-- AlterTable
ALTER TABLE `CommunityReport` ADD COLUMN `evidence` JSON NULL,
    ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `CommunityReportEvidence` (
    `reportId` VARCHAR(191) NOT NULL,
    `attachmentId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,

    INDEX `CommunityReportEvidence_fileId_idx`(`fileId`),
    PRIMARY KEY (`reportId`, `attachmentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunityReportSubmission` (
    `reporterId` VARCHAR(191) NOT NULL,
    `submissionId` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `requestHash` VARCHAR(191) NOT NULL,
    `created` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunityReportSubmission_reportId_idx`(`reportId`),
    PRIMARY KEY (`reporterId`, `submissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunityReportOperation` (
    `reportId` VARCHAR(191) NOT NULL,
    `operationId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `requestHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`reportId`, `operationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CommunityReportEvidence` ADD CONSTRAINT `CommunityReportEvidence_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `CommunityReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityReportEvidence` ADD CONSTRAINT `CommunityReportEvidence_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityReportSubmission` ADD CONSTRAINT `CommunityReportSubmission_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `CommunityReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityReportOperation` ADD CONSTRAINT `CommunityReportOperation_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `CommunityReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

