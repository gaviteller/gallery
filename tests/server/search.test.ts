import { describe, it, expect, vi, beforeEach } from "vitest"
import { createCallerFactory } from "@/lib/trpc"
import { appRouter } from "@/server/routers/_app"

const createCaller = createCallerFactory(appRouter)

// ── shared mock objects ──────────────────────────────────────────────────────

const mockUser = {
  id: "user-1",
  username: "luna",
  name: "Luna Artworks",
  image: null,
  commissionStatus: "OPEN" as const,
}

const mockPost = {
  id: "post-1",
  image: "data:image/jpeg;base64,abc",
  description: "A watercolor landscape",
  user: { username: "luna" },
}

const mockShopItem = {
  id: "shop-1",
  image: "data:image/jpeg;base64,def",
  title: "Watercolor Brush Set",
  description: "Digital brushes",
  price: 24,
  user: { username: "luna" },
}

const mockPrisma = {
  block: { findMany: vi.fn() },
  user: { findMany: vi.fn(), count: vi.fn() },
  post: { findMany: vi.fn(), count: vi.fn() },
  shopItem: { findMany: vi.fn(), count: vi.fn() },
}

function getCaller() {
  return createCaller({ session: null, prisma: mockPrisma as any })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.block.findMany.mockResolvedValue([])
})

// ── search.artists ───────────────────────────────────────────────────────────

describe("search.artists", () => {
  it("returns matching users with commissionStatus", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([mockUser])  // items
    const caller = getCaller()
    const result = await caller.search.artists({ query: "luna" })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].commissionStatus).toBe("OPEN")
    expect(result.items[0].username).toBe("luna")
  })

  it("returns empty items when no match", async () => {
    mockPrisma.user.findMany.mockResolvedValue([])
    const caller = getCaller()
    const result = await caller.search.artists({ query: "zzznomatch" })
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it("passes query to prisma with insensitive mode", async () => {
    mockPrisma.user.findMany.mockResolvedValue([mockUser])
    const caller = getCaller()
    await caller.search.artists({ query: "LUNA" })
    const call = mockPrisma.user.findMany.mock.calls[0][0]
    expect(call.where.OR[0].username.mode).toBe("insensitive")
  })
})

// ── search.posts ─────────────────────────────────────────────────────────────

describe("search.posts", () => {
  it("returns published posts matching description", async () => {
    mockPrisma.post.findMany.mockResolvedValue([mockPost])
    mockPrisma.post.count.mockResolvedValue(1)
    const caller = getCaller()
    const result = await caller.search.posts({ query: "watercolor" })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].description).toBe("A watercolor landscape")
    expect(result.total).toBe(1)
  })

  it("only searches PUBLISHED posts", async () => {
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.post.count.mockResolvedValue(0)
    const caller = getCaller()
    await caller.search.posts({ query: "watercolor" })
    const call = mockPrisma.post.findMany.mock.calls[0][0]
    expect(call.where.status).toBe("PUBLISHED")
  })

  it("returns empty when no match", async () => {
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.post.count.mockResolvedValue(0)
    const caller = getCaller()
    const result = await caller.search.posts({ query: "zzznomatch" })
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ── search.shop ──────────────────────────────────────────────────────────────

describe("search.shop", () => {
  it("returns shop items matching title", async () => {
    mockPrisma.shopItem.findMany.mockResolvedValue([mockShopItem])
    mockPrisma.shopItem.count.mockResolvedValue(1)
    const caller = getCaller()
    const result = await caller.search.shop({ query: "brush" })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].title).toBe("Watercolor Brush Set")
    expect(result.items[0].price).toBe(24)
  })

  it("returns empty when no match", async () => {
    mockPrisma.shopItem.findMany.mockResolvedValue([])
    mockPrisma.shopItem.count.mockResolvedValue(0)
    const caller = getCaller()
    const result = await caller.search.shop({ query: "zzznomatch" })
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it("searches both title and description", async () => {
    mockPrisma.shopItem.findMany.mockResolvedValue([mockShopItem])
    mockPrisma.shopItem.count.mockResolvedValue(1)
    const caller = getCaller()
    await caller.search.shop({ query: "digital" })
    const call = mockPrisma.shopItem.findMany.mock.calls[0][0]
    expect(call.where.OR).toHaveLength(2)
    expect(call.where.OR[0].title).toBeDefined()
    expect(call.where.OR[1].description).toBeDefined()
  })
})
