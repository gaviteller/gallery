/**
 * NIGHTLY JOB — DMCA counter-notice waiting period.
 * If the post owner filed a counter-notice 14+ days ago and the claimant hasn't
 * shown a court action (a moderator would have changed the status), the post is
 * restored and the owner is emailed. Runs daily (see vercel.json).
 */
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPostRestoredEmail } from "@/lib/email"
import { isAuthorizedCronRequest } from "@/lib/cron"

const COUNTER_NOTICE_WAIT_MS = 14 * 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const readyToRestore = await prisma.dmcaRequest.findMany({
    where: { status: "COUNTER_FILED", counterNoticedAt: { lt: new Date(Date.now() - COUNTER_NOTICE_WAIT_MS) } },
    select: { id: true, postId: true },
  })

  for (const dmcaRequest of readyToRestore) {
    await prisma.$transaction(async (tx) => {
      if (dmcaRequest.postId) {
        // Clear the removal details too, so the post no longer shows as "removed" to its owner.
        await tx.post.updateMany({
          where: { id: dmcaRequest.postId, status: "REMOVED" },
          data: { status: "PUBLISHED", removedAt: null, removalReason: null },
        })
      }
      await tx.dmcaRequest.update({ where: { id: dmcaRequest.id }, data: { status: "RESOLVED" } })
    })

    if (dmcaRequest.postId) {
      const post = await prisma.post.findUnique({
        where: { id: dmcaRequest.postId },
        select: { user: { select: { email: true, username: true } } },
      })
      if (post?.user.email) {
        await sendPostRestoredEmail(post.user.email, { username: post.user.username ?? "there" })
      }
    }
  }

  return NextResponse.json({ restored: readyToRestore.length })
}
