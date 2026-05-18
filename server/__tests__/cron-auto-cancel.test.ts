import { describe, it, expect } from "vitest"

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

function isStaleRequest(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= THREE_DAYS_MS
}

describe("auto-cancel staleness check", () => {
  it("returns false for a commission created 2 days ago", () => {
    const now = new Date("2026-06-10T00:00:00Z")
    const createdAt = new Date("2026-06-08T01:00:00Z")
    expect(isStaleRequest(createdAt, now)).toBe(false)
  })

  it("returns true for a commission created exactly 3 days ago", () => {
    const now = new Date("2026-06-10T00:00:00Z")
    const createdAt = new Date("2026-06-07T00:00:00Z")
    expect(isStaleRequest(createdAt, now)).toBe(true)
  })

  it("returns true for a commission created 5 days ago", () => {
    const now = new Date("2026-06-10T00:00:00Z")
    const createdAt = new Date("2026-06-05T00:00:00Z")
    expect(isStaleRequest(createdAt, now)).toBe(true)
  })
})
