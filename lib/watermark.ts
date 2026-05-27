/**
 * Burns "Gallery | @username" diagonally across the center of an image.
 * Returns a new JPEG base64 data URL.
 */
export async function applyWatermark(dataUrl: string, username: string): Promise<string> {
  // Load image from data URL
  const imageBuffer = Buffer.from(dataUrl.split(",")[1], "base64")

  // Import canvas dynamically to support both browser and Node.js
  let CanvasModule: typeof import("canvas") | null = null
  let canvas: any

  try {
    CanvasModule = await import("canvas")
    const { createCanvas, loadImage } = CanvasModule

    const img = await loadImage(imageBuffer)
    const W = img.width
    const H = img.height

    canvas = createCanvas(W, H)
    const ctx = canvas.getContext("2d")

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

    return canvas.toDataURL("image/jpeg", 0.9)
  } catch {
    // Fallback for browser environment where canvas module is not available
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const W = img.naturalWidth || 1
        const H = img.naturalHeight || 1

        const browserCanvas = document.createElement("canvas")
        browserCanvas.width = W
        browserCanvas.height = H
        const ctx = browserCanvas.getContext("2d")!

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

        resolve(browserCanvas.toDataURL("image/jpeg", 0.9))
      }
      img.onerror = () => reject(new Error("Watermark: failed to load image"))
      img.src = dataUrl
    })
  }
}
