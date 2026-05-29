-- AlterTable
ALTER TABLE "User" ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "adTargetingOptOut" BOOLEAN NOT NULL DEFAULT false;
