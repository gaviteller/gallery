import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { v2 as cloudinary } from "cloudinary"

export const runtime = "nodejs"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const order = await prisma.shopOrder.findUnique({
    where: { downloadToken: token },
    include: { item: { select: { fileUrl: true, title: true } } },
  })

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (order.status !== "PURCHASED") {
    return NextResponse.json({ error: "Order not eligible for download" }, { status: 403 })
  }

  if (!order.item.fileUrl) {
    return NextResponse.json({ error: "No file attached to this item" }, { status: 404 })
  }

  // Mark first download time (informational only; link stays valid)
  if (!order.downloadedAt) {
    await prisma.shopOrder.update({
      where: { id: order.id },
      data: { downloadedAt: new Date() },
    }).catch(() => {}) // non-critical
  }

  // Generate 24h signed URL for the private Cloudinary file.
  // order.item.fileUrl stores the public_id (set during upload in app/api/upload-file/route.ts)
  let signedUrl: string
  try {
    signedUrl = cloudinary.utils.private_download_url(order.item.fileUrl, "", {
      resource_type: "raw",
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
      attachment: true, // triggers browser download instead of inline display
    })
  } catch (err) {
    console.error("Failed to generate signed download URL:", err)
    return NextResponse.json({ error: "Download unavailable" }, { status: 500 })
  }

  return NextResponse.redirect(signedUrl)
}
