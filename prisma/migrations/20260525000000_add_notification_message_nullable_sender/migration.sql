-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "fromUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "message" TEXT;
