ALTER TABLE `AwardNomination`
  ADD COLUMN `cvFileId` VARCHAR(191) NULL,
  ADD COLUMN `photoFileId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `AwardNomination_cvFileId_key`(`cvFileId`),
  ADD UNIQUE INDEX `AwardNomination_photoFileId_key`(`photoFileId`),
  ADD CONSTRAINT `AwardNomination_cvFileId_fkey` FOREIGN KEY (`cvFileId`) REFERENCES `FileObject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `AwardNomination_photoFileId_fkey` FOREIGN KEY (`photoFileId`) REFERENCES `FileObject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
