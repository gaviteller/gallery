import { describe, it, expect } from "vitest"

// Pure logic functions extracted from what we'll put in the router
function computeTrustScore(commissions: Array<{
  status: string
  buyerRating: number | null
  cancelledBy: string | null
}>) {
  const completed = commissions.filter(c => c.status === "COMPLETE")
  const completedCount = completed.length

  const ratings = completed.filter(c => c.buyerRating !== null).map(c => c.buyerRating as number)
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null

  const accepted = commissions.filter(c => !["PENDING", "DECLINED"].includes(c.status))
  const artistCancels = accepted.filter(c => c.cancelledBy === "artist").length
  const cancelRate = accepted.length > 0
    ? Math.round((artistCancels / accepted.length) * 100)
    : 0

  return { completedCount, avgRating, cancelRate, ratingCount: ratings.length }
}

describe("computeTrustScore", () => {
  it("returns null avgRating with no ratings", () => {
    const result = computeTrustScore([
      { status: "COMPLETE", buyerRating: null, cancelledBy: null },
    ])
    expect(result.avgRating).toBeNull()
    expect(result.completedCount).toBe(1)
  })

  it("averages ratings correctly", () => {
    const result = computeTrustScore([
      { status: "COMPLETE", buyerRating: 5, cancelledBy: null },
      { status: "COMPLETE", buyerRating: 4, cancelledBy: null },
      { status: "COMPLETE", buyerRating: 3, cancelledBy: null },
    ])
    expect(result.avgRating).toBe(4.0)
    expect(result.ratingCount).toBe(3)
  })

  it("rounds to 1 decimal place", () => {
    const result = computeTrustScore([
      { status: "COMPLETE", buyerRating: 5, cancelledBy: null },
      { status: "COMPLETE", buyerRating: 4, cancelledBy: null },
    ])
    expect(result.avgRating).toBe(4.5)
  })

  it("calculates cancel rate as percentage", () => {
    const result = computeTrustScore([
      { status: "IN_PROGRESS", buyerRating: null, cancelledBy: null },
      { status: "CANCELLED", buyerRating: null, cancelledBy: "artist" },
      { status: "COMPLETE", buyerRating: 5, cancelledBy: null },
    ])
    // 1 artist cancel out of 3 accepted = 33%
    expect(result.cancelRate).toBe(33)
  })

  it("0 cancel rate with no cancellations", () => {
    const result = computeTrustScore([
      { status: "COMPLETE", buyerRating: 5, cancelledBy: null },
      { status: "COMPLETE", buyerRating: 4, cancelledBy: null },
    ])
    expect(result.cancelRate).toBe(0)
  })

  it("returns completedCount 0 with no completed commissions", () => {
    const result = computeTrustScore([])
    expect(result.completedCount).toBe(0)
    expect(result.avgRating).toBeNull()
  })
})

describe("flagRating eligibility", () => {
  function canFlagRating(commission: {
    status: string
    buyerRating: number | null
    ratingFlagged: boolean
  }, role: "artist" | "buyer"): boolean {
    if (role !== "artist") return false
    if (commission.status !== "COMPLETE") return false
    if (commission.buyerRating === null) return false
    if (commission.ratingFlagged) return false
    return true
  }

  it("artist can flag a completed, rated, unflagged commission", () => {
    expect(canFlagRating({ status: "COMPLETE", buyerRating: 1, ratingFlagged: false }, "artist")).toBe(true)
  })

  it("buyer cannot flag", () => {
    expect(canFlagRating({ status: "COMPLETE", buyerRating: 1, ratingFlagged: false }, "buyer")).toBe(false)
  })

  it("cannot flag already flagged", () => {
    expect(canFlagRating({ status: "COMPLETE", buyerRating: 1, ratingFlagged: true }, "artist")).toBe(false)
  })

  it("cannot flag if no rating yet", () => {
    expect(canFlagRating({ status: "COMPLETE", buyerRating: null, ratingFlagged: false }, "artist")).toBe(false)
  })
})
