/**
 * GET /api/img/<hash> — one picture as a real image file (see lib/image-links.ts).
 * The link changes whenever the picture changes, so browsers may cache it for a year.
 */
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params
  if (!/^[a-f0-9]{32}$/.test(hash)) return new Response("Not found", { status: 404 })
  const blob = await prisma.imageBlob.findUnique({ where: { hash } })
  if (!blob) return new Response("Not found", { status: 404 })
  return new Response(new Uint8Array(blob.data), {
    headers: {
      "Content-Type": blob.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
