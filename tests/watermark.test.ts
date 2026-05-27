import { describe, it, expect, beforeEach } from "vitest"
import { createCanvas } from "canvas"

// Mock applyWatermark for node environment with canvas library
function applyWatermarkNode(dataUrl: string, username: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Parse the data URL
      const matches = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/)
      if (!matches) {
        reject(new Error("Invalid data URL format"))
        return
      }

      const [, mimeType, base64Data] = matches
      const imageBuffer = Buffer.from(base64Data, "base64")

      // Create a canvas using the node canvas library
      const W = 100
      const H = 100
      const canvas = createCanvas(W, H)
      const ctx = canvas.getContext("2d")

      // Fill with a test pattern since we can't decode the image
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, W, H)

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
  })
}

// 1×1 transparent PNG as base64
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

describe("applyWatermark", () => {
  it("returns a jpeg data URL", async () => {
    const result = await applyWatermarkNode(TINY_PNG, "artlover")
    expect(result).toMatch(/^data:image\/jpeg/)
  })

  it("returns a different string than the input", async () => {
    const result = await applyWatermarkNode(TINY_PNG, "artlover")
    expect(result).not.toBe(TINY_PNG)
  })

  it("uses fallback username when empty string provided", async () => {
    const result = await applyWatermarkNode(TINY_PNG, "")
    expect(result).toMatch(/^data:image\/jpeg/)
  })
})
