import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { sendPushToUser } from "@/lib/sendPush"

export const dmRouter = router({

  getOrCreate: protectedProcedure
    .input(z.object({ otherUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const other = input.otherUserId
      if (me === other) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot DM yourself" })

      const [a, b] = me < other ? [me, other] : [other, me]

      const existing = await ctx.prisma.conversation.findUnique({
        where: { participantA_participantB: { participantA: a, participantB: b } },
      })
      if (existing) return existing

      return ctx.prisma.conversation.create({
        data: { participantA: a, participantB: b },
      })
    }),

  getConversations: protectedProcedure.query(async ({ ctx }) => {
    const me = ctx.session.user.id

    const convos = await ctx.prisma.conversation.findMany({
      where: { OR: [{ participantA: me }, { participantB: me }] },
      orderBy: { updatedAt: "desc" },
      include: {
        userA: { select: { id: true, username: true, name: true, image: true } },
        userB: { select: { id: true, username: true, name: true, image: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { text: true, createdAt: true, senderId: true },
        },
      },
    })

    return convos.map(c => {
      const other = c.participantA === me ? c.userB : c.userA
      const lastMsg = c.messages[0] ?? null
      return { id: c.id, other, lastMsg, updatedAt: c.updatedAt }
    })
  }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const me = ctx.session.user.id

      const convo = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId },
        select: { participantA: true, participantB: true },
      })
      if (!convo) throw new TRPCError({ code: "NOT_FOUND" })
      if (convo.participantA !== me && convo.participantB !== me) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      // Mark conversation as read for this user
      const isA = convo.participantA === me
      await ctx.prisma.conversation.update({
        where: { id: input.conversationId },
        data: isA ? { lastReadAtA: new Date() } : { lastReadAtB: new Date() },
      })

      return ctx.prisma.directMessage.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: "asc" },
        select: { id: true, text: true, senderId: true, createdAt: true },
      })
    }),

  send: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      text: z.string().min(1).max(4000),
    }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id

      const convo = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId },
        select: { participantA: true, participantB: true },
      })
      if (!convo) throw new TRPCError({ code: "NOT_FOUND" })
      if (convo.participantA !== me && convo.participantB !== me) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const isA = convo.participantA === me
      const [msg] = await ctx.prisma.$transaction([
        ctx.prisma.directMessage.create({
          data: { conversationId: input.conversationId, senderId: me, text: input.text },
        }),
        ctx.prisma.conversation.update({
          where: { id: input.conversationId },
          data: {
            updatedAt: new Date(),
            ...(isA ? { lastReadAtA: new Date() } : { lastReadAtB: new Date() }),
          },
        }),
      ])

      const otherId = convo.participantA === me ? convo.participantB : convo.participantA
      await ctx.prisma.notification.create({
        data: { userId: otherId, fromUserId: me, type: `dm:${input.conversationId}` },
      })

      // Fire push notification to recipient (non-blocking)
      const sender = await ctx.prisma.user.findUnique({
        where: { id: me },
        select: { username: true, name: true },
      })
      const senderName = sender?.username ? `@${sender.username}` : (sender?.name ?? "Someone")
      const preview = input.text.length > 80 ? input.text.slice(0, 77) + "…" : input.text
      sendPushToUser(ctx.prisma, otherId, {
        title: senderName,
        body: preview,
        url: `/messages/${input.conversationId}`,
        tag: `dm-${input.conversationId}`,
      }).catch(() => {/* ignore push errors */})

      return msg
    }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const me = ctx.session.user.id
    const convos = await ctx.prisma.conversation.findMany({
      where: { OR: [{ participantA: me }, { participantB: me }] },
      select: {
        participantA: true,
        participantB: true,
        lastReadAtA: true,
        lastReadAtB: true,
        messages: {
          orderBy: { createdAt: "desc" },
          select: { senderId: true, createdAt: true },
        },
      },
    })

    const count = convos.filter(c => {
      const myLastReadAt = c.participantA === me ? c.lastReadAtA : c.lastReadAtB
      const unreadMessages = c.messages.filter(m => {
        if (m.senderId === me) return false
        if (!myLastReadAt) return true
        return m.createdAt > myLastReadAt
      })
      return unreadMessages.length > 0
    }).length

    return { count }
  }),
})
