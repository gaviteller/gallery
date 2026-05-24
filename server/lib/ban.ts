import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "@prisma/client"

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
      message: "FORBIDDEN: Your account is currently suspended.",
    })
  }
}
