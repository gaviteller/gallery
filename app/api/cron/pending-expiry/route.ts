import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPostAutoRemovedEmail } from "@/lib/email"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const expired = await prisma.post.findMany({
    where: { status: "PENDING_REVIEW", pendingAt: { lt: cutoff } },
    select: { id: true, userId: true, user: { select: { email: true, username: true } } },
  })

  for (const post of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: post.id },
        data: {
          status: "REMOVED",
          removedAt: new Date(),
          removalReason: "This post was not resolved within the 14-day review period.",
        },
      })
      await tx.notification.create({
        data: { userId: post.userId, fromUserId: null, type: "post_auto_removed" },
      })
    })
    if (post.user.email) {
      void sendPostAutoRemovedEmail(post.user.email, { username: post.user.username ?? "there" })
    }
  }

  return NextResponse.json({ removed: expired.length })
}
