/**
 * SHOP — `trpc.shop.*`
 *
 * Digital-goods listings, the /shop feed, artist storefronts, order history,
 * Stripe Connect onboarding for sellers, and Stripe Checkout for buyers.
 * Payment completion (creating orders, emailing download links) happens in the
 * Stripe webhook: app/api/stripe/shop-webhook/route.ts.
 *
 * Listing statuses:
 *   ACTIVE          → for sale, visible to everyone
 *   PAUSED          → hidden by the seller
 *   PENDING_REVIEW  → hidden by AI moderation for human review
 *   REMOVED         → removed by moderation
 * Only ACTIVE listings are visible to anyone other than the seller.
 */
import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "@prisma/client"
import { checkNotBanned } from "@/server/lib/ban"
import { getBlockedUserIds, excludeIds } from "@/server/lib/blocks"
import { stripe } from "@/lib/stripe"
import { calculateFee } from "@/lib/shopFees"
import { scanShopItem } from "@/lib/ai-scan"

const SHOP_FEED_PAGE_SIZE = 24
const MAX_CART_ITEMS = 10

/** Public fields of a listing (never includes fileUrl — the paid download). */
const LISTING_FIELDS = {
  id: true,
  userId: true,
  image: true,
  title: true,
  description: true,
  price: true,
  tags: true,
  status: true,
  purchaseCount: true,
  createdAt: true,
  updatedAt: true,
} as const

function siteUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000"
}

/**
 * Stripe only accepts web links for product images. Images stored inline as
 * base64 data would make Checkout fail, so those are left out of the listing.
 */
function stripeProductImages(image: string): string[] | undefined {
  return image.startsWith("https://") ? [image] : undefined
}

/** Throws NOT_FOUND / FORBIDDEN unless the listing exists and belongs to the user. Returns its status. */
async function getOwnedListingStatus(prisma: PrismaClient, listingId: string, userId: string): Promise<string> {
  const listing = await prisma.shopItem.findUnique({ where: { id: listingId }, select: { userId: true, status: true } })
  if (!listing) throw new TRPCError({ code: "NOT_FOUND" })
  if (listing.userId !== userId) throw new TRPCError({ code: "FORBIDDEN" })
  return listing.status
}

export const shopRouter = router({
  // ─── Public browsing ─────────────────────────────────────────────────────────

  /** The /shop feed: newest ACTIVE listings, 24 per page, hiding blocked users. */
  getFeed: publicProcedure
    .input(z.object({ cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const blockedIds = await getBlockedUserIds(ctx.prisma, ctx.session?.user?.id)

      // Fetch one extra row to know whether there's another page.
      const listings = await ctx.prisma.shopItem.findMany({
        where: { status: "ACTIVE", ...excludeIds("userId", blockedIds) },
        select: {
          ...LISTING_FIELDS,
          user: { select: { username: true, image: true, name: true, bannerImage: true } },
        },
        orderBy: { createdAt: "desc" },
        take: SHOP_FEED_PAGE_SIZE + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
      })

      const hasMore = listings.length > SHOP_FEED_PAGE_SIZE
      const page = hasMore ? listings.slice(0, SHOP_FEED_PAGE_SIZE) : listings
      return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null }
    }),

  /** An artist's storefront. Visitors see ACTIVE listings; the seller sees all of theirs. */
  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const seller = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true },
      })
      if (!seller) throw new TRPCError({ code: "NOT_FOUND" })

      const viewerIsSeller = ctx.session?.user?.id === seller.id
      return ctx.prisma.shopItem.findMany({
        where: { userId: seller.id, ...(viewerIsSeller ? {} : { status: "ACTIVE" }) },
        select: LISTING_FIELDS,
        orderBy: { createdAt: "desc" },
      })
    }),

  /** One listing (item page). Anything not ACTIVE looks "not found" to everyone but the seller. */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const listing = await ctx.prisma.shopItem.findUnique({
        where: { id: input.id },
        select: { ...LISTING_FIELDS, user: { select: { username: true, image: true, name: true } } },
      })
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" })
      if (listing.status !== "ACTIVE" && ctx.session?.user?.id !== listing.userId) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return listing
    }),

  // ─── Order history ───────────────────────────────────────────────────────────

  /** The viewer's purchases with their download tokens (/shop/orders). */
  getMyOrders: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.shopOrder.findMany({
      where: { buyerId: ctx.session.user.id },
      select: {
        id: true,
        downloadToken: true,
        amountTotal: true,
        status: true,
        createdAt: true,
        downloadedAt: true,
        item: { select: { id: true, title: true, image: true, user: { select: { username: true } } } },
      },
      orderBy: { createdAt: "desc" },
    })
  }),

  /** The viewer's completed sales with fees and payouts (artist dashboard). */
  getMySales: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.shopOrder.findMany({
      where: { sellerId: ctx.session.user.id, status: "PURCHASED" },
      select: {
        id: true,
        amountTotal: true,
        galleryFee: true,
        sellerPayout: true,
        status: true,
        createdAt: true,
        item: { select: { id: true, title: true, image: true } },
        buyer: { select: { username: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  }),

  // ─── Artist management ───────────────────────────────────────────────────────

  /**
   * Creates a listing. `image` is the preview everyone sees; `fileUrl` is the
   * private file buyers download (a Cloudinary id, see lib/uploadFile.ts).
   * The preview is AI-scanned before returning.
   */
  create: protectedProcedure
    .input(
      z.object({
        image: z.string().min(1),
        fileUrl: z.string().default(""),
        title: z.string().min(1).max(100),
        description: z.string().max(1000).optional(),
        price: z.number().min(0.99),
        tags: z.array(z.string().max(50)).max(10).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sellerId = ctx.session.user.id
      await checkNotBanned(ctx.prisma, sellerId)
      const listing = await ctx.prisma.shopItem.create({
        data: {
          userId: sellerId,
          image: input.image,
          fileUrl: input.fileUrl,
          title: input.title,
          description: input.description ?? null,
          price: input.price,
          tags: input.tags,
          status: "ACTIVE",
        },
      })

      await scanShopItem(ctx.prisma, listing.id, sellerId, input.image)

      return listing
    }),

  /**
   * Edits a listing (only the fields provided). A new preview image is AI-scanned
   * just like on create — otherwise an image could be swapped in after approval.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        image: z.string().min(1).optional(),
        fileUrl: z.string().min(1).optional(),
        title: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).optional(),
        price: z.number().min(0.99).optional(),
        tags: z.array(z.string().max(50)).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sellerId = ctx.session.user.id
      await checkNotBanned(ctx.prisma, sellerId)
      await getOwnedListingStatus(ctx.prisma, input.id, sellerId)

      const { id: listingId, ...changes } = input
      const updatedListing = await ctx.prisma.shopItem.update({
        where: { id: listingId },
        data: {
          ...(changes.image !== undefined && { image: changes.image }),
          ...(changes.fileUrl !== undefined && { fileUrl: changes.fileUrl }),
          ...(changes.title !== undefined && { title: changes.title }),
          ...(changes.description !== undefined && { description: changes.description }),
          ...(changes.price !== undefined && { price: changes.price }),
          ...(changes.tags !== undefined && { tags: changes.tags }),
        },
      })

      if (changes.image !== undefined) await scanShopItem(ctx.prisma, listingId, sellerId, changes.image)

      return updatedListing
    }),

  /**
   * Pauses an ACTIVE listing or re-activates a PAUSED one.
   * Listings held or removed by moderation can't be toggled back on.
   */
  togglePause: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const currentStatus = await getOwnedListingStatus(ctx.prisma, input.id, ctx.session.user.id)
      if (currentStatus !== "ACTIVE" && currentStatus !== "PAUSED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This listing is under moderation and can't be changed." })
      }
      return ctx.prisma.shopItem.update({
        where: { id: input.id },
        data: { status: currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE" },
      })
    }),

  /** Deletes one of the viewer's listings. */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      await getOwnedListingStatus(ctx.prisma, input.id, ctx.session.user.id)
      return ctx.prisma.shopItem.delete({ where: { id: input.id } })
    }),

  // ─── Stripe Connect (seller payouts) ─────────────────────────────────────────

  /** Whether the seller finished Stripe onboarding (can receive payouts). */
  getConnectStatus: protectedProcedure.query(async ({ ctx }) => {
    const seller = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { stripeConnectId: true },
    })
    if (!seller?.stripeConnectId) return { connected: false, stripeConnectId: null }

    try {
      const account = await stripe.accounts.retrieve(seller.stripeConnectId)
      return {
        connected: account.charges_enabled && account.payouts_enabled,
        stripeConnectId: seller.stripeConnectId,
      }
    } catch (error) {
      console.error("Failed to retrieve Stripe account:", error)
      return { connected: false, stripeConnectId: null }
    }
  }),

  /**
   * Returns a Stripe onboarding link. Creates the seller's Stripe Express
   * account on first use and remembers its id.
   */
  createConnectLink: protectedProcedure.mutation(async ({ ctx }) => {
    const sellerId = ctx.session.user.id
    await checkNotBanned(ctx.prisma, sellerId)

    const seller = await ctx.prisma.user.findUnique({
      where: { id: sellerId },
      select: { stripeConnectId: true, email: true },
    })

    let stripeAccountId = seller?.stripeConnectId
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: seller?.email ?? undefined,
        capabilities: { transfers: { requested: true } },
      })
      stripeAccountId = account.id
      await ctx.prisma.user.update({ where: { id: sellerId }, data: { stripeConnectId: stripeAccountId } })
    }

    const onboardingLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl()}/shop/connect-return?refresh=1`,
      return_url: `${siteUrl()}/shop/connect-return`,
      type: "account_onboarding",
    })

    return { url: onboardingLink.url }
  }),

  // ─── Checkout ─────────────────────────────────────────────────────────────────

  /** Stripe Checkout for one listing ("Buy now"). */
  createCheckout: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const buyerId = ctx.session.user.id
      await checkNotBanned(ctx.prisma, buyerId)

      const listing = await ctx.prisma.shopItem.findUnique({
        where: { id: input.itemId },
        select: {
          id: true, userId: true, title: true, image: true, price: true, status: true,
          user: { select: { stripeConnectId: true, username: true } },
        },
      })
      if (!listing || listing.status !== "ACTIVE") throw new TRPCError({ code: "NOT_FOUND" })
      if (listing.userId === buyerId) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot buy your own item" })
      if (!listing.user.stripeConnectId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Artist has not connected Stripe" })

      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: listing.title, images: stripeProductImages(listing.image) },
              unit_amount: calculateFee(listing.price).totalCents,
            },
            quantity: 1,
          },
        ],
        // Read back by the webhook to create the order.
        metadata: { type: "shop_single", itemId: listing.id, buyerId, sellerId: listing.userId },
        success_url: `${siteUrl()}/shop/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl()}/@${listing.user.username}/shop/${listing.id}`,
      })

      return { url: checkoutSession.url! }
    }),

  /** Stripe Checkout for the whole cart (1–10 listings, possibly from different artists). */
  createCartCheckout: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.string() })).min(1).max(MAX_CART_ITEMS) }))
    .mutation(async ({ ctx, input }) => {
      const buyerId = ctx.session.user.id
      await checkNotBanned(ctx.prisma, buyerId)

      const listingIds = input.items.map((cartItem) => cartItem.id)
      const listings = await ctx.prisma.shopItem.findMany({
        where: { id: { in: listingIds }, status: "ACTIVE" },
        select: { id: true, userId: true, title: true, image: true, price: true, user: { select: { stripeConnectId: true } } },
      })

      if (listings.length !== listingIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "One or more items are unavailable" })
      }
      if (listings.some((listing) => listing.userId === buyerId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot buy your own items" })
      }
      if (listings.some((listing) => !listing.user.stripeConnectId)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "One or more artists have not connected Stripe" })
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: listings.map((listing) => ({
          price_data: {
            currency: "usd",
            product_data: { name: listing.title, images: stripeProductImages(listing.image) },
            unit_amount: calculateFee(listing.price).totalCents,
          },
          quantity: 1,
        })),
        metadata: { type: "shop_cart", buyerId, itemIds: JSON.stringify(listingIds) },
        success_url: `${siteUrl()}/shop/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl()}/shop`,
      })

      return { url: checkoutSession.url! }
    }),
})
