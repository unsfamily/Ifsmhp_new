-- Automatic member IDs drop the year: PREFIX-YYYY-NNNNNN becomes PREFIX-NNNNNN.
-- Application codes stay as they are. Manual IDs that do not match this pattern stay as they are.
-- The profile unique key rejects the rewrite if two IDs would collapse to one value.
-- Quoted copies still hold the old value, so rewrite them before the profile column.
UPDATE `Notification` n
INNER JOIN `MemberProfile` p
  ON p.`memberId` REGEXP '^[A-Z0-9][A-Z0-9_-]{0,29}-[0-9]{4}-[0-9]{4,10}$'
 AND LOCATE(p.`memberId`, n.`body`) > 0
SET n.`body` = REPLACE(n.`body`, p.`memberId`, REGEXP_REPLACE(p.`memberId`, '^([A-Z0-9][A-Z0-9_-]{0,29})-[0-9]{4}-([0-9]{4,10})$', '$1-$2'));

UPDATE `Message` m
INNER JOIN `MemberProfile` p
  ON p.`memberId` REGEXP '^[A-Z0-9][A-Z0-9_-]{0,29}-[0-9]{4}-[0-9]{4,10}$'
 AND (LOCATE(p.`memberId`, m.`senderName`) > 0 OR LOCATE(p.`memberId`, m.`body`) > 0)
SET
  m.`senderName` = REPLACE(m.`senderName`, p.`memberId`, REGEXP_REPLACE(p.`memberId`, '^([A-Z0-9][A-Z0-9_-]{0,29})-[0-9]{4}-([0-9]{4,10})$', '$1-$2')),
  m.`body` = REPLACE(m.`body`, p.`memberId`, REGEXP_REPLACE(p.`memberId`, '^([A-Z0-9][A-Z0-9_-]{0,29})-[0-9]{4}-([0-9]{4,10})$', '$1-$2'));

UPDATE `AuditLog` a
INNER JOIN `MemberProfile` p
  ON p.`memberId` REGEXP '^[A-Z0-9][A-Z0-9_-]{0,29}-[0-9]{4}-[0-9]{4,10}$'
 AND (
      a.`actorMemberId` = p.`memberId`
   OR LOCATE(p.`memberId`, a.`entity`) > 0
   OR LOCATE(p.`memberId`, a.`description`) > 0
   OR LOCATE(p.`memberId`, CAST(a.`changes` AS CHAR)) > 0
   OR LOCATE(p.`memberId`, CAST(a.`metadata` AS CHAR)) > 0
 )
SET
  a.`actorMemberId` = IF(a.`actorMemberId` = p.`memberId`, REGEXP_REPLACE(p.`memberId`, '^([A-Z0-9][A-Z0-9_-]{0,29})-[0-9]{4}-([0-9]{4,10})$', '$1-$2'), a.`actorMemberId`),
  a.`entity` = REPLACE(a.`entity`, p.`memberId`, REGEXP_REPLACE(p.`memberId`, '^([A-Z0-9][A-Z0-9_-]{0,29})-[0-9]{4}-([0-9]{4,10})$', '$1-$2')),
  a.`description` = REPLACE(a.`description`, p.`memberId`, REGEXP_REPLACE(p.`memberId`, '^([A-Z0-9][A-Z0-9_-]{0,29})-[0-9]{4}-([0-9]{4,10})$', '$1-$2')),
  a.`changes` = IF(
    a.`changes` IS NULL OR LOCATE(p.`memberId`, CAST(a.`changes` AS CHAR)) = 0,
    a.`changes`,
    CAST(REPLACE(CAST(a.`changes` AS CHAR), p.`memberId`, REGEXP_REPLACE(p.`memberId`, '^([A-Z0-9][A-Z0-9_-]{0,29})-[0-9]{4}-([0-9]{4,10})$', '$1-$2')) AS JSON)
  ),
  a.`metadata` = IF(
    a.`metadata` IS NULL OR LOCATE(p.`memberId`, CAST(a.`metadata` AS CHAR)) = 0,
    a.`metadata`,
    CAST(REPLACE(CAST(a.`metadata` AS CHAR), p.`memberId`, REGEXP_REPLACE(p.`memberId`, '^([A-Z0-9][A-Z0-9_-]{0,29})-[0-9]{4}-([0-9]{4,10})$', '$1-$2')) AS JSON)
  );

UPDATE `MemberProfile`
SET `memberId` = REGEXP_REPLACE(`memberId`, '^([A-Z0-9][A-Z0-9_-]{0,29})-[0-9]{4}-([0-9]{4,10})$', '$1-$2')
WHERE `memberId` REGEXP '^[A-Z0-9][A-Z0-9_-]{0,29}-[0-9]{4}-[0-9]{4,10}$';

-- One counter for every later automatic ID. Year 0 is only the storage key.
INSERT INTO `MemberIdSequence` (`id`, `year`, `nextNumber`, `updatedAt`)
SELECT SUBSTRING(REPLACE(UUID(), '-', ''), 1, 24), 0, computed.nextNumber, CURRENT_TIMESTAMP(3)
FROM (
  SELECT GREATEST(
    COALESCE((SELECT MAX(`nextNumber`) FROM (SELECT `nextNumber` FROM `MemberIdSequence`) AS existing), 1),
    COALESCE((
      SELECT MAX(CAST(REGEXP_SUBSTR(`memberId`, '[0-9]+$') AS UNSIGNED)) + 1
      FROM (
        SELECT `memberId` FROM `MemberProfile`
        WHERE `memberId` REGEXP '^[A-Z0-9][A-Z0-9_-]{0,29}-[0-9]{4,10}$'
      ) AS profiles
    ), 1)
  ) AS nextNumber
) AS computed
ON DUPLICATE KEY UPDATE
  `nextNumber` = GREATEST(`MemberIdSequence`.`nextNumber`, VALUES(`nextNumber`)),
  `updatedAt` = CURRENT_TIMESTAMP(3);

DELETE FROM `MemberIdSequence` WHERE `year` <> 0;
