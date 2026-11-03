-- Rewrite member IDs that remain in stored text after the profile update.
-- Application codes keep their year because the segment before it is APP.

UPDATE `Notification`
SET `body` = REGEXP_REPLACE(`body`, '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])', '$1-$3')
WHERE `body` REGEXP '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])';

UPDATE `Message`
SET
  `senderName` = REGEXP_REPLACE(`senderName`, '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])', '$1-$3'),
  `body` = REGEXP_REPLACE(`body`, '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])', '$1-$3')
WHERE `senderName` REGEXP '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])'
   OR `body` REGEXP '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])';

UPDATE `AuditLog`
SET
  `actorMemberId` = REGEXP_REPLACE(`actorMemberId`, '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])', '$1-$3'),
  `entity` = REGEXP_REPLACE(`entity`, '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])', '$1-$3'),
  `description` = REGEXP_REPLACE(`description`, '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])', '$1-$3'),
  `changes` = IF(
    `changes` IS NULL,
    NULL,
    CAST(REGEXP_REPLACE(CAST(`changes` AS CHAR), '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])', '$1-$3') AS JSON)
  ),
  `metadata` = IF(
    `metadata` IS NULL,
    NULL,
    CAST(REGEXP_REPLACE(CAST(`metadata` AS CHAR), '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])', '$1-$3') AS JSON)
  )
WHERE `actorMemberId` REGEXP '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])'
   OR `entity` REGEXP '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])'
   OR `description` REGEXP '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])'
   OR CAST(`changes` AS CHAR) REGEXP '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])'
   OR CAST(`metadata` AS CHAR) REGEXP '(?<![A-Z0-9_])([A-Z0-9][A-Z0-9_-]{0,29})-(?<!APP-)([0-9]{4})-([0-9]{4,10})(?![0-9])';
