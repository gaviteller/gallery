import { describe, it, expect, afterEach, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"
import { normalizeEmail } from "@/lib/normalizeEmail"

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

    // Simulate auth callback logic
    const normalized = normalizeEmail("evader+alt@example.com")
    await prisma.user.update({
      where: { id: newUser.id },
      data: { normalizedEmail: normalized },
    })
    const bannedMatches = await prisma.user.findMany({
      where: {
        normalizedEmail: normalized,
        id: { not: newUser.id },
        bannedUntil: { not: null },
      },
      select: { id: true, bannedUntil: true },
    })
    const hasBannedMatch = bannedMatches.some(
      u => u.bannedUntil && u.bannedUntil > new Date()
    )
    if (hasBannedMatch) {
      await prisma.user.update({
        where: { id: newUser.id },
        data: { banEvasionFlag: true },
      })
    }

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

    const normalized = normalizeEmail("clean+tag@example.com")
    await prisma.user.update({
      where: { id: newUser.id },
      data: { normalizedEmail: normalized },
    })
    const bannedMatches = await prisma.user.findMany({
      where: {
        normalizedEmail: normalized,
        id: { not: newUser.id },
        bannedUntil: { not: null },
      },
      select: { id: true, bannedUntil: true },
    })
    const hasBannedMatch = bannedMatches.some(
      u => u.bannedUntil && u.bannedUntil > new Date()
    )
    if (hasBannedMatch) {
      await prisma.user.update({
        where: { id: newUser.id },
        data: { banEvasionFlag: true },
      })
    }

    const updated = await prisma.user.findUnique({ where: { id: newUser.id } })
    expect(updated?.banEvasionFlag).toBe(false)
  })
})
