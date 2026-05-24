import { z } from "zod"
import { router, modProcedure, adminProcedure, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { isSellingViolation } from "@/server/lib/strikes"

export const adminRouter = router({

  // ── User management ─────────────────────────────────────────────────────────

  listUsers: modProcedure
    .input(z.object({ query: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findMany({
        where: input.query ? {
          OR: [
            { username: { contains: input.query, mode: "insensitive" } },
            { email: { contains: input.query, mode: "insensitive" } },
          ],
        } : undefined,
        select: {
          id: true, username: true, email: true,
          isAdmin: true, isModerator: true,
          bannedUntil: true, createdAt: true,
          _count: { select: { receivedStrikes: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    }),

  getUser: modProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true, username: true, email: true,
          isAdmin: true, isModerator: true,
          bannedUntil: true, banReason: true, createdAt: true,
          receivedStrikes: {
            orderBy: { createdAt: "desc" },
            include: { issuedBy: { select: { username: true } } },
          },
        },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      return user
    }),

  setModerator: adminProcedure
    .input(z.object({ userId: z.string(), isModerator: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { isModerator: input.isModerator },
        select: { id: true, username: true, isModerator: true },
      })
    }),

  // ── Strikes ─────────────────────────────────────────────────────────────────

  issueStrike: modProcedure
    .input(z.object({
      userId: z.string(),
      level: z.enum(["MINOR", "MODERATE", "SEVERE", "ZERO_TOLERANCE"]),
      violation: z.enum([
        "ARTIST_CANCEL", "FAKE_DELIVERY", "FALSE_ADVERTISING", "BAIT_AND_SWITCH",
        "OFF_PLATFORM_PAYMENT", "COMMISSION_FARMING", "SHOP_FALSE_ADVERTISING",
        "UNLABELLED_AI", "GORE", "HARASSMENT", "HATE_SPEECH", "SPAM",
        "DMCA_VIOLATION", "FTC_DISCLOSURE", "NCMEC_VIOLATION",
        "CHARGEBACK_FRAUD", "ZERO_TOLERANCE_CONDUCT",
      ]),
      contentId: z.string().optional(),
      contentType: z.enum(["post", "commission", "shop_item"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const strike = await ctx.prisma.strike.create({
        data: {
          userId: input.userId,
          issuedById: ctx.session.user.id,
          level: input.level,
          violation: input.violation,
          isSelling: isSellingViolation(input.violation),
          contentId: input.contentId,
          contentType: input.contentType,
          notes: input.notes,
        },
      })
      await ctx.prisma.notification.create({
        data: {
          userId: input.userId,
          fromUserId: ctx.session.user.id,
          type: "strike",
        },
      })
      return strike
    }),

  // ── Bans ────────────────────────────────────────────────────────────────────

  issueBan: modProcedure
    .input(z.object({
      userId: z.string(),
      duration: z.enum(["3d", "14d", "30d", "permanent"]),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const DURATIONS: Record<string, Date> = {
        "3d": new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        "14d": new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        "30d": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        "permanent": new Date("9999-12-31"),
      }
      const user = await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { bannedUntil: DURATIONS[input.duration], banReason: input.reason },
        select: { id: true, bannedUntil: true },
      })
      await ctx.prisma.notification.create({
        data: {
          userId: input.userId,
          fromUserId: ctx.session.user.id,
          type: "ban",
        },
      })
      return user
    }),

  liftBan: modProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { bannedUntil: null, banReason: null },
        select: { id: true, bannedUntil: true },
      })
    }),

  // ── Appeals (mod side) ───────────────────────────────────────────────────────

  listAppeals: modProcedure
    .input(z.object({ status: z.enum(["PENDING", "APPROVED", "DENIED"]).default("PENDING") }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.appeal.findMany({
        where: { status: input.status },
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, username: true } },
          strike: { select: { level: true, violation: true, createdAt: true } },
        },
      })
    }),

  getAppeal: modProcedure
    .input(z.object({ appealId: z.string() }))
    .query(async ({ ctx, input }) => {
      const appeal = await ctx.prisma.appeal.findUnique({
        where: { id: input.appealId },
        include: {
          user: {
            select: {
              id: true, username: true, bannedUntil: true, banReason: true,
              receivedStrikes: { orderBy: { createdAt: "desc" } },
            },
          },
          strike: true,
        },
      })
      if (!appeal) throw new TRPCError({ code: "NOT_FOUND" })
      return appeal
    }),

  approveAppeal: modProcedure
    .input(z.object({ appealId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const appeal = await ctx.prisma.appeal.findUnique({
        where: { id: input.appealId },
        include: { user: true },
      })
      if (!appeal) throw new TRPCError({ code: "NOT_FOUND" })
      if (appeal.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Appeal already reviewed" })

      await ctx.prisma.$transaction(async tx => {
        // Mark appeal approved
        await tx.appeal.update({
          where: { id: input.appealId },
          data: { status: "APPROVED", reviewedById: ctx.session.user.id, reviewedAt: new Date() },
        })
        // Reverse the strike (if referenced)
        if (appeal.strikeId) {
          await tx.strike.update({
            where: { id: appeal.strikeId },
            data: { reversed: true },
          })
        }
        // Lift the ban
        await tx.user.update({
          where: { id: appeal.userId },
          data: { bannedUntil: null, banReason: null },
        })
        // Notify user
        await tx.notification.create({
          data: {
            userId: appeal.userId,
            fromUserId: ctx.session.user.id,
            type: "appeal_approved",
          },
        })
      })
      return { success: true }
    }),

  denyAppeal: modProcedure
    .input(z.object({ appealId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const appeal = await ctx.prisma.appeal.findUnique({
        where: { id: input.appealId },
        select: { id: true, userId: true, status: true },
      })
      if (!appeal) throw new TRPCError({ code: "NOT_FOUND" })
      if (appeal.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Appeal already reviewed" })

      await ctx.prisma.appeal.update({
        where: { id: input.appealId },
        data: { status: "DENIED", reviewedById: ctx.session.user.id, reviewedAt: new Date() },
      })
      await ctx.prisma.notification.create({
        data: {
          userId: appeal.userId,
          fromUserId: ctx.session.user.id,
          type: "appeal_denied",
        },
      })
      return { success: true }
    }),

  // ── User-facing moderation ───────────────────────────────────────────────────

  getMyStrikes: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.strike.findMany({
      where: { userId: ctx.session.user.id, reversed: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, level: true, violation: true, createdAt: true },
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

      return ctx.prisma.appeal.create({
        data: {
          userId: ctx.session.user.id,
          text: input.text,
          strikeId: input.strikeId,
        },
      })
    }),

  getMyAppeals: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.appeal.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, text: true, createdAt: true, reviewedAt: true },
    })
  }),
})
