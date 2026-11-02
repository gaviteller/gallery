import { describe, it, expect, vi, beforeEach } from "vitest"
import { createCallerFactory } from "@/lib/trpc"
import { appRouter } from "@/server/routers/_app"

vi.mock("@/lib/ai-scan", () => ({ scanShopItem: vi.fn().mockResolvedValue(undefined), scanPost: vi.fn(), scanComment: vi.fn(), scanAvatar: vi.fn() }))
const checkoutCreate = vi.fn().mockResolvedValue({ url: "https://checkout.stripe.test/x" })
vi.mock("@/lib/stripe", () => ({ stripe: { checkout: { sessions: { create: (...args: unknown[]) => checkoutCreate(...args) } } } }))
import { scanShopItem } from "@/lib/ai-scan"

const createCaller = createCallerFactory(appRouter)
const db = {
  user: { findUnique: vi.fn().mockResolvedValue({ bannedUntil: null }) },
  shopItem: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn().mockResolvedValue({ id: "i1" }) },
}
const asViewer = (id: string | null) => createCaller({ session: id ? ({ user: { id } } as never) : null, prisma: db as never })

beforeEach(() => vi.clearAllMocks())

describe("shop.getById visibility", () => {
  it("hides removed / under-review / paused listings from other people", async () => {
    for (const status of ["REMOVED", "PENDING_REVIEW", "PAUSED"]) {
      db.shopItem.findUnique.mockResolvedValueOnce({ id: "i1", userId: "seller", status })
      await expect(asViewer("buyer").shop.getById({ id: "i1" })).rejects.toThrow()
    }
  })
  it("the seller can still open their own hidden listing", async () => {
    db.shopItem.findUnique.mockResolvedValueOnce({ id: "i1", userId: "seller", status: "PENDING_REVIEW" })
    await expect(asViewer("seller").shop.getById({ id: "i1" })).resolves.toBeTruthy()
  })
})

describe("shop.update", () => {
  it("re-runs the AI scan when the preview image changes", async () => {
    db.shopItem.findUnique.mockResolvedValueOnce({ userId: "seller", status: "ACTIVE" })
    await asViewer("seller").shop.update({ id: "i1", image: "data:image/png;base64,new" })
    expect(scanShopItem).toHaveBeenCalledWith(db, "i1", "seller", "data:image/png;base64,new")
  })
  it("doesn't scan when only text changes", async () => {
    db.shopItem.findUnique.mockResolvedValueOnce({ userId: "seller", status: "ACTIVE" })
    await asViewer("seller").shop.update({ id: "i1", title: "New title" })
    expect(scanShopItem).not.toHaveBeenCalled()
  })
})

describe("shop.togglePause", () => {
  it("can't re-activate a listing moderation removed or is reviewing", async () => {
    for (const status of ["REMOVED", "PENDING_REVIEW"]) {
      db.shopItem.findUnique.mockResolvedValueOnce({ userId: "seller", status })
      await expect(asViewer("seller").shop.togglePause({ id: "i1" })).rejects.toThrow("under moderation")
    }
    expect(db.shopItem.update).not.toHaveBeenCalled()
  })
  it("still pauses and unpauses normally", async () => {
    db.shopItem.findUnique.mockResolvedValueOnce({ userId: "seller", status: "ACTIVE" })
    await asViewer("seller").shop.togglePause({ id: "i1" })
    expect(db.shopItem.update).toHaveBeenLastCalledWith({ where: { id: "i1" }, data: { status: "PAUSED" } })
  })
})

describe("checkout product images", () => {
  it("only sends Stripe web-link images, not inline base64 data", async () => {
    db.shopItem.findUnique.mockResolvedValueOnce({
      id: "i1", userId: "seller", title: "Print", image: "data:image/png;base64,AAAA", price: 10, status: "ACTIVE",
      user: { stripeConnectId: "acct_1", username: "seller" },
    })
    await asViewer("buyer").shop.createCheckout({ itemId: "i1" })
    expect(checkoutCreate.mock.calls[0][0].line_items[0].price_data.product_data.images).toBeUndefined()
  })
})
