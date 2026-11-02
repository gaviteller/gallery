import { describe, it, expect, vi, beforeEach } from "vitest"
import { createCallerFactory } from "@/lib/trpc"
import { appRouter } from "@/server/routers/_app"

vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(actual).map((key) => [key, vi.fn().mockResolvedValue(undefined)]))
})
vi.mock("@/server/lib/autoBan", () => ({ applyAutomaticBan: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/lib/ai-scan", () => ({ scanPost: vi.fn().mockResolvedValue(undefined), scanShopItem: vi.fn(), scanComment: vi.fn(), scanAvatar: vi.fn() }))
import { applyAutomaticBan } from "@/server/lib/autoBan"
import { scanPost } from "@/lib/ai-scan"

const createCaller = createCallerFactory(appRouter)
const tx = {
  commission: { update: vi.fn(), count: vi.fn().mockResolvedValue(1) },
  strike: { create: vi.fn() },
  user: { update: vi.fn() },
  notification: { create: vi.fn() },
  professionalMessage: { create: vi.fn() },
}
const db = {
  user: { findUnique: vi.fn() },
  commission: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  block: { findFirst: vi.fn().mockResolvedValue(null) },
  post: { create: vi.fn() },
  $transaction: vi.fn(),
}
const asViewer = (id: string) => createCaller({ session: { user: { id } } as never, prisma: db as never })

beforeEach(() => {
  vi.clearAllMocks()
  db.$transaction.mockImplementation(async (arg: unknown) => (typeof arg === "function" ? (arg as (t: typeof tx) => unknown)(tx) : Promise.all(arg as unknown[])))
})

describe("commission.cancel", () => {
  it("artist cancelling a PAID commission gets a Minor ARTIST_CANCEL strike and an auto-ban check", async () => {
    db.user.findUnique.mockResolvedValue({ bannedUntil: null, email: null, username: "buyer" })
    db.commission.findUnique.mockResolvedValue({ id: "c1", artistId: "artist", buyerId: "buyer", status: "IN_PROGRESS" })
    await asViewer("artist").commission.cancel({ id: "c1" })
    expect(tx.strike.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "artist", level: "MINOR", violation: "ARTIST_CANCEL", isSelling: true }) })
    expect(applyAutomaticBan).toHaveBeenCalledWith(db, "artist")
  })

  it("no strike when the artist cancels before payment, or when the buyer cancels", async () => {
    db.user.findUnique.mockResolvedValue({ bannedUntil: null, email: null, username: "x" })
    db.commission.findUnique.mockResolvedValueOnce({ id: "c1", artistId: "artist", buyerId: "buyer", status: "ACCEPTED" })
    await asViewer("artist").commission.cancel({ id: "c1" })
    db.commission.findUnique.mockResolvedValueOnce({ id: "c1", artistId: "artist", buyerId: "buyer", status: "IN_PROGRESS" })
    await asViewer("buyer").commission.cancel({ id: "c1" })
    expect(tx.strike.create).not.toHaveBeenCalled()
    expect(applyAutomaticBan).not.toHaveBeenCalled()
  })
})

describe("commission.submitRequest", () => {
  it("refuses requests to a currently banned artist", async () => {
    db.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "buyer"
        ? { bannedUntil: null }
        : { commissionStatus: "OPEN", sellingEnabled: true, commissionFeatureDisabled: false, bannedUntil: new Date(Date.now() + 86_400_000) })
    await expect(
      asViewer("buyer").commission.submitRequest({ artistId: "artist", description: "A dragon", dropdownSelections: {} }),
    ).rejects.toThrow("not accepting commissions")
    expect(db.commission.create).not.toHaveBeenCalled()
  })
})

describe("commission.shareToFeed", () => {
  it("AI-scans the delivered image once it becomes a public post", async () => {
    db.commission.findUnique.mockResolvedValue({ artistId: "artist", displayAsExample: true, artistFeedShareOffered: false, messages: [{ fileUrl: "https://files.test/art.png" }] })
    db.post.create.mockResolvedValue({ id: "post1" })
    db.commission.update.mockResolvedValue({})
    await asViewer("artist").commission.shareToFeed({ id: "c1" })
    expect(scanPost).toHaveBeenCalledWith(db, "post1", "artist", "https://files.test/art.png")
  })
})

describe("removed endpoints", () => {
  it("getCompletedWork (ignored buyers' display permission) no longer exists", () => {
    const procedureNames = Object.keys(appRouter._def.procedures)
    expect(procedureNames).toContain("commission.getMine")
    expect(procedureNames).not.toContain("commission.getCompletedWork")
  })
})
