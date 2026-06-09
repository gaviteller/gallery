import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { checkNotBanned } from "@/server/lib/ban"
import { stripe } from "@/lib/stripe"

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
          user: { select: { username: true, image: true, name: true } },
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
      return ctx.prisma.shopItem.create({
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

    const account = await stripe.accounts.retrieve(user.stripeConnectId)
    return {
      connected: account.charges_enabled && account.payouts_enabled,
      stripeConnectId: user.stripeConnectId,
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
})
