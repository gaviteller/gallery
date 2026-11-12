/**
 * POSTS — `trpc.post.*`
 *
 * Creating/deleting/pinning posts, the home feed, profile post grids, and
 * community reports. Post statuses:
 *   PUBLISHED       → visible to everyone
 *   PENDING_REVIEW  → hidden from others (AI flag or 3 community reports); owner still sees it
 *   REMOVED         → hidden; owner sees it for 15 days with the reason + appeal link
 */
import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { checkNotBanned } from "@/server/lib/ban"
import { ReportReason, type PrismaClient } from "@prisma/client"
import { sendPostFlaggedEmail } from "@/lib/email"
import { scanPost } from "@/lib/ai-scan"
import { REMOVAL_GRACE_CUTOFF } from "@/lib/removal"
import { after } from "next/server"

const MAX_PINNED_POSTS = 3
const REPORTS_UNTIL_REVIEW = 3

/** "#Fantasy art #fantasy" → ["fantasy"] — unique lowercase tags without the "#". */
function extractHashtags(caption: string | undefined): string[] {
  const matches = (caption ?? "").match(/#([a-zA-Z0-9_]+)/g) ?? []
  return [...new Set(matches.map((hashtag) => hashtag.slice(1).toLowerCase()))]
}

/** Throws NOT_FOUND / FORBIDDEN unless the post exists and belongs to `userId`. Loads only the owner id. */
async function assertPostOwner(prisma: PrismaClient, postId: string, userId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } })
  if (!post) throw new TRPCError({ code: "NOT_FOUND" })
  if (post.userId !== userId) throw new TRPCError({ code: "FORBIDDEN" })
}

/**
 * Which posts a viewer may see on someone's profile: everyone sees PUBLISHED;
 * the owner also sees posts under review and posts removed in the last 15 days.
 */
function visiblePostsFilter(profileUserId: string, viewerIsOwner: boolean) {
  return viewerIsOwner
    ? {
        userId: profileUserId,
        OR: [
          { status: { in: ["PUBLISHED" as const, "PENDING_REVIEW" as const] } },
          { status: "REMOVED" as const, removedAt: { gte: REMOVAL_GRACE_CUTOFF() } },
        ],
      }
    : { userId: profileUserId, status: "PUBLISHED" as const }
}

/** Finds a user's id by username (case-insensitive), or throws NOT_FOUND. */
async function getUserIdByUsername(prisma: PrismaClient, username: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  })
  if (!user) throw new TRPCError({ code: "NOT_FOUND" })
  return user.id
}

export const postRouter = router({
  /**
   * Publishes a post. Hashtags in the caption are saved and linked.
   * The image is AI-scanned before returning, so a post the AI rejects is
   * already hidden or removed by the time the page refreshes.
   */
  create: protectedProcedure
    .input(z.object({
      image: z.string().min(1),
      description: z.string().max(2200).optional(),
      isAiGenerated: z.boolean().optional(),
      isCommission: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const authorId = ctx.session.user.id
      await checkNotBanned(ctx.prisma, authorId)
      const hashtags = extractHashtags(input.description)
      const post = await ctx.prisma.post.create({
        data: {
          userId: authorId,
          image: input.image,
          description: input.description ?? null,
          isAiGenerated: input.isAiGenerated ?? false,
          isCommission: input.isCommission ?? false,
          hashtags: hashtags.length > 0
            ? { connectOrCreate: hashtags.map((tag) => ({ where: { tag }, create: { tag } })) }
            : undefined,
        },
      })

      // AI only informs, so scan after replying instead of making the poster wait.
      const prisma = ctx.prisma
      after(() => scanPost(prisma, post.id, authorId, input.image))

      return post
    }),

  /**
   * Home "For You" feed, ranked and paged.
   *
   * The ranking is frozen to a snapshot time (`asOf`) chosen by the client when the
   * feed page opens. Every page request uses the same snapshot, so:
   *  - the order doesn't shuffle while you scroll or after you like something
   *  - posts are never repeated or skipped between pages
   * The feed re-ranks only when the page is opened/refreshed (new `asOf`).
   */
  getFeed: publicProcedure
    .input(z.object({
      cursor: z.number().int().min(0).default(0),
      asOf: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const PAGE_SIZE = 12
      const RANKING_POOL_SIZE = 300
      const snapshotTime = new Date(input.asOf ?? Date.now())
      const viewerId = ctx.session?.user?.id ?? null
      const beforeSnapshot = { createdAt: { lte: snapshotTime } }

      // Step 1: load the candidate pool WITHOUT image data. Images are large, so we
      // only fetch them for the 12 posts actually being returned (step 3).
      const posts = await ctx.prisma.post.findMany({
        where: {
          ...beforeSnapshot,
          user: { username: { not: null } },
          OR: [
            { status: "PUBLISHED" },
            ...(viewerId ? [{ status: "PENDING_REVIEW" as const, userId: viewerId }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: RANKING_POOL_SIZE,
        select: {
          id: true, userId: true, title: true, description: true, createdAt: true, updatedAt: true,
          isAiGenerated: true, isCommission: true, pinned: true, status: true, pendingAt: true,
          flagReason: true, reportCount: true, removedAt: true, removalReason: true,
          aiVerdict: true, aiScores: true,
          user: { select: { id: true, username: true, name: true, image: true, commissionStatus: true } },
          // Counts as of the snapshot, so new likes/comments don't reshuffle the feed mid-scroll.
          _count: { select: { likes: { where: beforeSnapshot }, comments: { where: beforeSnapshot } } },
        },
      })

      // Step 2: viewer-specific signals. Ranking inputs (follows, liked artists) are
      // limited to the snapshot; display flags (likedByMe, reported) are live.
      let followedArtistIds = new Set<string>()
      let likedPostIds = new Set<string>()
      let likedArtistIds = new Set<string>()
      let reportedPostIds = new Set<string>()
      let blockedUserIds = new Set<string>()

      if (viewerId) {
        const poolPostIds = posts.map((p) => p.id)
        const poolArtistIds = [...new Set(posts.map((p) => p.userId))]

        const [follows, likesOnPool, recentLikes, reports, blockRelations] = await Promise.all([
          ctx.prisma.follow.findMany({
            where: { followerId: viewerId, followingId: { in: poolArtistIds }, ...beforeSnapshot },
            select: { followingId: true },
          }),
          ctx.prisma.like.findMany({
            where: { userId: viewerId, postId: { in: poolPostIds } },
            select: { postId: true },
          }),
          // Artists the viewer has liked before (interest graph)
          ctx.prisma.like.findMany({
            where: { userId: viewerId, ...beforeSnapshot },
            select: { post: { select: { userId: true } } },
            orderBy: { createdAt: "desc" },
            take: 300,
          }),
          ctx.prisma.report.findMany({
            where: { reporterId: viewerId, postId: { in: poolPostIds } },
            select: { postId: true },
          }),
          ctx.prisma.block.findMany({
            where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
            select: { blockerId: true, blockedId: true },
          }),
        ])

        followedArtistIds = new Set(follows.map((f) => f.followingId))
        likedPostIds = new Set(likesOnPool.map((l) => l.postId))
        likedArtistIds = new Set(recentLikes.map((l) => l.post.userId))
        reportedPostIds = new Set(reports.map((r) => r.postId))
        blockedUserIds = new Set(
          blockRelations.map((b) => b.blockerId === viewerId ? b.blockedId : b.blockerId)
        )
      }

      const visiblePosts = posts.filter((p) => !blockedUserIds.has(p.userId))

      // Score every post. Scoring uses the snapshot time, so it's identical for every page.
      const scored = visiblePosts.map((post) => {
        const ageHours = (snapshotTime.getTime() - new Date(post.createdAt).getTime()) / 3_600_000
        // Recency: up to 30 points, fading as the post gets older (72-hour decay)
        const recencyScore = 30 * Math.exp(-ageHours / 72)
        // Engagement: likes + double-weighted comments, dampened by age
        const engagementScore = ((post._count.likes + post._count.comments * 2) / Math.pow(ageHours + 2, 1.1)) * 8
        // Social: big boost for artists you follow, smaller for artists you've liked but don't follow
        const followBoost = followedArtistIds.has(post.userId) ? 45 : 0
        const interestBoost = likedArtistIds.has(post.userId) && !followedArtistIds.has(post.userId) ? 18 : 0

        return {
          ...post,
          isFollowing: followedArtistIds.has(post.userId),
          isOwnPost: post.userId === viewerId,
          likedByMe: likedPostIds.has(post.id),
          viewerHasReported: reportedPostIds.has(post.id),
          _score: recencyScore + engagementScore + followBoost + interestBoost,
        }
      })

      // Tie-break on id so equal scores always come out in the same order.
      scored.sort((a, b) => b._score - a._score || a.id.localeCompare(b.id))

      const page = scored.slice(input.cursor, input.cursor + PAGE_SIZE)
      const nextCursor = input.cursor + PAGE_SIZE < scored.length
        ? input.cursor + PAGE_SIZE
        : null

      // Step 3: fetch images only for the posts on this page.
      const images = await ctx.prisma.post.findMany({
        where: { id: { in: page.map((p) => p.id) } },
        select: { id: true, image: true },
      })
      const imageByPostId = new Map(images.map((p) => [p.id, p.image]))

      return {
        posts: page.map((p) => ({ ...p, image: imageByPostId.get(p.id) ?? "" })),
        nextCursor,
      }
    }),

  /**
   * A profile's post grid, pinned posts first. Visitors see PUBLISHED posts only;
   * the owner also sees posts under review and posts removed in the last 15 days.
   *
   * Ownership is decided from the login session. `viewerUserId` is still accepted
   * so older callers don't break, but it's ignored — trusting it let anyone view
   * another user's hidden posts.
   */
  getByUsername: publicProcedure
    .input(z.object({ username: z.string(), viewerUserId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const profileUserId = await getUserIdByUsername(ctx.prisma, input.username)
      return ctx.prisma.post.findMany({
        where: visiblePostsFilter(profileUserId, ctx.session?.user?.id === profileUserId),
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      })
    }),

  /** Posts the user marked as commission work, newest first (same visibility rules as the grid). */
  getCommissionsByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const profileUserId = await getUserIdByUsername(ctx.prisma, input.username)
      return ctx.prisma.post.findMany({
        where: {
          ...visiblePostsFilter(profileUserId, ctx.session?.user?.id === profileUserId),
          isCommission: true,
        },
        orderBy: { createdAt: "desc" },
      })
    }),

  /**
   * One post with its author and hashtags (post detail page).
   * Hidden posts (under review / removed) look "not found" to everyone except
   * their owner, who can still open them within the 15-day removal window.
   */
  getOne: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.prisma.post.findUnique({
        where: { id: input.id },
        include: {
          user: { select: { id: true, username: true, name: true, image: true } },
          hashtags: { select: { tag: true } },
        },
      })
      if (!post) throw new TRPCError({ code: "NOT_FOUND" })

      const viewerIsOwner = ctx.session?.user?.id === post.userId
      const ownerCanStillSee =
        post.status === "PENDING_REVIEW" ||
        (post.status === "REMOVED" && !!post.removedAt && post.removedAt >= REMOVAL_GRACE_CUTOFF())
      if (post.status !== "PUBLISHED" && !(viewerIsOwner && ownerCanStillSee)) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return post
    }),

  /** Deletes the viewer's own post. */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      await assertPostOwner(ctx.prisma, input.id, ctx.session.user.id)
      return ctx.prisma.post.delete({ where: { id: input.id } })
    }),

  /** Pins one of the viewer's posts to the top of their profile (max 3). */
  pin: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ownerId = ctx.session.user.id
      await assertPostOwner(ctx.prisma, input.id, ownerId)

      // Count and update in one transaction so two quick clicks can't pin a 4th post.
      return ctx.prisma.$transaction(async (tx) => {
        const pinnedCount = await tx.post.count({ where: { userId: ownerId, pinned: true } })
        if (pinnedCount >= MAX_PINNED_POSTS) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `You can only pin up to ${MAX_PINNED_POSTS} posts.` })
        }
        return tx.post.update({ where: { id: input.id }, data: { pinned: true } })
      })
    }),

  /** Unpins one of the viewer's posts. */
  unpin: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertPostOwner(ctx.prisma, input.id, ctx.session.user.id)
      return ctx.prisma.post.update({ where: { id: input.id }, data: { pinned: false } })
    }),

  /**
   * Community report. Each user can report a post once. If the post was never
   * AI-scanned, a scan runs in the background. At 3 reports a PUBLISHED post is
   * hidden for review and the owner is notified (in-app + email).
   */
  report: protectedProcedure
    .input(z.object({
      postId: z.string(),
      reason: z.nativeEnum(ReportReason),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const reporterId = ctx.session.user.id

      const post = await ctx.prisma.post.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          userId: true,
          status: true,
          reportCount: true,
          image: true,
          aiVerdict: true,
          user: { select: { email: true, username: true } },
        },
      })
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." })
      if (post.userId === reporterId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot report your own post." })
      }

      // The database allows one report per (post, reporter); a duplicate fails with P2002.
      try {
        await ctx.prisma.report.create({
          data: {
            postId: input.postId,
            reporterId,
            reason: input.reason,
            notes: input.notes ?? null,
          },
        })
      } catch (error: unknown) {
        if ((error as { code?: string })?.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "You have already reported this post." })
        }
        throw error
      }

      // Never scanned → scan now (after the response is sent) so moderators see a score.
      if (!post.aiVerdict) {
        after(() => scanPost(ctx.prisma, post.id, post.userId, post.image))
      }

      // Atomic increment so simultaneous reports are all counted.
      const afterReport = await ctx.prisma.post.update({
        where: { id: input.postId },
        data: { reportCount: { increment: 1 } },
        select: { reportCount: true, status: true },
      })

      if (afterReport.reportCount >= REPORTS_UNTIL_REVIEW && afterReport.status === "PUBLISHED") {
        await ctx.prisma.$transaction(async (tx) => {
          await tx.post.update({
            where: { id: input.postId },
            data: {
              status: "PENDING_REVIEW",
              pendingAt: new Date(),
              flagReason: "Reached community report threshold",
            },
          })
          // System notification (no human sender).
          await tx.notification.create({
            data: {
              userId: post.userId,
              fromUserId: null,
              type: "post_pending_review",
            },
          })
        })

        // Email only after the transaction succeeded.
        if (post.user.email) {
          void sendPostFlaggedEmail(post.user.email, {
            username: post.user.username ?? "there",
          })
        }
      }

      return { success: true }
    }),

  /** Stats for the artist dashboard: totals, average likes, top post, and every post's counts. */
  getMyPostStats: protectedProcedure.query(async ({ ctx }) => {
    const posts = await ctx.prisma.post.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        image: true,
        description: true,
        createdAt: true,
        isAiGenerated: true,
        isCommission: true,
        _count: { select: { likes: true, comments: true } },
      },
    })

    const totalLikes = posts.reduce((sum, post) => sum + post._count.likes, 0)
    const totalComments = posts.reduce((sum, post) => sum + post._count.comments, 0)
    const topPost = posts.reduce<typeof posts[0] | null>(
      (best, post) => (!best || post._count.likes > best._count.likes ? post : best),
      null
    )

    return {
      totalPosts: posts.length,
      totalLikes,
      totalComments,
      avgLikes: posts.length > 0 ? Math.round((totalLikes / posts.length) * 10) / 10 : 0,
      topPostId: topPost?.id ?? null,
      posts: posts.map((post) => ({
        id: post.id,
        image: post.image,
        description: post.description,
        createdAt: post.createdAt,
        likes: post._count.likes,
        comments: post._count.comments,
        isAiGenerated: post.isAiGenerated,
        isCommission: post.isCommission,
      })),
    }
  }),
})
