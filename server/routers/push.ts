/**
 * PUSH NOTIFICATION SUBSCRIPTIONS — `trpc.push.*`
 *
 * When a user allows notifications, their browser gives us a "subscription"
 * (an endpoint URL + two keys). We store one row per device so lib/sendPush.ts
 * can deliver phone/browser notifications later.
 */
import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"

export const pushRouter = router({
  /** Our server's public VAPID key — the browser needs it to create a subscription. */
  getPublicKey: publicProcedure.query(() => {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? "" }
  }),

  /** Saves (or re-assigns) this device's subscription to the logged-in user. */
  subscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string(),
      p256dh: z.string(),
      auth: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await ctx.prisma.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: { userId, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth },
        update: { userId, p256dh: input.p256dh, auth: input.auth },
      })
      return { ok: true }
    }),

  /** Removes this device's subscription (e.g. on logout or when notifications are turned off). */
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.pushSubscription.deleteMany({
        where: { endpoint: input.endpoint, userId: ctx.session.user.id },
      })
      return { ok: true }
    }),
})
