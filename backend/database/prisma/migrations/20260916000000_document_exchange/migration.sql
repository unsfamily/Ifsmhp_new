ALTER TABLE `Message`
  ADD COLUMN `clientRequestId` VARCHAR(191) NULL,
  ADD COLUMN `meetingRequestedAt` DATETIME(3) NULL,
  ADD COLUMN `meetingTimezone` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Message_senderId_clientRequestId_key` ON `Message` (`senderId`, `clientRequestId`);
ALTER TABLE `SharedLink` ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'LINK';
CREATE TABLE `DocumentExchange` (
  `id` VARCHAR(191) NOT NULL,
  `memberId` VARCHAR(191) NOT NULL,
  `conversationId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DocumentExchange_memberId_key` (`memberId`),
  UNIQUE INDEX `DocumentExchange_conversationId_key` (`conversationId`),
  CONSTRAINT `DocumentExchange_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DocumentExchange_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `AttachmentOpen` (
  `id` VARCHAR(191) NOT NULL,
  `attachmentId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AttachmentOpen_attachmentId_userId_key` (`attachmentId`, `userId`),
  CONSTRAINT `AttachmentOpen_attachmentId_fkey` FOREIGN KEY (`attachmentId`) REFERENCES `MessageAttachment` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AttachmentOpen_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
