import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"

export const interactionRouter = router({
  // ── Likes ────────────────────────────────────────────────────────────────
  toggleLike: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.like.findUnique({
        where: { userId_postId: { userId: ctx.session.user.id, postId: input.postId } },
      })
      if (existing) {
        await ctx.prisma.like.delete({ where: { userId_postId: { userId: ctx.session.user.id, postId: input.postId } } })
        return { liked: false }
      } else {
        await ctx.prisma.like.create({ data: { userId: ctx.session.user.id, postId: input.postId } })
        return { liked: true }
      }
    }),

  getPostData: publicProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [likeCount, commentCount, liked, comments] = await Promise.all([
        ctx.prisma.like.count({ where: { postId: input.postId } }),
        ctx.prisma.comment.count({ where: { postId: input.postId } }),
        ctx.session
          ? ctx.prisma.like.findUnique({ where: { userId_postId: { userId: ctx.session.user.id, postId: input.postId } } })
          : null,
        ctx.prisma.comment.findMany({
          where: { postId: input.postId },
          orderBy: { createdAt: "asc" },
          include: { user: { select: { username: true, name: true, image: true } } },
        }),
      ])
      return { likeCount, commentCount, liked: !!liked, comments }
    }),

  // ── Comments ─────────────────────────────────────────────────────────────
  addComment: protectedProcedure
    .input(z.object({ postId: z.string(), text: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.comment.create({
        data: { userId: ctx.session.user.id, postId: input.postId, text: input.text },
        include: { user: { select: { username: true, name: true, image: true } } },
      })
    }),

  deleteComment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findUnique({ where: { id: input.id } })
      if (!comment) return
      if (comment.userId !== ctx.session.user.id) return
      await ctx.prisma.comment.delete({ where: { id: input.id } })
    }),
})
