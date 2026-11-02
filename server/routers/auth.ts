/**
 * PASSWORD RESET — `trpc.auth.*`
 *
 * Flow: user enters their email on /forgot-password → we email a one-time link
 * (valid 1 hour) → /reset-password?token=… sets the new password.
 * Signup itself is handled by app/api/auth/signup/route.ts and login by lib/auth.ts.
 *
 * Only a SHA-256 hash of the token is stored, so a database leak can't be used
 * to reset anyone's password.
 */
import { z } from "zod"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { router, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { sendPasswordResetEmail } from "@/lib/email"
import { normalizeEmail } from "@/lib/normalizeEmail"

const RESET_LINK_LIFETIME_MS = 60 * 60 * 1000
const RESET_TOKEN_PREFIX = "password-reset:"
const PASSWORD_HASH_ROUNDS = 12

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

export const authRouter = router({
  /**
   * Emails a reset link if the address belongs to an account.
   * Always reports success so the form can't be used to discover which emails are registered.
   */
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: input.email.trim(), mode: "insensitive" } },
            { normalizedEmail: normalizeEmail(input.email) },
          ],
        },
        select: { id: true, email: true, username: true },
      })
      if (!user || !user.email) return { success: true }

      const tokenIdentifier = `${RESET_TOKEN_PREFIX}${user.email}`
      // Only the newest link works — remove any earlier one for this email.
      await ctx.prisma.verificationToken.deleteMany({ where: { identifier: tokenIdentifier } })

      const rawToken = crypto.randomBytes(32).toString("hex")
      await ctx.prisma.verificationToken.create({
        data: {
          identifier: tokenIdentifier,
          token: sha256(rawToken),
          expires: new Date(Date.now() + RESET_LINK_LIFETIME_MS),
        },
      })

      void sendPasswordResetEmail(user.email, { username: user.username ?? "there", token: rawToken })
      return { success: true }
    }),

  /** Sets a new password using the token from the email link, then invalidates the token. */
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      password: z.string().min(8).max(128),
    }))
    .mutation(async ({ ctx, input }) => {
      const hashedToken = sha256(input.token)
      const tokenRecord = await ctx.prisma.verificationToken.findUnique({ where: { token: hashedToken } })

      if (!tokenRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reset link is invalid or has expired." })
      }
      if (tokenRecord.expires < new Date()) {
        await ctx.prisma.verificationToken.delete({ where: { token: hashedToken } })
        throw new TRPCError({ code: "BAD_REQUEST", message: "Reset link has expired. Please request a new one." })
      }

      const email = tokenRecord.identifier.replace(RESET_TOKEN_PREFIX, "")
      const user = await ctx.prisma.user.findFirst({ where: { email }, select: { id: true } })
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reset link is invalid or has expired." })
      }

      const passwordHash = await bcrypt.hash(input.password, PASSWORD_HASH_ROUNDS)
      await ctx.prisma.$transaction([
        ctx.prisma.user.update({ where: { id: user.id }, data: { password: passwordHash } }),
        ctx.prisma.verificationToken.delete({ where: { token: hashedToken } }),
      ])

      return { success: true }
    }),
})
