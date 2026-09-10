ALTER TABLE `SupportRequest`
  ADD COLUMN `assignedAdminId` VARCHAR(191) NULL,
  ADD COLUMN `conversationId` VARCHAR(191) NULL;
ALTER TABLE `SupportRequestHistory` ADD COLUMN `internal` BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX `SupportRequest_conversationId_key` ON `SupportRequest`(`conversationId`);
ALTER TABLE `SupportRequest` ADD CONSTRAINT `SupportRequest_assignedAdminId_fkey`
  FOREIGN KEY (`assignedAdminId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SupportRequest` ADD CONSTRAINT `SupportRequest_conversationId_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
