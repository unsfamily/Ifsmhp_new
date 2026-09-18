ALTER TABLE `Announcement` ADD COLUMN `expiresAt` DATETIME(3) NULL,
  ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `Notification` ADD COLUMN `announcementId` VARCHAR(191) NULL;
-- Preserve duplicate historical notifications, linking only the oldest receipt.
UPDATE `Notification` n
JOIN `AnnouncementDelivery` d ON d.id = n.announcementDeliveryId
LEFT JOIN (
  SELECT n2.userId, d2.announcementId, MIN(n2.id) AS keeper
  FROM `Notification` n2 JOIN `AnnouncementDelivery` d2 ON d2.id = n2.announcementDeliveryId
  GROUP BY n2.userId, d2.announcementId
) k ON k.userId = n.userId AND k.announcementId = d.announcementId
SET n.announcementId = d.announcementId WHERE n.id = k.keeper;
CREATE UNIQUE INDEX `Notification_userId_announcementId_key` ON `Notification` (`userId`, `announcementId`);
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_announcementId_fkey`
  FOREIGN KEY (`announcementId`) REFERENCES `Announcement` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
