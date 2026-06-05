import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { v2 as cloudinary } from "cloudinary"
import { prisma } from "@/lib/prisma"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const ALLOWED_FOLDERS = ["posts", "avatars", "banners", "stories", "commissions"] as const
type AllowedFolder = typeof ALLOWED_FOLDERS[number]

function isAllowedFolder(f: unknown): f is AllowedFolder {
  return ALLOWED_FOLDERS.includes(f as AllowedFolder)
}

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

  const { image, folder } = body

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "image must be a base64 data URL" }, { status: 400 })
  }

  const base64Data = image.split(",")[1] ?? ""
  const MAX_BASE64_CHARS = 14_000_000 // ~10 MB decoded
  if (base64Data.length > MAX_BASE64_CHARS) {
    return NextResponse.json({ error: "Image exceeds maximum size (10 MB)" }, { status: 413 })
  }

  if (!isAllowedFolder(folder)) {
    return NextResponse.json({ error: `folder must be one of: ${ALLOWED_FOLDERS.join(", ")}` }, { status: 400 })
  }

  try {
    const result = await cloudinary.uploader.upload(image, { folder })
    return NextResponse.json({ url: result.secure_url })
  } catch (err) {
    console.error("[upload] cloudinary error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
