/**
 * NIGHTLY JOB — posts left "under review" (PENDING_REVIEW) for 14 days without a
 * moderator decision are removed. The owner is notified in-app and by email and
 * can appeal from /appeal. Runs daily (see vercel.json).
 */
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPostAutoRemovedEmail } from "@/lib/email"
import { isAuthorizedCronRequest } from "@/lib/cron"

const REVIEW_PERIOD_MS = 14 * 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const expiredReviews = await prisma.post.findMany({
    where: { status: "PENDING_REVIEW", pendingAt: { lt: new Date(Date.now() - REVIEW_PERIOD_MS) } },
    select: { id: true, userId: true, user: { select: { email: true, username: true } } },
  })

  for (const post of expiredReviews) {
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

  return NextResponse.json({ removed: expiredReviews.length })
}
