import { describe, it, expect } from "vitest"
import { z } from "zod"

// Mirror the updated schema (deadline is now required)
const acceptSchema = z.object({
  id: z.string(),
  price: z.number().positive(),
  deadline: z.string().datetime(),
})

describe("accept mutation input schema", () => {
  it("rejects input missing deadline", () => {
    const result = acceptSchema.safeParse({ id: "abc", price: 50 })
    expect(result.success).toBe(false)
  })

  it("rejects input missing price", () => {
    const result = acceptSchema.safeParse({ id: "abc", deadline: "2026-06-01T00:00:00.000Z" })
    expect(result.success).toBe(false)
  })

  it("rejects negative price", () => {
    const result = acceptSchema.safeParse({ id: "abc", price: -10, deadline: "2026-06-01T00:00:00.000Z" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid datetime string", () => {
    const result = acceptSchema.safeParse({ id: "abc", price: 50, deadline: "not-a-date" })
    expect(result.success).toBe(false)
  })

  it("accepts valid id + positive price + ISO datetime", () => {
    const result = acceptSchema.safeParse({ id: "abc", price: 50, deadline: "2026-06-01T00:00:00.000Z" })
    expect(result.success).toBe(true)
  })
})
