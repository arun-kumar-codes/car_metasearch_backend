/*
  Warnings:

  - You are about to drop the column `walletBalance` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the `Bill` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_paidByAdminId_fkey";

-- AlterTable
ALTER TABLE "Admin" DROP COLUMN "walletBalance";

-- DropTable
DROP TABLE "Bill";
