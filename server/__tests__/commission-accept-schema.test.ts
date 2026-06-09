import { describe, it, expect } from "vitest"
import { acceptInputSchema } from "../routers/commission"

describe("accept mutation input schema", () => {
  it("rejects input missing deadline", () => {
    const result = acceptInputSchema.safeParse({ id: "abc", price: 50 })
    expect(result.success).toBe(false)
  })

  it("rejects input missing price", () => {
    const result = acceptInputSchema.safeParse({ id: "abc", deadline: "2027-01-01T00:00:00.000Z" })
    expect(result.success).toBe(false)
  })

  it("rejects negative price", () => {
    const result = acceptInputSchema.safeParse({ id: "abc", price: -10, deadline: "2027-01-01T00:00:00.000Z" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid datetime string", () => {
    const result = acceptInputSchema.safeParse({ id: "abc", price: 50, deadline: "not-a-date" })
    expect(result.success).toBe(false)
  })

  it("accepts valid id + positive price + ISO datetime", () => {
    const result = acceptInputSchema.safeParse({ id: "abc", price: 50, deadline: "2027-01-01T00:00:00.000Z" })
    expect(result.success).toBe(true)
  })

  it("rejects a past deadline", () => {
    const result = acceptInputSchema.safeParse({ id: "abc", price: 50, deadline: "2020-01-01T00:00:00.000Z" })
    expect(result.success).toBe(false)
  })
})
