-- CreateTable
CREATE TABLE IF NOT EXISTS "ImageBlob" (
    "hash" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageBlob_pkey" PRIMARY KEY ("hash")
);
