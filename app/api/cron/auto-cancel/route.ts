/**
 * NIGHTLY JOB — cancels commission requests the artist ignored for 3 days.
 * Runs daily (see vercel.json). Both parties get an in-app notification.
 */
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAuthorizedCronRequest } from "@/lib/cron"

const UNANSWERED_REQUEST_LIMIT_MS = 3 * 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const unansweredRequests = await prisma.commission.findMany({
    where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - UNANSWERED_REQUEST_LIMIT_MS) } },
    select: { id: true, buyerId: true, artistId: true },
  })
  if (unansweredRequests.length === 0) return NextResponse.json({ cancelled: 0 })

  await prisma.$transaction([
    prisma.commission.updateMany({
      where: { id: { in: unansweredRequests.map((commission) => commission.id) } },
      data: { status: "CANCELLED" },
    }),
    prisma.notification.createMany({
      data: unansweredRequests.flatMap((commission) => [
        { userId: commission.buyerId, fromUserId: commission.artistId, type: `commission_auto_cancelled:${commission.id}` },
        { userId: commission.artistId, fromUserId: commission.buyerId, type: `commission_auto_cancelled:${commission.id}` },
      ]),
    }),
  ])

  return NextResponse.json({ cancelled: unansweredRequests.length })
}
