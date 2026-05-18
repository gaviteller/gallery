import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret")
  if (secret !== "gallery-migrate-2026") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const results: string[] = []

  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Story" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "image" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
      )
    `
    results.push("Story table: OK")

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "StoryView" (
        "id" TEXT NOT NULL,
        "storyId" TEXT NOT NULL,
        "viewerId" TEXT NOT NULL,
        "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
      )
    `
    results.push("StoryView table: OK")

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Story_userId_idx" ON "Story"("userId")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Story_expiresAt_idx" ON "Story"("expiresAt")`
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "StoryView_storyId_viewerId_key" ON "StoryView"("storyId", "viewerId")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "StoryView_viewerId_idx" ON "StoryView"("viewerId")`
    results.push("Indexes: OK")

    await prisma.$executeRaw`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Story_userId_fkey') THEN
          ALTER TABLE "Story" ADD CONSTRAINT "Story_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `
    await prisma.$executeRaw`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoryView_storyId_fkey') THEN
          ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_storyId_fkey"
            FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `
    await prisma.$executeRaw`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoryView_viewerId_fkey') THEN
          ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_viewerId_fkey"
            FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `
    results.push("Foreign keys: OK")

    // Mark migration as applied in _prisma_migrations
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        'manual',
        NOW(),
        '20260518000000_add_stories',
        NULL,
        NULL,
        NOW(),
        1
      )
      ON CONFLICT DO NOTHING
    `
    results.push("Migration record: OK")

    return NextResponse.json({ ok: true, results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg, results }, { status: 500 })
  }
}
