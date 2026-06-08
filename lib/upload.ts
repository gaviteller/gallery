/**
 * Uploads a base64 data URL to Cloudinary via the /api/upload route.
 * Returns the Cloudinary HTTPS URL.
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
