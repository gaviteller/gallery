import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"

export const blockRouter = router({
  toggle: protectedProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id

      const target = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true },
      })
      if (!target) throw new TRPCError({ code: "NOT_FOUND" })
      if (target.id === me) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot block yourself." })
      }

      const existing = await ctx.prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: me, blockedId: target.id } },
      })

      if (existing) {
        // Unblock
        await ctx.prisma.block.delete({
          where: { blockerId_blockedId: { blockerId: me, blockedId: target.id } },
        })
        return { blocked: false }
      } else {
        // Block: delete follow relationships in both directions, then create block
        await ctx.prisma.$transaction([
          ctx.prisma.follow.deleteMany({
            where: {
              OR: [
                { followerId: me, followingId: target.id },
                { followerId: target.id, followingId: me },
              ],
            },
          }),
          ctx.prisma.block.create({
            data: { blockerId: me, blockedId: target.id },
          }),
        ])
        return { blocked: true }
      }
    }),

  status: protectedProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const me = ctx.session.user.id

      const target = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true },
      })
      if (!target) return { blocked: false }

      const block = await ctx.prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: me, blockedId: target.id } },
      })
      return { blocked: !!block }
    }),

  getMyBlocked: protectedProcedure.query(async ({ ctx }) => {
    const me = ctx.session.user.id

    const blocks = await ctx.prisma.block.findMany({
      where: { blockerId: me },
      orderBy: { createdAt: "desc" },
      include: {
        blocked: { select: { id: true, username: true, name: true, image: true } },
      },
    })
    return blocks.map((b) => b.blocked)
  }),
})
