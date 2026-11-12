/**
 * Re-checks EVERYTHING on the site against the current rulebook (run after the rulebook changes).
 *   npx tsx --env-file=.env --env-file=.env.local scripts/resweep.ts
 * Inform-only: results land in the admin's AI flags queue; nothing is hidden or removed.
 * AI-art notices are NOT sent for old posts during a sweep (only tracked).
 * Costs one AI request per item.
 */
import { PrismaClient } from "@prisma/client"
import {
  scanPost, scanShopItem, scanStory, scanAvatar, scanProfileText,
  scanComment, scanChatMessage, scanCommissionRequest, getRulebook,
} from "@/lib/ai-scan"

const prisma = new PrismaClient()
const CONCURRENCY = 4

async function runAll(label: string, ids: string[], fn: (id: string) => Promise<unknown>) {
  let done = 0
  const queue = [...ids]
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const id = queue.shift()!
      await fn(id)
      done++
    }
  }))
  console.log(`  ${label}: ${done} checked`)
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set")
  const rulebook = await getRulebook(prisma)
  if (!rulebook) throw new Error("No rulebook saved")
  const startedAt = new Date()
  console.log(`Sweeping with rulebook version ${rulebook.version}…`)

  const [posts, items, stories, users, comments, dms, cms, requests] = await Promise.all([
    prisma.post.findMany({ where: { status: { not: "REMOVED" } }, select: { id: true } }),
    prisma.shopItem.findMany({ where: { status: { not: "REMOVED" } }, select: { id: true } }),
    prisma.story.findMany({ select: { id: true } }),
    prisma.user.findMany({ select: { id: true, image: true, bannerImage: true } }),
    prisma.comment.findMany({ where: { hidden: false }, select: { id: true } }),
    prisma.directMessage.findMany({ where: { hidden: false }, select: { id: true } }),
    prisma.professionalMessage.findMany({ where: { hidden: false, isSystem: false, text: { not: null } }, select: { id: true } }),
    prisma.commission.findMany({ select: { id: true } }),
  ])

  await runAll("posts", posts.map((x) => x.id), (id) => scanPost(prisma, id, undefined, undefined, false))
  await runAll("shop listings", items.map((x) => x.id), (id) => scanShopItem(prisma, id, undefined, undefined, false))
  await runAll("stories", stories.map((x) => x.id), (id) => scanStory(prisma, id))
  await runAll("profiles (name, username, bio)", users.map((x) => x.id), (id) => scanProfileText(prisma, id))
  await runAll("profile photos", users.filter((u) => u.image).map((u) => u.id), (id) => scanAvatar(prisma, id, "image", users.find((u) => u.id === id)!.image!))
  await runAll("banners", users.filter((u) => u.bannerImage).map((u) => u.id), (id) => scanAvatar(prisma, id, "bannerImage", users.find((u) => u.id === id)!.bannerImage!))
  await runAll("comments", comments.map((x) => x.id), (id) => scanComment(prisma, id))
  await runAll("direct messages", dms.map((x) => x.id), (id) => scanChatMessage(prisma, "DM", id))
  await runAll("commission chat messages", cms.map((x) => x.id), (id) => scanChatMessage(prisma, "COMMISSION", id))
  await runAll("commission requests", requests.map((x) => x.id), (id) => scanCommissionRequest(prisma, id))

  // Summary of what this sweep found.
  const logs = await prisma.aIScanLog.findMany({ where: { createdAt: { gte: startedAt } }, select: { contentType: true, contentId: true, action: true, verdict: true, scores: true } })
  const flagged = logs.filter((l) => l.action.startsWith("FLAGGED_"))
  const aiArt = logs.filter((l) => l.action === "AI_ART_SUSPECTED")
  const errors = logs.filter((l) => l.action.startsWith("SCAN_ERROR"))
  console.log(`\nChecked ${logs.length - aiArt.length} items. Flagged ${flagged.length}. Possible unlabelled AI art: ${aiArt.length}. Errors: ${errors.length}.`)
  const order = ["ZERO", "URGENT", "SEVERE", "REVIEW", "CHECK"]
  for (const l of flagged.sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict))) {
    const sc = l.scores as { rules?: string[]; why?: string }
    console.log(`- ${l.verdict.padEnd(6)} ${l.contentType.padEnd(18)} ${(sc.rules ?? []).join(",").padEnd(16)} ${(sc.why ?? "").slice(0, 150)}`)
  }
  for (const e of errors.slice(0, 5)) console.log(`! error on ${e.contentType} ${e.contentId}: ${e.action.slice(0, 160)}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error("Sweep failed:", e.message); process.exit(1) })
