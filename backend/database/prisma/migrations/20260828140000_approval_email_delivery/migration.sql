-- AlterTable
ALTER TABLE `MembershipApplication` ADD COLUMN `approvalEmailAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `approvalEmailError` TEXT NULL,
    ADD COLUMN `approvalEmailSentAt` DATETIME(3) NULL;

