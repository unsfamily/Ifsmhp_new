ALTER TABLE `GallerySubcategory` ADD COLUMN `displayOrder` INTEGER NOT NULL DEFAULT 0;

-- Awards gallery order: Event 2025, NASA, Convocation, Lab Visit, Coaching.
UPDATE `GallerySubcategory` SET `displayOrder` = 1 WHERE `name` = 'Event 2025';
UPDATE `GallerySubcategory` SET `displayOrder` = 2 WHERE `name` = 'NASA';
UPDATE `GallerySubcategory` SET `displayOrder` = 3 WHERE `name` = 'Convocation';
UPDATE `GallerySubcategory` SET `displayOrder` = 4 WHERE `name` = 'Lab Visit';
UPDATE `GallerySubcategory` SET `displayOrder` = 5 WHERE `name` = 'Coaching';

CREATE INDEX `GallerySubcategory_categoryId_displayOrder_idx` ON `GallerySubcategory`(`categoryId`, `displayOrder`);
