import { describe, it, expect } from "vitest"
import { isWithin15Days } from "@/lib/removal"

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000

describe("isWithin15Days", () => {
  it("returns true for a post removed 1 day ago", () => {
    const removedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    expect(isWithin15Days(removedAt)).toBe(true)
  })

  it("returns true for a post removed exactly 14 days ago", () => {
    const removedAt = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    expect(isWithin15Days(removedAt)).toBe(true)
  })

  it("returns false for a post removed 15 days ago", () => {
    const removedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 - 1000)
    expect(isWithin15Days(removedAt)).toBe(false)
  })

  it("returns false for a post removed 30 days ago", () => {
    const removedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    expect(isWithin15Days(removedAt)).toBe(false)
  })

  it("returns false for null removedAt", () => {
    expect(isWithin15Days(null)).toBe(false)
  })
})
