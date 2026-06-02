import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { checkNotBanned } from "@/server/lib/ban"
import { ReportReason } from "@prisma/client"
import { sendPostFlaggedEmail } from "@/lib/email"

export const postRouter = router({
  create: protectedProcedure
    .input(z.object({
      image: z.string().min(1),
      description: z.string().max(2200).optional(),
      isAiGenerated: z.boolean().optional(),
      isCommission: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
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
        where: {
          user: { username: { not: null } },
          OR: [
            { status: "PUBLISHED" },
            ...(ctx.session?.user?.id ? [{ status: "PENDING_REVIEW" as const, userId: ctx.session.user.id }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: POOL,
        include: {
          user: { select: { id: true, username: true, name: true, image: true, commissionStatus: true } },
          _count: { select: { likes: true, comments: true } },
        },
      })

      const userId = ctx.session?.user?.id ?? null
      let followingSet = new Set<string>()
      let likedSet = new Set<string>()
      let likedArtistSet = new Set<string>()
      let reportedSet = new Set<string>()
      let blockedUserIds = new Set<string>()

      if (userId) {
        const postIds = posts.map((p) => p.id)
        const userIds = [...new Set(posts.map((p) => p.userId))]

        const [follows, myLikes, myRecentLikes, myReports, blockRelations] = await Promise.all([
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
          ctx.prisma.report.findMany({
            where: { reporterId: userId, postId: { in: postIds } },
            select: { postId: true },
          }),
          ctx.prisma.block.findMany({
            where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
            select: { blockerId: true, blockedId: true },
          }),
        ])

        followingSet = new Set(follows.map((f) => f.followingId))
        likedSet = new Set(myLikes.map((l) => l.postId))
        likedArtistSet = new Set(myRecentLikes.map((l) => l.post.userId))
        reportedSet = new Set(myReports.map((r) => r.postId))
        blockedUserIds = new Set(
          blockRelations.map((b) => b.blockerId === userId ? b.blockedId : b.blockerId)
        )
      }

      const visiblePosts = posts.filter((p) => !blockedUserIds.has(p.userId))

      // Score every post
      const now = Date.now()
      const scored = visiblePosts.map((post) => {
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
          viewerHasReported: reportedSet.has(post.id),
          _score: recency + engagement + followBoost + interestBoost,
        }
      })

      scored.sort((a, b) => b._score - a._score)

      let slice = scored.slice(input.cursor, input.cursor + PAGE_SIZE)
      const nextCursor = input.cursor + PAGE_SIZE < scored.length
        ? input.cursor + PAGE_SIZE
        : null

      return { posts: slice, nextCursor }
    }),

  getByUsername: publicProcedure
    .input(z.object({ username: z.string(), viewerUserId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })

      const isOwner = input.viewerUserId === user.id
      const graceCutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)

      return ctx.prisma.post.findMany({
        where: isOwner
          ? {
              userId: user.id,
              OR: [
                { status: { in: ["PUBLISHED", "PENDING_REVIEW"] } },
                { status: "REMOVED", removedAt: { gte: graceCutoff } },
              ],
            }
          : { userId: user.id, status: "PUBLISHED" },
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
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
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

  report: protectedProcedure
    .input(z.object({
      postId: z.string(),
      reason: z.nativeEnum(ReportReason),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const callerId = ctx.session.user.id

      // 1. Verify post exists and caller is not the owner
      const post = await ctx.prisma.post.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          userId: true,
          status: true,
          reportCount: true,
          user: { select: { email: true, username: true } },
        },
      })
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." })
      if (post.userId === callerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot report your own post." })
      }

      // 2. Create Report row (unique constraint will throw on duplicate)
      try {
        await ctx.prisma.report.create({
          data: {
            postId: input.postId,
            reporterId: callerId,
            reason: input.reason,
            notes: input.notes ?? null,
          },
        })
      } catch (e: unknown) {
        // Prisma unique constraint violation = P2002
        if ((e as { code?: string })?.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "You have already reported this post." })
        }
        throw e
      }

      // 3. Increment reportCount atomically and check threshold
      const updated = await ctx.prisma.post.update({
        where: { id: input.postId },
        data: { reportCount: { increment: 1 } },
        select: { reportCount: true, status: true },
      })

      // 4. If threshold reached and post is still PUBLISHED, move to PENDING_REVIEW
      if (updated.reportCount >= 3 && updated.status === "PUBLISHED") {
        await ctx.prisma.$transaction(async (tx) => {
          await tx.post.update({
            where: { id: input.postId },
            data: {
              status: "PENDING_REVIEW",
              pendingAt: new Date(),
              flagReason: "Reached community report threshold",
            },
          })
          // Notify post owner — system notification (no human sender)
          await tx.notification.create({
            data: {
              userId: post.userId,
              fromUserId: null,
              type: "post_pending_review",
            },
          })
        })

        // Send flagged email after transaction commits
        if (post.user.email) {
          void sendPostFlaggedEmail(post.user.email, {
            username: post.user.username ?? "there",
          })
        }
      }

      return { success: true }
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
