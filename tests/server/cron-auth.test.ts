import { describe, it, expect, afterEach } from "vitest"
import { isAuthorizedCronRequest } from "@/lib/cron"

const requestWith = (authorization?: string) =>
  new Request("https://gallery.test/api/cron/auto-cancel", { headers: authorization ? { authorization } : {} })

afterEach(() => { delete process.env.CRON_SECRET })

describe("isAuthorizedCronRequest", () => {
  it("accepts the configured secret", () => {
    process.env.CRON_SECRET = "s3cret"
    expect(isAuthorizedCronRequest(requestWith("Bearer s3cret"))).toBe(true)
  })

  it("rejects a wrong or missing header", () => {
    process.env.CRON_SECRET = "s3cret"
    expect(isAuthorizedCronRequest(requestWith("Bearer nope"))).toBe(false)
    expect(isAuthorizedCronRequest(requestWith())).toBe(false)
  })

  it("rejects everything when CRON_SECRET isn't set (no 'Bearer undefined' loophole)", () => {
    expect(isAuthorizedCronRequest(requestWith("Bearer undefined"))).toBe(false)
  })
})
