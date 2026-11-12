/**
 * LIKES & COMMENTS — `trpc.interaction.*`
 *
 * Post likes, comment likes, adding/deleting comments, and the combined
 * "likes + comments" data shown under a post. New comments are AI-scanned
 * (lib/ai-scan.ts) and post owners get a push notification for likes/comments.
 */
import { z } from "zod"
import { after } from "next/server"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { checkNotBanned } from "@/server/lib/ban"
import { scanComment } from "@/lib/ai-scan"
import { sendPushToUser } from "@/lib/sendPush"
import type { PrismaClient } from "@prisma/client"

/** Fields returned for every comment (and reply). */
const commentSelect = {
  id: true,
  text: true,
  createdAt: true,
  parentId: true,
  user: { select: { username: true, name: true, image: true } },
  _count: { select: { likes: true, replies: true } },
}

/** Ids of every comment and reply in a thread, for looking up the viewer's likes in one query. */
function getAllCommentIds(comments: { id: string; replies?: { id: string }[] }[]): string[] {
  return comments.flatMap((comment) => [comment.id, ...(comment.replies?.map((reply) => reply.id) ?? [])])
}

/**
 * Sends a push notification to a post's owner (unless they acted on their own post).
 * Looks up the post owner and the actor's display name in parallel. Fire-and-forget.
 */
async function notifyPostOwner(
  prisma: PrismaClient,
  postId: string,
  actorId: string,
  buildMessage: (actorName: string) => { title: string; body: string; tag: string },
) {
  const [post, actor] = await Promise.all([
    prisma.post.findUnique({ where: { id: postId }, select: { userId: true } }),
    prisma.user.findUnique({ where: { id: actorId }, select: { username: true, name: true } }),
  ])
  if (!post || post.userId === actorId) return
  const message = buildMessage(actor?.name ?? actor?.username ?? "Someone")
  sendPushToUser(prisma, post.userId, { ...message, url: `/` }).catch(() => {})
}

export const interactionRouter = router({
  // ── Post likes ───────────────────────────────────────────────────────────

  /** Likes the post, or removes the like if already liked. Returns the new state. */
  toggleLike: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id
      await checkNotBanned(ctx.prisma, viewerId)

      const unliked = await ctx.prisma.like.deleteMany({ where: { userId: viewerId, postId: input.postId } })
      if (unliked.count > 0) return { liked: false }

      await ctx.prisma.like.create({ data: { userId: viewerId, postId: input.postId } })
      await notifyPostOwner(ctx.prisma, input.postId, viewerId, (likerName) => ({
        title: "New like",
        body: `${likerName} liked your post`,
        tag: `like-${input.postId}`,
      }))
      return { liked: true }
    }),

  /**
   * Everything shown under a post: like count, whether the viewer liked it, and
   * the visible (not AI-hidden) comments with their replies, oldest first,
   * each marked with whether the viewer liked it.
   */
  getPostData: publicProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.session?.user?.id
      const [likeCount, viewerLike, topLevelComments] = await Promise.all([
        ctx.prisma.like.count({ where: { postId: input.postId } }),
        viewerId
          ? ctx.prisma.like.findUnique({
              where: { userId_postId: { userId: viewerId, postId: input.postId } },
              select: { id: true },
            })
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

      const commentIdsViewerLiked = viewerId
        ? new Set(
            (await ctx.prisma.commentLike.findMany({
              where: { userId: viewerId, commentId: { in: getAllCommentIds(topLevelComments) } },
              select: { commentId: true },
            })).map((commentLike) => commentLike.commentId)
          )
        : new Set<string>()

      return {
        likeCount,
        liked: !!viewerLike,
        comments: topLevelComments.map((comment) => ({
          ...comment,
          likedByMe: commentIdsViewerLiked.has(comment.id),
          replies: comment.replies.map((reply) => ({ ...reply, likedByMe: commentIdsViewerLiked.has(reply.id) })),
        })),
      }
    }),

  // ── Comment likes ────────────────────────────────────────────────────────

  /** Likes a comment, or removes the like if already liked. */
  toggleCommentLike: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id
      await checkNotBanned(ctx.prisma, viewerId)

      const unliked = await ctx.prisma.commentLike.deleteMany({ where: { userId: viewerId, commentId: input.commentId } })
      if (unliked.count > 0) return { liked: false }

      await ctx.prisma.commentLike.create({ data: { userId: viewerId, commentId: input.commentId } })
      return { liked: true }
    }),

  // ── Comments ─────────────────────────────────────────────────────────────

  /**
   * Adds a comment (or a reply when `parentId` is set). The AI scan runs before
   * returning, so a comment it rejects is already hidden when the page refreshes.
   */
  addComment: protectedProcedure
    .input(z.object({ postId: z.string(), text: z.string().min(1).max(500), parentId: z.string().nullish() }))
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id
      await checkNotBanned(ctx.prisma, viewerId)
      const comment = await ctx.prisma.comment.create({
        data: {
          userId: viewerId,
          postId: input.postId,
          text: input.text,
          parentId: input.parentId ?? null,
        },
        select: { id: true },
      })
      const prismaForScan = ctx.prisma
      after(() => scanComment(prismaForScan, comment.id))
      await notifyPostOwner(ctx.prisma, input.postId, viewerId, (commenterName) => ({
        title: "New comment",
        body: `${commenterName}: ${input.text.slice(0, 80)}`,
        tag: `comment-${input.postId}`,
      }))
    }),

  /** Deletes a comment — only its author can. Silently does nothing otherwise. */
  deleteComment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.comment.deleteMany({ where: { id: input.id, userId: ctx.session.user.id } })
    }),
})
