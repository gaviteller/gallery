/**
 * STRIKE CATEGORIES.
 * "Selling" violations are ones tied to commissions/shop (as opposed to content
 * violations like NSFW posts). They're grouped so selling privileges can be
 * restricted separately from posting privileges.
 */
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

/** True if this strike type is a commission/shop (selling) violation. */
export function isSellingViolation(violation: StrikeViolation): boolean {
  return SELLING_VIOLATIONS.has(violation)
}
