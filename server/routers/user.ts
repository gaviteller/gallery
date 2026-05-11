import { z } from "zod"
import { router, publicProcedure, protectedProcedure } from "@/lib/trpc"

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
    })
  }),

  checkUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({
        where: { username: input.username },
      })
      return { available: !existing }
    }),

  completeOnboarding: protectedProcedure
    .input(z.object({
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
      sellingEnabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check username not taken by someone else
      const existing = await ctx.prisma.user.findUnique({
        where: { username: input.username },
      })
      if (existing && existing.id !== ctx.session.user.id) {
        throw new Error("Username already taken")
      }
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          username: input.username,
          sellingEnabled: input.sellingEnabled,
          onboardingComplete: true,
        },
      })
    }),

  updateSellingEnabled: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { sellingEnabled: input.enabled },
      })
    }),
})
