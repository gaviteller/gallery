/**
 * DIRECT MESSAGES (social DMs) — `trpc.dm.*`
 *
 * One `Conversation` row per pair of users. The pair is always stored in a fixed
 * order (smaller id = participantA) so the same two people can never end up with
 * two conversations. Each side has its own "last read" time (lastReadAtA/B),
 * which is how unread badges are computed.
 *
 * Commission chats are separate — see commissionMessage.ts / professional DMs.
 */
import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "@prisma/client"
import { sendPushToUser } from "@/lib/sendPush"
import { checkNotBanned } from "@/server/lib/ban"

const PUSH_PREVIEW_MAX_CHARS = 80

/** Public profile fields shown for the other person in a conversation. */
const partnerFields = { id: true, username: true, name: true, image: true } as const

/**
 * Loads a conversation's participants and makes sure the viewer is one of them.
 * Returns which side the viewer is on and the other person's id.
 */
async function getConversationForParticipant(prisma: PrismaClient, conversationId: string, viewerId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participantA: true, participantB: true, lastReadAtA: true, lastReadAtB: true },
  })
  if (!conversation) throw new TRPCError({ code: "NOT_FOUND" })
  const viewerIsA = conversation.participantA === viewerId
  if (!viewerIsA && conversation.participantB !== viewerId) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
  return {
    viewerIsA,
    otherUserId: viewerIsA ? conversation.participantB : conversation.participantA,
    viewerLastReadAt: viewerIsA ? conversation.lastReadAtA : conversation.lastReadAtB,
  }
}

/** The data update that sets the viewer's "last read" time to now. */
function markReadNow(viewerIsA: boolean) {
  return viewerIsA ? { lastReadAtA: new Date() } : { lastReadAtB: new Date() }
}

export const dmRouter = router({
  /**
   * Returns the conversation with another user, creating it on first contact.
   * Refused if either person has blocked the other.
   */
  getOrCreate: protectedProcedure
    .input(z.object({ otherUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id
      const otherUserId = input.otherUserId
      if (viewerId === otherUserId) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot DM yourself" })

      const block = await ctx.prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: viewerId, blockedId: otherUserId },
            { blockerId: otherUserId, blockedId: viewerId },
          ],
        },
        select: { id: true },
      })
      if (block) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot message this user." })

      // Fixed ordering so each pair maps to exactly one conversation row.
      const [participantA, participantB] = viewerId < otherUserId ? [viewerId, otherUserId] : [otherUserId, viewerId]
      const existing = await ctx.prisma.conversation.findUnique({
        where: { participantA_participantB: { participantA, participantB } },
      })
      if (existing) return existing

      return ctx.prisma.conversation.create({ data: { participantA, participantB } })
    }),

  /**
   * The viewer's inbox: every conversation, most recently active first, with the
   * other person's profile and the latest message. (No banner images — the list
   * doesn't show them, and they're large.)
   */
  getConversations: protectedProcedure.query(async ({ ctx }) => {
    const viewerId = ctx.session.user.id

    const conversations = await ctx.prisma.conversation.findMany({
      where: { OR: [{ participantA: viewerId }, { participantB: viewerId }] },
      orderBy: { updatedAt: "desc" },
      include: {
        userA: { select: partnerFields },
        userB: { select: partnerFields },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { text: true, createdAt: true, senderId: true },
        },
      },
    })

    return conversations.map((conversation) => ({
      id: conversation.id,
      other: conversation.participantA === viewerId ? conversation.userB : conversation.userA,
      lastMsg: conversation.messages[0] ?? null,
      updatedAt: conversation.updatedAt,
    }))
  }),

  /** One conversation's header info (other person incl. banner image) for the chat page. */
  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { otherUserId } = await getConversationForParticipant(ctx.prisma, input.conversationId, ctx.session.user.id)
      const other = await ctx.prisma.user.findUnique({
        where: { id: otherUserId },
        select: { ...partnerFields, bannerImage: true },
      })
      if (!other) throw new TRPCError({ code: "NOT_FOUND" })
      return { id: input.conversationId, other }
    }),

  /**
   * All messages in a conversation, oldest first. Also marks the conversation as
   * read for the viewer — but only when there's actually something new, because
   * the open chat polls this every 8 seconds and a write on every poll is wasteful.
   */
  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id
      const { viewerIsA, viewerLastReadAt } = await getConversationForParticipant(ctx.prisma, input.conversationId, viewerId)

      const messages = await ctx.prisma.directMessage.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: "asc" },
        select: { id: true, text: true, senderId: true, createdAt: true },
      })

      const hasUnreadFromOther = messages.some(
        (message) => message.senderId !== viewerId && (!viewerLastReadAt || message.createdAt > viewerLastReadAt),
      )
      if (!viewerLastReadAt || hasUnreadFromOther) {
        await ctx.prisma.conversation.update({
          where: { id: input.conversationId },
          data: markReadNow(viewerIsA),
        })
      }

      return messages
    }),

  /**
   * Sends a message. Bumps the conversation to the top of both inboxes, marks it
   * read for the sender, and notifies the recipient (in-app + push).
   */
  send: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      text: z.string().min(1).max(4000),
    }))
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id
      await checkNotBanned(ctx.prisma, viewerId)
      const { viewerIsA, otherUserId } = await getConversationForParticipant(ctx.prisma, input.conversationId, viewerId)

      const [message] = await ctx.prisma.$transaction([
        ctx.prisma.directMessage.create({
          data: { conversationId: input.conversationId, senderId: viewerId, text: input.text },
        }),
        ctx.prisma.conversation.update({
          where: { id: input.conversationId },
          data: { updatedAt: new Date(), ...markReadNow(viewerIsA) },
        }),
      ])

      const [, sender] = await Promise.all([
        ctx.prisma.notification.create({
          data: { userId: otherUserId, fromUserId: viewerId, type: `dm:${input.conversationId}` },
        }),
        ctx.prisma.user.findUnique({ where: { id: viewerId }, select: { username: true, name: true } }),
      ])
      const senderName = sender?.username ? `@${sender.username}` : (sender?.name ?? "Someone")
      const preview = input.text.length > PUSH_PREVIEW_MAX_CHARS
        ? input.text.slice(0, PUSH_PREVIEW_MAX_CHARS - 3) + "…"
        : input.text
      sendPushToUser(ctx.prisma, otherUserId, {
        title: senderName,
        body: preview,
        url: `/messages/${input.conversationId}`,
        tag: `dm-${input.conversationId}`,
      }).catch(() => { /* push failures must not fail the send */ })

      return message
    }),

  /**
   * Number of conversations with a message from the other person newer than the
   * viewer's last read time. Shown as the badge on the Messages icon (polled every 30s).
   */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const viewerId = ctx.session.user.id
    const conversations = await ctx.prisma.conversation.findMany({
      where: { OR: [{ participantA: viewerId }, { participantB: viewerId }] },
      select: {
        participantA: true,
        lastReadAtA: true,
        lastReadAtB: true,
        // Only the newest message from the other person is needed to decide "unread".
        messages: {
          where: { senderId: { not: viewerId } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    })

    const count = conversations.filter((conversation) => {
      const newestFromOther = conversation.messages[0]
      if (!newestFromOther) return false
      const viewerLastReadAt = conversation.participantA === viewerId ? conversation.lastReadAtA : conversation.lastReadAtB
      if (!viewerLastReadAt) return true
      return newestFromOther.createdAt > viewerLastReadAt
    }).length

    return { count }
  }),
})
