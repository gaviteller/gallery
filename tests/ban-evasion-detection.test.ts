import { describe, it, expect, afterEach, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"
import { normalizeEmail } from "@/lib/normalizeEmail"
import { runBanEvasionCheck } from "@/lib/auth"

const prisma = new PrismaClient()

describe("ban evasion detection logic", () => {
  const createdIds: string[] = []

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } })
    createdIds.length = 0
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("flags new account when normalized email matches a banned user", async () => {
    const bannedUser = await prisma.user.create({
      data: {
        email: "evader@example.com",
        username: `banned_${Date.now()}`,
        normalizedEmail: normalizeEmail("evader@example.com"),
        bannedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        banReason: "Test ban",
      },
    })
    createdIds.push(bannedUser.id)

    const newUser = await prisma.user.create({
      data: {
        email: "evader+alt@example.com",
        username: `new_${Date.now()}`,
      },
    })
    createdIds.push(newUser.id)

    await runBanEvasionCheck(newUser.id, "evader+alt@example.com")

    const updated = await prisma.user.findUnique({ where: { id: newUser.id } })
    expect(updated?.banEvasionFlag).toBe(true)
    expect(updated?.normalizedEmail).toBe("evader@example.com")
  })

  it("does not flag new account when matching user is not banned", async () => {
    const goodUser = await prisma.user.create({
      data: {
        email: "clean@example.com",
        username: `clean_${Date.now()}`,
        normalizedEmail: normalizeEmail("clean@example.com"),
      },
    })
    createdIds.push(goodUser.id)

    const newUser = await prisma.user.create({
      data: {
        email: "clean+tag@example.com",
        username: `clean2_${Date.now()}`,
      },
    })
    createdIds.push(newUser.id)

    await runBanEvasionCheck(newUser.id, "clean+tag@example.com")

    const updated = await prisma.user.findUnique({ where: { id: newUser.id } })
    expect(updated?.banEvasionFlag).toBe(false)
  })
})
