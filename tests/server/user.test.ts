import { describe, it, expect, vi } from "vitest"
import { createCallerFactory } from "@/lib/trpc"
import { appRouter } from "@/server/routers/_app"

const createCaller = createCallerFactory(appRouter)

// Mock prisma
const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  username: null,
  bio: null,
  sellingEnabled: false,
  onboardingComplete: false,
  commissionStatus: "CLOSED" as const,
}

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

const mockSession = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    image: null,
    username: null,
    sellingEnabled: false,
    onboardingComplete: false,
    bannedUntil: null,
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}

function getCaller(session = mockSession) {
  return createCaller({
    session,
    prisma: mockPrisma as any,
  })
}

describe("user.me", () => {
  it("returns the current user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser)
    const caller = getCaller()
    const result = await caller.user.me()
    expect(result).toEqual(mockUser)
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
    })
  })

  it("throws UNAUTHORIZED when not logged in", async () => {
    const unauthCaller = getCaller(null as any)
    await expect(unauthCaller.user.me()).rejects.toThrow("UNAUTHORIZED")
  })
})

describe("user.completeOnboarding", () => {
  it("sets onboardingComplete and sellingEnabled", async () => {
    const updated = { ...mockUser, onboardingComplete: true, sellingEnabled: true }
    mockPrisma.user.update.mockResolvedValue(updated)
    const caller = getCaller()
    const result = await caller.user.completeOnboarding({ sellingEnabled: true })
    expect(result.onboardingComplete).toBe(true)
    expect(result.sellingEnabled).toBe(true)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { sellingEnabled: true, onboardingComplete: true },
    })
  })
})

describe("user.updateSellingEnabled", () => {
  it("enables selling", async () => {
    const updated = { ...mockUser, sellingEnabled: true }
    mockPrisma.user.update.mockResolvedValue(updated)
    const caller = getCaller()
    const result = await caller.user.updateSellingEnabled({ enabled: true })
    expect(result.sellingEnabled).toBe(true)
  })

  it("disables selling", async () => {
    const updated = { ...mockUser, sellingEnabled: false }
    mockPrisma.user.update.mockResolvedValue(updated)
    const caller = getCaller()
    const result = await caller.user.updateSellingEnabled({ enabled: false })
    expect(result.sellingEnabled).toBe(false)
  })
})
