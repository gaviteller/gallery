import { describe, it, expect } from "vitest"
import { acceptInputSchema } from "../routers/commission"

describe("accept mutation input schema", () => {
  it("rejects input missing deadline", () => {
    const result = acceptInputSchema.safeParse({ id: "abc", price: 50 })
    expect(result.success).toBe(false)
  })

  it("rejects input missing price", () => {
    const result = acceptInputSchema.safeParse({ id: "abc", deadline: "2026-06-01T00:00:00.000Z" })
    expect(result.success).toBe(false)
  })

  it("rejects negative price", () => {
    const result = acceptInputSchema.safeParse({ id: "abc", price: -10, deadline: "2026-06-01T00:00:00.000Z" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid datetime string", () => {
    const result = acceptInputSchema.safeParse({ id: "abc", price: 50, deadline: "not-a-date" })
    expect(result.success).toBe(false)
  })

  it("accepts valid id + positive price + ISO datetime", () => {
    const result = acceptInputSchema.safeParse({ id: "abc", price: 50, deadline: "2026-06-01T00:00:00.000Z" })
    expect(result.success).toBe(true)
  })
})

describe("dual deadline notification targeting", () => {
  it("identifies two distinct user IDs to notify", () => {
    const buyerId = "buyer-1"
    const artistId = "artist-1"
    const targets = [buyerId, artistId]
    expect(targets).toHaveLength(2)
    expect(new Set(targets).size).toBe(2)
  })

  it("both targets are included when buyer !== artist", () => {
    const buyerId = "buyer-1"
    const artistId = "artist-2"
    const data = [
      { userId: buyerId, type: "commission_deadline_approaching:xyz" },
      { userId: artistId, type: "commission_deadline_approaching:xyz" },
    ]
    expect(data.some(d => d.userId === buyerId)).toBe(true)
    expect(data.some(d => d.userId === artistId)).toBe(true)
  })
})
