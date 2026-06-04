import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const cutoff = new Date(Date.now() - FOURTEEN_DAYS_MS)

  const eligible = await prisma.dmcaRequest.findMany({
    where: {
      status: "COUNTER_FILED",
      counterNoticedAt: { lt: cutoff },
    },
    select: { id: true, postId: true },
  })

  if (eligible.length === 0) {
    return NextResponse.json({ restored: 0 })
  }

  let restored = 0

  for (const dmca of eligible) {
    await prisma.$transaction(async (tx) => {
      if (dmca.postId) {
        await tx.post.updateMany({
          where: { id: dmca.postId, status: "REMOVED" },
          data: { status: "PUBLISHED" },
        })
      }
      await tx.dmcaRequest.update({
        where: { id: dmca.id },
        data: { status: "RESOLVED" },
      })
    })
    restored++
  }

  return NextResponse.json({ restored })
}
