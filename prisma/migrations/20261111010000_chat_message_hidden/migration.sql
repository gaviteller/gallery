-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hiddenReason" TEXT;

-- AlterTable
ALTER TABLE "ProfessionalMessage" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hiddenReason" TEXT;

