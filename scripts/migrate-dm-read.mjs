import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Adding lastReadAtA / lastReadAtB columns to Conversation…")
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lastReadAtA" TIMESTAMP(3)`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lastReadAtB" TIMESTAMP(3)`
  )
  console.log("Done ✓")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
