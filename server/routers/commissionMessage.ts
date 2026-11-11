/**
 * COMMISSION THREAD MESSAGES — `trpc.commissionMessage.*`
 *
 * Messages between a buyer and artist inside a commission (Professional DMs).
 * Reading the thread happens in commission.ts; this file only sends messages.
 */
import { z } from "zod"
import { after } from "next/server"
import { scanChatMessage } from "@/lib/ai-scan"
import { router, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"

/** Once a commission reaches one of these statuses its thread is read-only. */
const CLOSED_STATUSES = ["COMPLETE", "DECLINED", "CANCELLED"]

export const commissionMessageRouter = router({
  /**
   * Sends a text and/or file message in a commission thread.
   * Only the buyer or the artist may post, and only while the commission is open.
   * The other party gets an in-app notification.
   */
  send: protectedProcedure
    .input(z.object({
      commissionId: z.string(),
      text: z.string().min(1).max(5000).optional(),
      fileUrl: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.text && !input.fileUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Message must have text or a file" })
      }
      const senderId = ctx.session.user.id
      const commission = await ctx.prisma.commission.findUnique({
        where: { id: input.commissionId },
        select: { buyerId: true, artistId: true, status: true },
      })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      const senderIsBuyer = commission.buyerId === senderId
      if (!senderIsBuyer && commission.artistId !== senderId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }
      if (CLOSED_STATUSES.includes(commission.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This commission thread is closed" })
      }

      const message = await ctx.prisma.professionalMessage.create({
        data: {
          commissionId: input.commissionId,
          senderId,
          text: input.text ?? null,
          fileUrl: input.fileUrl ?? null,
        },
      })
      // Check the text for safety after replying (hidden from the other person if flagged).
      if (message.text) {
        const prisma = ctx.prisma
        after(() => scanChatMessage(prisma, "COMMISSION", message.id).then(() => undefined))
      }
      // The notification type carries the commission id so the bell can link to the thread.
      await ctx.prisma.notification.create({
        data: {
          userId: senderIsBuyer ? commission.artistId : commission.buyerId,
          fromUserId: senderId,
          type: `commission_message:${input.commissionId}`,
        },
      })
      return message
    }),
})
