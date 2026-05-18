import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const cutoff = new Date(Date.now() - FIVE_DAYS_MS)

  const stale = await prisma.commission.findMany({
    where: {
      status: "DELIVERED",
      deliveredAt: { lt: cutoff },
    },
    select: { id: true, buyerId: true, artistId: true },
  })

  if (stale.length === 0) {
    return NextResponse.json({ released: 0 })
  }

  const staleIds = stale.map(c => c.id)

  await prisma.$transaction([
    prisma.commission.updateMany({
      where: { id: { in: staleIds } },
      data: { status: "COMPLETE" },
    }),
    prisma.notification.createMany({
      data: stale.flatMap(c => [
        {
          userId: c.buyerId,
          fromUserId: c.artistId,
          type: `commission_auto_released:${c.id}`,
        },
        {
          userId: c.artistId,
          fromUserId: c.buyerId,
          type: `commission_auto_released:${c.id}`,
        },
      ]),
    }),
  ])

  return NextResponse.json({ released: stale.length })
}
