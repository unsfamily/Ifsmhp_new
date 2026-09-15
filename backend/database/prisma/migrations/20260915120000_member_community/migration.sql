-- Community join columns were bare Strings with no foreign keys, so a thread's
-- author and a group member's profile could not be joined at all. The seeded
-- rows already hold the right ids (profileId -> MemberProfile, authorId -> User),
-- so the constraints apply without a backfill.

-- Defensive: drop anything that would fail the new constraints. On a clean
-- database these delete nothing.
DELETE `m` FROM `InterestGroupMember` `m`
  LEFT JOIN `MemberProfile` `p` ON `p`.`id` = `m`.`profileId`
  WHERE `p`.`id` IS NULL;

UPDATE `DiscussionThread` `t`
  LEFT JOIN `User` `u` ON `u`.`id` = `t`.`authorId`
  SET `t`.`authorId` = NULL
  WHERE `t`.`authorId` IS NOT NULL AND `u`.`id` IS NULL;

UPDATE `DiscussionReply` `r`
  LEFT JOIN `User` `u` ON `u`.`id` = `r`.`authorId`
  SET `r`.`authorId` = NULL
  WHERE `r`.`authorId` IS NOT NULL AND `u`.`id` IS NULL;

CREATE INDEX `InterestGroupMember_profileId_idx` ON `InterestGroupMember` (`profileId`);
ALTER TABLE `InterestGroupMember`
  ADD CONSTRAINT `InterestGroupMember_profileId_fkey`
  FOREIGN KEY (`profileId`) REFERENCES `MemberProfile` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX `DiscussionThread_authorId_idx` ON `DiscussionThread` (`authorId`);
-- The community list orders by updatedAt; unindexed it was a filesort.
CREATE INDEX `DiscussionThread_updatedAt_idx` ON `DiscussionThread` (`updatedAt`);
ALTER TABLE `DiscussionThread`
  ADD CONSTRAINT `DiscussionThread_authorId_fkey`
  FOREIGN KEY (`authorId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `DiscussionReply_authorId_idx` ON `DiscussionReply` (`authorId`);
ALTER TABLE `DiscussionReply`
  ADD CONSTRAINT `DiscussionReply_authorId_fkey`
  FOREIGN KEY (`authorId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- The composite unique is requesterId-leading, so "requests addressed to me"
-- was a full scan.
CREATE INDEX `MemberConnection_addresseeId_idx` ON `MemberConnection` (`addresseeId`);

-- Separates member↔office threads from member↔member direct messages. Defaulted
-- to 'CRO' so every existing conversation keeps appearing in the admin queue.
ALTER TABLE `Conversation` ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'CRO';
