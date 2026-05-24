import { describe, it, expect } from "vitest"
import { isSellingViolation, SELLING_VIOLATIONS } from "@/server/lib/strikes"

describe("isSellingViolation", () => {
  it("returns true for all selling violations", () => {
    const selling = [
      "ARTIST_CANCEL", "FAKE_DELIVERY", "FALSE_ADVERTISING",
      "BAIT_AND_SWITCH", "OFF_PLATFORM_PAYMENT", "COMMISSION_FARMING",
      "SHOP_FALSE_ADVERTISING",
    ]
    selling.forEach(v => expect(isSellingViolation(v as any)).toBe(true))
  })

  it("returns false for non-selling violations", () => {
    const nonSelling = [
      "UNLABELLED_AI", "GORE", "HARASSMENT", "HATE_SPEECH", "SPAM",
      "DMCA_VIOLATION", "FTC_DISCLOSURE", "NCMEC_VIOLATION",
      "CHARGEBACK_FRAUD", "ZERO_TOLERANCE_CONDUCT",
    ]
    nonSelling.forEach(v => expect(isSellingViolation(v as any)).toBe(false))
  })

  it("SELLING_VIOLATIONS set has 7 entries", () => {
    expect(SELLING_VIOLATIONS.size).toBe(7)
  })
})
