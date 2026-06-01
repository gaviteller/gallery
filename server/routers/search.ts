import { z } from "zod"
import { router, publicProcedure } from "@/lib/trpc"

export const searchRouter = router({
  artists: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
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

      const where = {
        OR: [
          { username: { contains: input.query, mode: "insensitive" as const } },
          { name: { contains: input.query, mode: "insensitive" as const } },
        ],
        username: { not: null },
        ...(blockedIds.size > 0 ? { id: { notIn: [...blockedIds] } } : {}),
      }

      const items = await ctx.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          name: true,
          image: true,
          commissionStatus: true,
        },
        take: input.limit,
        orderBy: { username: "asc" },
      })

      const total = items.length < input.limit
        ? items.length
        : await ctx.prisma.user.count({ where })

      return { items, total }
    }),

  posts: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const where = {
        status: "PUBLISHED" as const,
        OR: [
          { description: { contains: input.query, mode: "insensitive" as const } },
          { hashtags: { some: { tag: { contains: input.query, mode: "insensitive" as const } } } },
        ],
      }

      const [items, total] = await Promise.all([
        ctx.prisma.post.findMany({
          where,
          select: {
            id: true,
            image: true,
            description: true,
            user: { select: { username: true } },
          },
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        ctx.prisma.post.count({ where }),
      ])

      return { items, total }
    }),

  shop: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const where = {
        OR: [
          { title: { contains: input.query, mode: "insensitive" as const } },
          { description: { contains: input.query, mode: "insensitive" as const } },
        ],
      }

      const [items, total] = await Promise.all([
        ctx.prisma.shopItem.findMany({
          where,
          select: {
            id: true,
            image: true,
            title: true,
            price: true,
            user: { select: { username: true } },
          },
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        ctx.prisma.shopItem.count({ where }),
      ])

      return { items, total }
    }),
})
