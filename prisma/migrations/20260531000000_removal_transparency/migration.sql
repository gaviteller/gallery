-- AlterTable
ALTER TABLE "Post" ADD COLUMN "removedAt" TIMESTAMP(3),
ADD COLUMN "removalReason" TEXT;
