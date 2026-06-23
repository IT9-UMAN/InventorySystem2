/*
  Warnings:

  - You are about to drop the column `debitNoteId` on the `purchaseorderbill` table. All the data in the column will be lost.

*/
-- DropForeignKey
-- ALTER TABLE `purchaseorderbill` DROP FOREIGN KEY `PurchaseOrderBill_debitNoteId_fkey`;

-- -- DropIndex
-- DROP INDEX `PurchaseOrderBill_debitNoteId_fkey` ON `purchaseorderbill`;

-- AlterTable
-- ALTER TABLE `purchaseorderbill` DROP COLUMN `debitNoteId`;

-- RenameIndex
-- ALTER TABLE `payment` RENAME INDEX `Payment_debitNoteId_idx` TO `Payment_debitNoteId_fkey`;

-- RenameIndex
-- ALTER TABLE `payment` RENAME INDEX `Payment_poId_idx` TO `Payment_poId_fkey`;
