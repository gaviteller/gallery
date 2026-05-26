import { prisma } from "../lib/prisma"
import { normalizeEmail } from "../lib/normalizeEmail"

async function main() {
  const users = await prisma.user.findMany({
    where: { normalizedEmail: null },
    select: { id: true, email: true },
  })
  console.log(`Backfilling ${users.length} users…`)
  for (const user of users) {
    if (!user.email) continue
    await prisma.user.update({
      where: { id: user.id },
      data: { normalizedEmail: normalizeEmail(user.email) },
    })
  }
  console.log("Done.")
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
