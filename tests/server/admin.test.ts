import { describe, it, expect, vi, beforeEach } from "vitest"
import { createCallerFactory } from "@/lib/trpc"
import { appRouter } from "@/server/routers/_app"

const createCaller = createCallerFactory(appRouter)

const mockMod = { id: "mod-1", isAdmin: false, isModerator: true }
const mockAdmin = { id: "admin-1", isAdmin: true, isModerator: false }
const mockUser = { id: "user-1", isAdmin: false, isModerator: false }

const mockPrisma = {
  user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  strike: { create: vi.fn(), findMany: vi.fn() },
  appeal: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  notification: { create: vi.fn() },
}

function modSession() {
  return {
    user: { id: "mod-1", username: "mod", sellingEnabled: false, onboardingComplete: true },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

function adminSession() {
  return {
    user: { id: "admin-1", username: "admin", sellingEnabled: false, onboardingComplete: true },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

function userSession() {
  return {
    user: { id: "user-1", username: "user", sellingEnabled: false, onboardingComplete: true },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

function getCaller(session: any) {
  return createCaller({ session, prisma: mockPrisma as any })
}

beforeEach(() => vi.clearAllMocks())

describe("admin.issueStrike", () => {
  it("throws FORBIDDEN for non-moderators", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser)
    const caller = getCaller(userSession())
    await expect(
      caller.admin.issueStrike({ userId: "target-1", level: "MINOR", violation: "SPAM" })
    ).rejects.toThrow("FORBIDDEN")
  })

  it("allows moderators to issue strikes", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockMod)
    mockPrisma.strike.create.mockResolvedValue({ id: "strike-1" })
    mockPrisma.notification.create.mockResolvedValue({})
    const caller = getCaller(modSession())
    const result = await caller.admin.issueStrike({
      userId: "target-1",
      level: "MINOR",
      violation: "SPAM",
    })
    expect(result.id).toBe("strike-1")
    expect(mockPrisma.strike.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "target-1",
          issuedById: "mod-1",
          level: "MINOR",
          violation: "SPAM",
          isSelling: false,
        }),
      })
    )
  })

  it("sets isSelling true for selling violations", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockMod)
    mockPrisma.strike.create.mockResolvedValue({ id: "strike-2" })
    mockPrisma.notification.create.mockResolvedValue({})
    const caller = getCaller(modSession())
    await caller.admin.issueStrike({
      userId: "target-1",
      level: "MODERATE",
      violation: "FAKE_DELIVERY",
    })
    expect(mockPrisma.strike.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isSelling: true }),
      })
    )
  })
})

describe("admin.setModerator", () => {
  it("throws FORBIDDEN for moderators (admin-only)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockMod)
    const caller = getCaller(modSession())
    await expect(
      caller.admin.setModerator({ userId: "user-1", isModerator: true })
    ).rejects.toThrow("FORBIDDEN")
  })

  it("allows admin to set moderator", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockAdmin)
    mockPrisma.user.update.mockResolvedValue({ id: "user-1", isModerator: true })
    const caller = getCaller(adminSession())
    const result = await caller.admin.setModerator({ userId: "user-1", isModerator: true })
    expect(result.isModerator).toBe(true)
  })
})
