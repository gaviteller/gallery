import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export const storyRouter = router({
  create: protectedProcedure
    .input(z.object({ image: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date()
      return ctx.prisma.story.create({
        data: {
          userId: ctx.session.user.id,
          image: input.image,
          expiresAt: new Date(now.getTime() + TWENTY_FOUR_HOURS_MS),
        },
      })
    }),

  getFeed: protectedProcedure.query(async ({ ctx }) => {
    const me = ctx.session.user.id
    const now = new Date()

    const follows = await ctx.prisma.follow.findMany({
      where: { followerId: me },
      select: { followingId: true },
    })
    const followingIds = follows.map(f => f.followingId)
    const userIds = [me, ...followingIds]

    const stories = await ctx.prisma.story.findMany({
      where: {
        userId: { in: userIds },
        expiresAt: { gt: now },
      },
      include: {
        user: { select: { id: true, username: true, name: true, image: true } },
        views: { where: { viewerId: me }, select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    const grouped = new Map<string, {
      userId: string
      username: string | null
      name: string | null
      image: string | null
      stories: { id: string; image: string; createdAt: Date; viewed: boolean }[]
      hasUnviewed: boolean
    }>()

    for (const story of stories) {
      const uid = story.userId
      if (!grouped.has(uid)) {
        grouped.set(uid, {
          userId: uid,
          username: story.user.username,
          name: story.user.name,
          image: story.user.image,
          stories: [],
          hasUnviewed: false,
        })
      }
      const group = grouped.get(uid)!
      const viewed = story.views.length > 0
      group.stories.push({ id: story.id, image: story.image, createdAt: story.createdAt, viewed })
      if (!viewed) group.hasUnviewed = true
    }

    const groups = Array.from(grouped.values())
    const ownGroup = groups.find(g => g.userId === me)
    const others = groups
      .filter(g => g.userId !== me)
      .sort((a, b) => (b.hasUnviewed ? 1 : 0) - (a.hasUnviewed ? 1 : 0))

    if (!ownGroup) {
      const me_user = await ctx.prisma.user.findUnique({
        where: { id: me },
        select: { id: true, username: true, name: true, image: true },
      })
      if (me_user) {
        others.unshift({ userId: me, username: me_user.username, name: me_user.name, image: me_user.image, stories: [], hasUnviewed: false })
      }
    } else {
      others.unshift(ownGroup)
    }

    return others
  }),

  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true },
      })
      if (!user) return []

      return ctx.prisma.story.findMany({
        where: { userId: user.id, expiresAt: { gt: now } },
        select: { id: true, image: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    }),

  markViewed: protectedProcedure
    .input(z.object({ storyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.storyView.upsert({
        where: { storyId_viewerId: { storyId: input.storyId, viewerId: ctx.session.user.id } },
        create: { storyId: input.storyId, viewerId: ctx.session.user.id },
        update: {},
      })
      return { ok: true }
    }),
})
