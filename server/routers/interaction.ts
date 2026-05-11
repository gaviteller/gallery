import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"

const commentSelect = {
  id: true,
  text: true,
  createdAt: true,
  parentId: true,
  user: { select: { username: true, name: true, image: true } },
  _count: { select: { likes: true, replies: true } },
}

export const interactionRouter = router({
  // ── Post likes ───────────────────────────────────────────────────────────
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
      const [likeCount, liked, topComments] = await Promise.all([
        ctx.prisma.like.count({ where: { postId: input.postId } }),
        ctx.session
          ? ctx.prisma.like.findUnique({ where: { userId_postId: { userId: ctx.session.user.id, postId: input.postId } } })
          : null,
        ctx.prisma.comment.findMany({
          where: { postId: input.postId, parentId: null },
          orderBy: { createdAt: "asc" },
          select: {
            ...commentSelect,
            replies: {
              orderBy: { createdAt: "asc" },
              select: commentSelect,
            },
          },
        }),
      ])

      // attach likedByMe to each comment
      const myCommentLikes = ctx.session
        ? new Set(
            (await ctx.prisma.commentLike.findMany({
              where: { userId: ctx.session.user.id, commentId: { in: getAllCommentIds(topComments) } },
              select: { commentId: true },
            })).map((l) => l.commentId)
          )
        : new Set<string>()

      return {
        likeCount,
        liked: !!liked,
        comments: topComments.map((c) => ({
          ...c,
          likedByMe: myCommentLikes.has(c.id),
          replies: c.replies.map((r) => ({ ...r, likedByMe: myCommentLikes.has(r.id) })),
        })),
      }
    }),

  // ── Comment likes ────────────────────────────────────────────────────────
  toggleCommentLike: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.commentLike.findUnique({
        where: { userId_commentId: { userId: ctx.session.user.id, commentId: input.commentId } },
      })
      if (existing) {
        await ctx.prisma.commentLike.delete({ where: { userId_commentId: { userId: ctx.session.user.id, commentId: input.commentId } } })
        return { liked: false }
      } else {
        await ctx.prisma.commentLike.create({ data: { userId: ctx.session.user.id, commentId: input.commentId } })
        return { liked: true }
      }
    }),

  // ── Comments ─────────────────────────────────────────────────────────────
  addComment: protectedProcedure
    .input(z.object({ postId: z.string(), text: z.string().min(1).max(500), parentId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.comment.create({
        data: {
          userId: ctx.session.user.id,
          postId: input.postId,
          text: input.text,
          parentId: input.parentId ?? null,
        },
        select: commentSelect,
      })
    }),

  deleteComment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findUnique({ where: { id: input.id } })
      if (!comment || comment.userId !== ctx.session.user.id) return
      await ctx.prisma.comment.delete({ where: { id: input.id } })
    }),
})

function getAllCommentIds(comments: { id: string; replies?: { id: string }[] }[]): string[] {
  return comments.flatMap((c) => [c.id, ...(c.replies?.map((r) => r.id) ?? [])])
}
