-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AgencyBill" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgencyBill_agencyId_idx" ON "AgencyBill"("agencyId");

-- CreateIndex
CREATE INDEX "AgencyBill_status_idx" ON "AgencyBill"("status");

-- CreateIndex
CREATE INDEX "AgencyBill_periodLabel_idx" ON "AgencyBill"("periodLabel");

-- AddForeignKey
ALTER TABLE "AgencyBill" ADD CONSTRAINT "AgencyBill_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
