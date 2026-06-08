/**
 * Uploads a base64 data URL as a private file via /api/upload-file.
 * Returns the Cloudinary public_id (NOT a direct URL).
 * Store this value in ShopItem.fileUrl — generate signed URLs on demand.
 */
export async function uploadFile(base64: string, filename: string): Promise<string> {
  const res = await fetch("/api/upload-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: base64, filename }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? "File upload failed")
  }
  const data = await res.json() as { publicId: string }
  return data.publicId
}
