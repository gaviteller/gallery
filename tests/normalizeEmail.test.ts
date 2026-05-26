import { describe, it, expect } from "vitest"
import { normalizeEmail } from "@/lib/normalizeEmail"

describe("normalizeEmail", () => {
  it("strips + alias and dots from gmail address", () => {
    expect(normalizeEmail("user+alt@gmail.com")).toBe("user@gmail.com")
  })

  it("lowercases and removes dots from local part", () => {
    expect(normalizeEmail("User.Name@gmail.com")).toBe("username@gmail.com")
  })

  it("does not strip dots from domain", () => {
    expect(normalizeEmail("test@yahoo.com")).toBe("test@yahoo.com")
  })

  it("handles combined dots and + alias", () => {
    expect(normalizeEmail("u.s.e.r+tag@gmail.com")).toBe("user@gmail.com")
  })

  it("lowercases domain", () => {
    expect(normalizeEmail("Test@EXAMPLE.COM")).toBe("test@example.com")
  })
})
