/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `Agency` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Agency_email_key";

-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "loginOtpExpires" TIMESTAMP(3),
ADD COLUMN     "loginOtpToken" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneOtpExpires" TIMESTAMP(3),
ADD COLUMN     "phoneOtpToken" TEXT,
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'AGENCY';

-- CreateIndex
CREATE UNIQUE INDEX "Agency_phone_key" ON "Agency"("phone");

-- CreateIndex
CREATE INDEX "Agency_phone_idx" ON "Agency"("phone");

-- CreateIndex
CREATE INDEX "Agency_role_idx" ON "Agency"("role");
