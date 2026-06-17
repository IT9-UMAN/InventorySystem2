/*
  Warnings:

  - You are about to drop the column `debitNoteId` on the `purchaseorderbill` table. All the data in the column will be lost.
  - You are about to alter the column `quantity` on the `purchaseorderitem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `Decimal(18,4)`.

*/
-- DropForeignKey
-- ALTER TABLE `purchaseorderbill` DROP FOREIGN KEY `PurchaseOrderBill_debitNoteId_fkey`;

-- DropIndex
-- DROP INDEX `PurchaseOrderBill_debitNoteId_fkey` ON `purchaseorderbill`;

-- AlterTable
-- ALTER TABLE `purchaseorderbill` DROP COLUMN `debitNoteId`;

-- AlterTable
ALTER TABLE `PurchaseOrderItem` MODIFY `quantity` DECIMAL(18, 4) NOT NULL;
