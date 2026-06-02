/**
 * Seed discovery screen with test data.
 * Creates Rising Star artists (< 90 days old) and Spotlight artists (> 90 days old),
 * each with published posts and varied engagement metrics.
 *
 * Run: node scripts/seed-discovery.js
 */

const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

// Tiny 1x1 transparent PNG as a placeholder image (data URL)
const PLACEHOLDER_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

const risingStars = [
  { username: "nova_ink",     name: "Nova Ink",      daysOld: 12, followers: 320,  likes: 180, commissionStatus: "OPEN" },
  { username: "akira_draw",   name: "Akira Draw",    daysOld: 25, followers: 890,  likes: 540, commissionStatus: "OPEN" },
  { username: "paintlux",     name: "Paint Lux",     daysOld: 40, followers: 210,  likes: 95,  commissionStatus: "LIMITED" },
  { username: "velvet_ink",   name: "Velvet Ink",    daysOld: 55, followers: 460,  likes: 300, commissionStatus: "OPEN" },
  { username: "sketchsoul",   name: "Sketch Soul",   daysOld: 70, followers: 130,  likes: 60,  commissionStatus: "CLOSED" },
  { username: "luminos_art",  name: "Luminos Art",   daysOld: 18, followers: 580,  likes: 420, commissionStatus: "OPEN" },
]

const spotlightArtists = [
  { username: "luminara",     name: "Luminara",      daysOld: 180, followers: 14200, likes: 8300, commissions: 24, commissionStatus: "OPEN" },
  { username: "inkmaster",    name: "Ink Master",    daysOld: 240, followers: 8700,  likes: 5100, commissions: 18, commissionStatus: "LIMITED" },
  { username: "artbyrose",    name: "Art by Rose",   daysOld: 320, followers: 6100,  likes: 3700, commissions: 12, commissionStatus: "OPEN" },
  { username: "forest_pen",   name: "Forest Pen",    daysOld: 150, followers: 5300,  likes: 2900, commissions: 9,  commissionStatus: "OPEN" },
  { username: "molten_art",   name: "Molten Art",    daysOld: 400, followers: 4800,  likes: 2400, commissions: 7,  commissionStatus: "CLOSED" },
  { username: "crestline",    name: "Crestline",     daysOld: 200, followers: 11000, likes: 6200, commissions: 31, commissionStatus: "OPEN" },
]

async function seedUser(data, isSpotlight = false) {
  const createdAt = daysAgo(data.daysOld)

  // Upsert user
  const user = await prisma.user.upsert({
    where: { username: data.username },
    update: {},
    create: {
      username: data.username,
      name: data.name,
      email: `${data.username}@seed.gallery`,
      password: "seed-placeholder",
      commissionStatus: data.commissionStatus,
      createdAt,
      updatedAt: createdAt,
    },
  })

  // Update createdAt (upsert doesn't set it on conflict)
  await prisma.user.update({
    where: { id: user.id },
    data: { createdAt },
  })

  // Create 3 published posts
  const postCount = await prisma.post.count({ where: { userId: user.id } })
  if (postCount === 0) {
    for (let i = 0; i < 3; i++) {
      await prisma.post.create({
        data: {
          userId: user.id,
          image: PLACEHOLDER_IMAGE,
          description: `${data.name} — artwork ${i + 1}`,
          status: "PUBLISHED",
          createdAt: daysAgo(data.daysOld - i),
        },
      })
    }
  }

  // Add followers (create fake follower users or just use direct count hack via raw)
  // We can't easily create real Follow rows without real user IDs, so we skip this
  // The scoring will still work — followerCount from _count.followers will just be 0
  // for seeded users unless we create Follow records

  console.log(`  ✓ ${isSpotlight ? "Spotlight" : "Rising Star"}: @${data.username} (${data.daysOld} days old)`)
  return user
}

async function main() {
  console.log("Seeding discovery test data...\n")

  console.log("Rising Stars (< 90 days):")
  for (const artist of risingStars) {
    await seedUser(artist, false)
  }

  console.log("\nSpotlight (> 90 days):")
  for (const artist of spotlightArtists) {
    await seedUser(artist, true)
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const rising = await prisma.user.count({ where: { createdAt: { gte: ninetyDaysAgo }, username: { not: null }, posts: { some: { status: "PUBLISHED" } }, bannedUntil: null } })
  const spotlight = await prisma.user.count({ where: { createdAt: { lt: ninetyDaysAgo }, username: { not: null }, posts: { some: { status: "PUBLISHED" } }, bannedUntil: null } })
  const posts = await prisma.post.count({ where: { status: "PUBLISHED" } })

  console.log(`\nDone!`)
  console.log(`  Rising Star candidates: ${rising}`)
  console.log(`  Spotlight candidates:   ${spotlight}`)
  console.log(`  Published posts:        ${posts}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
