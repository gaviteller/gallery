import { describe, it, expect } from "vitest"
import { decideAutomaticBan, PERMANENT_BAN_DATE } from "@/server/lib/autoBan"

const NOW = new Date("2026-10-05T12:00:00Z")
const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY)
const strike = (level: "MINOR" | "MODERATE" | "SEVERE" | "ZERO_TOLERANCE", ageDays = 0, reversed = false) =>
  ({ level, createdAt: daysAgo(ageDays), reversed })

describe("decideAutomaticBan", () => {
  it("does nothing with no strikes", () => {
    expect(decideAutomaticBan([], NOW)).toBeNull()
  })

  it("5 minor strikes in 30 days is not enough", () => {
    expect(decideAutomaticBan(Array.from({ length: 5 }, () => strike("MINOR", 1)), NOW)).toBeNull()
  })

  it("6 minor strikes in 30 days → 3-day ban", () => {
    const ban = decideAutomaticBan(Array.from({ length: 6 }, () => strike("MINOR", 1)), NOW)
    expect(ban?.bannedUntil).toEqual(new Date(NOW.getTime() + 3 * DAY))
  })

  it("minor strikes older than 30 days don't count", () => {
    const strikes = [...Array.from({ length: 5 }, () => strike("MINOR", 1)), strike("MINOR", 31)]
    expect(decideAutomaticBan(strikes, NOW)).toBeNull()
  })

  it("4 moderate strikes in 30 days → 14-day ban", () => {
    const ban = decideAutomaticBan(Array.from({ length: 4 }, () => strike("MODERATE", 2)), NOW)
    expect(ban?.bannedUntil).toEqual(new Date(NOW.getTime() + 14 * DAY))
  })

  it("1 recent severe strike → 30-day ban", () => {
    const ban = decideAutomaticBan([strike("SEVERE", 0)], NOW)
    expect(ban?.bannedUntil).toEqual(new Date(NOW.getTime() + 30 * DAY))
  })

  it("2 severe strikes ever → permanent", () => {
    const ban = decideAutomaticBan([strike("SEVERE", 400), strike("SEVERE", 0)], NOW)
    expect(ban?.bannedUntil).toEqual(PERMANENT_BAN_DATE)
  })

  it("zero tolerance → permanent", () => {
    const ban = decideAutomaticBan([strike("ZERO_TOLERANCE", 0)], NOW)
    expect(ban?.bannedUntil).toEqual(PERMANENT_BAN_DATE)
  })

  it("reversed strikes are ignored", () => {
    expect(decideAutomaticBan([strike("ZERO_TOLERANCE", 0, true)], NOW)).toBeNull()
  })

  it("picks the longest applicable ban", () => {
    const strikes = [...Array.from({ length: 6 }, () => strike("MINOR", 1)), strike("SEVERE", 0)]
    expect(decideAutomaticBan(strikes, NOW)?.bannedUntil).toEqual(new Date(NOW.getTime() + 30 * DAY))
  })
})
