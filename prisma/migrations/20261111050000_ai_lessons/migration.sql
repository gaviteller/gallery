-- CreateTable
CREATE TABLE "AiLesson" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL DEFAULT 'ALL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiLesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiLesson_active_idx" ON "AiLesson"("active");

