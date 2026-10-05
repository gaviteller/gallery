/**
 * BAN CHECK — call at the start of any action a suspended user shouldn't be able to do
 * (posting, commenting, selling...).
 */
import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "@prisma/client"

/** Throws FORBIDDEN if the user's ban (`bannedUntil`) is still in the future; otherwise does nothing. */
export async function checkNotBanned(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bannedUntil: true },
  })
  if (user?.bannedUntil && user.bannedUntil > new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account is currently suspended.",
    })
  }
}
