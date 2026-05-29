import { describe, it, expect } from "vitest"
import { isAtLeast13 } from "@/lib/age"

describe("isAtLeast13", () => {
  it("accepts someone born exactly 13 years ago today", () => {
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 13)
    expect(isAtLeast13(dob.toISOString().split("T")[0])).toBe(true)
  })

  it("accepts someone born 20 years ago", () => {
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 20)
    expect(isAtLeast13(dob.toISOString().split("T")[0])).toBe(true)
  })

  it("rejects someone who will turn 13 tomorrow", () => {
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 13)
    dob.setDate(dob.getDate() + 1) // one day short
    expect(isAtLeast13(dob.toISOString().split("T")[0])).toBe(false)
  })

  it("rejects someone born 5 years ago", () => {
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 5)
    expect(isAtLeast13(dob.toISOString().split("T")[0])).toBe(false)
  })

  it("rejects an invalid date string", () => {
    expect(isAtLeast13("not-a-date")).toBe(false)
  })
})
