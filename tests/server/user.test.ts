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
    findFirst: vi.fn(),
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
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "user-1" },
    }))
    // Security: the password hash and moderation-only fields must never be sent to the browser.
    const selected = mockPrisma.user.findUnique.mock.calls[0][0].select
    expect(selected).toBeDefined()
    for (const secret of ["password", "normalizedEmail", "accountNotes", "banEvasionFlag", "stripeConnectId", "chargebackCount"]) {
      expect(selected[secret]).toBeUndefined()
    }
  })

  it("throws UNAUTHORIZED when not logged in", async () => {
    const unauthCaller = getCaller(null as any)
    await expect(unauthCaller.user.me()).rejects.toThrow("UNAUTHORIZED")
  })
})

describe("user.getByUsername", () => {
  it("only requests public profile fields (no email, password or moderation data)", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "user-2", username: "artist" })
    await createCaller({ session: null, prisma: mockPrisma as any }).user.getByUsername({ username: "artist" })
    const selected = mockPrisma.user.findFirst.mock.calls.at(-1)![0].select
    expect(selected.username).toBe(true)
    for (const secret of ["password", "email", "dateOfBirth", "normalizedEmail", "accountNotes", "banEvasionFlag", "stripeConnectId", "isAdmin"]) {
      expect(selected[secret]).toBeUndefined()
    }
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
    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "user-1" },
      data: { sellingEnabled: true, onboardingComplete: true },
    }))
    expect(mockPrisma.user.update.mock.calls[0][0].select.password).toBeUndefined()
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

describe("user.updateShowRealName", () => {
  it("sets showRealName to true", async () => {
    const updated = { id: "user-1", showRealName: true }
    mockPrisma.user.update.mockResolvedValue(updated)
    const caller = getCaller()
    const result = await caller.user.updateShowRealName({ showRealName: true })
    expect(result.showRealName).toBe(true)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { showRealName: true },
      select: { id: true, showRealName: true },
    })
  })

  it("sets showRealName to false", async () => {
    const updated = { id: "user-1", showRealName: false }
    mockPrisma.user.update.mockResolvedValue(updated)
    const caller = getCaller()
    const result = await caller.user.updateShowRealName({ showRealName: false })
    expect(result.showRealName).toBe(false)
  })

  it("throws UNAUTHORIZED when not logged in", async () => {
    const unauthCaller = getCaller(null as any)
    await expect(
      unauthCaller.user.updateShowRealName({ showRealName: true })
    ).rejects.toThrow("UNAUTHORIZED")
  })
})
