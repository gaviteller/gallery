import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"

export const followRouter = router({
  follow: protectedProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.prisma.user.findUnique({ where: { username: input.username } })
      if (!target) throw new TRPCError({ code: "NOT_FOUND" })
      if (target.id === ctx.session.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot follow yourself." })

      await ctx.prisma.follow.upsert({
        where: { followerId_followingId: { followerId: ctx.session.user.id, followingId: target.id } },
        create: { followerId: ctx.session.user.id, followingId: target.id },
        update: {},
      })

      // Create notification (delete old one first to avoid duplicates)
      await ctx.prisma.notification.deleteMany({
        where: { userId: target.id, fromUserId: ctx.session.user.id, type: "follow" },
      })
      await ctx.prisma.notification.create({
        data: { userId: target.id, fromUserId: ctx.session.user.id, type: "follow" },
      })

      return { following: true }
    }),

  unfollow: protectedProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.prisma.user.findUnique({ where: { username: input.username } })
      if (!target) throw new TRPCError({ code: "NOT_FOUND" })

      await ctx.prisma.follow.deleteMany({
        where: { followerId: ctx.session.user.id, followingId: target.id },
      })

      return { following: false }
    }),

  status: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const target = await ctx.prisma.user.findUnique({
        where: { username: input.username },
        include: {
          _count: { select: { followers: true, following: true } },
        },
      })
      if (!target) return { following: false, followerCount: 0, followingCount: 0 }

      let following = false
      if (ctx.session) {
        const follow = await ctx.prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: ctx.session.user.id, followingId: target.id } },
        })
        following = !!follow
      }

      return {
        following,
        followerCount: target._count.followers,
        followingCount: target._count.following,
      }
    }),
})
