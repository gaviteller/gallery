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
    .query(async ({ ctx }) => {
      const posts = await ctx.prisma.post.findMany({
        where: { user: { username: { not: null } } },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: {
            select: { id: true, username: true, name: true, image: true },
          },
          _count: { select: { likes: true, comments: true } },
        },
      })

      const currentUserId = ctx.session?.user?.id ?? null

      if (!currentUserId) {
        return posts.map((p) => ({ ...p, isFollowing: false, isOwnPost: false, likedByMe: false }))
      }

      const postIds = posts.map((p) => p.id)
      const userIds = [...new Set(posts.map((p) => p.userId))]

      const [follows, myLikes] = await Promise.all([
        ctx.prisma.follow.findMany({
          where: { followerId: currentUserId, followingId: { in: userIds } },
          select: { followingId: true },
        }).catch(() => []),
        ctx.prisma.like.findMany({
          where: { userId: currentUserId, postId: { in: postIds } },
          select: { postId: true },
        }),
      ])

      const followingSet = new Set(follows.map((f) => f.followingId))
      const likedSet = new Set(myLikes.map((l) => l.postId))

      return posts.map((p) => ({
        ...p,
        isFollowing: followingSet.has(p.userId),
        isOwnPost: p.userId === currentUserId,
        likedByMe: likedSet.has(p.id),
      }))
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
        orderBy: { createdAt: "desc" },
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
})
