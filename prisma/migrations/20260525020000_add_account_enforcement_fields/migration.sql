-- AlterTable
ALTER TABLE "User" ADD COLUMN "chargebackCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "accountNotes" TEXT;
ALTER TABLE "User" ADD COLUMN "normalizedEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "banEvasionFlag" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_normalizedEmail_idx" ON "User"("normalizedEmail");
