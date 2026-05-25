import { z } from "zod"
import bcrypt from "bcryptjs"
import { router, publicProcedure, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"

// ── User-facing moderation helpers ──────────────────────────────────────────

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
    })
  }),

  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: input.query, mode: "insensitive" } },
            { name: { contains: input.query, mode: "insensitive" } },
          ],
          username: { not: null },
        },
        select: { id: true, username: true, name: true, image: true },
        take: 20,
      })
    }),

  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
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
    .input(z.object({ sellingEnabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
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
        data: {
          sellingEnabled: input.enabled,
          commissionStatus: input.enabled ? "OPEN" : "CLOSED",
        },
      })
    }),

  updateCommissionStatus: protectedProcedure
    .input(z.object({ status: z.enum(["OPEN", "CLOSED"]) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { commissionStatus: input.status },
      })
    }),

  changeUsername: protectedProcedure
    .input(z.object({
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({ where: { username: input.username } })
      if (existing && existing.id !== ctx.session.user.id) {
        throw new TRPCError({ code: "CONFLICT", message: "Username is already taken." })
      }
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { username: input.username },
      })
    }),

  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.session.user.id } })
      if (!user?.password) throw new TRPCError({ code: "BAD_REQUEST", message: "No password set on this account." })
      const valid = await bcrypt.compare(input.currentPassword, user.password)
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." })
      const hashed = await bcrypt.hash(input.newPassword, 12)
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { password: hashed },
      })
    }),

  getMyStrikes: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.strike.findMany({
      where: { userId: ctx.session.user.id, reversed: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, level: true, violation: true, createdAt: true },
    })
  }),

  getMyAppeals: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.appeal.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, text: true, createdAt: true, reviewedAt: true },
    })
  }),

  submitAppeal: protectedProcedure
    .input(z.object({
      text: z.string().min(20).max(2000),
      strikeId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.appeal.findFirst({
        where: { userId: ctx.session.user.id, status: "PENDING" },
      })
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a pending appeal" })

      if (input.strikeId) {
        const strike = await ctx.prisma.strike.findUnique({
          where: { id: input.strikeId },
          select: { userId: true },
        })
        if (!strike || strike.userId !== ctx.session.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Strike not found or does not belong to you" })
        }
      }

      return ctx.prisma.appeal.create({
        data: {
          userId: ctx.session.user.id,
          text: input.text,
          strikeId: input.strikeId,
        },
      })
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        bio: z.string().max(160).nullable(),
        image: z.string().nullable(),
        bannerImage: z.string().nullable().optional(),
        websiteUrl: z.string().nullable(),
        twitterHandle: z.string().max(50).nullable(),
        instagramHandle: z.string().max(50).nullable(),
        artstationHandle: z.string().max(50).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          name: input.name,
          bio: input.bio,
          image: input.image,
          ...(input.bannerImage !== undefined && { bannerImage: input.bannerImage }),
          websiteUrl: input.websiteUrl,
          twitterHandle: input.twitterHandle,
          instagramHandle: input.instagramHandle,
          artstationHandle: input.artstationHandle,
        },
      })
    }),
})
