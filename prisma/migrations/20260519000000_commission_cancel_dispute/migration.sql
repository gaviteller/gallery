-- AlterEnum
ALTER TYPE "CommissionRequestStatus" ADD VALUE 'DISPUTED';

-- AlterTable: Commission — add cancelledBy and disputedAt
ALTER TABLE "Commission" ADD COLUMN "cancelledBy" TEXT;
ALTER TABLE "Commission" ADD COLUMN "disputedAt" TIMESTAMP(3);

-- AlterTable: User — add buyerCancellationCount and commissionFeatureDisabled
ALTER TABLE "User" ADD COLUMN "buyerCancellationCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "commissionFeatureDisabled" BOOLEAN NOT NULL DEFAULT false;
