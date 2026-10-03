ALTER TABLE `User` ADD COLUMN `firstName` VARCHAR(59) NULL, ADD COLUMN `lastName` VARCHAR(59) NULL;

ALTER TABLE `MemberProfile` ADD COLUMN `communicationAddress` TEXT NULL, ADD COLUMN `permanentAddress` TEXT NULL;
