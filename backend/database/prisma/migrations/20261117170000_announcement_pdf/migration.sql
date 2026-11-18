-- Optional private PDF attached to an announcement. Existing rows stay unattached.
ALTER TABLE `Announcement`
  ADD COLUMN `attachmentFileId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Announcement_attachmentFileId_key` ON `Announcement`(`attachmentFileId`);

ALTER TABLE `Announcement`
  ADD CONSTRAINT `Announcement_attachmentFileId_fkey`
  FOREIGN KEY (`attachmentFileId`) REFERENCES `FileObject`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
