-- Stores a PayU transaction id until the verified callback records the payment.
CREATE TABLE `MembershipGatewayAttempt` (
  `id` VARCHAR(191) NOT NULL,
  `chargeId` VARCHAR(191) NOT NULL,
  `txnId` VARCHAR(25) NOT NULL,
  `returnPath` VARCHAR(40) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MembershipGatewayAttempt_txnId_key` (`txnId`),
  INDEX `MembershipGatewayAttempt_chargeId_idx` (`chargeId`),
  CONSTRAINT `MembershipGatewayAttempt_chargeId_fkey`
    FOREIGN KEY (`chargeId`) REFERENCES `MembershipCharge`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
