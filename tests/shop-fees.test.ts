import { describe, it, expect } from "vitest"
import { calculateFee } from "../lib/shopFees"

describe("calculateFee", () => {
  it("calculates 8% gallery fee and seller payout for $10.00", () => {
    const result = calculateFee(10.00)
    expect(result.galleryFee).toBeCloseTo(0.80, 2)
    expect(result.sellerPayout).toBeCloseTo(9.20, 2)
    expect(result.totalCents).toBe(1000)
    expect(result.galleryFeeCents).toBe(80)
    expect(result.sellerPayoutCents).toBe(920)
  })

  it("rounds cents correctly for $3.99", () => {
    const result = calculateFee(3.99)
    expect(result.totalCents).toBe(399)
    expect(result.galleryFeeCents).toBe(32) // floor(399 * 0.08) = 31.92 → 32
    expect(result.sellerPayoutCents).toBe(367) // 399 - 32 = 367
    expect(result.galleryFeeCents + result.sellerPayoutCents).toBe(result.totalCents)
  })

  it("galleryFeeCents + sellerPayoutCents always equals totalCents", () => {
    const prices = [0.99, 1.50, 9.99, 25.00, 99.99, 249.99]
    for (const price of prices) {
      const result = calculateFee(price)
      expect(result.galleryFeeCents + result.sellerPayoutCents).toBe(result.totalCents)
    }
  })

  it("returns float representations consistent with cents", () => {
    const result = calculateFee(5.00)
    expect(result.galleryFee).toBe(result.galleryFeeCents / 100)
    expect(result.sellerPayout).toBe(result.sellerPayoutCents / 100)
  })
})
