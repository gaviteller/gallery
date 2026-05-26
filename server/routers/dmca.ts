import { z } from "zod"
import { router, publicProcedure } from "@/lib/trpc"

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
})
