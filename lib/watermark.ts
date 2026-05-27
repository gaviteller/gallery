/**
 * Burns "Gallery | @username" diagonally across the center of an image.
 * Browser-only — uses native Canvas API.
 * Returns a new JPEG base64 data URL.
 */
export function applyWatermark(dataUrl: string, username: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    // Set up handlers before setting src to catch immediate errors
    img.onload = () => {
      try {
        const W = img.naturalWidth
        const H = img.naturalHeight
        if (!W || !H) {
          reject(new Error("Watermark: image has zero dimensions"))
          return
        }

        const canvas = document.createElement("canvas")
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Watermark: failed to get canvas context"))
          return
        }

        // Draw original image
        ctx.drawImage(img, 0, 0, W, H)

        // Watermark text
        const handle = username.trim() || "gallery"
        const text = `Gallery | @${handle}`
        const fontSize = Math.max(12, Math.floor(W * 0.072))

        ctx.save()
        ctx.translate(W / 2, H / 2)
        ctx.rotate(-Math.PI / 4)
        ctx.font = `bold ${fontSize}px Arial, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.shadowColor = "rgba(0,0,0,0.7)"
        ctx.shadowBlur = 8
        ctx.globalAlpha = 0.28
        ctx.fillStyle = "#ffffff"
        ctx.fillText(text, 0, 0)
        ctx.restore()

        resolve(canvas.toDataURL("image/jpeg", 0.9))
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    img.onerror = () => reject(new Error("Watermark: failed to load image"))

    // Set src last to trigger load
    img.src = dataUrl
  })
}
