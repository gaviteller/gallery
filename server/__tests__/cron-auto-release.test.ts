import { describe, it, expect } from "vitest"

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000

function isStaleDelivery(deliveredAt: Date, now: Date): boolean {
  return now.getTime() - deliveredAt.getTime() >= FIVE_DAYS_MS
}

describe("auto-release staleness check", () => {
  it("returns false for a commission delivered 4 days ago", () => {
    const now = new Date("2026-06-10T00:00:00Z")
    const deliveredAt = new Date("2026-06-06T01:00:00Z")
    expect(isStaleDelivery(deliveredAt, now)).toBe(false)
  })

  it("returns true for a commission delivered exactly 5 days ago", () => {
    const now = new Date("2026-06-10T00:00:00Z")
    const deliveredAt = new Date("2026-06-05T00:00:00Z")
    expect(isStaleDelivery(deliveredAt, now)).toBe(true)
  })

  it("returns true for a commission delivered 7 days ago", () => {
    const now = new Date("2026-06-10T00:00:00Z")
    const deliveredAt = new Date("2026-06-03T00:00:00Z")
    expect(isStaleDelivery(deliveredAt, now)).toBe(true)
  })
})
