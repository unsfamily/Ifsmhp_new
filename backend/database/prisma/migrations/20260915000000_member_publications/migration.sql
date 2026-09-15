-- Submission metadata captured by the member "Submit New Paper" form.
-- Every column is nullable, so rows created before the form existed stay valid
-- and no backfill is required.
ALTER TABLE `Publication`
  ADD COLUMN `authors` TEXT NULL,
  ADD COLUMN `correspondingAuthor` VARCHAR(191) NULL,
  ADD COLUMN `correspondingEmail` VARCHAR(191) NULL,
  ADD COLUMN `orcid` VARCHAR(191) NULL,
  ADD COLUMN `keywords` TEXT NULL,
  ADD COLUMN `funding` TEXT NULL,
  ADD COLUMN `conflicts` TEXT NULL,
  ADD COLUMN `ethicsApproval` TEXT NULL,
  ADD COLUMN `coverLetter` TEXT NULL;

-- Parity with ProjectFile: one upload may only be attached to a publication
-- once. Any pre-existing duplicate is collapsed onto its earliest row first,
-- otherwise the index creation below fails on legacy data.
DELETE `pf` FROM `PublicationFile` `pf`
  JOIN `PublicationFile` `keep`
    ON `keep`.`publicationId` = `pf`.`publicationId`
   AND `keep`.`fileId` = `pf`.`fileId`
   AND `keep`.`id` < `pf`.`id`;

CREATE UNIQUE INDEX `PublicationFile_publicationId_fileId_key`
  ON `PublicationFile` (`publicationId`, `fileId`);
