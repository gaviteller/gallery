import { describe, it, expect, afterEach, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

describe("account enforcement schema fields", () => {
  const createdIds: string[] = []

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } })
    createdIds.length = 0
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("new User has correct defaults for enforcement fields", async () => {
    const user = await prisma.user.create({
      data: {
        email: `schema-test-${Date.now()}@example.com`,
        username: `schema_test_${Date.now()}`,
      },
    })
    createdIds.push(user.id)

    expect(user.chargebackCount).toBe(0)
    expect(user.accountNotes).toBeNull()
    expect(user.normalizedEmail).toBeNull()
    expect(user.banEvasionFlag).toBe(false)
  })
})
