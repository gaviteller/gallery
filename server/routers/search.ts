import { z } from "zod"
import { router, publicProcedure } from "@/lib/trpc"

export const searchRouter = router({
  artists: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const blockedIds = new Set<string>()

      if (ctx.session?.user?.id) {
        const blockRelations = await ctx.prisma.block.findMany({
          where: {
            OR: [
              { blockerId: ctx.session.user.id },
              { blockedId: ctx.session.user.id },
            ],
          },
          select: { blockerId: true, blockedId: true },
        })
        for (const b of blockRelations) {
          blockedIds.add(b.blockerId === ctx.session.user.id ? b.blockedId : b.blockerId)
        }
      }

      // Note: bannedUntil is intentionally not filtered here — search is public discovery.
      // Banned users can still be found but cannot accept commissions.
      const where = {
        OR: [
          { username: { contains: input.query, mode: "insensitive" as const } },
          { name: { contains: input.query, mode: "insensitive" as const } },
        ],
        username: { not: null },
        ...(blockedIds.size > 0 ? { id: { notIn: [...blockedIds] } } : {}),
      }

      const items = await ctx.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          name: true,
          image: true,
          commissionStatus: true,
        },
        take: input.limit,
        orderBy: { username: "asc" },
      })

      const total = items.length < input.limit
        ? items.length
        : await ctx.prisma.user.count({ where })

      return { items, total }
    }),

  /**
   * Posts whose caption or hashtags match the search text.
   * `sort` comes from the Explore filter sheet:
   *   trending  → most likes in the last 7 days (default)
   *   newest    → most recent first
   *   mostLiked → most likes of all time
   */
  posts: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
      sort: z.enum(["trending", "newest", "mostLiked"]).default("trending"),
    }))
    .query(async ({ ctx, input }) => {
      const blockedIds = new Set<string>()
      if (ctx.session?.user?.id) {
        const blockRelations = await ctx.prisma.block.findMany({
          where: {
            OR: [
              { blockerId: ctx.session.user.id },
              { blockedId: ctx.session.user.id },
            ],
          },
          select: { blockerId: true, blockedId: true },
        })
        for (const b of blockRelations) {
          blockedIds.add(b.blockerId === ctx.session.user.id ? b.blockedId : b.blockerId)
        }
      }

      const where = {
        status: "PUBLISHED" as const,
        user: { username: { not: null } },
        ...(blockedIds.size > 0 ? { userId: { notIn: [...blockedIds] } } : {}),
        OR: [
          { description: { contains: input.query, mode: "insensitive" as const } },
          { hashtags: { some: { tag: { contains: input.query, mode: "insensitive" as const } } } },
        ],
      }

      const total = await ctx.prisma.post.count({ where })
      const resultFields = {
        id: true,
        image: true,
        description: true,
        user: { select: { username: true } },
      } as const

      if (input.sort === "newest" || input.sort === "mostLiked") {
        const items = await ctx.prisma.post.findMany({
          where,
          select: resultFields,
          take: input.limit,
          orderBy: input.sort === "newest"
            ? { createdAt: "desc" }
            : [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
        })
        return { items, total }
      }

      // Trending: the database can't sort by "likes in the last 7 days" directly, so
      // count recent likes for the matching posts (without loading images), rank them
      // here, then load full details for just the top results.
      const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
      const MAX_POSTS_TO_RANK = 500
      const recentLikesSince = new Date(Date.now() - TRENDING_WINDOW_MS)
      const candidates = await ctx.prisma.post.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          _count: { select: { likes: { where: { createdAt: { gte: recentLikesSince } } } } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_POSTS_TO_RANK,
      })
      const topPostIds = candidates
        .sort((a, b) => b._count.likes - a._count.likes || b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, input.limit)
        .map((post) => post.id)

      const topPosts = await ctx.prisma.post.findMany({
        where: { id: { in: topPostIds } },
        select: resultFields,
      })
      const rankById = new Map(topPostIds.map((id, rank) => [id, rank]))
      const items = topPosts.sort((a, b) => rankById.get(a.id)! - rankById.get(b.id)!)

      return { items, total }
    }),

  shop: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const blockedIds = new Set<string>()
      if (ctx.session?.user?.id) {
        const blockRelations = await ctx.prisma.block.findMany({
          where: {
            OR: [
              { blockerId: ctx.session.user.id },
              { blockedId: ctx.session.user.id },
            ],
          },
          select: { blockerId: true, blockedId: true },
        })
        for (const b of blockRelations) {
          blockedIds.add(b.blockerId === ctx.session.user.id ? b.blockedId : b.blockerId)
        }
      }

      const where = {
        // Only live listings — never paused, removed, or held for moderation review.
        status: "ACTIVE",
        user: { username: { not: null } },
        ...(blockedIds.size > 0 ? { userId: { notIn: [...blockedIds] } } : {}),
        OR: [
          { title: { contains: input.query, mode: "insensitive" as const } },
          { description: { contains: input.query, mode: "insensitive" as const } },
        ],
      }

      const [items, total] = await Promise.all([
        ctx.prisma.shopItem.findMany({
          where,
          select: {
            id: true,
            image: true,
            title: true,
            price: true,
            user: { select: { username: true } },
          },
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        ctx.prisma.shopItem.count({ where }),
      ])

      return { items, total }
    }),
})
