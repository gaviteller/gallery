/**
 * Sends an image (base64 data URL) to the /api/upload route and returns the URL to save.
 *
 * Right now /api/upload only validates the image (logged in, not banned, ≤10 MB) and
 * returns it unchanged, so images are stored as base64 inside the database.
 * When Cloudinary is set up, only app/api/upload/route.ts needs to change — it will
 * upload the file and return a Cloudinary URL instead; callers stay the same.
 * Plan: docs/superpowers/plans/2026-06-05-cloudinary-image-storage.md
 */
export async function uploadImage(base64: string, folder: "posts" | "avatars" | "banners" | "stories" | "commissions" | "shop-previews"): Promise<string> {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, folder }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? "Image upload failed")
  }

  const data = await res.json() as { url: string }
  return data.url
}
