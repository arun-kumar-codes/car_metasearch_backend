-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- Migrate existing agency roles to dealer roles (AGENCY/ADMIN/SUPERADMIN -> DEALER_ADMIN)
UPDATE "Agency" SET "role" = 'DEALER_ADMIN' WHERE "role" IN ('AGENCY', 'ADMIN', 'SUPERADMIN');

-- Set default for new Agency rows
ALTER TABLE "Agency" ALTER COLUMN "role" SET DEFAULT 'DEALER_ADMIN';

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Admin_email_idx" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Admin_role_idx" ON "Admin"("role");
