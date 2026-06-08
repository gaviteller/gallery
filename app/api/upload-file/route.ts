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

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

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

  let body: { file?: unknown; filename?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { file, filename } = body
  if (typeof file !== "string" || !file.startsWith("data:")) {
    return NextResponse.json({ error: "file must be a base64 data URL" }, { status: 400 })
  }

  const base64Data = file.split(",")[1] ?? ""
  const approxBytes = Math.ceil((base64Data.length * 3) / 4)
  if (approxBytes > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds maximum size (50 MB)" }, { status: 413 })
  }

  try {
    const safeFilename =
      typeof filename === "string"
        ? `${session.user.id}_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`
        : `${session.user.id}_${Date.now()}`

    const result = await cloudinary.uploader.upload(file, {
      folder: "shop-files",
      type: "private",
      resource_type: "raw",
      public_id: safeFilename,
    })
    // Return only public_id — never the direct URL (requires signed access)
    return NextResponse.json({ publicId: result.public_id })
  } catch (err) {
    console.error("[upload-file] cloudinary error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
