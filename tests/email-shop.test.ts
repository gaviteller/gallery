import { describe, it, expect, vi } from "vitest"

// Mock resend before importing email module
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
  })),
}))

describe("shop email functions", () => {
  it("sendShopPurchaseEmail exports as a function", async () => {
    const { sendShopPurchaseEmail } = await import("../lib/email")
    expect(typeof sendShopPurchaseEmail).toBe("function")
  })

  it("sendShopSaleEmail exports as a function", async () => {
    const { sendShopSaleEmail } = await import("../lib/email")
    expect(typeof sendShopSaleEmail).toBe("function")
  })

  it("sendShopPurchaseEmail returns without throwing for valid input", async () => {
    const { sendShopPurchaseEmail } = await import("../lib/email")
    await expect(
      sendShopPurchaseEmail({
        to: "buyer@example.com",
        buyerName: "Alice",
        itemTitle: "Cozy Cat Procreate Brush",
        sellerUsername: "artist123",
        downloadUrl: "https://gallery.example.com/api/shop/download/tok_abc123",
        amountPaid: 9.99,
      })
    ).resolves.not.toThrow()
  })

  it("sendShopSaleEmail returns without throwing for valid input", async () => {
    const { sendShopSaleEmail } = await import("../lib/email")
    await expect(
      sendShopSaleEmail({
        to: "artist@example.com",
        artistName: "Bob",
        itemTitle: "Cozy Cat Procreate Brush",
        buyerUsername: "alice",
        sellerPayout: 9.19,
      })
    ).resolves.not.toThrow()
  })
})
