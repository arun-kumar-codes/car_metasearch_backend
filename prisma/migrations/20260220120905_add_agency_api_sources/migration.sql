-- CreateTable
CREATE TABLE "AgencyApiSource" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT,
    "apiUrl" TEXT NOT NULL,
    "apiKey" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyApiSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgencyApiSource_agencyId_idx" ON "AgencyApiSource"("agencyId");

-- AddForeignKey
ALTER TABLE "AgencyApiSource" ADD CONSTRAINT "AgencyApiSource_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
