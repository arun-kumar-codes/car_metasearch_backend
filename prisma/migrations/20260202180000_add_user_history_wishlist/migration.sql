-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "suggestionsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserListingView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserListingView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWishlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "UserListingView_userId_listingId_key" ON "UserListingView"("userId", "listingId");

-- CreateIndex
CREATE INDEX "UserListingView_userId_idx" ON "UserListingView"("userId");

-- CreateIndex
CREATE INDEX "UserListingView_listingId_idx" ON "UserListingView"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWishlist_userId_listingId_key" ON "UserWishlist"("userId", "listingId");

-- CreateIndex
CREATE INDEX "UserWishlist_userId_idx" ON "UserWishlist"("userId");

-- CreateIndex
CREATE INDEX "UserWishlist_listingId_idx" ON "UserWishlist"("listingId");

-- AddForeignKey
ALTER TABLE "UserListingView" ADD CONSTRAINT "UserListingView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWishlist" ADD CONSTRAINT "UserWishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
