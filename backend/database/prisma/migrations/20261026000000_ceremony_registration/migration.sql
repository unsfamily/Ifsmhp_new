-- CreateTable
CREATE TABLE `CeremonyRegistration` (
    `id` VARCHAR(191) NOT NULL,
    `ceremonySlug` VARCHAR(80) NOT NULL,
    `fullName` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `emailNormalized` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `institution` VARCHAR(200) NOT NULL,
    `designation` VARCHAR(120) NULL,
    `participationType` VARCHAR(40) NOT NULL,
    `message` TEXT NULL,
    `consentAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CeremonyRegistration_ceremonySlug_emailNormalized_key`(`ceremonySlug`, `emailNormalized`),
    INDEX `CeremonyRegistration_ceremonySlug_updatedAt_idx`(`ceremonySlug`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
