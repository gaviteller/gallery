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

    // Get IDs that I've blocked or that have blocked me
    const [blocked, blockedBy] = await Promise.all([
      ctx.prisma.block.findMany({ where: { blockerId: me }, select: { blockedId: true } }),
      ctx.prisma.block.findMany({ where: { blockedId: me }, select: { blockerId: true } }),
    ])
    const hiddenIds = new Set([
      ...blocked.map(b => b.blockedId),
      ...blockedBy.map(b => b.blockerId),
    ])

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
      const isA = c.participantA === me
      const lastReadAt = isA ? c.lastReadAtA : c.lastReadAtB
      const isUnread = !!(
        lastMsg &&
        lastMsg.senderId !== me &&
        (!lastReadAt || lastMsg.createdAt > lastReadAt)
      )
      return {
        id: c.id,
        other,
        lastMsg,
        updatedAt: c.updatedAt,
        isBlocked: hiddenIds.has(other.id),
        isUnread,
      }
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

      const otherId = convo.participantA === me ? convo.participantB : convo.participantA

      // Block check — either direction
      const block = await ctx.prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: me, blockedId: otherId },
            { blockerId: otherId, blockedId: me },
          ],
        },
      })
      if (block) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot send message to this user" })

      const [msg] = await ctx.prisma.$transaction([
        ctx.prisma.directMessage.create({
          data: { conversationId: input.conversationId, senderId: me, text: input.text },
        }),
        ctx.prisma.conversation.update({
          where: { id: input.conversationId },
          data: { updatedAt: new Date() },
        }),
      ])

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

  markRead: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
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
      await ctx.prisma.conversation.update({
        where: { id: input.conversationId },
        data: isA ? { lastReadAtA: new Date() } : { lastReadAtB: new Date() },
      })
      return { ok: true }
    }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const me = ctx.session.user.id
    const convos = await ctx.prisma.conversation.findMany({
      where: { OR: [{ participantA: me }, { participantB: me }] },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { senderId: true, createdAt: true } },
      },
    })
    const count = convos.filter(c => {
      const last = c.messages[0]
      if (!last || last.senderId === me) return false
      const isA = c.participantA === me
      const lastReadAt = isA ? c.lastReadAtA : c.lastReadAtB
      if (!lastReadAt) return true
      return last.createdAt > lastReadAt
    }).length
    return { count }
  }),

  // ── Block / unblock ──────────────────────────────────────────────────────────

  blockUser: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      if (me === input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot block yourself" })
      await ctx.prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId: me, blockedId: input.userId } },
        create: { blockerId: me, blockedId: input.userId },
        update: {},
      })
      return { ok: true }
    }),

  unblockUser: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      await ctx.prisma.block.deleteMany({
        where: { blockerId: me, blockedId: input.userId },
      })
      return { ok: true }
    }),

  getBlockStatus: protectedProcedure
    .input(z.object({ otherUserId: z.string() }))
    .query(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const [iBlockedThem, theyBlockedMe] = await Promise.all([
        ctx.prisma.block.findUnique({
          where: { blockerId_blockedId: { blockerId: me, blockedId: input.otherUserId } },
        }),
        ctx.prisma.block.findUnique({
          where: { blockerId_blockedId: { blockerId: input.otherUserId, blockedId: me } },
        }),
      ])
      return { iBlockedThem: !!iBlockedThem, theyBlockedMe: !!theyBlockedMe }
    }),

  // ── Delete conversation ──────────────────────────────────────────────────────

  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
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
      await ctx.prisma.conversation.delete({ where: { id: input.conversationId } })
      return { ok: true }
    }),
})
