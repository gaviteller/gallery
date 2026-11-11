/**
 * COMMISSIONS — `trpc.commission.*`
 *
 * Everything about paid custom-art requests between a buyer and an artist.
 *
 * Lifecycle (status):
 *   PENDING      buyer sent a request          → artist accepts (sets price + deadline) or declines
 *   ACCEPTED     waiting for the buyer to pay  → buyer confirms payment (simulated for now)
 *   IN_PROGRESS  paid, artist is working       → artist delivers a file
 *   DELIVERED    waiting for the buyer          → buyer approves, disputes, or 5 days pass (auto-release)
 *   COMPLETE     money released to the artist  → buyer may rate; buyer may allow it as a portfolio example
 *   DECLINED / CANCELLED / DISPUTED (frozen for moderators)
 *
 * Every status change also writes a system message into the commission thread,
 * notifies the other party, and usually sends an email.
 * Automatic time-based changes live in app/api/cron/ (auto-cancel, auto-release).
 *
 * Sections below: artist settings · dashboard stats · request-form categories ·
 * lifecycle actions · ratings & portfolio · trust score · browse feeds.
 */
import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { Prisma, type PrismaClient } from "@prisma/client"
import { computeTier } from "@/server/lib/trustScore"
import { sendPushToUser } from "@/lib/sendPush"
import { checkNotBanned } from "@/server/lib/ban"
import { applyAutomaticBan } from "@/server/lib/autoBan"
import { getBlockedUserIds, excludeIds } from "@/server/lib/blocks"
import { scanPost } from "@/lib/ai-scan"
import {
  sendCommissionRequestEmail,
  sendCommissionAcceptedEmail,
  sendCommissionDeclinedEmail,
  sendCommissionPaymentConfirmedEmail,
  sendCommissionDeliveredEmail,
  sendCommissionCompleteEmail,
  sendCommissionCancelledEmail,
  sendCommissionDisputeEmail,
} from "@/lib/email"

const priceRangeSchema = z.array(z.object({
  label: z.string().min(1).max(100),
  price: z.number().positive(),
}))

/** After this many paid-commission cancellations in one month, an artist's commissions are switched off. */
const MONTHLY_ARTIST_CANCEL_LIMIT = 5
const AUTO_RELEASE_AFTER_MS = 5 * 24 * 60 * 60 * 1000
const DEADLINE_WARNING_WINDOW_MS = 48 * 60 * 60 * 1000

/**
 * The commission columns the actions below need. Deliberately leaves out
 * `referencePhotos` (inline images — large) so status checks stay cheap.
 */
const COMMISSION_CORE_FIELDS = {
  id: true,
  buyerId: true,
  artistId: true,
  status: true,
  agreedPrice: true,
  deadline: true,
  deliveredAt: true,
  disputedAt: true,
  buyerRating: true,
  ratingFlagged: true,
  displayAsExample: true,
  displayPermissionAnswered: true,
  artistFeedShareOffered: true,
} as const

/** Loads a commission's core fields, or null if it doesn't exist. */
function findCommission(prisma: PrismaClient, commissionId: string) {
  return prisma.commission.findUnique({ where: { id: commissionId }, select: COMMISSION_CORE_FIELDS })
}

/**
 * Prisma filter for artists who can actually take commissions right now:
 * open, selling enabled, commissions not suspended, and not currently banned.
 */
function availableArtistFilter() {
  return {
    commissionStatus: { in: ["OPEN" as const, "LIMITED" as const] },
    sellingEnabled: true,
    commissionFeatureDisabled: false,
    username: { not: null },
    OR: [{ bannedUntil: null }, { bannedUntil: { lt: new Date() } }],
  }
}

/**
 * Small, stable "random" number (0–8) per artist that changes once an hour.
 * Gives the browse feed some variety without reshuffling between page loads,
 * which would repeat or skip artists while scrolling.
 */
function hourlyJitter(artistId: string): number {
  const seed = `${artistId}:${Math.floor(Date.now() / 3_600_000)}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return (Math.abs(hash) % 1000) / 1000 * 8
}

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

  /** An artist's public commission info: status, description, prices, styles, request-form categories. */
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

  /** Saves the artist's commission settings (dashboard). Returns only the saved fields. */
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
      // SECURITY: explicit select — the full user row includes the password hash.
      return ctx.prisma.user.update({
        select: {
          id: true,
          commissionStatus: true,
          commissionDescription: true,
          commissionTurnaround: true,
          priceRanges: true,
          commissionCardImages: true,
          artStyles: true,
        },
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

  /** Artist dashboard numbers: active commissions, money held in escrow, total earned. */
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

  /** The custom dropdowns (e.g. "Size", "Background") an artist added to their request form. */
  getCategories: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const artist = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true },
      })
      if (!artist) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.prisma.commissionDropdownCategory.findMany({
        where: { userId: artist.id },
        orderBy: { order: "asc" },
      })
    }),

  /** Adds a request-form dropdown; it goes to the end of the list. */
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

  /** Renames a request-form dropdown or changes its options (owner only). */
  updateCategory: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(50).optional(),
      options: z.array(z.string().min(1).max(50)).min(1).max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.prisma.commissionDropdownCategory.findUnique({ where: { id: input.id } })
      if (!category) throw new TRPCError({ code: "NOT_FOUND" })
      if (category.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.commissionDropdownCategory.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.options !== undefined ? { options: input.options } : {}),
        },
      })
    }),

  /** Removes a request-form dropdown (owner only). */
  deleteCategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.prisma.commissionDropdownCategory.findUnique({ where: { id: input.id } })
      if (!category) throw new TRPCError({ code: "NOT_FOUND" })
      if (category.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.commissionDropdownCategory.delete({ where: { id: input.id } })
    }),

  // ── Commission request lifecycle ─────────────────────────────────────────

  /** Buyer sends a commission request. Refused if blocked either way, or the artist is closed / not selling / suspended. Notifies the artist (in-app + email). */
  submitRequest: protectedProcedure
    .input(z.object({
      artistId: z.string(),
      description: z.string().min(1).max(5000),
      dropdownSelections: z.record(z.string(), z.string()),
      referencePhotos: z.array(z.string()).max(5).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      if (input.artistId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot commission yourself" })
      }
      const buyerId = ctx.session.user.id
      const artist = await ctx.prisma.user.findUnique({
        where: { id: input.artistId },
        select: {
          email: true, username: true, name: true, commissionStatus: true,
          sellingEnabled: true, commissionFeatureDisabled: true, bannedUntil: true,
        },
      })
      if (!artist) throw new TRPCError({ code: "NOT_FOUND", message: "Artist not found" })
      const block = await ctx.prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: buyerId, blockedId: input.artistId },
            { blockerId: input.artistId, blockedId: buyerId },
          ],
        },
        select: { id: true },
      })
      if (block) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot commission this artist." })
      const artistIsBanned = !!artist.bannedUntil && artist.bannedUntil > new Date()
      if (artist.commissionStatus === "CLOSED" || !artist.sellingEnabled || artistIsBanned) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This artist is not accepting commissions" })
      }
      if (artist.commissionFeatureDisabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This artist's commission feature has been suspended" })
      }
      const commission = await ctx.prisma.commission.create({
        data: {
          buyerId,
          artistId: input.artistId,
          description: input.description,
          dropdownSelections: input.dropdownSelections as unknown as Prisma.InputJsonValue,
          referencePhotos: input.referencePhotos ?? [],
        },
      })
      await ctx.prisma.notification.create({
        data: { userId: commission.artistId, fromUserId: buyerId, type: `commission_request:${commission.id}` },
      })
      if (artist.email) {
        const buyer = await ctx.prisma.user.findUnique({ where: { id: buyerId }, select: { username: true } })
        await sendCommissionRequestEmail(artist.email, {
          artistUsername: artist.username ?? artist.name ?? "Artist",
          buyerUsername: buyer?.username ?? "Someone",
        })
      }
      return commission
    }),

  /** The viewer's commissions as buyer and as artist (Professional DMs list). Reference photos are left out — the list doesn't show them. */
  getMine: protectedProcedure
    .query(async ({ ctx }) => {
      const viewerId = ctx.session.user.id
      // Every column except referencePhotos (inline images — large, and unused by the list).
      const listFields = {
        id: true, buyerId: true, artistId: true, status: true, description: true,
        dropdownSelections: true, agreedPrice: true, deliveredAt: true, createdAt: true,
        updatedAt: true, deadline: true, deadlineNotificationSent: true, artistFeedShareOffered: true,
        buyerRating: true, displayAsExample: true, displayPermissionAnswered: true,
        cancelledBy: true, disputedAt: true, ratingFlagged: true,
      } as const
      const partyFields = { select: { id: true, username: true, name: true, image: true } } as const
      const [asBuyer, asArtist] = await Promise.all([
        ctx.prisma.commission.findMany({
          where: { buyerId: viewerId },
          select: { ...listFields, artist: partyFields },
          orderBy: { updatedAt: "desc" },
        }),
        ctx.prisma.commission.findMany({
          where: { artistId: viewerId },
          select: { ...listFields, buyer: partyFields },
          orderBy: { updatedAt: "desc" },
        }),
      ])
      return { asBuyer, asArtist }
    }),

  /** One commission with both parties and its whole message thread. Also sends the one-time "deadline in 48h" notification when due. */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({
        where: { id: input.id },
        include: {
          buyer: { select: { id: true, username: true, name: true, image: true, bannerImage: true, buyerCancellationCount: true } },
          artist: { select: { id: true, username: true, name: true, image: true, bannerImage: true } },
          messages: {
            // Messages held by the AI chat check are only shown to their sender.
            where: { OR: [{ hidden: false }, { senderId: ctx.session.user.id }] },
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
      // Skip if commission is frozen (DISPUTED) or already closed
      if (
        commission.deadline &&
        !commission.deadlineNotificationSent &&
        !["COMPLETE", "DECLINED", "CANCELLED", "DISPUTED"].includes(commission.status)
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

  /** Artist accepts a PENDING request, setting the price and deadline. Buyer is asked to pay. */
  accept: protectedProcedure
    .input(acceptInputSchema)
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const commission = await findCommission(ctx.prisma, input.id)
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
      const [buyer, artist] = await Promise.all([
        ctx.prisma.user.findUnique({ where: { id: commission.buyerId }, select: { email: true, username: true } }),
        ctx.prisma.user.findUnique({ where: { id: commission.artistId }, select: { username: true } }),
      ])
      if (buyer?.email) {
        await sendCommissionAcceptedEmail(buyer.email, {
          buyerUsername: buyer.username ?? "there",
          artistUsername: artist?.username ?? "the artist",
          price: input.price,
          deadline: formatted,
        })
      }
      sendPushToUser(ctx.prisma, commission.buyerId, {
        title: "Commission accepted!",
        body: `@${artist?.username} accepted your commission for $${input.price}`,
        url: `/professional-dms/${input.id}`,
        tag: `commission-${input.id}`,
      }).catch(() => {})
      return updated
    }),

  /** Artist declines a PENDING request. */
  decline: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await findCommission(ctx.prisma, input.id)
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
      const [buyer, artist] = await Promise.all([
        ctx.prisma.user.findUnique({ where: { id: commission.buyerId }, select: { email: true, username: true } }),
        ctx.prisma.user.findUnique({ where: { id: commission.artistId }, select: { username: true } }),
      ])
      if (buyer?.email) {
        await sendCommissionDeclinedEmail(buyer.email, {
          buyerUsername: buyer.username ?? "there",
          artistUsername: artist?.username ?? "the artist",
        })
      }
      return updated
    }),

  /** Artist changes the agreed price before the buyer has paid. */
  updatePrice: protectedProcedure
    .input(z.object({ id: z.string(), price: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await findCommission(ctx.prisma, input.id)
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "ACCEPTED") throw new TRPCError({ code: "BAD_REQUEST", message: "Can only update price on accepted commissions" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { agreedPrice: input.price },
      })
    }),

  /** Artist sets or changes the deadline on an open commission; resets the 48h reminder. */
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

  /** Buyer confirms payment (simulated until Stripe escrow is built): ACCEPTED → IN_PROGRESS. */
  confirmPayment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await findCommission(ctx.prisma, input.id)
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
      const [artist, buyer] = await Promise.all([
        ctx.prisma.user.findUnique({ where: { id: commission.artistId }, select: { email: true, username: true } }),
        ctx.prisma.user.findUnique({ where: { id: commission.buyerId }, select: { username: true } }),
      ])
      if (artist?.email) {
        await sendCommissionPaymentConfirmedEmail(artist.email, {
          artistUsername: artist.username ?? "there",
          buyerUsername: buyer?.username ?? "the buyer",
        })
      }
      return updated
    }),

  /** Artist delivers the finished file: IN_PROGRESS → DELIVERED. Starts the 5-day auto-release clock. */
  markDelivered: protectedProcedure
    .input(z.object({ id: z.string(), fileUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await findCommission(ctx.prisma, input.id)
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
      const [buyer, artist] = await Promise.all([
        ctx.prisma.user.findUnique({ where: { id: commission.buyerId }, select: { email: true, username: true } }),
        ctx.prisma.user.findUnique({ where: { id: commission.artistId }, select: { username: true } }),
      ])
      if (buyer?.email) {
        await sendCommissionDeliveredEmail(buyer.email, {
          buyerUsername: buyer.username ?? "there",
          artistUsername: artist?.username ?? "the artist",
        })
      }
      sendPushToUser(ctx.prisma, commission.buyerId, {
        title: "Work delivered!",
        body: `@${artist?.username} delivered your commission — please review`,
        url: `/professional-dms/${input.id}`,
        tag: `commission-${input.id}`,
      }).catch(() => {})
      return updatedCommission
    }),

  /** Buyer approves the delivery: DELIVERED → COMPLETE, payment released to the artist. */
  confirmDelivery: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await findCommission(ctx.prisma, input.id)
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
      const [artist, buyer] = await Promise.all([
        ctx.prisma.user.findUnique({ where: { id: commission.artistId }, select: { email: true, username: true } }),
        ctx.prisma.user.findUnique({ where: { id: commission.buyerId }, select: { username: true } }),
      ])
      if (artist?.email) {
        await sendCommissionCompleteEmail(artist.email, {
          artistUsername: artist.username ?? "there",
          buyerUsername: buyer?.username ?? "the buyer",
        })
      }
      sendPushToUser(ctx.prisma, commission.artistId, {
        title: "Commission complete!",
        body: `@${buyer?.username} approved your delivery — payment released`,
        url: `/professional-dms/${input.id}`,
        tag: `commission-${input.id}`,
      }).catch(() => {})
      return updated
    }),

  /**
   * Cancels a commission (buyer or artist), allowed until it's delivered.
   * After payment (IN_PROGRESS) there are consequences, per the Terms of Service:
   *  - artist cancels → Minor selling strike (ARTIST_CANCEL); 5+ such cancellations
   *    in a calendar month switch the artist's commissions off
   *  - buyer cancels  → buyer's public cancellation count goes up
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const viewerId = ctx.session.user.id
      const commission = await findCommission(ctx.prisma, input.id)
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })

      const isArtist = commission.artistId === viewerId
      const isBuyer = commission.buyerId === viewerId
      if (!isArtist && !isBuyer) throw new TRPCError({ code: "FORBIDDEN" })

      const cancellableStatuses = ["PENDING", "ACCEPTED", "IN_PROGRESS"]
      if (!cancellableStatuses.includes(commission.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Commission cannot be cancelled at this stage" })
      }

      const isPaid = commission.status === "IN_PROGRESS"
      const cancellerRole = isArtist ? "artist" : "buyer"
      const otherPartyId = isArtist ? commission.buyerId : commission.artistId

      const threadMessage = !isPaid
        ? `Commission cancelled by ${cancellerRole}.`
        : isArtist
          ? "Commission cancelled by artist after payment. Full refund issued to buyer. A strike has been recorded against the artist."
          : "Commission cancelled by buyer after payment. Full refund issued."

      await ctx.prisma.$transaction(async (tx) => {
        await tx.commission.update({
          where: { id: input.id },
          data: { status: "CANCELLED", cancelledBy: cancellerRole },
        })

        if (isPaid && isArtist) {
          await tx.strike.create({
            data: {
              userId: commission.artistId,
              level: "MINOR",
              violation: "ARTIST_CANCEL",
              isSelling: true,
              contentId: input.id,
              contentType: "commission",
              notes: "Artist cancelled a commission after the buyer paid.",
            },
          })

          const startOfMonth = new Date()
          startOfMonth.setDate(1)
          startOfMonth.setHours(0, 0, 0, 0)
          // Includes this commission (already marked cancelled above).
          const artistCancelsThisMonth = await tx.commission.count({
            where: {
              artistId: commission.artistId,
              cancelledBy: "artist",
              status: "CANCELLED",
              updatedAt: { gte: startOfMonth },
            },
          })
          if (artistCancelsThisMonth >= MONTHLY_ARTIST_CANCEL_LIMIT) {
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

        await tx.notification.create({
          data: { userId: otherPartyId, fromUserId: viewerId, type: `commission_cancelled:${input.id}` },
        })
        await tx.professionalMessage.create({
          data: { commissionId: input.id, senderId: viewerId, text: threadMessage, isSystem: true },
        })
      })

      if (isPaid && isArtist) await applyAutomaticBan(ctx.prisma, commission.artistId)

      const notified = await ctx.prisma.user.findUnique({ where: { id: otherPartyId }, select: { email: true, username: true } })
      if (notified?.email) {
        await sendCommissionCancelledEmail(notified.email, {
          username: notified.username ?? "there",
          cancelledByRole: cancellerRole,
        })
      }
      return ctx.prisma.commission.findUnique({ where: { id: input.id } })
    }),

  /** Buyer disputes a delivery: the commission is frozen (DISPUTED) for moderators; escrow is not released. */
  dispute: protectedProcedure
    .input(z.object({
      id: z.string(),
      reason: z.string().min(10).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const viewerId = ctx.session.user.id
      const commission = await findCommission(ctx.prisma, input.id)
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== viewerId) throw new TRPCError({ code: "FORBIDDEN" })
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
            fromUserId: viewerId,
            type: `commission_disputed:${input.id}`,
          },
        }),
        ctx.prisma.professionalMessage.create({
          data: {
            commissionId: input.id,
            senderId: viewerId,
            text: `Commission disputed by buyer. Reason: ${input.reason}\n\nThis commission is now frozen pending moderation review. Escrow will not be released until resolved.`,
            isSystem: true,
          },
        }),
      ])

      const [artist, buyer] = await Promise.all([
        ctx.prisma.user.findUnique({ where: { id: commission.artistId }, select: { email: true, username: true } }),
        ctx.prisma.user.findUnique({ where: { id: commission.buyerId }, select: { email: true, username: true } }),
      ])
      await Promise.all([
        artist?.email ? sendCommissionDisputeEmail(artist.email, { username: artist.username ?? "there" }) : Promise.resolve(),
        buyer?.email ? sendCommissionDisputeEmail(buyer.email, { username: buyer.username ?? "there" }) : Promise.resolve(),
      ])
      return ctx.prisma.commission.findUnique({ where: { id: input.id } })
    }),

  /** Completes a DELIVERED commission once 5 days pass without a dispute (also done nightly by /api/cron/auto-release). */
  checkAutoRelease: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await findCommission(ctx.prisma, input.id)
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

  /** Buyer rates a completed commission 1–5 stars, once. */
  submitRating: protectedProcedure
    .input(z.object({
      id: z.string(),
      rating: z.number().int().min(1).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      const commission = await findCommission(ctx.prisma, input.id)
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "COMPLETE") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not complete" })
      if (commission.buyerRating !== null) throw new TRPCError({ code: "BAD_REQUEST", message: "Already rated" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { buyerRating: input.rating },
      })
    }),

  /** Artist flags a rating as retaliatory, queuing it for human review. */
  flagRating: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id
      const commission = await findCommission(ctx.prisma, input.id)
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== viewerId) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "COMPLETE") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not complete" })
      if (commission.buyerRating === null) throw new TRPCError({ code: "BAD_REQUEST", message: "No rating to dispute" })
      if (commission.ratingFlagged) throw new TRPCError({ code: "BAD_REQUEST", message: "Rating already flagged" })

      await ctx.prisma.$transaction([
        ctx.prisma.commission.update({
          where: { id: input.id },
          data: { ratingFlagged: true },
        }),
        ctx.prisma.professionalMessage.create({
          data: {
            commissionId: input.id,
            senderId: viewerId,
            text: "Artist has flagged this rating as potentially retaliatory. The rating has been queued for human review.",
            isSystem: true,
          },
        }),
      ])

      return ctx.prisma.commission.findUnique({ where: { id: input.id } })
    }),

  /** Buyer decides once whether the artist may show this commission as a portfolio example. */
  setDisplayPermission: protectedProcedure
    .input(z.object({
      id: z.string(),
      allow: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const commission = await findCommission(ctx.prisma, input.id)
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

  /** With the buyer's permission, the artist posts the delivered image to their public feed (AI-scanned like any post). */
  shareToFeed: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const artistId = ctx.session.user.id
      const commission = await ctx.prisma.commission.findUnique({
        where: { id: input.id },
        select: {
          artistId: true,
          displayAsExample: true,
          artistFeedShareOffered: true,
          messages: {
            where: { fileUrl: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { fileUrl: true },
          },
        },
      })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== artistId) throw new TRPCError({ code: "FORBIDDEN" })
      if (!commission.displayAsExample) throw new TRPCError({ code: "BAD_REQUEST", message: "Buyer has not approved display" })
      if (commission.artistFeedShareOffered) throw new TRPCError({ code: "BAD_REQUEST", message: "Already responded" })
      const deliveredImage = commission.messages[0]?.fileUrl
      if (!deliveredImage) throw new TRPCError({ code: "BAD_REQUEST", message: "No delivered image found" })
      const [post] = await ctx.prisma.$transaction([
        ctx.prisma.post.create({
          data: { userId: artistId, image: deliveredImage, isCommission: true },
        }),
        ctx.prisma.commission.update({
          where: { id: input.id },
          data: { artistFeedShareOffered: true },
        }),
      ])
      // Delivered files are private and unscanned; once posted publicly they get
      // the same AI check as any other post.
      await scanPost(ctx.prisma, post.id, artistId, deliveredImage)
      return { posted: true }
    }),

  /** Artist declines the offer to share the delivered work to their feed. */
  dismissFeedShare: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await findCommission(ctx.prisma, input.id)
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.artistFeedShareOffered) throw new TRPCError({ code: "BAD_REQUEST", message: "Already responded" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { artistFeedShareOffered: true },
      })
    }),

  /** The artist's Trust Score: average rating minus selling-strike deductions, cancel rate and tier. Shown publicly after 10 completions. */
  getTrustScore: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const artist = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true, bannedUntil: true },
      })
      if (!artist) throw new TRPCError({ code: "NOT_FOUND" })

      const commissions = await ctx.prisma.commission.findMany({
        where: {
          artistId: artist.id,
          status: { notIn: ["PENDING", "DECLINED"] },
        },
        select: { status: true, buyerRating: true, cancelledBy: true },
      })

      const completed = commissions.filter(c => c.status === "COMPLETE")
      const completedCount = completed.length

      const ratings = completed
        .filter(c => c.buyerRating !== null)
        .map(c => c.buyerRating as number)
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null

      const artistCancels = commissions.filter(c => c.cancelledBy === "artist").length
      const cancelRate = commissions.length > 0
        ? Math.round((artistCancels / commissions.length) * 100)
        : 0

      // Pull selling-related strikes (non-reversed only)
      const sellingStrikes = await ctx.prisma.strike.findMany({
        where: { userId: artist.id, isSelling: true, reversed: false },
        select: { level: true },
      })
      const sellingStrikeCount = sellingStrikes.length
      const strikeDeduction =
        sellingStrikes.filter(s => s.level === "MINOR").length * 0.1 +
        sellingStrikes.filter(s => s.level === "MODERATE").length * 0.3 +
        sellingStrikes.filter(s => s.level === "SEVERE").length * 0.8

      const finalScore = avgRating !== null
        ? Math.max(1.0, Math.min(5.0, Math.round((avgRating - strikeDeduction) * 10) / 10))
        : null

      const hasScore = completedCount >= 10
      const isSuspended = !!(artist.bannedUntil && artist.bannedUntil > new Date())
      const tier = computeTier(finalScore, hasScore, isSuspended)

      return {
        completedCount,
        avgRating,
        finalScore,
        tier,
        cancelRate,
        ratingCount: ratings.length,
        hasScore,
        strikeDeduction,
        sellingStrikeCount,
      }
    }),

  /** Delivered images the buyers allowed the artist to display (profile portfolio). */
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

  /** Saves or un-saves an artist to the viewer's favourites. */
  toggleFavorite: protectedProcedure
    .input(z.object({ artistId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id
      const removed = await ctx.prisma.commissionFavorite.deleteMany({ where: { userId: viewerId, artistId: input.artistId } })
      if (removed.count > 0) return { favorited: false }
      await ctx.prisma.commissionFavorite.create({ data: { userId: viewerId, artistId: input.artistId } })
      return { favorited: true }
    }),

  /**
   * Commission browse "For You", 8 artists per page. Only artists who can take
   * commissions right now (open, not suspended, not banned, not blocked).
   * Score = new-artist boost + popularity (completions, favourites) + style match
   * with artists you follow + big boosts for artists you follow / favourited
   * + a small hourly-stable shuffle so the feed varies without reshuffling mid-scroll.
   */
  getForYouFeed: publicProcedure
    .input(z.object({ cursor: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const PAGE_SIZE = 8
      const CANDIDATE_POOL_SIZE = 200
      const viewerId = ctx.session?.user?.id ?? null

      let preferredStyles: string[] = []
      let followedIds = new Set<string>()
      let favoritedIds = new Set<string>()

      if (viewerId) {
        const [follows, favorites] = await Promise.all([
          ctx.prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } }),
          ctx.prisma.commissionFavorite.findMany({ where: { userId: viewerId }, select: { artistId: true } }),
        ])
        followedIds = new Set(follows.map((follow) => follow.followingId))
        favoritedIds = new Set(favorites.map((favorite) => favorite.artistId))

        // "Styles you like" = art styles of commission artists you follow.
        if (followedIds.size > 0) {
          const followedArtists = await ctx.prisma.user.findMany({
            where: {
              id: { in: [...followedIds] },
              sellingEnabled: true,
              commissionStatus: { in: ["OPEN", "LIMITED"] },
            },
            select: { artStyles: true },
          })
          preferredStyles = [...new Set(followedArtists.flatMap((artist) => artist.artStyles))]
        }
      }

      const blockedIds = await getBlockedUserIds(ctx.prisma, viewerId)
      if (viewerId) blockedIds.add(viewerId)

      // Step 1: score a pool of artists using only small fields (no images).
      const candidates = await ctx.prisma.user.findMany({
        where: { ...availableArtistFilter(), ...excludeIds("id", blockedIds) },
        select: {
          id: true,
          createdAt: true,
          artStyles: true,
          _count: {
            select: {
              favoritedByUsers: true,
              artistCommissions: { where: { status: "COMPLETE" } },
            },
          },
        },
        take: CANDIDATE_POOL_SIZE,
        orderBy: { createdAt: "desc" },
      })

      const now = Date.now()
      const ranked = candidates
        .map((artist) => {
          const ageHours = (now - artist.createdAt.getTime()) / 3_600_000
          const newArtistBoost = ageHours < 168 ? 30 * Math.exp(-ageHours / 72) : 0
          const popularity = Math.log1p(artist._count.artistCommissions * 2 + artist._count.favoritedByUsers) * 12
          const styleMatch = artist.artStyles.filter((style) => preferredStyles.includes(style)).length * 20
          const followBoost = followedIds.has(artist.id) ? 60 : 0
          const favoriteBoost = favoritedIds.has(artist.id) ? 40 : 0
          const score = newArtistBoost + popularity + styleMatch + followBoost + favoriteBoost + hourlyJitter(artist.id)
          return { artistId: artist.id, score }
        })
        .sort((a, b) => b.score - a.score || a.artistId.localeCompare(b.artistId))

      const pageArtistIds = ranked.slice(input.cursor, input.cursor + PAGE_SIZE).map((entry) => entry.artistId)
      const nextCursor = input.cursor + PAGE_SIZE < ranked.length ? input.cursor + PAGE_SIZE : null
      if (pageArtistIds.length === 0) return { artists: [], nextCursor }

      // Step 2: load full card details (including images) for just this page.
      const pageArtists = await ctx.prisma.user.findMany({
        where: { id: { in: pageArtistIds } },
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
            where: { isCommission: true, status: "PUBLISHED" },
            take: 4,
            orderBy: { createdAt: "desc" },
            select: { id: true, image: true },
          },
          commissionCategories: { orderBy: { order: "asc" }, select: { name: true, options: true } },
          artistCommissions: { where: { status: "COMPLETE" }, select: { id: true } },
          _count: { select: { favoritedByUsers: true } },
        },
      })
      const artistById = new Map(pageArtists.map((artist) => [artist.id, artist]))

      return {
        artists: pageArtistIds
          .map((artistId) => artistById.get(artistId))
          .filter((artist): artist is NonNullable<typeof artist> => !!artist)
          .map((artist) => ({
            ...artist,
            isFavorited: favoritedIds.has(artist.id),
            isFollowed: followedIds.has(artist.id),
          })),
        nextCursor,
      }
    }),

  // ── Discovery feed ────────────────────────────────────────────────────────

  /**
   * Commission browse search + sort (up to 50 artists available right now).
   * Search matches username, display name, or an exact option in the artist's
   * request-form dropdowns. "affordable" sorts by average listed price.
   */
  getDiscovery: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      sortBy: z.enum(["default", "top", "new", "affordable"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const sortBy = input.sortBy ?? "default"
      const orderBy: Prisma.UserOrderByWithRelationInput =
        sortBy === "top" ? { artistCommissions: { _count: "desc" } } : { createdAt: "desc" }

      const blockedIds = await getBlockedUserIds(ctx.prisma, ctx.session?.user?.id)

      const artists = await ctx.prisma.user.findMany({
        where: {
          AND: [
            availableArtistFilter(),
            excludeIds("id", blockedIds),
            input.search
              ? {
                  OR: [
                    { username: { contains: input.search, mode: "insensitive" } },
                    { name: { contains: input.search, mode: "insensitive" } },
                    { commissionCategories: { some: { options: { has: input.search } } } },
                  ],
                }
              : {},
          ],
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
            where: { isCommission: true, status: "PUBLISHED" },
            take: 4,
            orderBy: { createdAt: "desc" },
            select: { id: true, image: true },
          },
          commissionCategories: { orderBy: { order: "asc" }, select: { name: true, options: true } },
        },
        take: 50,
        orderBy,
      })

      if (sortBy !== "affordable") return artists

      const averagePrice = (artist: typeof artists[number]) => {
        const priceRanges = artist.priceRanges as { label: string; price: number }[] | null
        if (!priceRanges || priceRanges.length === 0) return Infinity
        return priceRanges.reduce((sum, range) => sum + range.price, 0) / priceRanges.length
      }
      return [...artists].sort((a, b) => averagePrice(a) - averagePrice(b))
    }),
})
