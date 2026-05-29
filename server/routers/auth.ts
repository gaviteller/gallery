import { z } from "zod"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { router, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { sendPasswordResetEmail } from "@/lib/email"

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

export const authRouter = router({
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { normalizedEmail: input.email.toLowerCase().trim() },
        select: { id: true, email: true, username: true },
      })

      // Always return success — never reveal whether email is registered
      if (!user || !user.email) return { success: true }

      const RESET_IDENTIFIER = `password-reset:${user.email}`

      // Delete any existing reset token for this email
      await ctx.prisma.verificationToken.deleteMany({
        where: { identifier: RESET_IDENTIFIER },
      })

      // Generate token
      const rawToken = crypto.randomBytes(32).toString("hex")
      const hashedToken = sha256(rawToken)
      const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await ctx.prisma.verificationToken.create({
        data: {
          identifier: RESET_IDENTIFIER,
          token: hashedToken,
          expires,
        },
      })

      void sendPasswordResetEmail(user.email, {
        username: user.username ?? "there",
        token: rawToken,
      })

      return { success: true }
    }),

  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      password: z.string().min(8).max(128),
    }))
    .mutation(async ({ ctx, input }) => {
      const hashedToken = sha256(input.token)

      const record = await ctx.prisma.verificationToken.findUnique({
        where: { token: hashedToken },
      })

      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reset link is invalid or has expired.",
        })
      }

      if (record.expires < new Date()) {
        await ctx.prisma.verificationToken.delete({
          where: { token: hashedToken },
        })
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reset link has expired. Please request a new one.",
        })
      }

      const email = record.identifier.replace("password-reset:", "")

      const user = await ctx.prisma.user.findFirst({
        where: { email },
        select: { id: true },
      })

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reset link is invalid or has expired." })
      }

      const hashed = await bcrypt.hash(input.password, 12)

      await ctx.prisma.$transaction([
        ctx.prisma.user.update({
          where: { id: user.id },
          data: { password: hashed },
        }),
        ctx.prisma.verificationToken.delete({
          where: { token: hashedToken },
        }),
      ])

      return { success: true }
    }),
})
