import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"

const CLOSED_STATUSES = ["COMPLETE", "DECLINED", "CANCELLED"]

export const commissionMessageRouter = router({
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
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.commissionId } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (
        commission.buyerId !== ctx.session.user.id &&
        commission.artistId !== ctx.session.user.id
      ) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }
      if (CLOSED_STATUSES.includes(commission.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This commission thread is closed" })
      }
      return ctx.prisma.professionalMessage.create({
        data: {
          commissionId: input.commissionId,
          senderId: ctx.session.user.id,
          text: input.text ?? null,
          fileUrl: input.fileUrl ?? null,
        },
      })
    }),
})
