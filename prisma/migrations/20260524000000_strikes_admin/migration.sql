-- User: admin/moderator/ban fields
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "isModerator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "bannedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "banReason" TEXT;

-- New enums
CREATE TYPE "StrikeLevel" AS ENUM ('MINOR', 'MODERATE', 'SEVERE', 'ZERO_TOLERANCE');
CREATE TYPE "StrikeViolation" AS ENUM (
  'ARTIST_CANCEL', 'FAKE_DELIVERY', 'FALSE_ADVERTISING', 'BAIT_AND_SWITCH',
  'OFF_PLATFORM_PAYMENT', 'COMMISSION_FARMING', 'SHOP_FALSE_ADVERTISING',
  'UNLABELLED_AI', 'GORE', 'HARASSMENT', 'HATE_SPEECH', 'SPAM',
  'DMCA_VIOLATION', 'FTC_DISCLOSURE', 'NCMEC_VIOLATION',
  'CHARGEBACK_FRAUD', 'ZERO_TOLERANCE_CONDUCT'
);
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- Strike table
CREATE TABLE "Strike" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "issuedById" TEXT NOT NULL,
  "level" "StrikeLevel" NOT NULL,
  "violation" "StrikeViolation" NOT NULL,
  "isSelling" BOOLEAN NOT NULL DEFAULT false,
  "contentId" TEXT,
  "contentType" TEXT,
  "notes" TEXT,
  "reversed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Strike_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Strike" ADD CONSTRAINT "Strike_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Strike" ADD CONSTRAINT "Strike_issuedById_fkey"
  FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Strike_userId_idx" ON "Strike"("userId");
CREATE INDEX "Strike_issuedById_idx" ON "Strike"("issuedById");

-- Appeal table
CREATE TABLE "Appeal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "strikeId" TEXT,
  "text" TEXT NOT NULL,
  "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_strikeId_fkey"
  FOREIGN KEY ("strikeId") REFERENCES "Strike"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Appeal_userId_idx" ON "Appeal"("userId");
CREATE INDEX "Appeal_status_idx" ON "Appeal"("status");
