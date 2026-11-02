/**
 * NIGHTLY JOB — completes deliveries the buyer didn't respond to within 5 days,
 * releasing payment to the artist. Disputed commissions are never touched
 * (their status is DISPUTED, not DELIVERED). Runs daily (see vercel.json).
 */
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAuthorizedCronRequest } from "@/lib/cron"

const BUYER_REVIEW_WINDOW_MS = 5 * 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const overdueDeliveries = await prisma.commission.findMany({
    where: { status: "DELIVERED", deliveredAt: { lt: new Date(Date.now() - BUYER_REVIEW_WINDOW_MS) } },
    select: { id: true, buyerId: true, artistId: true },
  })
  if (overdueDeliveries.length === 0) return NextResponse.json({ released: 0 })

  await prisma.$transaction([
    prisma.commission.updateMany({
      where: { id: { in: overdueDeliveries.map((commission) => commission.id) } },
      data: { status: "COMPLETE" },
    }),
    prisma.notification.createMany({
      data: overdueDeliveries.flatMap((commission) => [
        { userId: commission.buyerId, fromUserId: commission.artistId, type: `commission_auto_released:${commission.id}` },
        { userId: commission.artistId, fromUserId: commission.buyerId, type: `commission_auto_released:${commission.id}` },
      ]),
    }),
  ])

  return NextResponse.json({ released: overdueDeliveries.length })
}
