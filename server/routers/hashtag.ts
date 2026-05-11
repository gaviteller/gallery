import { z } from "zod"
import { router, publicProcedure } from "@/lib/trpc"

export const hashtagRouter = router({
  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const tag = input.query.replace(/^#/, "").toLowerCase()
      return ctx.prisma.hashtag.findMany({
        where: { tag: { contains: tag, mode: "insensitive" } },
        include: { _count: { select: { posts: true } } },
        orderBy: { posts: { _count: "desc" } },
        take: 8,
      })
    }),

  getPosts: publicProcedure
    .input(z.object({ tag: z.string() }))
    .query(async ({ ctx, input }) => {
      const tag = input.tag.replace(/^#/, "").toLowerCase()
      return ctx.prisma.post.findMany({
        where: {
          hashtags: { some: { tag } },
          user: { username: { not: null } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, username: true, name: true, image: true } },
          _count: { select: { likes: true, comments: true } },
        },
      })
    }),
})
