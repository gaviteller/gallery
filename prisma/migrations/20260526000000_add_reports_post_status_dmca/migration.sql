-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('PUBLISHED', 'PENDING_REVIEW', 'REMOVED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE_SPEECH', 'GORE', 'CSAM', 'COPYRIGHT', 'UNLABELLED_AI', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED_REMOVED', 'REVIEWED_KEPT');

-- CreateEnum
CREATE TYPE "DmcaStatus" AS ENUM ('PENDING', 'REMOVED', 'COUNTER_FILED', 'RESOLVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN "pendingAt" TIMESTAMP(3),
ADD COLUMN "flagReason" TEXT,
ADD COLUMN "reportCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Appeal" ADD COLUMN "dmcaRequestId" TEXT;

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "notes" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmcaRequest" (
    "id" TEXT NOT NULL,
    "claimantName" TEXT NOT NULL,
    "claimantEmail" TEXT NOT NULL,
    "postId" TEXT,
    "postUrl" TEXT,
    "description" TEXT NOT NULL,
    "status" "DmcaStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "DmcaRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Report_postId_reporterId_key" ON "Report"("postId", "reporterId");

-- CreateIndex
CREATE INDEX "Report_postId_idx" ON "Report"("postId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "DmcaRequest_status_idx" ON "DmcaRequest"("status");

-- CreateIndex
CREATE INDEX "DmcaRequest_claimantEmail_idx" ON "DmcaRequest"("claimantEmail");

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_dmcaRequestId_fkey" FOREIGN KEY ("dmcaRequestId") REFERENCES "DmcaRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
