/**
 * DISCOVERY — `trpc.discovery.*` (the Explore page and the sidebar)
 *
 *   trendingTags → sidebar "Trending" box
 *   risingStars  → newer artists (joined ≤ 90 days ago) growing fast; also the sidebar "Suggested" list
 *   spotlight    → established artists (joined > 90 days ago) with the biggest following
 *   forYou       → "You Might Like" post grid, excluding people the viewer already follows
 *
 * Every list hides blocked users. Artist scores get a small boost or penalty
 * from how many of their posts the AI moderation marked SAFE.
 */
import { z } from "zod"
import { router, publicProcedure } from "@/lib/trpc"
import type { CommissionStatus } from "@prisma/client"
import { getBlockedUserIds } from "@/server/lib/blocks"

// ── Constants ─────────────────────────────────────────────────────────────────

const DISCOVERY_WINDOW_DAYS = 90
const DISCOVERY_WINDOW_MS = DISCOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000
const TRENDING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

// ── Scoring ───────────────────────────────────────────────────────────────────

type ScoredCandidate = {
  id: string
  username: string | null
  name: string | null
  image: string | null
  commissionStatus: CommissionStatus
  createdAt: Date
  _count: { followers: number }
  posts: { _count: { likes: number }; aiVerdict: string | null; createdAt: Date }[]
  artistCommissions: { buyerRating: number | null }[]
}

/** Average buyer rating (1–5) across completed commissions; 0 if none rated. */
function avgRating(commissions: { buyerRating: number | null }[]): number {
  const ratings = commissions.map((commission) => commission.buyerRating).filter((rating): rating is number => rating !== null)
  return ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0
}

function totalLikes(posts: { _count: { likes: number } }[]): number {
  return posts.reduce((sum, post) => sum + post._count.likes, 0)
}

/** 0–1: share of AI-scanned posts marked SAFE. Artists with no scanned posts count as neutral (0.5). */
function contentQuality(posts: { aiVerdict: string | null }[]): number {
  const scannedPosts = posts.filter((post) => post.aiVerdict !== null)
  if (scannedPosts.length === 0) return 0.5
  return scannedPosts.filter((post) => post.aiVerdict === "SAFE").length / scannedPosts.length
}

/** Multiplier from content quality: 0.8× (everything flagged) up to 1.1× (everything safe). */
function qualityMultiplier(posts: { aiVerdict: string | null }[]): number {
  return 0.8 + contentQuality(posts) * 0.3
}

/** Rising Star score: followers and likes gained per day since joining, plus rating. */
function scoreRisingStar(artist: ScoredCandidate): number {
  const accountAgeDays = Math.max(1, (Date.now() - artist.createdAt.getTime()) / 86_400_000)
  const followersPerDay = artist._count.followers / accountAgeDays
  const likesPerDay = totalLikes(artist.posts) / accountAgeDays
  const ratingScore = avgRating(artist.artistCommissions) / 5
  const baseScore = followersPerDay * 0.4 + likesPerDay * 0.35 + ratingScore * 0.25
  return baseScore * qualityMultiplier(artist.posts)
}

/** Spotlight score: total followers, completed commissions, likes and rating. */
function scoreSpotlight(artist: ScoredCandidate): number {
  const completedCommissions = artist.artistCommissions.length
  const baseScore =
    artist._count.followers * 0.4 +
    completedCommissions * 10 * 0.3 +
    totalLikes(artist.posts) * 0.15 +
    (avgRating(artist.artistCommissions) / 5) * 100 * 0.15
  return baseScore * qualityMultiplier(artist.posts)
}

/** The small artist object the UI cards need. */
function toArtistCard(artist: ScoredCandidate) {
  return {
    id: artist.id,
    username: artist.username,
    name: artist.name,
    image: artist.image,
    commissionStatus: artist.commissionStatus,
    followerCount: artist._count.followers,
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
    select: { _count: { select: { likes: true } }, aiVerdict: true, createdAt: true },
  },
  artistCommissions: {
    where: { status: "COMPLETE" as const, buyerRating: { not: null } },
    select: { buyerRating: true },
  },
} as const

// ── Router ────────────────────────────────────────────────────────────────────

export const discoveryRouter = router({
  /**
   * Hashtags ranked by how many published posts used them in the last 30 days
   * (falls back to all-time on a quiet site). Posts by banned users don't count.
   * Shown in the sidebar "Trending" box.
   */
  trendingTags: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(30).default(6) }))
    .query(async ({ ctx, input }) => {
      const rank = async (since?: Date) => {
        const tags = await ctx.prisma.hashtag.findMany({
          select: {
            tag: true,
            _count: {
              select: {
                posts: {
                  where: {
                    status: "PUBLISHED",
                    user: { bannedUntil: null },
                    ...(since ? { createdAt: { gte: since } } : {}),
                  },
                },
              },
            },
          },
        })
        return tags
          .map(t => ({ tag: t.tag, count: t._count.posts }))
          .filter(t => t.count > 0)
          .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
          .slice(0, input.limit)
      }

      // Small communities may have no tagged posts in the window; fall back to all-time.
      const recent = await rank(new Date(Date.now() - TRENDING_WINDOW_MS))
      return { items: recent.length > 0 ? recent : await rank() }
    }),

  /**
   * New artists (joined in the last 90 days) ranked by early traction.
   * `excludeFollowed: true` turns this into "suggested artists to follow": it also
   * leaves out the viewer themself and anyone they already follow (used by the sidebar).
   */
  risingStars: publicProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(15),
      excludeFollowed: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.session?.user?.id
      const hiddenUserIds = await getBlockedUserIds(ctx.prisma, viewerId)
      if (input.excludeFollowed && viewerId) {
        hiddenUserIds.add(viewerId)
        const alreadyFollowing = await ctx.prisma.follow.findMany({
          where: { followerId: viewerId },
          select: { followingId: true },
        })
        for (const follow of alreadyFollowing) hiddenUserIds.add(follow.followingId)
      }
      const ninetyDaysAgo = new Date(Date.now() - DISCOVERY_WINDOW_MS)

      const candidates = await ctx.prisma.user.findMany({
        where: {
          createdAt: { gte: ninetyDaysAgo },
          username: { not: null },
          posts: { some: { status: "PUBLISHED" } },
          bannedUntil: null,
          ...(hiddenUserIds.size > 0 ? { id: { notIn: [...hiddenUserIds] } } : {}),
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
      const blockedIds = await getBlockedUserIds(ctx.prisma, ctx.session?.user?.id)
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

  /**
   * "You Might Like": recent posts from people the viewer doesn't follow,
   * ranked by likes per hour (recent posts with fast engagement win).
   * Excludes the viewer, blocked users, banned users and AI-flagged EXPLICIT posts.
   */
  forYou: publicProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(9),
    }))
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.session?.user?.id
      const blockedIds = await getBlockedUserIds(ctx.prisma, viewerId)

      const followedIds = viewerId
        ? (await ctx.prisma.follow.findMany({
            where: { followerId: viewerId },
            select: { followingId: true },
          })).map((follow) => follow.followingId)
        : []

      const excludedAuthorIds = [...followedIds, ...(viewerId ? [viewerId] : []), ...blockedIds]
      const CANDIDATES_PER_RESULT = 6

      // Rank a pool of recent posts WITHOUT images (they're large), then load
      // images only for the few posts actually returned.
      const candidates = await ctx.prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          user: { username: { not: null }, bannedUntil: null },
          ...(excludedAuthorIds.length > 0 ? { userId: { notIn: excludedAuthorIds } } : {}),
          aiVerdict: { not: "EXPLICIT" },
        },
        select: {
          id: true,
          description: true,
          createdAt: true,
          user: { select: { username: true } },
          _count: { select: { likes: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit * CANDIDATES_PER_RESULT,
      })

      const topPosts = candidates
        .map((post) => {
          const hoursOld = Math.max(1, (Date.now() - post.createdAt.getTime()) / 3_600_000)
          return { post, score: post._count.likes / Math.pow(hoursOld + 2, 1.5) }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit)
        .map(({ post }) => post)

      const images = topPosts.length > 0
        ? await ctx.prisma.post.findMany({
            where: { id: { in: topPosts.map((post) => post.id) } },
            select: { id: true, image: true },
          })
        : []
      const imageByPostId = new Map(images.map((post) => [post.id, post.image]))

      return { items: topPosts.map((post) => ({ ...post, image: imageByPostId.get(post.id) ?? "" })) }
    }),
})
