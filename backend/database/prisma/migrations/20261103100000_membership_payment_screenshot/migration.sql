-- Proof image attached to an offline payment claim. Does not settle the charge.
ALTER TABLE `MembershipCharge`
  ADD COLUMN `claimedScreenshotFileId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `MembershipCharge_claimedScreenshotFileId_key` ON `MembershipCharge`(`claimedScreenshotFileId`);

ALTER TABLE `MembershipCharge`
  ADD CONSTRAINT `MembershipCharge_claimedScreenshotFileId_fkey`
  FOREIGN KEY (`claimedScreenshotFileId`) REFERENCES `FileObject`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
