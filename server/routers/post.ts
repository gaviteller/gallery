import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"

export const postRouter = router({
  create: protectedProcedure
    .input(z.object({
      image: z.string().min(1),
      description: z.string().max(2200).optional(),
      isAiGenerated: z.boolean().optional(),
      isCommission: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tags = [
        ...new Set(
          (input.description ?? "")
            .match(/#([a-zA-Z0-9_]+)/g)
            ?.map((t) => t.slice(1).toLowerCase()) ?? []
        ),
      ]
      return ctx.prisma.post.create({
        data: {
          userId: ctx.session.user.id,
          image: input.image,
          description: input.description ?? null,
          isAiGenerated: input.isAiGenerated ?? false,
          isCommission: input.isCommission ?? false,
          hashtags: tags.length > 0 ? {
            connectOrCreate: tags.map((tag) => ({
              where: { tag },
              create: { tag },
            })),
          } : undefined,
        },
      })
    }),

  getFeed: publicProcedure
    .input(z.object({ cursor: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const PAGE_SIZE = 12
      const POOL = 300

      // Pull a large recent pool to rank from
      const posts = await ctx.prisma.post.findMany({
        where: { user: { username: { not: null } } },
        orderBy: { createdAt: "desc" },
        take: POOL,
        include: {
          user: { select: { id: true, username: true, name: true, image: true } },
          _count: { select: { likes: true, comments: true } },
        },
      })

      const userId = ctx.session?.user?.id ?? null
      let followingSet = new Set<string>()
      let likedSet = new Set<string>()
      let likedArtistSet = new Set<string>()

      if (userId) {
        const postIds = posts.map((p) => p.id)
        const userIds = [...new Set(posts.map((p) => p.userId))]

        const [follows, myLikes, myRecentLikes] = await Promise.all([
          ctx.prisma.follow.findMany({
            where: { followerId: userId, followingId: { in: userIds } },
            select: { followingId: true },
          }),
          ctx.prisma.like.findMany({
            where: { userId, postId: { in: postIds } },
            select: { postId: true },
          }),
          // Which artists has this user liked in the past? (interest graph)
          ctx.prisma.like.findMany({
            where: { userId },
            select: { post: { select: { userId: true } } },
            orderBy: { createdAt: "desc" },
            take: 300,
          }),
        ])

        followingSet = new Set(follows.map((f) => f.followingId))
        likedSet = new Set(myLikes.map((l) => l.postId))
        likedArtistSet = new Set(myRecentLikes.map((l) => l.post.userId))
      }

      // Score every post
      const now = Date.now()
      const scored = posts.map((post) => {
        const ageHours = (now - new Date(post.createdAt).getTime()) / 3_600_000
        // Recency: 30-point bonus decaying with a 72-hour half-life
        const recency = 30 * Math.exp(-ageHours / 72)
        // Engagement: likes + weighted comments, dampened by age
        const engagement = ((post._count.likes + post._count.comments * 2) / Math.pow(ageHours + 2, 1.1)) * 8
        // Social signals
        const followBoost = followingSet.has(post.userId) ? 45 : 0
        const interestBoost = likedArtistSet.has(post.userId) && !followingSet.has(post.userId) ? 18 : 0

        return {
          ...post,
          isFollowing: followingSet.has(post.userId),
          isOwnPost: post.userId === userId,
          likedByMe: likedSet.has(post.id),
          _score: recency + engagement + followBoost + interestBoost,
        }
      })

      scored.sort((a, b) => b._score - a._score)

      const slice = scored.slice(input.cursor, input.cursor + PAGE_SIZE)
      const nextCursor = input.cursor + PAGE_SIZE < scored.length
        ? input.cursor + PAGE_SIZE
        : null

      return { posts: slice, nextCursor }
    }),

  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.prisma.post.findMany({
        where: { userId: user.id },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      })
    }),

  getCommissionsByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.prisma.post.findMany({
        where: { userId: user.id, isCommission: true },
        orderBy: { createdAt: "desc" },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.post.findUnique({ where: { id: input.id } })
      if (!post) throw new TRPCError({ code: "NOT_FOUND" })
      if (post.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.post.delete({ where: { id: input.id } })
    }),

  pin: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.post.findUnique({ where: { id: input.id } })
      if (!post) throw new TRPCError({ code: "NOT_FOUND" })
      if (post.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })

      return ctx.prisma.$transaction(async (tx) => {
        // Enforce max 3 pinned posts (inside transaction to prevent race condition)
        const pinnedCount = await tx.post.count({
          where: { userId: ctx.session.user.id, pinned: true },
        })
        if (pinnedCount >= 3) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You can only pin up to 3 posts." })
        }

        return tx.post.update({ where: { id: input.id }, data: { pinned: true } })
      })
    }),

  unpin: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.post.findUnique({ where: { id: input.id } })
      if (!post) throw new TRPCError({ code: "NOT_FOUND" })
      if (post.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.post.update({ where: { id: input.id }, data: { pinned: false } })
    }),

  getMyPostStats: protectedProcedure.query(async ({ ctx }) => {
    const me = ctx.session.user.id

    const posts = await ctx.prisma.post.findMany({
      where: { userId: me },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { likes: true, comments: true } },
      },
    })

    const totalLikes = posts.reduce((sum, p) => sum + p._count.likes, 0)
    const totalComments = posts.reduce((sum, p) => sum + p._count.comments, 0)
    const topPost = posts.reduce<typeof posts[0] | null>(
      (best, p) => (!best || p._count.likes > best._count.likes ? p : best),
      null
    )

    return {
      totalPosts: posts.length,
      totalLikes,
      totalComments,
      avgLikes: posts.length > 0 ? Math.round((totalLikes / posts.length) * 10) / 10 : 0,
      topPostId: topPost?.id ?? null,
      posts: posts.map(p => ({
        id: p.id,
        image: p.image,
        description: p.description,
        createdAt: p.createdAt,
        likes: p._count.likes,
        comments: p._count.comments,
        isAiGenerated: p.isAiGenerated,
        isCommission: p.isCommission,
      })),
    }
  }),
})
