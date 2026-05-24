import { describe, it, expect, vi } from "vitest"
import { checkNotBanned } from "@/server/lib/ban"
import { TRPCError } from "@trpc/server"

const mockPrisma = {
  user: { findUnique: vi.fn() },
}

describe("checkNotBanned", () => {
  it("does nothing when user is not banned (null bannedUntil)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ bannedUntil: null })
    await expect(checkNotBanned(mockPrisma as any, "user-1")).resolves.toBeUndefined()
  })

  it("does nothing when ban has expired", async () => {
    const pastDate = new Date(Date.now() - 1000)
    mockPrisma.user.findUnique.mockResolvedValue({ bannedUntil: pastDate })
    await expect(checkNotBanned(mockPrisma as any, "user-1")).resolves.toBeUndefined()
  })

  it("throws FORBIDDEN when ban is active", async () => {
    const futureDate = new Date(Date.now() + 86400000)
    mockPrisma.user.findUnique.mockResolvedValue({ bannedUntil: futureDate })
    await expect(checkNotBanned(mockPrisma as any, "user-1")).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("throws FORBIDDEN for permanent ban (year 9999)", async () => {
    const permanentDate = new Date("9999-12-31")
    mockPrisma.user.findUnique.mockResolvedValue({ bannedUntil: permanentDate })
    await expect(checkNotBanned(mockPrisma as any, "user-1")).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})
