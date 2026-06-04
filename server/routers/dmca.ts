import { z } from "zod"
import { router, publicProcedure, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"

export const dmcaRouter = router({
  submit: publicProcedure
    .input(z.object({
      claimantName: z.string().min(1).max(200),
      claimantEmail: z.string().email(),
      postUrl: z.string().url(),
      description: z.string().min(50).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Attempt to extract postId from a URL like /posts/<id>
      const match = input.postUrl.match(/\/posts\/([a-z0-9]+)/i)
      const postId = match ? match[1] : null

      await ctx.prisma.dmcaRequest.create({
        data: {
          claimantName: input.claimantName,
          claimantEmail: input.claimantEmail,
          postId: postId ?? null,
          postUrl: input.postUrl,
          description: input.description,
        },
      })

      return { success: true }
    }),
  fileCounterNotice: protectedProcedure
    .input(z.object({
      dmcaRequestId: z.string(),
      statement: z.string().min(20).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const dmca = await ctx.prisma.dmcaRequest.findUnique({
        where: { id: input.dmcaRequestId },
        select: { id: true, status: true, postId: true },
      })
      if (!dmca) throw new TRPCError({ code: "NOT_FOUND" })
      if (dmca.status !== "REMOVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A counter-notice can only be filed for posts that have been removed via DMCA.",
        })
      }
      if (!dmca.postId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No post is linked to this DMCA request.",
        })
      }

      // Verify the linked post belongs to the calling user
      const post = await ctx.prisma.post.findUnique({
        where: { id: dmca.postId },
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

      return ctx.prisma.dmcaRequest.update({
        where: { id: input.dmcaRequestId },
        data: {
          status: "COUNTER_FILED",
          counterNoticedAt: new Date(),
          counterNoticeText: input.statement,
        },
      })
    }),
})
