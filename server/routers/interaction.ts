import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { checkNotBanned } from "@/server/lib/ban"
import { scanComment } from "@/lib/ai-scan"
import { sendPushToUser } from "@/lib/sendPush"

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
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const existing = await ctx.prisma.like.findUnique({
        where: { userId_postId: { userId: ctx.session.user.id, postId: input.postId } },
      })
      if (existing) {
        await ctx.prisma.like.delete({ where: { userId_postId: { userId: ctx.session.user.id, postId: input.postId } } })
        return { liked: false }
      } else {
        await ctx.prisma.like.create({ data: { userId: ctx.session.user.id, postId: input.postId } })
        const post = await ctx.prisma.post.findUnique({ where: { id: input.postId }, select: { userId: true } })
        const liker = await ctx.prisma.user.findUnique({ where: { id: ctx.session.user.id }, select: { username: true, name: true } })
        if (post && post.userId !== ctx.session.user.id) {
          const name = liker?.name ?? liker?.username ?? "Someone"
          sendPushToUser(ctx.prisma, post.userId, {
            title: "New like",
            body: `${name} liked your post`,
            url: `/`,
            tag: `like-${input.postId}`,
          }).catch(() => {})
        }
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
          where: { postId: input.postId, parentId: null, hidden: false },
          orderBy: { createdAt: "asc" },
          select: {
            ...commentSelect,
            replies: {
              where: { hidden: false },
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
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
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
    .input(z.object({ postId: z.string(), text: z.string().min(1).max(500), parentId: z.string().nullish() }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const comment = await ctx.prisma.comment.create({
        data: {
          userId: ctx.session.user.id,
          postId: input.postId,
          text: input.text,
          parentId: input.parentId ?? null,
        },
      })
      await scanComment(ctx.prisma, comment.id)
      const post = await ctx.prisma.post.findUnique({ where: { id: input.postId }, select: { userId: true } })
      const commenter = await ctx.prisma.user.findUnique({ where: { id: ctx.session.user.id }, select: { username: true, name: true } })
      if (post && post.userId !== ctx.session.user.id) {
        const name = commenter?.name ?? commenter?.username ?? "Someone"
        sendPushToUser(ctx.prisma, post.userId, {
          title: "New comment",
          body: `${name}: ${input.text.slice(0, 80)}`,
          url: `/`,
          tag: `comment-${input.postId}`,
        }).catch(() => {})
      }
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
