import { describe, it, expect } from "vitest"
import { computeShopStats } from "@/lib/shopFees"

describe("computeShopStats", () => {
  it("returns zeros for empty order list", () => {
    const result = computeShopStats([])
    expect(result).toEqual({
      totalSales: 0,
      totalRevenue: 0,
      totalFees: 0,
      totalPayout: 0,
    })
  })

  it("sums a single order correctly", () => {
    const result = computeShopStats([
      { amountTotal: 10, galleryFee: 0.8, sellerPayout: 9.2 },
    ])
    expect(result.totalSales).toBe(1)
    expect(result.totalRevenue).toBeCloseTo(10)
    expect(result.totalFees).toBeCloseTo(0.8)
    expect(result.totalPayout).toBeCloseTo(9.2)
  })

  it("sums multiple orders", () => {
    const result = computeShopStats([
      { amountTotal: 10, galleryFee: 0.8, sellerPayout: 9.2 },
      { amountTotal: 20, galleryFee: 1.6, sellerPayout: 18.4 },
    ])
    expect(result.totalSales).toBe(2)
    expect(result.totalRevenue).toBeCloseTo(30)
    expect(result.totalFees).toBeCloseTo(2.4)
    expect(result.totalPayout).toBeCloseTo(27.6)
  })
})
