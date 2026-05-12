import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { Prisma } from "@prisma/client"

const priceRangeSchema = z.array(z.object({
  label: z.string().min(1).max(100),
  price: z.number().positive(),
}))

export const commissionRouter = router({

  // ── Artist profile settings ───────────────────────────────────────────────

  getProfile: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: {
          id: true,
          username: true,
          name: true,
          image: true,
          commissionStatus: true,
          commissionDescription: true,
          commissionTurnaround: true,
          priceRanges: true,
          commissionCategories: { orderBy: { order: "asc" } },
        },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      return user
    }),

  updateProfile: protectedProcedure
    .input(z.object({
      commissionStatus: z.enum(["OPEN", "LIMITED", "CLOSED"]),
      commissionDescription: z.string().max(2000).optional(),
      commissionTurnaround: z.string().max(100).optional(),
      priceRanges: priceRangeSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          commissionStatus: input.commissionStatus,
          commissionDescription: input.commissionDescription ?? null,
          commissionTurnaround: input.commissionTurnaround ?? null,
          priceRanges: input.priceRanges ?? [],
        },
      })
    }),

  // ── Business overview (artist only) ──────────────────────────────────────

  getMyStats: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id

      const [activeCommissions, completedCommissions] = await Promise.all([
        ctx.prisma.commission.findMany({
          where: {
            artistId: userId,
            status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS", "DELIVERED"] },
          },
          select: { id: true, agreedPrice: true, status: true },
        }),
        ctx.prisma.commission.findMany({
          where: { artistId: userId, status: "COMPLETE" },
          select: { agreedPrice: true },
        }),
      ])

      const escrowHeld = activeCommissions
        .filter(c => ["IN_PROGRESS", "DELIVERED"].includes(c.status))
        .reduce((sum, c) => sum + (c.agreedPrice ?? 0), 0)

      const totalEarned = completedCommissions
        .reduce((sum, c) => sum + (c.agreedPrice ?? 0), 0)

      return {
        activeCount: activeCommissions.length,
        escrowHeld,
        totalEarned,
      }
    }),

  // ── Dropdown category management ─────────────────────────────────────────

  getCategories: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.prisma.commissionDropdownCategory.findMany({
        where: { userId: user.id },
        orderBy: { order: "asc" },
      })
    }),

  createCategory: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      options: z.array(z.string().min(1).max(50)).min(1).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.prisma.commissionDropdownCategory.count({
        where: { userId: ctx.session.user.id },
      })
      return ctx.prisma.commissionDropdownCategory.create({
        data: {
          userId: ctx.session.user.id,
          name: input.name,
          options: input.options,
          order: count,
        },
      })
    }),

  updateCategory: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(50).optional(),
      options: z.array(z.string().min(1).max(50)).min(1).max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cat = await ctx.prisma.commissionDropdownCategory.findUnique({ where: { id: input.id } })
      if (!cat) throw new TRPCError({ code: "NOT_FOUND" })
      if (cat.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.commissionDropdownCategory.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.options !== undefined ? { options: input.options } : {}),
        },
      })
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cat = await ctx.prisma.commissionDropdownCategory.findUnique({ where: { id: input.id } })
      if (!cat) throw new TRPCError({ code: "NOT_FOUND" })
      if (cat.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.commissionDropdownCategory.delete({ where: { id: input.id } })
    }),

  // ── Commission request lifecycle ─────────────────────────────────────────

  submitRequest: protectedProcedure
    .input(z.object({
      artistId: z.string(),
      description: z.string().min(1).max(5000),
      dropdownSelections: z.record(z.string(), z.string()),
      referencePhotos: z.array(z.string()).max(5).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.artistId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot commission yourself" })
      }
      const artist = await ctx.prisma.user.findUnique({ where: { id: input.artistId } })
      if (!artist) throw new TRPCError({ code: "NOT_FOUND", message: "Artist not found" })
      if (artist.commissionStatus === "CLOSED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This artist is not accepting commissions" })
      }
      if (!artist.sellingEnabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This artist is not accepting commissions" })
      }
      return ctx.prisma.commission.create({
        data: {
          buyerId: ctx.session.user.id,
          artistId: input.artistId,
          description: input.description,
          dropdownSelections: input.dropdownSelections as unknown as Prisma.InputJsonValue,
          referencePhotos: input.referencePhotos ?? [],
        },
      })
    }),

  getMine: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id
      const [asBuyer, asArtist] = await Promise.all([
        ctx.prisma.commission.findMany({
          where: { buyerId: userId },
          include: {
            artist: { select: { id: true, username: true, name: true, image: true } },
          },
          orderBy: { updatedAt: "desc" },
        }),
        ctx.prisma.commission.findMany({
          where: { artistId: userId },
          include: {
            buyer: { select: { id: true, username: true, name: true, image: true } },
          },
          orderBy: { updatedAt: "desc" },
        }),
      ])
      return { asBuyer, asArtist }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({
        where: { id: input.id },
        include: {
          buyer: { select: { id: true, username: true, name: true, image: true } },
          artist: { select: { id: true, username: true, name: true, image: true } },
          messages: {
            include: {
              sender: { select: { id: true, username: true, image: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== ctx.session.user.id && commission.artistId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }
      return commission
    }),

  accept: protectedProcedure
    .input(z.object({ id: z.string(), price: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not pending" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "ACCEPTED", agreedPrice: input.price },
      })
    }),

  decline: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not pending" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "DECLINED" },
      })
    }),

  updatePrice: protectedProcedure
    .input(z.object({ id: z.string(), price: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "ACCEPTED") throw new TRPCError({ code: "BAD_REQUEST", message: "Can only update price on accepted commissions" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { agreedPrice: input.price },
      })
    }),

  confirmPayment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "ACCEPTED") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not accepted yet" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "IN_PROGRESS" },
      })
    }),

  markDelivered: protectedProcedure
    .input(z.object({ id: z.string(), fileUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "IN_PROGRESS") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not in progress" })
      const [, updatedCommission] = await ctx.prisma.$transaction([
        ctx.prisma.professionalMessage.create({
          data: {
            commissionId: input.id,
            senderId: ctx.session.user.id,
            text: "✅ Work delivered! Please review and confirm receipt.",
            fileUrl: input.fileUrl,
          },
        }),
        ctx.prisma.commission.update({
          where: { id: input.id },
          data: { status: "DELIVERED", deliveredAt: new Date() },
        }),
      ])
      return updatedCommission
    }),

  confirmDelivery: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "DELIVERED") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission has not been delivered yet" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "COMPLETE" },
      })
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (!["PENDING", "ACCEPTED"].includes(commission.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Commission cannot be cancelled at this stage" })
      }
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "CANCELLED" },
      })
    }),

  checkAutoRelease: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission || commission.status !== "DELIVERED" || !commission.deliveredAt) return null
      if (commission.buyerId !== ctx.session.user.id && commission.artistId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000
      if (Date.now() - commission.deliveredAt.getTime() >= fiveDaysMs) {
        return ctx.prisma.commission.update({
          where: { id: input.id },
          data: { status: "COMPLETE" },
        })
      }
      return null
    }),

  // ── Discovery feed ────────────────────────────────────────────────────────

  getDiscovery: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const users = await ctx.prisma.user.findMany({
        where: {
          commissionStatus: { in: ["OPEN", "LIMITED"] },
          sellingEnabled: true,
          username: { not: null },
          ...(input.search ? {
            OR: [
              { username: { contains: input.search, mode: "insensitive" } },
              { name: { contains: input.search, mode: "insensitive" } },
              {
                commissionCategories: {
                  some: {
                    options: { has: input.search },
                  },
                },
              },
            ],
          } : {}),
        },
        select: {
          id: true,
          username: true,
          name: true,
          image: true,
          commissionStatus: true,
          priceRanges: true,
          posts: {
            where: { isCommission: true },
            take: 6,
            orderBy: { createdAt: "desc" },
            select: { id: true, image: true },
          },
          commissionCategories: {
            orderBy: { order: "asc" },
            select: { name: true, options: true },
          },
        },
        take: 50,
        orderBy: { createdAt: "desc" },
      })

      // Client-side price filter (avg of price ranges)
      if (input.minPrice !== undefined || input.maxPrice !== undefined) {
        return users.filter(u => {
          const ranges = u.priceRanges as { label: string; price: number }[] | null
          if (!ranges || ranges.length === 0) return false
          const avg = ranges.reduce((s, r) => s + r.price, 0) / ranges.length
          if (input.minPrice !== undefined && avg < input.minPrice) return false
          if (input.maxPrice !== undefined && avg > input.maxPrice) return false
          return true
        })
      }
      return users
    }),
})
