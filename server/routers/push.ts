import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"

export const pushRouter = router({
  // Return the VAPID public key so the client can subscribe
  getPublicKey: publicProcedure.query(() => {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? "" }
  }),

  // Save a push subscription for the current user
  subscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string(),
      p256dh: z.string(),
      auth: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: {
          userId: ctx.session.user.id,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
        },
        update: {
          userId: ctx.session.user.id,
          p256dh: input.p256dh,
          auth: input.auth,
        },
      })
      return { ok: true }
    }),

  // Remove a subscription (e.g. on logout)
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.pushSubscription.deleteMany({
        where: { endpoint: input.endpoint, userId: ctx.session.user.id },
      })
      return { ok: true }
    }),
})
