-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "accountHolderName" TEXT,
ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "ifscCode" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "serviceAreas" JSONB,
ADD COLUMN     "whatsappNumber" TEXT,
ADD COLUMN     "yearOfEstablishment" INTEGER;
