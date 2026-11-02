-- Applicant UTR/UPI claim for offline fee matching. Does not mark the charge paid.
ALTER TABLE `MembershipCharge`
  ADD COLUMN `claimedReference` VARCHAR(191) NULL,
  ADD COLUMN `claimedAt` DATETIME(3) NULL,
  ADD COLUMN `claimedRequestId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `MembershipCharge_claimedRequestId_key` ON `MembershipCharge`(`claimedRequestId`);
