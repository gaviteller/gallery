// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest"
import { applyWatermark } from "@/lib/watermark"

// 1×1 transparent PNG as base64
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

type FakeCtx = {
  drawImage: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
  restore: ReturnType<typeof vi.fn>
  translate: ReturnType<typeof vi.fn>
  rotate: ReturnType<typeof vi.fn>
  fillText: ReturnType<typeof vi.fn>
  font: string
  textAlign: string
  textBaseline: string
  shadowColor: string
  shadowBlur: number
  globalAlpha: number
  fillStyle: string
}

/**
 * jsdom doesn't implement Image.onload for data URLs or canvas.getContext().
 * We stub both so applyWatermark runs end-to-end without native deps.
 * Returns { restore, getCtx } so tests can assert on canvas calls.
 */
function mockBrowserAPIs(): { restore: () => void; getCtx: () => FakeCtx } {
  let capturedCtx: FakeCtx | null = null

  // Image: fires onload via microtask when src is set, or onerror if triggerError is true
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

  // Canvas: getContext() returns a spy-able 2D context; toDataURL returns a valid jpeg URL
  const origCreateElement = document.createElement.bind(document)
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") {
      const ctx: FakeCtx = {
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
      capturedCtx = ctx
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

  return {
    restore: () => {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    },
    getCtx: () => {
      if (!capturedCtx) throw new Error("Canvas context was never created")
      return capturedCtx
    },
  }
}

/**
 * Like mockBrowserAPIs but the Image fires onerror instead of onload,
 * to test rejection behaviour.
 */
function mockBrowserAPIsWithImageError(): () => void {
  class BrokenImage {
    naturalWidth = 0
    naturalHeight = 0
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_value: string) {
      Promise.resolve().then(() => {
        if (typeof this.onerror === "function") this.onerror()
      })
    }
  }
  vi.stubGlobal("Image", BrokenImage)
  return () => vi.unstubAllGlobals()
}

describe("applyWatermark", () => {
  let restore: () => void

  afterEach(() => restore?.())

  it("returns a jpeg data URL", async () => {
    const mocks = mockBrowserAPIs()
    restore = mocks.restore
    const result = await applyWatermark(TINY_PNG, "artlover")
    expect(result).toMatch(/^data:image\/jpeg/)
  })

  it("draws the watermark text onto the canvas", async () => {
    const mocks = mockBrowserAPIs()
    restore = mocks.restore
    await applyWatermark(TINY_PNG, "artlover")
    const ctx = mocks.getCtx()
    // fillText must have been called with a string containing the username
    expect(ctx.fillText).toHaveBeenCalledOnce()
    const [text] = ctx.fillText.mock.calls[0] as [string, ...unknown[]]
    expect(text).toContain("@artlover")
    // canvas must have been rotated and translated for the diagonal watermark
    expect(ctx.rotate).toHaveBeenCalledOnce()
    expect(ctx.translate).toHaveBeenCalledOnce()
  })

  it("uses @gallery as fallback when username is empty", async () => {
    const mocks = mockBrowserAPIs()
    restore = mocks.restore
    await applyWatermark(TINY_PNG, "")
    const ctx = mocks.getCtx()
    const [text] = ctx.fillText.mock.calls[0] as [string, ...unknown[]]
    expect(text).toContain("@gallery")
  })

  it("rejects when the image fails to load", async () => {
    restore = mockBrowserAPIsWithImageError()
    await expect(applyWatermark(TINY_PNG, "artlover")).rejects.toThrow(
      "Watermark: failed to load image",
    )
  })
})
