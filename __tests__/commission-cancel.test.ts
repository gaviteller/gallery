// __tests__/commission-cancel.test.ts
import { describe, it, expect } from "vitest"

// These tests verify business logic functions we'll extract from the router

describe("cancellation business rules", () => {
  type Stage = "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "DELIVERED" | "COMPLETE" | "CANCELLED" | "DISPUTED"

  function canCancel(status: Stage, role: "artist" | "buyer"): { allowed: boolean; hasConsequences: boolean } {
    if (["COMPLETE", "CANCELLED", "DISPUTED"].includes(status)) {
      return { allowed: false, hasConsequences: false }
    }
    if (status === "DELIVERED") {
      return { allowed: false, hasConsequences: false } // dispute only
    }
    const isPaid = status === "IN_PROGRESS"
    return { allowed: true, hasConsequences: isPaid }
  }

  it("artist can cancel PENDING — no consequences", () => {
    expect(canCancel("PENDING", "artist")).toEqual({ allowed: true, hasConsequences: false })
  })

  it("artist can cancel ACCEPTED — no consequences", () => {
    expect(canCancel("ACCEPTED", "artist")).toEqual({ allowed: true, hasConsequences: false })
  })

  it("artist can cancel IN_PROGRESS — with consequences (strike)", () => {
    expect(canCancel("IN_PROGRESS", "artist")).toEqual({ allowed: true, hasConsequences: true })
  })

  it("buyer can cancel IN_PROGRESS — with consequences (cancellation count)", () => {
    expect(canCancel("IN_PROGRESS", "buyer")).toEqual({ allowed: true, hasConsequences: true })
  })

  it("cannot cancel DELIVERED", () => {
    expect(canCancel("DELIVERED", "buyer")).toEqual({ allowed: false, hasConsequences: false })
  })

  it("cannot cancel COMPLETE", () => {
    expect(canCancel("COMPLETE", "buyer")).toEqual({ allowed: false, hasConsequences: false })
  })

  it("cannot cancel DISPUTED", () => {
    expect(canCancel("DISPUTED", "buyer")).toEqual({ allowed: false, hasConsequences: false })
  })
})

describe("dispute eligibility", () => {
  type Stage = "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "DELIVERED" | "COMPLETE" | "CANCELLED" | "DISPUTED"

  function canDispute(status: Stage, role: "artist" | "buyer"): boolean {
    return status === "DELIVERED" && role === "buyer"
  }

  it("buyer can dispute DELIVERED", () => {
    expect(canDispute("DELIVERED", "buyer")).toBe(true)
  })

  it("artist cannot dispute", () => {
    expect(canDispute("DELIVERED", "artist")).toBe(false)
  })

  it("cannot dispute IN_PROGRESS", () => {
    expect(canDispute("IN_PROGRESS", "buyer")).toBe(false)
  })
})
