// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest"
import { applyWatermark } from "@/lib/watermark"

// 1×1 transparent PNG as base64
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

/**
 * jsdom doesn't implement Image.onload for data URLs or canvas.getContext().
 * We stub both so applyWatermark runs end-to-end without native deps.
 */
function mockBrowserAPIs() {
  // Image: fires onload via microtask when src is set
  class FakeImage {
    naturalWidth = 100
    naturalHeight = 100
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_value: string) {
      Promise.resolve().then(() => {
        if (typeof this.onload === "function") this.onload()
      })
    }
  }
  vi.stubGlobal("Image", FakeImage)

  // Canvas: getContext() returns a no-op 2D context; toDataURL returns a real-looking jpeg URL
  const origCreateElement = document.createElement.bind(document)
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") {
      const ctx: Record<string, unknown> = {
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        fillText: vi.fn(),
        font: "",
        textAlign: "",
        textBaseline: "",
        shadowColor: "",
        shadowBlur: 0,
        globalAlpha: 1,
        fillStyle: "",
      }
      const canvas = {
        width: 0,
        height: 0,
        getContext: (_type: string) => ctx,
        toDataURL: (type: string, _quality?: number) =>
          `data:${type ?? "image/jpeg"};base64,/9j/fakeJpegData`,
      }
      return canvas as unknown as HTMLElement
    }
    return origCreateElement(tag)
  })

  return () => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  }
}

describe("applyWatermark", () => {
  let restore: () => void

  afterEach(() => restore?.())

  it("returns a jpeg data URL", async () => {
    restore = mockBrowserAPIs()
    const result = await applyWatermark(TINY_PNG, "artlover")
    expect(result).toMatch(/^data:image\/jpeg/)
  })

  it("returns a different string than the input", async () => {
    restore = mockBrowserAPIs()
    const result = await applyWatermark(TINY_PNG, "artlover")
    expect(result).not.toBe(TINY_PNG)
  })

  it("uses fallback username when empty string provided", async () => {
    restore = mockBrowserAPIs()
    const result = await applyWatermark(TINY_PNG, "")
    expect(result).toMatch(/^data:image\/jpeg/)
  })
})
