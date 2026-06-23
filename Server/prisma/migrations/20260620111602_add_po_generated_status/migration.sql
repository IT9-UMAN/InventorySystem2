/*
  Warnings:

  - You are about to alter the column `status` on the `prepo` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(1))` to `Enum(EnumId(0))`.
  - You are about to drop the column `debitNoteId` on the `purchaseorderbill` table. All the data in the column will be lost.

*/
-- DropForeignKey
-- ALTER TABLE `purchaseorderbill` DROP FOREIGN KEY `PurchaseOrderBill_debitNoteId_fkey`;

-- DropIndex
-- DROP INDEX `PurchaseOrderBill_debitNoteId_fkey` ON `purchaseorderbill`;

-- AlterTable
ALTER TABLE `PrePo` MODIFY `status` ENUM('PrePO_Draft', 'PrePO_Requested', 'PrePO_Approved', 'PrePO_Rejected', 'PO_Generated') NOT NULL DEFAULT 'PrePO_Draft';

-- AlterTable
-- ALTER TABLE `purchaseorderbill` DROP COLUMN `debitNoteId`;

-- -- RenameIndex
-- ALTER TABLE `payment` RENAME INDEX `Payment_debitNoteId_idx` TO `Payment_debitNoteId_fkey`;

-- -- RenameIndex
-- ALTER TABLE `payment` RENAME INDEX `Payment_poId_idx` TO `Payment_poId_fkey`;
