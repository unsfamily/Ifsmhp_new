-- AlterTable
ALTER TABLE `AuditLog` ADD COLUMN `actorEmail` VARCHAR(191) NULL,
    ADD COLUMN `actorMemberId` VARCHAR(191) NULL,
    ADD COLUMN `deduplicationKey` VARCHAR(191) NULL,
    ADD COLUMN `entityId` VARCHAR(191) NULL,
    ADD COLUMN `entityType` VARCHAR(191) NULL,
    ADD COLUMN `eventVersion` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `metadata` JSON NULL,
    ADD COLUMN `module` VARCHAR(191) NULL,
    ADD COLUMN `outcome` VARCHAR(191) NULL,
    ADD COLUMN `requestId` VARCHAR(191) NULL,
    ADD COLUMN `source` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `AuditLog_deduplicationKey_key` ON `AuditLog`(`deduplicationKey`);

-- CreateIndex
CREATE INDEX `AuditLog_createdAt_id_idx` ON `AuditLog`(`createdAt`, `id`);

-- CreateIndex
CREATE INDEX `AuditLog_module_createdAt_id_idx` ON `AuditLog`(`module`, `createdAt`, `id`);

-- CreateIndex
CREATE INDEX `AuditLog_actorRole_createdAt_id_idx` ON `AuditLog`(`actorRole`, `createdAt`, `id`);

-- CreateIndex
CREATE INDEX `AuditLog_entityType_entityId_createdAt_idx` ON `AuditLog`(`entityType`, `entityId`, `createdAt`);

-- CreateIndex
CREATE INDEX `AuditLog_requestId_idx` ON `AuditLog`(`requestId`);

