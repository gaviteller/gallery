/**
 * DMCA (COPYRIGHT) — `trpc.dmca.*`
 *
 * Flow: a rights-holder submits a takedown (public form at /dmca) → a moderator
 * reviews it in the admin panel and may remove the post → the post's owner can
 * file a counter-notice (/dmca/counter-notice) → if the claimant doesn't respond
 * with a court action within 14 days, the cron job /api/cron/dmca-restore
 * restores the post.
 */
import { z } from "zod"
import { router, publicProcedure, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { sendDmcaCounterNoticeEmail } from "@/lib/email"

export const dmcaRouter = router({
  /**
   * Records a takedown request. Anyone can submit (no login needed).
   * ⚠️ KNOWN ISSUE: the post id is only detected in URLs shaped like "/posts/<id>",
   * but real post URLs are "/@username/<id>", so `postId` is usually left empty.
   * Left as-is pending a decision.
   */
  submit: publicProcedure
    .input(z.object({
      claimantName: z.string().min(1).max(200),
      claimantEmail: z.string().email(),
      postUrl: z.string().url(),
      description: z.string().min(50).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const postIdMatch = input.postUrl.match(/\/posts\/([a-z0-9]+)/i)

      await ctx.prisma.dmcaRequest.create({
        data: {
          claimantName: input.claimantName,
          claimantEmail: input.claimantEmail,
          postId: postIdMatch ? postIdMatch[1] : null,
          postUrl: input.postUrl,
          description: input.description,
        },
      })

      return { success: true }
    }),

  /**
   * The post owner disputes a DMCA removal. Only allowed when the request is
   * REMOVED and the linked post belongs to the caller. Emails the claimant.
   */
  fileCounterNotice: protectedProcedure
    .input(z.object({
      dmcaRequestId: z.string(),
      statement: z.string().min(20).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const dmcaRequest = await ctx.prisma.dmcaRequest.findUnique({
        where: { id: input.dmcaRequestId },
        select: { id: true, status: true, postId: true, claimantEmail: true, claimantName: true, postUrl: true },
      })
      if (!dmcaRequest) throw new TRPCError({ code: "NOT_FOUND" })
      if (dmcaRequest.status !== "REMOVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A counter-notice can only be filed for posts that have been removed via DMCA.",
        })
      }
      if (!dmcaRequest.postId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No post is linked to this DMCA request.",
        })
      }

      const post = await ctx.prisma.post.findUnique({
        where: { id: dmcaRequest.postId },
        select: { userId: true },
      })
      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "The post linked to this DMCA request no longer exists.",
        })
      }
      if (post.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const updatedRequest = await ctx.prisma.dmcaRequest.update({
        where: { id: input.dmcaRequestId },
        data: {
          status: "COUNTER_FILED",
          counterNoticedAt: new Date(),
          counterNoticeText: input.statement,
        },
      })
      if (dmcaRequest.claimantEmail) {
        await sendDmcaCounterNoticeEmail(dmcaRequest.claimantEmail, {
          claimantName: dmcaRequest.claimantName,
          counterNoticeText: input.statement,
          postUrl: dmcaRequest.postUrl ?? "(URL not recorded)",
        })
      }
      return updatedRequest
    }),
})
