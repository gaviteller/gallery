import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

describe("Notification nullable sender", () => {
  let userId: string
  let notifId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `notif-test-${Date.now()}@example.com`,
        username: `notif_test_${Date.now()}`,
      },
    })
    userId = user.id
  })

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it("creates a notification with fromUserId: null and a message", async () => {
    const notif = await prisma.notification.create({
      data: {
        userId,
        fromUserId: null,
        type: "site_notice",
        message: "Test system notice.",
      },
    })
    notifId = notif.id
    expect(notif.fromUserId).toBeNull()
    expect(notif.message).toBe("Test system notice.")
    await prisma.notification.delete({ where: { id: notifId } })
  })
})
