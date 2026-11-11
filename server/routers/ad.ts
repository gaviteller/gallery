/**
 * IN-SITE ADS — read side. Ads are created and edited in the admin panel (Ads page).
 *   getForPlacement → active, in-date ads for one spot: FEED | SIGNUP (auth page spotlight) | SIDEBAR | EXPLORE | SHOP
 *   recordView / recordClick → bump the counters the admin sees
 */
import { z } from "zod"
import { router, publicProcedure } from "@/lib/trpc"

export const AD_PLACEMENTS = ["FEED", "SIGNUP", "SIDEBAR", "EXPLORE", "SHOP"] as const

export const adRouter = router({
  getForPlacement: publicProcedure
    .input(z.object({ placement: z.enum(AD_PLACEMENTS) }))
    .query(({ ctx, input }) => {
      const now = new Date()
      return ctx.prisma.ad.findMany({
        where: {
          active: true,
          placements: { has: input.placement },
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, preset: true, headline: true, body: true, imageUrl: true, linkUrl: true, frequency: true },
      })
    }),

  recordView: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.ad.updateMany({ where: { id: input.id }, data: { views: { increment: 1 } } })
    }),

  recordClick: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.ad.updateMany({ where: { id: input.id }, data: { clicks: { increment: 1 } } })
    }),
})
