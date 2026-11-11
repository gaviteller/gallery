/**
 * POST /api/track — records one page visit for the admin Analytics page.
 * Called by components/PageViewTracker on every navigation.
 *
 * Privacy: no cookies. The visitor id is a one-way hash of IP + browser + today's date
 * (+ a server secret), so it counts unique visitors per day but can't identify anyone
 * and changes every day. Bots are ignored.
 */
import { createHash } from "crypto"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit/i
const bodySchema = z.object({
  path: z.string().min(1).max(300),
  search: z.string().max(120).optional(),
  referrer: z.string().max(300).optional(),
})

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? ""
  if (!userAgent || BOT_PATTERN.test(userAgent)) return new NextResponse(null, { status: 204 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !parsed.data.path.startsWith("/") || parsed.data.path.startsWith("/api")) {
    return new NextResponse(null, { status: 204 })
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local"
  const day = new Date().toISOString().slice(0, 10)
  const visitorId = createHash("sha256").update(`${ip}|${userAgent}|${day}|${process.env.NEXTAUTH_SECRET ?? ""}`).digest("hex").slice(0, 32)

  let referrer: string | null = null
  try { referrer = parsed.data.referrer ? new URL(parsed.data.referrer).hostname : null } catch { referrer = null }

  const session = await getServerSession(authOptions).catch(() => null)
  await prisma.pageView.create({
    data: {
      path: parsed.data.path,
      search: parsed.data.search?.trim().toLowerCase() || null,
      visitorId,
      userId: session?.user?.id ?? null,
      referrer,
    },
  }).catch(() => {})
  return new NextResponse(null, { status: 204 })
}
