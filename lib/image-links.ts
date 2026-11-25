/**
 * IMAGE LINKS — makes the site light without moving any stored data.
 *
 * Pictures are still saved in the database as base64 text ("data:image/...").
 * Sending that text inside every API response made pages download megabytes
 * and nothing could be cached. So before a response leaves the server, every
 * base64 picture in it is swapped for a short link, /api/img/<hash>, which
 * serves the real image file with a one-year browser cache.
 *
 * The hash is taken from the picture itself, so the same picture always gets
 * the same link and a changed picture gets a new one. The first time a picture
 * is seen it is copied (once) into the ImageBlob table that the link reads from.
 *
 * When a saved link comes back in (e.g. a profile form re-saving the current
 * avatar), toStoredImage() turns it back into the stored base64 text, so the
 * database never holds these links and older code reading it keeps working.
 */
import { createHash } from "crypto"
import type { PrismaClient } from "@prisma/client"

const PREFIX = "/api/img/"
const SAFE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/avif"])
// Paid download files and private attachments are never turned into shareable links.
const PRIVATE_KEY = /file|attachment|delivery/i
const known = new Set<string>() // hashes already saved in ImageBlob (per server instance)

function parseDataUrl(value: string): { mime: string; base64: string } | null {
  const comma = value.indexOf(",")
  const head = value.slice(5, comma) // after "data:"
  if (comma < 0 || !head.endsWith(";base64")) return null
  const mime = head.slice(0, -7).toLowerCase()
  // Only plain raster formats; anything else (e.g. SVG, which can carry scripts) stays inline.
  if (!SAFE_TYPES.has(mime)) return null
  return { mime, base64: value.slice(comma + 1) }
}

const hashOf = (value: string) => createHash("sha1").update(value).digest("hex").slice(0, 32)

/** Swaps every base64 picture inside `data` (deeply) for its /api/img link. */
export async function linkImages<T>(prisma: PrismaClient, data: T): Promise<T> {
  const found = new Map<string, string>() // data url -> hash
  const seen = new WeakSet<object>()
  const collect = (v: unknown) => {
    if (typeof v === "string") {
      if (v.startsWith("data:image/") && !found.has(v) && parseDataUrl(v)) found.set(v, hashOf(v))
      return
    }
    if (!v || typeof v !== "object" || v instanceof Date || seen.has(v)) return
    seen.add(v)
    if (Array.isArray(v)) v.forEach(collect)
    else for (const [k, item] of Object.entries(v)) if (!PRIVATE_KEY.test(k)) collect(item)
  }
  collect(data)
  if (!found.size) return data

  // Save pictures not yet in ImageBlob (each picture only ever once).
  const unknown = [...found.entries()].filter(([, h]) => !known.has(h))
  if (unknown.length) {
    const existing = await prisma.imageBlob.findMany({ where: { hash: { in: unknown.map(([, h]) => h) } }, select: { hash: true } })
    existing.forEach((e) => known.add(e.hash))
    const missing = unknown.filter(([, h]) => !known.has(h))
    if (missing.length) {
      const rows = missing.flatMap(([url, hash]) => {
        const parsed = parseDataUrl(url)
        return parsed ? [{ hash, mime: parsed.mime, data: Buffer.from(parsed.base64, "base64") }] : []
      })
      await prisma.imageBlob.createMany({ data: rows, skipDuplicates: true })
      rows.forEach((r) => known.add(r.hash))
    }
  }

  const replace = (v: unknown): unknown => {
    if (typeof v === "string") {
      const hash = found.get(v)
      return hash && known.has(hash) ? PREFIX + hash : v
    }
    if (!v || typeof v !== "object" || v instanceof Date) return v
    if (Array.isArray(v)) return v.map(replace)
    if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) return v
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, PRIVATE_KEY.test(k) ? x : replace(x)]))
  }
  return replace(data) as T
}

/** Turns an /api/img link back into the stored base64 picture (anything else passes through). */
export async function toStoredImage<T extends string | null | undefined>(prisma: PrismaClient, value: T): Promise<T> {
  if (typeof value !== "string") return value
  const at = value.indexOf(PREFIX)
  if (at < 0) return value
  const hash = value.slice(at + PREFIX.length).split(/[?#/]/)[0]
  const blob = await prisma.imageBlob.findUnique({ where: { hash } })
  if (!blob) return value
  return `data:${blob.mime};base64,${Buffer.from(blob.data).toString("base64")}` as T
}
