import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { checkNotBanned } from "@/server/lib/ban"
import { stripe } from "@/lib/stripe"
import { calculateFee } from "@/lib/shopFees"
import { scanShopItem } from "@/lib/ai-scan"

const PAGE_SIZE = 24

export const shopRouter = router({
  // ─── Public browsing ─────────────────────────────────────────────────────────

  getFeed: publicProcedure
    .input(z.object({ cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // Collect all IDs the current user has blocked or is blocked by
      const blockedIds: string[] =
        ctx.session?.user?.id
          ? (
              await ctx.prisma.block.findMany({
                where: {
                  OR: [
                    { blockerId: ctx.session.user.id },
                    { blockedId: ctx.session.user.id },
                  ],
                },
                select: { blockerId: true, blockedId: true },
              })
            )
              .flatMap(b => [b.blockerId, b.blockedId])
              .filter(id => id !== ctx.session!.user.id)
          : []

      const items = await ctx.prisma.shopItem.findMany({
        where: {
          status: "ACTIVE",
          userId: { notIn: blockedIds },
        },
        select: {
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
          user: { select: { username: true, image: true, name: true, bannerImage: true } },
        },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
      })

      const hasMore = items.length > PAGE_SIZE
      const page = hasMore ? items.slice(0, PAGE_SIZE) : items
      return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null }
    }),

  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })

      const isOwner = ctx.session?.user?.id === user.id
      return ctx.prisma.shopItem.findMany({
        where: {
          userId: user.id,
          ...(isOwner ? {} : { status: "ACTIVE" }),
        },
        select: {
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
        },
        orderBy: { createdAt: "desc" },
      })
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.shopItem.findUnique({
        where: { id: input.id },
        select: {
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
          user: { select: { username: true, image: true, name: true } },
        },
      })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      // Non-owners cannot see PAUSED items
      if (item.status === "PAUSED" && ctx.session?.user?.id !== item.userId) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return item
    }),

  // ─── Order history ───────────────────────────────────────────────────────────

  getMyOrders: protectedProcedure.query(async ({ ctx }) => {
    const orders = await ctx.prisma.shopOrder.findMany({
      where: { buyerId: ctx.session.user.id },
      select: {
        id: true,
        downloadToken: true,
        amountTotal: true,
        status: true,
        createdAt: true,
        downloadedAt: true,
        item: {
          select: {
            id: true,
            title: true,
            image: true,
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })
    return orders
  }),

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
        item: {
          select: {
            id: true,
            title: true,
            image: true,
          },
        },
        buyer: {
          select: {
            username: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  }),

  // ─── Artist management ───────────────────────────────────────────────────────

  create: protectedProcedure
    .input(
      z.object({
        image: z.string().min(1),       // Cloudinary URL (from /api/upload)
        fileUrl: z.string().default(""),     // becomes required in Task 8's listing form
        title: z.string().min(1).max(100),
        description: z.string().max(1000).optional(),
        price: z.number().min(0.99),
        tags: z.array(z.string().max(50)).max(10).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const item = await ctx.prisma.shopItem.create({
        data: {
          userId: ctx.session.user.id,
          image: input.image,
          fileUrl: input.fileUrl,
          title: input.title,
          description: input.description ?? null,
          price: input.price,
          tags: input.tags,
          status: "ACTIVE",
        },
      })

      await scanShopItem(ctx.prisma, item.id, ctx.session.user.id, input.image)

      return item
    }),

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
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const item = await ctx.prisma.shopItem.findUnique({ where: { id: input.id } })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      if (item.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })

      const { id, ...fields } = input
      return ctx.prisma.shopItem.update({
        where: { id },
        data: {
          ...(fields.image !== undefined && { image: fields.image }),
          ...(fields.fileUrl !== undefined && { fileUrl: fields.fileUrl }),
          ...(fields.title !== undefined && { title: fields.title }),
          ...(fields.description !== undefined && { description: fields.description }),
          ...(fields.price !== undefined && { price: fields.price }),
          ...(fields.tags !== undefined && { tags: fields.tags }),
        },
      })
    }),

  togglePause: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const item = await ctx.prisma.shopItem.findUnique({ where: { id: input.id } })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      if (item.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.shopItem.update({
        where: { id: input.id },
        data: { status: item.status === "ACTIVE" ? "PAUSED" : "ACTIVE" },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const item = await ctx.prisma.shopItem.findUnique({ where: { id: input.id } })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      if (item.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.shopItem.delete({ where: { id: input.id } })
    }),

  // ─── Stripe Connect ───────────────────────────────────────────────────────────

  getConnectStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { stripeConnectId: true },
    })
    if (!user?.stripeConnectId) return { connected: false, stripeConnectId: null }

    try {
      const account = await stripe.accounts.retrieve(user.stripeConnectId)
      return {
        connected: account.charges_enabled && account.payouts_enabled,
        stripeConnectId: user.stripeConnectId,
      }
    } catch (err) {
      console.error("Failed to retrieve Stripe account:", err)
      return { connected: false, stripeConnectId: null }
    }
  }),

  createConnectLink: protectedProcedure.mutation(async ({ ctx }) => {
    await checkNotBanned(ctx.prisma, ctx.session.user.id)

    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { stripeConnectId: true, email: true },
    })

    let accountId = user?.stripeConnectId

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user?.email ?? undefined,
        capabilities: { transfers: { requested: true } },
      })
      accountId = account.id
      await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { stripeConnectId: accountId },
      })
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/shop/connect-return?refresh=1`,
      return_url: `${baseUrl}/shop/connect-return`,
      type: "account_onboarding",
    })

    return { url: link.url }
  }),

  // ─── Checkout ─────────────────────────────────────────────────────────────────

  createCheckout: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)

      const item = await ctx.prisma.shopItem.findUnique({
        where: { id: input.itemId },
        include: { user: { select: { id: true, stripeConnectId: true, username: true } } },
      })
      if (!item || item.status !== "ACTIVE") throw new TRPCError({ code: "NOT_FOUND" })
      if (item.userId === ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot buy your own item" })
      if (!item.user.stripeConnectId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Artist has not connected Stripe" })

      const { totalCents } = calculateFee(item.price)
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: item.title,
                images: [item.image],
              },
              unit_amount: totalCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: "shop_single",
          itemId: item.id,
          buyerId: ctx.session.user.id,
          sellerId: item.userId,
        },
        success_url: `${baseUrl}/shop/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/@${item.user.username}/shop/${item.id}`,
      })

      return { url: session.url! }
    }),

  createCartCheckout: protectedProcedure
    .input(
      z.object({
        items: z
          .array(z.object({ id: z.string() }))
          .min(1)
          .max(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)

      const itemIds = input.items.map(i => i.id)
      const dbItems = await ctx.prisma.shopItem.findMany({
        where: { id: { in: itemIds }, status: "ACTIVE" },
        include: { user: { select: { id: true, stripeConnectId: true } } },
      })

      if (dbItems.length !== itemIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "One or more items are unavailable" })
      }
      if (dbItems.some(item => item.userId === ctx.session.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot buy your own items" })
      }
      if (dbItems.some(item => !item.user.stripeConnectId)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "One or more artists have not connected Stripe" })
      }

      const lineItems = dbItems.map(item => {
        const { totalCents } = calculateFee(item.price)
        return {
          price_data: {
            currency: "usd",
            product_data: { name: item.title, images: [item.image] },
            unit_amount: totalCents,
          },
          quantity: 1,
        }
      })

      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: lineItems,
        metadata: {
          type: "shop_cart",
          buyerId: ctx.session.user.id,
          itemIds: JSON.stringify(itemIds),
        },
        success_url: `${baseUrl}/shop/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/shop`,
      })

      return { url: session.url! }
    }),
})
