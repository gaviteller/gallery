/**
 * FOLLOWS — `trpc.follow.*`
 *
 * Follow / unfollow, follower counts, and "followed by people you know" (mutuals).
 * Following someone notifies them (in-app + push).
 */
import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "@prisma/client"
import { sendPushToUser } from "@/lib/sendPush"

/** Exact-match username → user id, or throws NOT_FOUND. */
async function getUserIdByExactUsername(prisma: PrismaClient, username: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } })
  if (!user) throw new TRPCError({ code: "NOT_FOUND" })
  return user.id
}

export const followRouter = router({
  /**
   * Follows a user (safe to call twice). Replaces any earlier "followed you"
   * notification from the same person so re-following doesn't stack duplicates.
   */
  follow: protectedProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const followerId = ctx.session.user.id
      const targetId = await getUserIdByExactUsername(ctx.prisma, input.username)
      if (targetId === followerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot follow yourself." })

      await ctx.prisma.follow.upsert({
        where: { followerId_followingId: { followerId, followingId: targetId } },
        create: { followerId, followingId: targetId },
        update: {},
      })

      await ctx.prisma.notification.deleteMany({
        where: { userId: targetId, fromUserId: followerId, type: "follow" },
      })
      await ctx.prisma.notification.create({
        data: { userId: targetId, fromUserId: followerId, type: "follow" },
      })

      const follower = await ctx.prisma.user.findUnique({ where: { id: followerId }, select: { name: true, username: true } })
      sendPushToUser(ctx.prisma, targetId, {
        title: "New follower",
        body: `${follower?.name ?? follower?.username ?? "Someone"} started following you`,
        url: `/@${input.username}`,
        tag: `follow-${followerId}`,
      }).catch(() => {})

      return { following: true }
    }),

  /** Unfollows a user (no error if you weren't following). */
  unfollow: protectedProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const targetId = await getUserIdByExactUsername(ctx.prisma, input.username)
      await ctx.prisma.follow.deleteMany({
        where: { followerId: ctx.session.user.id, followingId: targetId },
      })
      return { following: false }
    }),

  /** Follower/following counts, plus whether the viewer follows this user. */
  status: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const target = await ctx.prisma.user.findUnique({
        where: { username: input.username },
        select: { id: true, _count: { select: { followers: true, following: true } } },
      })
      if (!target) return { following: false, followerCount: 0, followingCount: 0 }

      const viewerId = ctx.session?.user?.id
      const viewerFollows = viewerId
        ? await ctx.prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: viewerId, followingId: target.id } },
            select: { id: true },
          })
        : null

      return {
        following: !!viewerFollows,
        followerCount: target._count.followers,
        followingCount: target._count.following,
      }
    }),

  /** People the viewer follows who also follow this user ("Followed by …" on profiles). */
  mutuals: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.session?.user?.id
      if (!viewerId) return { count: 0, users: [] }

      const target = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true },
      })
      if (!target) return { count: 0, users: [] }

      // One query: follows INTO the target whose follower is someone the viewer follows.
      const mutualFollows = await ctx.prisma.follow.findMany({
        where: {
          followingId: target.id,
          follower: { followers: { some: { followerId: viewerId } } },
        },
        select: {
          follower: { select: { id: true, username: true, name: true, image: true } },
        },
      })

      const users = mutualFollows.map((follow) => follow.follower)
      return { count: users.length, users }
    }),
})
