-- CreateEnum
CREATE TYPE "AdPreset" AS ENUM ('ARTIST_SPOTLIGHT', 'PARTNER', 'GALLERY_PROMO');

-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "search" TEXT,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "preset" "AdPreset" NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT,
    "imageUrl" TEXT,
    "postId" TEXT,
    "linkUrl" TEXT NOT NULL,
    "placements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "frequency" INTEGER NOT NULL DEFAULT 8,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");

-- CreateIndex
CREATE INDEX "PageView_path_createdAt_idx" ON "PageView"("path", "createdAt");

-- CreateIndex
CREATE INDEX "Ad_active_startsAt_idx" ON "Ad"("active", "startsAt");

