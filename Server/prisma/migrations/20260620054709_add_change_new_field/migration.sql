/*
  Warnings:

  - You are about to drop the column `itemId` on the `prepo` table. All the data in the column will be lost.
  - You are about to drop the column `itemName` on the `prepo` table. All the data in the column will be lost.
  - You are about to drop the column `itemSource` on the `prepo` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `prepo` table. All the data in the column will be lost.
  - You are about to drop the column `rate` on the `prepo` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `prepo` table. All the data in the column will be lost.
  - You are about to drop the column `debitNoteId` on the `purchaseorderbill` table. All the data in the column will be lost.

*/
-- -- DropForeignKey
-- ALTER TABLE `purchaseorderbill` DROP FOREIGN KEY `PurchaseOrderBill_debitNoteId_fkey`;

-- -- DropIndex
-- DROP INDEX `PurchaseOrderBill_debitNoteId_fkey` ON `purchaseorderbill`;

-- AlterTable
ALTER TABLE `PrePo` DROP COLUMN `itemId`,
    DROP COLUMN `itemName`,
    DROP COLUMN `itemSource`,
    DROP COLUMN `quantity`,
    DROP COLUMN `rate`,
    DROP COLUMN `unit`,
    ADD COLUMN `poNumber` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PrePo_Draft', 'PrePO_Requested', 'PrePO_Approved', 'PrePO_Rejected') NOT NULL DEFAULT 'PrePo_Draft';

-- AlterTable
-- ALTER TABLE `purchaseorderbill` DROP COLUMN `debitNoteId`;

-- CreateTable
CREATE TABLE `PrePoItems` (
    `id` VARCHAR(191) NOT NULL,
    `prePoId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NULL,
    `itemSource` VARCHAR(191) NULL,
    `itemName` VARCHAR(191) NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `rate` DECIMAL(12, 4) NOT NULL,
    `createAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PrePoItems` ADD CONSTRAINT `PrePoItems_prePoId_fkey` FOREIGN KEY (`prePoId`) REFERENCES `PrePo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- -- RenameIndex
-- ALTER TABLE `payment` RENAME INDEX `Payment_debitNoteId_idx` TO `Payment_debitNoteId_fkey`;

-- -- RenameIndex
-- ALTER TABLE `payment` RENAME INDEX `Payment_poId_idx` TO `Payment_poId_fkey`;
