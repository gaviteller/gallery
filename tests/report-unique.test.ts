import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

describe("Report @@unique constraint", () => {
  let postId: string
  let reporterId: string
  let ownerId: string

  beforeAll(async () => {
    ownerId = (await prisma.user.create({
      data: { email: `owner-${Date.now()}@test.com`, username: `owner-${Date.now()}` },
    })).id
    reporterId = (await prisma.user.create({
      data: { email: `reporter-${Date.now()}@test.com`, username: `reporter-${Date.now()}` },
    })).id
    postId = (await prisma.post.create({
      data: { userId: ownerId, image: "data:image/png;base64,test" },
    })).id
  })

  afterAll(async () => {
    await prisma.report.deleteMany({ where: { postId } })
    await prisma.post.delete({ where: { id: postId } })
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, reporterId] } } })
    await prisma.$disconnect()
  })

  it("creates a Report row successfully", async () => {
    const report = await prisma.report.create({
      data: { postId, reporterId, reason: "SPAM" },
    })
    expect(report.id).toBeTruthy()
    expect(report.status).toBe("PENDING")
  })

  it("throws on duplicate [postId, reporterId]", async () => {
    await expect(
      prisma.report.create({ data: { postId, reporterId, reason: "OTHER" } })
    ).rejects.toMatchObject({ code: "P2002" })
  })

  it("deletes Report rows when Post is deleted", async () => {
    // Create a fresh post and report
    const newPostId = (await prisma.post.create({
      data: { userId: ownerId, image: "data:image/png;base64,cascade" },
    })).id
    await prisma.report.create({
      data: { postId: newPostId, reporterId, reason: "SPAM" },
    })
    // Delete the post
    await prisma.post.delete({ where: { id: newPostId } })
    // Reports should be gone
    const remaining = await prisma.report.count({ where: { postId: newPostId } })
    expect(remaining).toBe(0)
  })
})
