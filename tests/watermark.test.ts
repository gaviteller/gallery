// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { applyWatermark } from "@/lib/watermark"

// 1×1 transparent PNG as base64
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

describe("applyWatermark", () => {
  it("returns a jpeg data URL", async () => {
    const result = await applyWatermark(TINY_PNG, "artlover")
    expect(result).toMatch(/^data:image\/jpeg/)
  })

  it("returns a different string than the input", async () => {
    const result = await applyWatermark(TINY_PNG, "artlover")
    expect(result).not.toBe(TINY_PNG)
  })

  it("uses fallback username when empty string provided", async () => {
    const result = await applyWatermark(TINY_PNG, "")
    expect(result).toMatch(/^data:image\/jpeg/)
  })
})
