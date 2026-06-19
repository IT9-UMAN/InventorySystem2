/*
  Warnings:

  - You are about to drop the column `debitNoteId` on the `purchaseorderbill` table. All the data in the column will be lost.

*/
-- DropForeignKey
-- ALTER TABLE `purchaseorderbill` DROP FOREIGN KEY `PurchaseOrderBill_debitNoteId_fkey`;

-- -- DropIndex
-- DROP INDEX `PurchaseOrderBill_debitNoteId_fkey` ON `purchaseorderbill`;

-- -- AlterTable
-- ALTER TABLE `purchaseorderbill` DROP COLUMN `debitNoteId`;

-- CreateTable
CREATE TABLE `PrePo` (
    `id` VARCHAR(191) NOT NULL,
    `poId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `itemSource` VARCHAR(191) NULL,
    `itemName` VARCHAR(191) NULL,
    `quantity` DECIMAL(18, 4) NULL,
    `unit` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `rate` DECIMAL(12, 4) NOT NULL,
    `status` ENUM('PrePO_Requested', 'PrePO_Approved', 'PrePO_Rejected') NOT NULL DEFAULT 'PrePO_Requested',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PrePo` ADD CONSTRAINT `PrePo_poId_fkey` FOREIGN KEY (`poId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrePo` ADD CONSTRAINT `PrePo_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrePo` ADD CONSTRAINT `PrePo_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrePo` ADD CONSTRAINT `PrePo_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
-- ALTER TABLE `payment` RENAME INDEX `Payment_debitNoteId_idx` TO `Payment_debitNoteId_fkey`;

-- -- RenameIndex
-- ALTER TABLE `payment` RENAME INDEX `Payment_poId_idx` TO `Payment_poId_fkey`;
