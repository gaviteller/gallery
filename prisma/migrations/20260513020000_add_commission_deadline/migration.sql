ALTER TABLE "Commission" ADD COLUMN "deadline" TIMESTAMP(3);
ALTER TABLE "Commission" ADD COLUMN "deadlineNotificationSent" BOOLEAN NOT NULL DEFAULT false;
