import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc"

export const notificationRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    // Lazily clean up read notifications older than 24 h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await ctx.prisma.notification.deleteMany({
      where: {
        userId: ctx.session.user.id,
        read: true,
        createdAt: { lt: cutoff },
      },
    })

    return ctx.prisma.notification.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        fromUser: {
          select: { username: true, name: true, image: true },
        },
      },
    })
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.notification.count({
      where: { userId: ctx.session.user.id, read: false },
    })
    return { count }
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({
      where: { userId: ctx.session.user.id, read: false },
      data: { read: true },
    })
  }),
})
