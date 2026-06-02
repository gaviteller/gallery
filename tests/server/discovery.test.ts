import { describe, it, expect, vi, beforeEach } from "vitest"
import { createCallerFactory } from "@/lib/trpc"
import { appRouter } from "@/server/routers/_app"

const createCaller = createCallerFactory(appRouter)

const mockArtist = {
  id: "user-1",
  username: "nova_ink",
  name: "Nova Ink",
  image: null,
  commissionStatus: "OPEN" as const,
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  _count: { followers: 500 },
  posts: [{ _count: { likes: 200 } }, { _count: { likes: 150 } }],
  artistCommissions: [{ buyerRating: 5 }, { buyerRating: 4 }],
}

const mockSpotlightArtist = {
  id: "user-2",
  username: "luminara",
  name: "Luminara Arts",
  image: null,
  commissionStatus: "OPEN" as const,
  createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), // 200 days ago
  _count: { followers: 10000 },
  posts: [{ _count: { likes: 3000 } }],
  artistCommissions: [{ buyerRating: 5 }],
}

const mockPrisma = {
  block: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  follow: { findMany: vi.fn() },
  post: { findMany: vi.fn(), count: vi.fn() },
}

function getCaller() {
  return createCaller({ session: null, prisma: mockPrisma as any })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.block.findMany.mockResolvedValue([])
})

describe("discovery.risingStars", () => {
  it("returns scored rising stars sorted by score", async () => {
    mockPrisma.user.findMany.mockResolvedValue([mockArtist])
    const caller = getCaller()
    const result = await caller.discovery.risingStars({ limit: 15 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].username).toBe("nova_ink")
    expect(result.items[0].followerCount).toBe(500)
    expect(result.total).toBe(1)
  })

  it("returns empty when no candidates", async () => {
    mockPrisma.user.findMany.mockResolvedValue([])
    const caller = getCaller()
    const result = await caller.discovery.risingStars({ limit: 15 })
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it("respects limit", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...mockArtist, id: `u-${i}`, username: `user${i}` }))
    mockPrisma.user.findMany.mockResolvedValue(many)
    const caller = getCaller()
    const result = await caller.discovery.risingStars({ limit: 3 })
    expect(result.items).toHaveLength(3)
  })

  it("excludes blocked users", async () => {
    mockPrisma.block.findMany.mockResolvedValue([
      { blockerId: "me", blockedId: "user-1" },
    ])
    mockPrisma.user.findMany.mockResolvedValue([mockArtist]) // mockArtist has id: "user-1"
    const caller = createCaller({ session: { user: { id: "me" } } as any, prisma: mockPrisma as any })
    const result = await caller.discovery.risingStars({ limit: 15 })
    // user-1 is blocked — should NOT appear
    // BUT: The Prisma mock always returns what we tell it to, so we verify
    // that the notIn filter was passed to user.findMany
    const callArgs = mockPrisma.user.findMany.mock.calls[0][0]
    expect(callArgs.where.id?.notIn).toContain("user-1")
  })
})

describe("discovery.spotlight", () => {
  it("returns scored spotlight artists", async () => {
    mockPrisma.user.findMany.mockResolvedValue([mockSpotlightArtist])
    const caller = getCaller()
    const result = await caller.discovery.spotlight({ limit: 15 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].username).toBe("luminara")
    expect(result.items[0].followerCount).toBe(10000)
  })

  it("returns empty when no candidates", async () => {
    mockPrisma.user.findMany.mockResolvedValue([])
    const caller = getCaller()
    const result = await caller.discovery.spotlight({ limit: 15 })
    expect(result.items).toHaveLength(0)
  })
})

describe("discovery.forYou", () => {
  it("returns posts for anonymous user", async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      { id: "post-1", image: "img1", description: "cool art", user: { username: "luna" }, _count: { likes: 50 } },
    ])
    const caller = getCaller()
    const result = await caller.discovery.forYou({ limit: 9 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe("post-1")
  })

  it("respects limit", async () => {
    const posts = Array.from({ length: 9 }, (_, i) => ({
      id: `post-${i}`,
      image: `img${i}`,
      description: null,
      user: { username: `user${i}` },
      _count: { likes: i },
    }))
    mockPrisma.post.findMany.mockResolvedValue(posts)
    const caller = getCaller()
    const result = await caller.discovery.forYou({ limit: 9 })
    expect(result.items).toHaveLength(9)
  })

  it("excludes followed users when session present", async () => {
    mockPrisma.follow.findMany.mockResolvedValue([{ followingId: "followed-user" }])
    mockPrisma.post.findMany.mockResolvedValue([])
    const caller = createCaller({ session: { user: { id: "me" } } as any, prisma: mockPrisma as any })
    await caller.discovery.forYou({ limit: 9 })
    const callArgs = mockPrisma.post.findMany.mock.calls[0][0]
    expect(callArgs.where.userId.notIn).toContain("followed-user")
    expect(callArgs.where.userId.notIn).toContain("me")
  })
})
