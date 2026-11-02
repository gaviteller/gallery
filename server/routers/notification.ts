/**
 * NOTIFICATIONS API — `trpc.notification.*` (the bell icon).
 *
 * Notifications are created by other parts of the backend (likes, follows,
 * commissions, moderation...). This file only lists them and marks them read.
 */
import { router, protectedProcedure } from "@/lib/trpc"

const READ_NOTIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000

export const notificationRouter = router({
  /**
   * The viewer's 50 newest notifications.
   * Also deletes notifications that were read more than 24 hours ago, so the
   * table doesn't grow forever (there's no separate cleanup job).
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const viewerId = ctx.session.user.id
    await ctx.prisma.notification.deleteMany({
      where: {
        userId: viewerId,
        read: true,
        createdAt: { lt: new Date(Date.now() - READ_NOTIFICATION_LIFETIME_MS) },
      },
    })

    return ctx.prisma.notification.findMany({
      where: { userId: viewerId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        fromUser: { select: { username: true, name: true, image: true } },
      },
    })
  }),

  /** Number for the red badge on the bell. Polled every 30s by the nav bars. */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.notification.count({
      where: { userId: ctx.session.user.id, read: false },
    })
    return { count }
  }),

  /** Called when the notification panel is opened. */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({
      where: { userId: ctx.session.user.id, read: false },
      data: { read: true },
    })
  }),
})
