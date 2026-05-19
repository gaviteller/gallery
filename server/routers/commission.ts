import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { Prisma } from "@prisma/client"

const priceRangeSchema = z.array(z.object({
  label: z.string().min(1).max(100),
  price: z.number().positive(),
}))

export const acceptInputSchema = z.object({
  id: z.string(),
  price: z.number().positive(),
  deadline: z.string().datetime().refine(
    val => new Date(val) > new Date(),
    { message: "Deadline must be in the future" }
  ),
})

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
          commissionCardImages: true,
          artStyles: true,
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
      commissionCardImages: z.array(z.string()).max(5).optional(),
      artStyles: z.array(z.string().min(1).max(50)).max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          commissionStatus: input.commissionStatus,
          commissionDescription: input.commissionDescription ?? null,
          commissionTurnaround: input.commissionTurnaround ?? null,
          priceRanges: input.priceRanges ?? [],
          ...(input.commissionCardImages !== undefined && { commissionCardImages: input.commissionCardImages }),
          ...(input.artStyles !== undefined && { artStyles: input.artStyles }),
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
      const commission = await ctx.prisma.commission.create({
        data: {
          buyerId: ctx.session.user.id,
          artistId: input.artistId,
          description: input.description,
          dropdownSelections: input.dropdownSelections as unknown as Prisma.InputJsonValue,
          referencePhotos: input.referencePhotos ?? [],
        },
      })
      await ctx.prisma.notification.create({
        data: { userId: commission.artistId, fromUserId: ctx.session.user.id, type: `commission_request:${commission.id}` },
      })
      return commission
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

      // Approaching-deadline notification (within 48 h, not yet sent)
      if (
        commission.deadline &&
        !commission.deadlineNotificationSent &&
        !["COMPLETE", "DECLINED", "CANCELLED"].includes(commission.status)
      ) {
        const msUntil = new Date(commission.deadline).getTime() - Date.now()
        const fortyEightHours = 48 * 60 * 60 * 1000
        if (msUntil > 0 && msUntil <= fortyEightHours) {
          await ctx.prisma.commission.update({
            where: { id: input.id },
            data: { deadlineNotificationSent: true },
          })
          // NOTE: fromUserId is the party who loaded the page and triggered the check.
          // This is a clock-triggered event, not a user action — a system actor ID would
          // be more accurate here but the app has no system user yet.
          await ctx.prisma.notification.createMany({
            data: [
              {
                userId: commission.buyerId,
                fromUserId: ctx.session.user.id,
                type: `commission_deadline_approaching:${input.id}`,
              },
              {
                userId: commission.artistId,
                fromUserId: ctx.session.user.id,
                type: `commission_deadline_approaching:${input.id}`,
              },
            ],
          })
        }
      }

      return commission
    }),

  accept: protectedProcedure
    .input(acceptInputSchema)
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not pending" })

      const deadlineDate = new Date(input.deadline)
      const formatted = deadlineDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })

      const updated = await ctx.prisma.commission.update({
        where: { id: input.id },
        data: {
          status: "ACCEPTED",
          agreedPrice: input.price,
          deadline: deadlineDate,
          deadlineNotificationSent: false,
        },
      })
      await ctx.prisma.notification.create({
        data: { userId: commission.buyerId, fromUserId: ctx.session.user.id, type: `commission_accepted:${input.id}` },
      })
      await ctx.prisma.professionalMessage.create({
        data: {
          commissionId: input.id,
          senderId: ctx.session.user.id,
          text: `Commission accepted at $${input.price}. Deadline: ${formatted}. Awaiting payment.`,
          isSystem: true,
        },
      })
      return updated
    }),

  decline: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not pending" })
      const updated = await ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "DECLINED" },
      })
      await ctx.prisma.notification.create({
        data: { userId: commission.buyerId, fromUserId: ctx.session.user.id, type: `commission_declined:${input.id}` },
      })
      await ctx.prisma.professionalMessage.create({
        data: { commissionId: input.id, senderId: ctx.session.user.id, text: "Commission request declined.", isSystem: true },
      })
      return updated
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

  setDeadline: protectedProcedure
    .input(z.object({
      id: z.string(),
      deadline: z.string().datetime(),
    }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({
        where: { id: input.id },
        select: { artistId: true, buyerId: true, status: true, deadline: true },
      })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      const CLOSED = ["COMPLETE", "DECLINED", "CANCELLED"]
      if (CLOSED.includes(commission.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is closed" })

      const newDeadline = new Date(input.deadline)
      const isUpdate = commission.deadline !== null
      const formatted = newDeadline.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

      await ctx.prisma.commission.update({
        where: { id: input.id },
        data: { deadline: newDeadline, deadlineNotificationSent: false },
      })

      await ctx.prisma.professionalMessage.create({
        data: {
          commissionId: input.id,
          senderId: ctx.session.user.id,
          text: isUpdate ? `Deadline updated to ${formatted}.` : `Deadline set: ${formatted}.`,
          isSystem: true,
        },
      })

      await ctx.prisma.notification.create({
        data: {
          userId: commission.buyerId,
          fromUserId: ctx.session.user.id,
          type: isUpdate ? `commission_deadline_updated:${input.id}` : `commission_deadline_set:${input.id}`,
        },
      })

      return { deadline: newDeadline }
    }),

  confirmPayment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "ACCEPTED") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not accepted yet" })
      const updated = await ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "IN_PROGRESS" },
      })
      await ctx.prisma.notification.create({
        data: { userId: commission.artistId, fromUserId: ctx.session.user.id, type: `commission_paid:${input.id}` },
      })
      await ctx.prisma.professionalMessage.create({
        data: { commissionId: input.id, senderId: ctx.session.user.id, text: "Payment confirmed. Commission is now in progress.", isSystem: true },
      })
      return updated
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
      await ctx.prisma.notification.create({
        data: { userId: commission.buyerId, fromUserId: ctx.session.user.id, type: `commission_delivered:${input.id}` },
      })
      await ctx.prisma.professionalMessage.create({
        data: { commissionId: input.id, senderId: ctx.session.user.id, text: "Delivery submitted. Please review and approve.", isSystem: true },
      })
      return updatedCommission
    }),

  confirmDelivery: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "DELIVERED") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission has not been delivered yet" })
      const updated = await ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "COMPLETE" },
      })
      await ctx.prisma.notification.create({
        data: { userId: commission.artistId, fromUserId: ctx.session.user.id, type: `commission_complete:${input.id}` },
      })
      await ctx.prisma.professionalMessage.create({
        data: { commissionId: input.id, senderId: ctx.session.user.id, text: "Commission complete. Payment released to the artist.", isSystem: true },
      })
      return updated
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })

      const isArtist = commission.artistId === me
      const isBuyer = commission.buyerId === me
      if (!isArtist && !isBuyer) throw new TRPCError({ code: "FORBIDDEN" })

      // Cannot cancel DELIVERED, COMPLETE, CANCELLED, or DISPUTED
      const cancellableStatuses = ["PENDING", "ACCEPTED", "IN_PROGRESS"]
      if (!cancellableStatuses.includes(commission.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Commission cannot be cancelled at this stage" })
      }

      const isPaid = commission.status === "IN_PROGRESS"
      const cancellerRole = isArtist ? "artist" : "buyer"

      // Build system message
      let systemMsg: string
      if (!isPaid) {
        systemMsg = `Commission cancelled by ${cancellerRole}.`
      } else if (isArtist) {
        systemMsg = "Commission cancelled by artist after payment. Full refund issued to buyer. A strike has been recorded against the artist."
      } else {
        systemMsg = "Commission cancelled by buyer after payment. Full refund issued."
      }

      await ctx.prisma.$transaction(async (tx) => {
        // Cancel the commission
        await tx.commission.update({
          where: { id: input.id },
          data: { status: "CANCELLED", cancelledBy: cancellerRole },
        })

        // Post-payment consequences
        if (isPaid && isArtist) {
          // Increment artist's monthly cancellation count — check if feature should be disabled
          const monthStart = new Date()
          monthStart.setDate(1)
          monthStart.setHours(0, 0, 0, 0)

          const monthlyCancels = await tx.commission.count({
            where: {
              artistId: commission.artistId,
              cancelledBy: "artist",
              status: "CANCELLED",
              updatedAt: { gte: monthStart },
            },
          })

          // 4 existing + this one = 5
          if (monthlyCancels >= 4) {
            await tx.user.update({
              where: { id: commission.artistId },
              data: { commissionFeatureDisabled: true },
            })
          }
        }

        if (isPaid && isBuyer) {
          await tx.user.update({
            where: { id: commission.buyerId },
            data: { buyerCancellationCount: { increment: 1 } },
          })
        }

        // Notifications
        const notifyId = isArtist ? commission.buyerId : commission.artistId
        await tx.notification.create({
          data: { userId: notifyId, fromUserId: me, type: `commission_cancelled:${input.id}` },
        })

        await tx.professionalMessage.create({
          data: { commissionId: input.id, senderId: me, text: systemMsg, isSystem: true },
        })
      })

      return ctx.prisma.commission.findUnique({ where: { id: input.id } })
    }),

  dispute: protectedProcedure
    .input(z.object({
      id: z.string(),
      reason: z.string().min(10).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== me) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "DELIVERED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can only dispute a delivered commission" })
      }

      await ctx.prisma.$transaction([
        ctx.prisma.commission.update({
          where: { id: input.id },
          data: { status: "DISPUTED", disputedAt: new Date() },
        }),
        ctx.prisma.notification.create({
          data: {
            userId: commission.artistId,
            fromUserId: me,
            type: `commission_disputed:${input.id}`,
          },
        }),
        ctx.prisma.professionalMessage.create({
          data: {
            commissionId: input.id,
            senderId: me,
            text: `Commission disputed by buyer. Reason: ${input.reason}\n\nThis commission is now frozen pending moderation review. Escrow will not be released until resolved.`,
            isSystem: true,
          },
        }),
      ])

      return ctx.prisma.commission.findUnique({ where: { id: input.id } })
    }),

  checkAutoRelease: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission || commission.status !== "DELIVERED" || commission.disputedAt || !commission.deliveredAt) return null
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

  submitRating: protectedProcedure
    .input(z.object({
      id: z.string(),
      rating: z.number().int().min(1).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "COMPLETE") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not complete" })
      if (commission.buyerRating !== null) throw new TRPCError({ code: "BAD_REQUEST", message: "Already rated" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { buyerRating: input.rating },
      })
    }),

  setDisplayPermission: protectedProcedure
    .input(z.object({
      id: z.string(),
      allow: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "COMPLETE") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not complete" })
      if (commission.displayPermissionAnswered) throw new TRPCError({ code: "BAD_REQUEST", message: "Already answered" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: {
          displayAsExample: input.allow,
          displayPermissionAnswered: true,
        },
      })
    }),

  shareToFeed: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({
        where: { id: input.id },
        include: {
          messages: {
            where: { fileUrl: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { fileUrl: true },
          },
        },
      })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (!commission.displayAsExample) throw new TRPCError({ code: "BAD_REQUEST", message: "Buyer has not approved display" })
      if (commission.artistFeedShareOffered) throw new TRPCError({ code: "BAD_REQUEST", message: "Already responded" })
      const fileUrl = commission.messages[0]?.fileUrl
      if (!fileUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "No delivered image found" })
      await ctx.prisma.$transaction([
        ctx.prisma.post.create({
          data: {
            userId: ctx.session.user.id,
            image: fileUrl,
            isCommission: true,
          },
        }),
        ctx.prisma.commission.update({
          where: { id: input.id },
          data: { artistFeedShareOffered: true },
        }),
      ])
      return { posted: true }
    }),

  dismissFeedShare: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.artistFeedShareOffered) throw new TRPCError({ code: "BAD_REQUEST", message: "Already responded" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { artistFeedShareOffered: true },
      })
    }),

  getApprovedWork: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true },
      })
      if (!user) return []

      const commissions = await ctx.prisma.commission.findMany({
        where: { artistId: user.id, displayAsExample: true, status: "COMPLETE" },
        orderBy: { deliveredAt: "desc" },
        include: {
          messages: {
            where: { fileUrl: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { fileUrl: true },
          },
        },
      })

      return commissions
        .filter(c => c.messages.length > 0)
        .map(c => ({
          commissionId: c.id,
          fileUrl: c.messages[0].fileUrl!,
          deliveredAt: c.deliveredAt,
        }))
    }),

  // ── For You feed + favorites ─────────────────────────────────────────────

  toggleFavorite: protectedProcedure
    .input(z.object({ artistId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const existing = await ctx.prisma.commissionFavorite.findUnique({
        where: { userId_artistId: { userId, artistId: input.artistId } },
      })
      if (existing) {
        await ctx.prisma.commissionFavorite.delete({ where: { id: existing.id } })
        return { favorited: false }
      }
      await ctx.prisma.commissionFavorite.create({ data: { userId, artistId: input.artistId } })
      return { favorited: true }
    }),

  getForYouFeed: publicProcedure
    .input(z.object({ cursor: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const PAGE_SIZE = 8
      const userId = ctx.session?.user?.id ?? null

      // Gather style preferences from followed artists
      let preferredStyles: string[] = []
      let followedIds: string[] = []
      let favoritedIds: string[] = []

      if (userId) {
        const [follows, favorites] = await Promise.all([
          ctx.prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true },
          }),
          ctx.prisma.commissionFavorite.findMany({
            where: { userId },
            select: { artistId: true },
          }),
        ])
        followedIds = follows.map(f => f.followingId)
        favoritedIds = favorites.map(f => f.artistId)

        if (followedIds.length > 0) {
          const followedArtists = await ctx.prisma.user.findMany({
            where: {
              id: { in: followedIds },
              sellingEnabled: true,
              commissionStatus: { in: ["OPEN", "LIMITED"] },
            },
            select: { artStyles: true },
          })
          const styleSet = new Set<string>()
          for (const a of followedArtists) a.artStyles.forEach(s => styleSet.add(s))
          preferredStyles = Array.from(styleSet)
        }
      }

      // Fetch candidate pool
      const pool = await ctx.prisma.user.findMany({
        where: {
          commissionStatus: { in: ["OPEN", "LIMITED"] },
          sellingEnabled: true,
          username: { not: null },
          id: { not: userId ?? undefined },
        },
        select: {
          id: true,
          username: true,
          name: true,
          image: true,
          commissionStatus: true,
          commissionDescription: true,
          commissionTurnaround: true,
          commissionCardImages: true,
          artStyles: true,
          priceRanges: true,
          createdAt: true,
          posts: {
            where: { isCommission: true },
            take: 4,
            orderBy: { createdAt: "desc" },
            select: { id: true, image: true },
          },
          commissionCategories: {
            orderBy: { order: "asc" },
            select: { name: true, options: true },
          },
          artistCommissions: {
            where: { status: "COMPLETE" },
            select: { id: true },
          },
          _count: {
            select: { favoritedByUsers: true },
          },
        },
        take: 200,
        orderBy: { createdAt: "desc" },
      })

      // Score each artist
      const now = Date.now()
      const scored = pool.map(artist => {
        const ageHours = (now - artist.createdAt.getTime()) / 3_600_000
        const completedCount = artist.artistCommissions.length
        const favoriteCount = artist._count.favoritedByUsers

        // Recency for new artists (rising star boost)
        const risingBoost = ageHours < 168 ? 30 * Math.exp(-ageHours / 72) : 0

        // Popularity signal (completions + favorites)
        const popularity = Math.log1p(completedCount * 2 + favoriteCount) * 12

        // Style match
        const styleMatch = preferredStyles.length > 0
          ? artist.artStyles.filter(s => preferredStyles.includes(s)).length * 20
          : 0

        // Follow boost
        const followBoost = followedIds.includes(artist.id) ? 60 : 0

        // Favorite boost
        const favoriteBoost = favoritedIds.includes(artist.id) ? 40 : 0

        // Small random shuffle so feed varies
        const jitter = Math.random() * 8

        const score = risingBoost + popularity + styleMatch + followBoost + favoriteBoost + jitter
        return { artist, score }
      })

      scored.sort((a, b) => b.score - a.score)

      // Beyond what we scored highly, append the rest for end-of-feed
      const page = scored.slice(input.cursor, input.cursor + PAGE_SIZE)
      const nextCursor = input.cursor + PAGE_SIZE < scored.length ? input.cursor + PAGE_SIZE : null

      // Build favorited set for this user
      const returnedIds = page.map(p => p.artist.id)
      let favoritedSet = new Set<string>()
      if (userId && returnedIds.length > 0) {
        const favs = await ctx.prisma.commissionFavorite.findMany({
          where: { userId, artistId: { in: returnedIds } },
          select: { artistId: true },
        })
        favoritedSet = new Set(favs.map(f => f.artistId))
      }

      // Build followed set for this user
      let followedSet = new Set<string>()
      if (userId && returnedIds.length > 0) {
        const follows = await ctx.prisma.follow.findMany({
          where: { followerId: userId, followingId: { in: returnedIds } },
          select: { followingId: true },
        })
        followedSet = new Set(follows.map(f => f.followingId))
      }

      return {
        artists: page.map(({ artist }) => ({
          ...artist,
          isFavorited: favoritedSet.has(artist.id),
          isFollowed: followedSet.has(artist.id),
        })),
        nextCursor,
      }
    }),

  // ── Discovery feed ────────────────────────────────────────────────────────

  getDiscovery: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      sortBy: z.enum(["default", "top", "new", "affordable"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const sortBy = input.sortBy ?? "default"

      const orderBy: Prisma.UserOrderByWithRelationInput =
        sortBy === "top"
          ? { artistCommissions: { _count: "desc" } }
          : sortBy === "new"
          ? { createdAt: "desc" }
          : { createdAt: "desc" }

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
          commissionDescription: true,
          commissionTurnaround: true,
          commissionCardImages: true,
          artStyles: true,
          priceRanges: true,
          posts: {
            where: { isCommission: true },
            take: 4,
            orderBy: { createdAt: "desc" },
            select: { id: true, image: true },
          },
          commissionCategories: {
            orderBy: { order: "asc" },
            select: { name: true, options: true },
          },
        },
        take: 50,
        orderBy,
      })

      // Affordable: sort client-side by avg price ascending
      if (sortBy === "affordable") {
        return [...users].sort((a, b) => {
          const avg = (u: typeof a) => {
            const ranges = u.priceRanges as { label: string; price: number }[] | null
            if (!ranges || ranges.length === 0) return Infinity
            return ranges.reduce((s, r) => s + r.price, 0) / ranges.length
          }
          return avg(a) - avg(b)
        })
      }

      return users
    }),

  getCompletedWork: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true },
      })
      if (!user) return []

      const commissions = await ctx.prisma.commission.findMany({
        where: { artistId: user.id, status: "COMPLETE" },
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: {
          messages: {
            where: { fileUrl: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { fileUrl: true },
          },
          buyer: { select: { username: true, name: true, image: true } },
        },
      })

      return commissions
        .filter(c => c.messages.length > 0)
        .map(c => ({
          id: c.id,
          fileUrl: c.messages[0].fileUrl!,
          buyer: c.buyer,
          completedAt: c.updatedAt,
        }))
    }),
})
