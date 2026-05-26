-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "reporterId" DROP NOT NULL;

-- AlterIndex (no-op, FK already exists)
