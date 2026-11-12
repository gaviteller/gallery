/**
 * STORIES — `trpc.story.*`
 *
 * 24-hour image stories (like Instagram). Expired stories are simply ignored by
 * every query (filtered on `expiresAt`); nothing deletes them.
 */
import { z } from "zod"
import { scanStory } from "@/lib/ai-scan"
import { after } from "next/server"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000

/** One circle in the stories row: an author and their active stories. */
type StoryGroup = {
  userId: string
  username: string | null
  name: string | null
  image: string | null
  stories: { id: string; image: string; createdAt: Date; viewed: boolean }[]
  hasUnviewed: boolean
}

export const storyRouter = router({
  /** Posts a new story that disappears after 24 hours. */
  create: protectedProcedure
    .input(z.object({ image: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const story = await ctx.prisma.story.create({
        data: {
          userId: ctx.session.user.id,
          image: input.image,
          expiresAt: new Date(Date.now() + STORY_LIFETIME_MS),
        },
      })
      const prisma = ctx.prisma
      after(() => scanStory(prisma, story.id))
      return story
    }),

  /**
   * The stories row: active stories from the viewer and everyone they follow,
   * grouped by author. The viewer's own circle is always first (even with no
   * stories, so they can add one); then authors with unseen stories come first.
   */
  getFeed: protectedProcedure.query(async ({ ctx }) => {
    const viewerId = ctx.session.user.id

    const follows = await ctx.prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    })
    const authorIds = [viewerId, ...follows.map((follow) => follow.followingId)]

    const activeStories = await ctx.prisma.story.findMany({
      where: { userId: { in: authorIds }, expiresAt: { gt: new Date() } },
      include: {
        user: { select: { id: true, username: true, name: true, image: true } },
        views: { where: { viewerId }, select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    const groupsByAuthor = new Map<string, StoryGroup>()
    for (const story of activeStories) {
      let group = groupsByAuthor.get(story.userId)
      if (!group) {
        group = {
          userId: story.userId,
          username: story.user.username,
          name: story.user.name,
          image: story.user.image,
          stories: [],
          hasUnviewed: false,
        }
        groupsByAuthor.set(story.userId, group)
      }
      const viewed = story.views.length > 0
      group.stories.push({ id: story.id, image: story.image, createdAt: story.createdAt, viewed })
      if (!viewed) group.hasUnviewed = true
    }

    const otherAuthors = [...groupsByAuthor.values()]
      .filter((group) => group.userId !== viewerId)
      .sort((a, b) => (b.hasUnviewed ? 1 : 0) - (a.hasUnviewed ? 1 : 0))

    let viewerGroup = groupsByAuthor.get(viewerId)
    if (!viewerGroup) {
      const viewer = await ctx.prisma.user.findUnique({
        where: { id: viewerId },
        select: { username: true, name: true, image: true },
      })
      if (!viewer) return otherAuthors
      viewerGroup = { userId: viewerId, ...viewer, stories: [], hasUnviewed: false }
    }
    return [viewerGroup, ...otherAuthors]
  }),

  /** A user's active stories, oldest first (opened from their profile avatar ring). */
  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const author = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true },
      })
      if (!author) return []

      return ctx.prisma.story.findMany({
        where: { userId: author.id, expiresAt: { gt: new Date() } },
        select: { id: true, image: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    }),

  /** Records that the viewer saw a story (drives the "unseen" ring). Safe to call repeatedly. */
  markViewed: protectedProcedure
    .input(z.object({ storyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const story = await ctx.prisma.story.findFirst({
        where: { id: input.storyId, expiresAt: { gt: new Date() } },
        select: { id: true },
      })
      if (!story) throw new TRPCError({ code: "NOT_FOUND" })
      const viewerId = ctx.session.user.id
      await ctx.prisma.storyView.upsert({
        where: { storyId_viewerId: { storyId: input.storyId, viewerId } },
        create: { storyId: input.storyId, viewerId },
        update: {},
      })
      return { ok: true }
    }),
})
