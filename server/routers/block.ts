/**
 * BLOCKING — `trpc.block.*`
 *
 * Blocking is one-directional in the database (blocker → blocked) but enforced
 * both ways everywhere else: feed, search, discovery, DMs and commissions hide
 * users from each other if either one blocked the other.
 */
import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "@prisma/client"

/** Finds a user's id by username (case-insensitive). Returns null if no such user. */
async function findUserIdByUsername(prisma: PrismaClient, username: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  })
  return user?.id ?? null
}

export const blockRouter = router({
  /**
   * Blocks the user if not blocked yet, otherwise unblocks them.
   * Blocking also removes any follow relationship in both directions.
   */
  toggle: protectedProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id
      const targetId = await findUserIdByUsername(ctx.prisma, input.username)
      if (!targetId) throw new TRPCError({ code: "NOT_FOUND" })
      if (targetId === viewerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot block yourself." })
      }

      // Try to unblock first: if a block existed, it's removed in one query.
      const unblocked = await ctx.prisma.block.deleteMany({
        where: { blockerId: viewerId, blockedId: targetId },
      })
      if (unblocked.count > 0) return { blocked: false }

      await ctx.prisma.$transaction([
        ctx.prisma.follow.deleteMany({
          where: {
            OR: [
              { followerId: viewerId, followingId: targetId },
              { followerId: targetId, followingId: viewerId },
            ],
          },
        }),
        ctx.prisma.block.create({ data: { blockerId: viewerId, blockedId: targetId } }),
      ])
      return { blocked: true }
    }),

  /** Whether the viewer has blocked this user (drives the Block/Unblock menu label). */
  status: protectedProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const targetId = await findUserIdByUsername(ctx.prisma, input.username)
      if (!targetId) return { blocked: false }

      const block = await ctx.prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: ctx.session.user.id, blockedId: targetId } },
        select: { id: true },
      })
      return { blocked: !!block }
    }),

  /** Everyone the viewer has blocked, newest first (Settings → Blocked accounts). */
  getMyBlocked: protectedProcedure.query(async ({ ctx }) => {
    const blocks = await ctx.prisma.block.findMany({
      where: { blockerId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        blocked: { select: { id: true, username: true, name: true, image: true } },
      },
    })
    return blocks.map((block) => block.blocked)
  }),
})
