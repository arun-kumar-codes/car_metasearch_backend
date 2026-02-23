-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "listingSource" TEXT;

-- CreateIndex
CREATE INDEX "Listing_agencyId_listingSource_idx" ON "Listing"("agencyId", "listingSource");
