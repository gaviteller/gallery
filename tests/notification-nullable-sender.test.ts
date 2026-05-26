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
    if (notifId) {
      await prisma.notification.deleteMany({ where: { id: notifId } })
    }
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
  })

  it("notification survives when sender is deleted (SetNull behavior)", async () => {
    const sender = await prisma.user.create({
      data: {
        email: `sender-test-${Date.now()}@example.com`,
        username: `sender_test_${Date.now()}`,
      },
    })
    const notif = await prisma.notification.create({
      data: {
        userId,
        fromUserId: sender.id,
        type: "follow",
        message: null,
      },
    })
    // Delete the sender — notification should survive with fromUserId: null
    await prisma.user.delete({ where: { id: sender.id } })
    const refetched = await prisma.notification.findUnique({ where: { id: notif.id } })
    expect(refetched).not.toBeNull()
    expect(refetched!.fromUserId).toBeNull()
    // Cleanup
    await prisma.notification.delete({ where: { id: notif.id } })
  })
})
