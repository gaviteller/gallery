import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Creating Block table…")
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Block" (
      "id" TEXT NOT NULL,
      "blockerId" TEXT NOT NULL,
      "blockedId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
    )
  `)
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId")`
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Block_blockerId_idx" ON "Block"("blockerId")`
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Block_blockedId_idx" ON "Block"("blockedId")`
  )
  // Add FK constraints (ignore error if already exists)
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    )
  } catch {}
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    )
  } catch {}
  console.log("Done ✓")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
