ALTER TABLE `MemberProfile` ADD COLUMN `avatarFileId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `MemberProfile_avatarFileId_key` ON `MemberProfile`(`avatarFileId`);
ALTER TABLE `MemberProfile` ADD CONSTRAINT `MemberProfile_avatarFileId_fkey`
  FOREIGN KEY (`avatarFileId`) REFERENCES `FileObject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
