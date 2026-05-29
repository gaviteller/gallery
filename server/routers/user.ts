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
      const blockedIds = new Set<string>()

      if (ctx.session?.user?.id) {
        const blockRelations = await ctx.prisma.block.findMany({
          where: {
            OR: [
              { blockerId: ctx.session.user.id },
              { blockedId: ctx.session.user.id },
            ],
          },
          select: { blockerId: true, blockedId: true },
        })
        for (const b of blockRelations) {
          blockedIds.add(b.blockerId === ctx.session.user.id ? b.blockedId : b.blockerId)
        }
      }

      return ctx.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: input.query, mode: "insensitive" } },
            { name: { contains: input.query, mode: "insensitive" } },
          ],
          username: { not: null },
          ...(blockedIds.size > 0 ? { id: { notIn: [...blockedIds] } } : {}),
        },
        select: { id: true, username: true, name: true, image: true },
        take: 20,
      })
    }),

  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
      })
      if (!user) return null

      if (ctx.session?.user?.id && ctx.session.user.id !== user.id) {
        const block = await ctx.prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: ctx.session.user.id, blockedId: user.id },
              { blockerId: user.id, blockedId: ctx.session.user.id },
            ],
          },
        })
        if (block) return null
      }

      return user
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
      select: {
        id: true,
        status: true,
        text: true,
        createdAt: true,
        reviewedAt: true,
        strikeId: true,
        postId: true,
      },
    })
  }),

  getMyRemovedPosts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.post.findMany({
      where: { userId: ctx.session.user.id, status: "REMOVED" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, image: true, updatedAt: true, flagReason: true },
    })
  }),

  submitAppeal: protectedProcedure
    .input(
      z.object({
        text:     z.string().min(20).max(2000),
        strikeId: z.string().optional(),
        postId:   z.string().optional(),
      }).refine(d => d.strikeId || d.postId, {
        message: "Must specify a strike or a removed post to appeal.",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callerId = ctx.session.user.id

      if (input.strikeId) {
        const strike = await ctx.prisma.strike.findUnique({
          where: { id: input.strikeId },
          select: { userId: true },
        })
        if (!strike || strike.userId !== callerId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Strike not found or does not belong to you." })
        }
      }

      if (input.postId) {
        const post = await ctx.prisma.post.findUnique({
          where: { id: input.postId },
          select: { userId: true, status: true },
        })
        if (!post || post.userId !== callerId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Post not found or does not belong to you." })
        }
        if (post.status !== "REMOVED") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This post is not removed." })
        }
        // Duplicate post appeal → CONFLICT (checked before the global guard so CONFLICT fires first)
        const dupPostAppeal = await ctx.prisma.appeal.findFirst({
          where: { userId: callerId, postId: input.postId, status: "PENDING" },
        })
        if (dupPostAppeal) {
          throw new TRPCError({ code: "CONFLICT", message: "You already have a pending appeal for this post." })
        }
      }

      // Global one-pending-appeal guard (covers strike appeals and cross-type collisions)
      const existing = await ctx.prisma.appeal.findFirst({
        where: { userId: callerId, status: "PENDING" },
      })
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a pending appeal." })

      return ctx.prisma.appeal.create({
        data: {
          userId:   callerId,
          text:     input.text,
          strikeId: input.strikeId ?? null,
          postId:   input.postId ?? null,
        },
      })
    }),

  updateShowRealName: protectedProcedure
    .input(z.object({ showRealName: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { showRealName: input.showRealName },
        select: { id: true, showRealName: true },
      })
    }),

  updateAdTargetingOptOut: protectedProcedure
    .input(z.object({ optOut: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { adTargetingOptOut: input.optOut },
        select: { id: true, adTargetingOptOut: true },
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
