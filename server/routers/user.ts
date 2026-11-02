/**
 * USERS & ACCOUNT SETTINGS — `trpc.user.*`
 *
 * Profiles, settings, onboarding, username checks, and the user's own
 * moderation history (strikes, removed posts, appeals).
 *
 * SECURITY: never return a raw User row to the browser — it contains the
 * password hash, email, moderator notes, etc. Every query below picks fields
 * from one of the two allow-lists:
 *   PUBLIC_PROFILE_FIELDS → safe for anyone (profile pages)
 *   OWN_ACCOUNT_FIELDS    → the logged-in user's own settings
 */
import { z } from "zod"
import bcrypt from "bcryptjs"
import { router, publicProcedure, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { scanAvatar } from "@/lib/ai-scan"
import { getBlockedUserIds, excludeIds } from "@/server/lib/blocks"
import { REMOVAL_GRACE_CUTOFF } from "@/lib/removal"

const PASSWORD_HASH_ROUNDS = 12

/** Fields anyone may see on a profile page. */
const PUBLIC_PROFILE_FIELDS = {
  id: true,
  username: true,
  name: true,
  image: true,
  bannerImage: true,
  bio: true,
  websiteUrl: true,
  twitterHandle: true,
  instagramHandle: true,
  artstationHandle: true,
  sellingEnabled: true,
  commissionStatus: true,
  commissionDescription: true,
  commissionTurnaround: true,
  priceRanges: true,
  commissionCardImages: true,
  artStyles: true,
  showRealName: true,
  createdAt: true,
} as const

/** Public fields plus private settings the user may see about themselves. */
const OWN_ACCOUNT_FIELDS = {
  ...PUBLIC_PROFILE_FIELDS,
  email: true,
  emailVerified: true,
  onboardingComplete: true,
  adTargetingOptOut: true,
  bannedUntil: true,
  banReason: true,
  commissionFeatureDisabled: true,
} as const

export const userRouter = router({
  /** The logged-in user's own account (Settings page). */
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: OWN_ACCOUNT_FIELDS,
    })
  }),

  /** Up to 20 users whose username or name contains the text, excluding blocked users. */
  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const blockedUserIds = await getBlockedUserIds(ctx.prisma, ctx.session?.user?.id)
      return ctx.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: input.query, mode: "insensitive" } },
            { name: { contains: input.query, mode: "insensitive" } },
          ],
          username: { not: null },
          ...excludeIds("id", blockedUserIds),
        },
        select: { id: true, username: true, name: true, image: true },
        take: 20,
      })
    }),

  /**
   * A public profile by username (case-insensitive). Returns null if the user
   * doesn't exist or if either side has blocked the other.
   */
  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: PUBLIC_PROFILE_FIELDS,
      })
      if (!profile) return null

      const viewerId = ctx.session?.user?.id
      if (viewerId && viewerId !== profile.id) {
        const block = await ctx.prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: viewerId, blockedId: profile.id },
              { blockerId: profile.id, blockedId: viewerId },
            ],
          },
          select: { id: true },
        })
        if (block) return null
      }

      return profile
    }),

  /** Whether a username is free (exact match). Used live while typing on signup/onboarding. */
  checkUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({
        where: { username: input.username },
        select: { id: true },
      })
      return { available: !existing }
    }),

  /** Final onboarding step: records whether the user wants to sell, and marks onboarding done. */
  completeOnboarding: protectedProcedure
    .input(z.object({ sellingEnabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { sellingEnabled: input.sellingEnabled, onboardingComplete: true },
        select: OWN_ACCOUNT_FIELDS,
      })
    }),

  /** Turns selling on/off. Also opens or closes commissions to match. */
  updateSellingEnabled: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          sellingEnabled: input.enabled,
          commissionStatus: input.enabled ? "OPEN" : "CLOSED",
        },
        select: OWN_ACCOUNT_FIELDS,
      })
    }),

  /** Opens or closes the artist's commissions. */
  updateCommissionStatus: protectedProcedure
    .input(z.object({ status: z.enum(["OPEN", "CLOSED"]) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { commissionStatus: input.status },
        select: OWN_ACCOUNT_FIELDS,
      })
    }),

  /** Changes the username (letters, numbers, underscores; 3–30 chars). Fails if taken. */
  changeUsername: protectedProcedure
    .input(z.object({
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    }))
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id
      const owner = await ctx.prisma.user.findUnique({ where: { username: input.username }, select: { id: true } })
      if (owner && owner.id !== viewerId) {
        throw new TRPCError({ code: "CONFLICT", message: "Username is already taken." })
      }
      return ctx.prisma.user.update({
        where: { id: viewerId },
        data: { username: input.username },
        select: OWN_ACCOUNT_FIELDS,
      })
    }),

  /** Changes the password after checking the current one. Not available for Google-only accounts. */
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    }))
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id
      const account = await ctx.prisma.user.findUnique({ where: { id: viewerId }, select: { password: true } })
      if (!account?.password) throw new TRPCError({ code: "BAD_REQUEST", message: "No password set on this account." })
      const currentPasswordMatches = await bcrypt.compare(input.currentPassword, account.password)
      if (!currentPasswordMatches) throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." })
      return ctx.prisma.user.update({
        where: { id: viewerId },
        data: { password: await bcrypt.hash(input.newPassword, PASSWORD_HASH_ROUNDS) },
        select: OWN_ACCOUNT_FIELDS,
      })
    }),

  /** The user's active (not reversed) strikes, newest first — shown on /appeal. */
  getMyStrikes: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.strike.findMany({
      where: { userId: ctx.session.user.id, reversed: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, level: true, violation: true, createdAt: true },
    })
  }),

  /** The user's appeals and their status, newest first. */
  getMyAppeals: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.appeal.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, text: true, createdAt: true, reviewedAt: true, strikeId: true, postId: true },
    })
  }),

  /** Posts removed in the last 15 days (still appealable), newest removal first. */
  getMyRemovedPosts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.post.findMany({
      where: {
        userId: ctx.session.user.id,
        status: "REMOVED",
        removedAt: { gte: REMOVAL_GRACE_CUTOFF() },
      },
      orderBy: { removedAt: "desc" },
      select: { id: true, image: true, removedAt: true, removalReason: true },
    })
  }),

  /**
   * Appeals a strike and/or a removed post. Rules:
   *  - the strike/post must belong to the caller, and the post must be REMOVED
   *  - only one pending appeal per post (CONFLICT), and one pending appeal overall
   */
  submitAppeal: protectedProcedure
    .input(
      z.object({
        text: z.string().min(20).max(2000),
        strikeId: z.string().optional(),
        postId: z.string().optional(),
      }).refine((appeal) => appeal.strikeId || appeal.postId, {
        message: "Must specify a strike or a removed post to appeal.",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id

      if (input.strikeId) {
        const strike = await ctx.prisma.strike.findUnique({
          where: { id: input.strikeId },
          select: { userId: true },
        })
        if (!strike || strike.userId !== viewerId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Strike not found or does not belong to you." })
        }
      }

      if (input.postId) {
        const post = await ctx.prisma.post.findUnique({
          where: { id: input.postId },
          select: { userId: true, status: true },
        })
        if (!post || post.userId !== viewerId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Post not found or does not belong to you." })
        }
        if (post.status !== "REMOVED") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This post is not removed." })
        }
        // Checked before the global rule below so this more specific error wins.
        const pendingAppealForPost = await ctx.prisma.appeal.findFirst({
          where: { userId: viewerId, postId: input.postId, status: "PENDING" },
          select: { id: true },
        })
        if (pendingAppealForPost) {
          throw new TRPCError({ code: "CONFLICT", message: "You already have a pending appeal for this post." })
        }
      }

      const anyPendingAppeal = await ctx.prisma.appeal.findFirst({
        where: { userId: viewerId, status: "PENDING" },
        select: { id: true },
      })
      if (anyPendingAppeal) throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a pending appeal." })

      return ctx.prisma.appeal.create({
        data: {
          userId: viewerId,
          text: input.text,
          strikeId: input.strikeId ?? null,
          postId: input.postId ?? null,
        },
      })
    }),

  /** Settings toggle: show real name next to username. */
  updateShowRealName: protectedProcedure
    .input(z.object({ showRealName: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { showRealName: input.showRealName },
        select: { id: true, showRealName: true },
      })
    }),

  /** Settings toggle: opt out of location-based ad targeting. */
  updateAdTargetingOptOut: protectedProcedure
    .input(z.object({ optOut: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { adTargetingOptOut: input.optOut },
        select: { id: true, adTargetingOptOut: true },
      })
    }),

  /**
   * Saves the Edit Profile form. A new profile photo or banner is AI-scanned
   * afterwards and reverted if inappropriate (see lib/ai-scan.ts → scanAvatar).
   * `bannerImage` is optional: leaving it out keeps the current banner.
   */
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
      const viewerId = ctx.session.user.id
      const updatedAccount = await ctx.prisma.user.update({
        where: { id: viewerId },
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
        select: OWN_ACCOUNT_FIELDS,
      })
      if (input.image) await scanAvatar(ctx.prisma, viewerId, "image", input.image)
      if (input.bannerImage) await scanAvatar(ctx.prisma, viewerId, "bannerImage", input.bannerImage)

      return updatedAccount
    }),
})
