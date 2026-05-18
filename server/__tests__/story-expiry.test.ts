import { describe, it, expect } from "vitest"

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

function getExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + TWENTY_FOUR_HOURS_MS)
}

function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt <= now
}

describe("story expiry", () => {
  it("expires 24 hours after creation", () => {
    const createdAt = new Date("2026-06-01T10:00:00Z")
    const expiresAt = getExpiresAt(createdAt)
    expect(expiresAt.toISOString()).toBe("2026-06-02T10:00:00.000Z")
  })

  it("is not expired 23 hours after creation", () => {
    const createdAt = new Date("2026-06-01T10:00:00Z")
    const expiresAt = getExpiresAt(createdAt)
    const now = new Date("2026-06-02T09:00:00Z")
    expect(isExpired(expiresAt, now)).toBe(false)
  })

  it("is expired exactly 24 hours after creation", () => {
    const createdAt = new Date("2026-06-01T10:00:00Z")
    const expiresAt = getExpiresAt(createdAt)
    const now = new Date("2026-06-02T10:00:00Z")
    expect(isExpired(expiresAt, now)).toBe(true)
  })
})
