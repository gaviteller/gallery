-- AlterTable
ALTER TABLE "Commission" ADD COLUMN "buyerRating" INTEGER;
ALTER TABLE "Commission" ADD COLUMN "displayAsExample" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Commission" ADD COLUMN "displayPermissionAnswered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Commission" ADD COLUMN "artistFeedShareOffered" BOOLEAN NOT NULL DEFAULT false;
