import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { bannedUntil: true },
  })
  if (user?.bannedUntil && user.bannedUntil > new Date()) {
    return NextResponse.json({ error: "Your account is currently suspended." }, { status: 403 })
  }

  let body: { image?: unknown; folder?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { image } = body

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "image must be a base64 data URL" }, { status: 400 })
  }

  const base64Data = image.split(",")[1] ?? ""
  const MAX_BASE64_CHARS = 14_000_000 // ~10 MB decoded
  if (base64Data.length > MAX_BASE64_CHARS) {
    return NextResponse.json({ error: "Image exceeds maximum size (10 MB)" }, { status: 413 })
  }

  // Store image as base64 data URL directly in the database
  return NextResponse.json({ url: image })
}
