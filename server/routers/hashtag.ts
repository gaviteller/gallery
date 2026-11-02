/**
 * HASHTAGS API — `trpc.hashtag.*`
 *
 * Hashtags are created automatically when a post caption contains "#something"
 * (see post.create). Tags are stored lowercase without the "#".
 */
import { z } from "zod"
import { router, publicProcedure } from "@/lib/trpc"

/** "#Fantasy" → "fantasy" (matches how tags are stored). */
function normalizeTag(rawTag: string): string {
  return rawTag.replace(/^#/, "").toLowerCase()
}

export const hashtagRouter = router({
  /** Up to 8 tags containing the search text, most-used first (search suggestions). */
  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.hashtag.findMany({
        where: { tag: { contains: normalizeTag(input.query), mode: "insensitive" } },
        include: { _count: { select: { posts: true } } },
        orderBy: { posts: { _count: "desc" } },
        take: 8,
      })
    }),

  /**
   * The 50 newest posts with this tag, for the /hashtag/[tag] page.
   * ⚠️ KNOWN ISSUE: does not filter by post status, so removed or under-review
   * posts can appear here. Left as-is pending a decision.
   */
  getPosts: publicProcedure
    .input(z.object({ tag: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.post.findMany({
        where: {
          hashtags: { some: { tag: normalizeTag(input.tag) } },
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
