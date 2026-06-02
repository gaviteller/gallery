import { z } from "zod"
import { router, publicProcedure } from "@/lib/trpc"
import type { PrismaClient, CommissionStatus } from "@prisma/client"

// ── Block helper ─────────────────────────────────────────────────────────────

async function getBlockedIds(
  prisma: PrismaClient,
  userId: string | undefined
): Promise<Set<string>> {
  const blocked = new Set<string>()
  if (!userId) return blocked
  const relations = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  })
  for (const b of relations) {
    blocked.add(b.blockerId === userId ? b.blockedId : b.blockerId)
  }
  return blocked
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DISCOVERY_WINDOW_DAYS = 90
const DISCOVERY_WINDOW_MS = DISCOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000

// ── Scoring ───────────────────────────────────────────────────────────────────

type ScoredCandidate = {
  id: string
  username: string | null
  name: string | null
  image: string | null
  commissionStatus: CommissionStatus
  createdAt: Date
  _count: { followers: number }
  posts: { _count: { likes: number } }[]
  artistCommissions: { buyerRating: number | null }[]
}

function avgRating(commissions: { buyerRating: number | null }[]): number {
  const ratings = commissions.map(c => c.buyerRating).filter((r): r is number => r !== null)
  return ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
}

function totalLikes(posts: { _count: { likes: number } }[]): number {
  return posts.reduce((s, p) => s + p._count.likes, 0)
}

/** Rising Star score: weighted by follower + like growth per account-age-day */
function scoreRisingStar(u: ScoredCandidate): number {
  const ageDays = Math.max(1, (Date.now() - u.createdAt.getTime()) / 86_400_000)
  const followerScore = u._count.followers / ageDays
  const likeScore = totalLikes(u.posts) / ageDays
  const ratingScore = avgRating(u.artistCommissions) / 5
  return followerScore * 0.4 + likeScore * 0.35 + ratingScore * 0.25
}

/** Spotlight score: weighted by absolute followers, commissions, likes, rating */
function scoreSpotlight(u: ScoredCandidate): number {
  const completedCount = u.artistCommissions.length
  return (
    u._count.followers * 0.4 +
    completedCount * 10 * 0.3 +
    totalLikes(u.posts) * 0.15 +
    (avgRating(u.artistCommissions) / 5) * 100 * 0.15
  )
}

function toArtistCard(u: ScoredCandidate) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    image: u.image,
    commissionStatus: u.commissionStatus,
    followerCount: u._count.followers,
  }
}

// ── Shared select ─────────────────────────────────────────────────────────────

const CANDIDATE_SELECT = {
  id: true,
  username: true,
  name: true,
  image: true,
  commissionStatus: true,
  createdAt: true,
  _count: { select: { followers: true } },
  posts: {
    where: { status: "PUBLISHED" as const },
    select: { _count: { select: { likes: true } } },
  },
  artistCommissions: {
    where: { status: "COMPLETE" as const, buyerRating: { not: null } },
    select: { buyerRating: true },
  },
} as const

// ── Router ────────────────────────────────────────────────────────────────────

export const discoveryRouter = router({
  risingStars: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(15) }))
    .query(async ({ ctx, input }) => {
      const blockedIds = await getBlockedIds(ctx.prisma, ctx.session?.user?.id)
      const ninetyDaysAgo = new Date(Date.now() - DISCOVERY_WINDOW_MS)

      const candidates = await ctx.prisma.user.findMany({
        where: {
          createdAt: { gte: ninetyDaysAgo },
          username: { not: null },
          posts: { some: { status: "PUBLISHED" } },
          bannedUntil: null,
          ...(blockedIds.size > 0 ? { id: { notIn: [...blockedIds] } } : {}),
        },
        select: CANDIDATE_SELECT,
        take: 100,
        orderBy: { createdAt: "desc" },
      })

      const items = (candidates as ScoredCandidate[])
        .map(u => ({ u, score: scoreRisingStar(u) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit)
        .map(({ u }) => toArtistCard(u))

      return { items, total: candidates.length }
    }),

  spotlight: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(15) }))
    .query(async ({ ctx, input }) => {
      const blockedIds = await getBlockedIds(ctx.prisma, ctx.session?.user?.id)
      const ninetyDaysAgo = new Date(Date.now() - DISCOVERY_WINDOW_MS)

      const candidates = await ctx.prisma.user.findMany({
        where: {
          createdAt: { lt: ninetyDaysAgo },
          username: { not: null },
          posts: { some: { status: "PUBLISHED" } },
          bannedUntil: null,
          ...(blockedIds.size > 0 ? { id: { notIn: [...blockedIds] } } : {}),
        },
        select: CANDIDATE_SELECT,
        take: 200,
        orderBy: { followers: { _count: "desc" } },
      })

      const items = (candidates as ScoredCandidate[])
        .map(u => ({ u, score: scoreSpotlight(u) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit)
        .map(({ u }) => toArtistCard(u))

      return { items, total: candidates.length }
    }),

  forYou: publicProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(9),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      const blockedIds = await getBlockedIds(ctx.prisma, userId)

      const followedIds = userId
        ? (await ctx.prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true },
          })).map((f: { followingId: string }) => f.followingId)
        : []

      const excludeIds = [
        ...followedIds,
        ...(userId ? [userId] : []),
        ...blockedIds,
      ]

      const where = {
        status: "PUBLISHED" as const,
        user: { username: { not: null } },
        ...(excludeIds.length > 0 ? { userId: { notIn: excludeIds } } : {}),
      }

      const items = await ctx.prisma.post.findMany({
        where,
        select: {
          id: true,
          image: true,
          description: true,
          user: { select: { username: true } },
          _count: { select: { likes: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      })

      return { items }
    }),
})
