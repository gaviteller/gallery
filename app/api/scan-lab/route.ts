/**
 * POST /api/scan-lab — runs the REAL moderation scanner on a test item for the admin Scan Lab.
 * Only the admin server can call it (header x-scan-lab-secret = SCAN_LAB_SECRET, set in both apps).
 * Nothing is stored: no scan log, no database rows, the image is only held for this request.
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { judgeContent } from "@/lib/ai-scan"

const bodySchema = z.object({
  image: z.string().startsWith("data:image/").max(12_000_000).optional(),
  text: z.string().max(4000).optional(),
  kind: z.enum(["post", "comment", "message", "profile photo", "shop listing", "story"]).default("post"),
  labelledAi: z.boolean().default(false),
  model: z.string().max(120).optional(),
  reviewModel: z.string().max(120).optional(),
})

export async function POST(request: Request) {
  const secret = process.env.SCAN_LAB_SECRET
  if (!secret || request.headers.get("x-scan-lab-secret") !== secret) return NextResponse.json({ error: "Not allowed" }, { status: 403 })
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Bad request" }, { status: 400 })
  const b = parsed.data
  if (!b.image && !b.text?.trim()) return NextResponse.json({ error: "Add a picture or some text to test." }, { status: 400 })
  const where: Record<string, string> = { post: "public feed, profiles and Explore", comment: "under a post, visible to everyone", message: "private conversation between two users", "profile photo": "everywhere on the site (strictest standard)", "shop listing": "public shop", story: "shown to followers for 24 hours" }
  try {
    const judgement = await judgeContent(prisma, {
      label: b.kind,
      where: where[b.kind],
      text: b.text ? { [b.kind === "post" || b.kind === "shop listing" ? "caption" : "text"]: b.text } : {},
      image: b.image ?? null,
      checkAiArt: b.kind === "post" || b.kind === "shop listing",
      labelledAi: b.labelledAi,
    }, { model: b.model || undefined, reviewModel: b.reviewModel ?? "" })
    return NextResponse.json(judgement)
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err).slice(0, 400) }, { status: 502 })
  }
}
