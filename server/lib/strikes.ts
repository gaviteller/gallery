import type { StrikeViolation } from "@prisma/client"

export const SELLING_VIOLATIONS = new Set<StrikeViolation>([
  "ARTIST_CANCEL",
  "FAKE_DELIVERY",
  "FALSE_ADVERTISING",
  "BAIT_AND_SWITCH",
  "OFF_PLATFORM_PAYMENT",
  "COMMISSION_FARMING",
  "SHOP_FALSE_ADVERTISING",
])

export function isSellingViolation(violation: StrikeViolation): boolean {
  return SELLING_VIOLATIONS.has(violation)
}
