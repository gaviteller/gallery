import { describe, it, expect } from "vitest"
import { computeTier, TIER_LABELS, TIER_COLORS, type TrustTier } from "@/server/lib/trustScore"

describe("computeTier", () => {
  it("returns suspended when isSuspended is true regardless of score", () => {
    expect(computeTier(4.9, true, true)).toBe("suspended")
    expect(computeTier(null, false, true)).toBe("suspended")
  })

  it("returns new_artist when hasScore is false", () => {
    expect(computeTier(null, false, false)).toBe("new_artist")
  })

  it("returns new_artist when finalScore is null even if hasScore is true", () => {
    expect(computeTier(null, true, false)).toBe("new_artist")
  })

  it("returns excellent for scores 4.5 to 5.0", () => {
    expect(computeTier(5.0, true, false)).toBe("excellent")
    expect(computeTier(4.5, true, false)).toBe("excellent")
    expect(computeTier(4.7, true, false)).toBe("excellent")
  })

  it("returns good for scores 3.5 to 4.4", () => {
    expect(computeTier(4.4, true, false)).toBe("good")
    expect(computeTier(3.5, true, false)).toBe("good")
    expect(computeTier(3.8, true, false)).toBe("good")
  })

  it("returns fair for scores 2.5 to 3.4", () => {
    expect(computeTier(3.4, true, false)).toBe("fair")
    expect(computeTier(2.5, true, false)).toBe("fair")
    expect(computeTier(3.0, true, false)).toBe("fair")
  })

  it("returns poor for scores 1.0 to 2.4", () => {
    expect(computeTier(2.4, true, false)).toBe("poor")
    expect(computeTier(1.0, true, false)).toBe("poor")
    expect(computeTier(1.5, true, false)).toBe("poor")
  })

  it("TIER_LABELS has an entry for every tier", () => {
    const tiers: TrustTier[] = ["excellent", "good", "fair", "poor", "new_artist", "suspended"]
    tiers.forEach(t => expect(TIER_LABELS[t]).toBeTruthy())
  })

  it("TIER_COLORS has an entry for every tier", () => {
    const tiers: TrustTier[] = ["excellent", "good", "fair", "poor", "new_artist", "suspended"]
    tiers.forEach(t => expect(TIER_COLORS[t]).toBeTruthy())
  })
})
