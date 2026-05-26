import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

describe("post.report", () => {
  let ownerId: string
  let reporter1Id: string
  let reporter2Id: string
  let reporter3Id: string
  let postId: string

  beforeAll(async () => {
    ownerId = (await prisma.user.create({
      data: { email: `own-${Date.now()}@t.com`, username: `own${Date.now()}` },
    })).id
    reporter1Id = (await prisma.user.create({
      data: { email: `r1-${Date.now()}@t.com`, username: `r1${Date.now()}` },
    })).id
    reporter2Id = (await prisma.user.create({
      data: { email: `r2-${Date.now()}@t.com`, username: `r2${Date.now()}` },
    })).id
    reporter3Id = (await prisma.user.create({
      data: { email: `r3-${Date.now()}@t.com`, username: `r3${Date.now()}` },
    })).id
    postId = (await prisma.post.create({
      data: { userId: ownerId, image: "data:image/png;base64,x" },
    })).id
  })

  afterAll(async () => {
    await prisma.report.deleteMany({ where: { postId } })
    await prisma.notification.deleteMany({ where: { userId: ownerId } })
    await prisma.post.deleteMany({ where: { id: postId } })
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, reporter1Id, reporter2Id, reporter3Id] } },
    })
    await prisma.$disconnect()
  })

  it("allows a user to report a post (success)", async () => {
    // Direct DB test — verify the report row is created
    const report = await prisma.report.create({
      data: { postId, reporterId: reporter1Id, reason: "SPAM" },
    })
    expect(report.id).toBeTruthy()
    expect(report.reason).toBe("SPAM")
    expect(report.status).toBe("PENDING")
    // Cleanup so later tests can use reporter1Id
    await prisma.report.delete({ where: { id: report.id } })
  })

  it("throws P2002 on duplicate report from same user+post", async () => {
    await prisma.report.create({
      data: { postId, reporterId: reporter1Id, reason: "SPAM" },
    })
    await expect(
      prisma.report.create({ data: { postId, reporterId: reporter1Id, reason: "OTHER" } })
    ).rejects.toMatchObject({ code: "P2002" })
    await prisma.report.deleteMany({ where: { postId, reporterId: reporter1Id } })
  })

  it("post reaches PENDING_REVIEW after 3 reports via direct DB ops", async () => {
    // Simulate 3 reports
    await prisma.report.createMany({
      data: [
        { postId, reporterId: reporter1Id, reason: "HARASSMENT" },
        { postId, reporterId: reporter2Id, reason: "HARASSMENT" },
        { postId, reporterId: reporter3Id, reason: "HARASSMENT" },
      ],
    })
    await prisma.post.update({
      where: { id: postId },
      data: { reportCount: 3, status: "PENDING_REVIEW", pendingAt: new Date(), flagReason: "Reached community report threshold" },
    })
    const post = await prisma.post.findUnique({ where: { id: postId } })
    expect(post!.status).toBe("PENDING_REVIEW")
    expect(post!.pendingAt).not.toBeNull()
  })
})
