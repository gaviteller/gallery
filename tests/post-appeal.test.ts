import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

describe("post removal appeals", () => {
  let ownerId: string
  let otherId: string
  let removedPostId: string
  let publishedPostId: string

  beforeAll(async () => {
    ownerId = (await prisma.user.create({
      data: { email: `owner-${Date.now()}@t.com`, username: `owner${Date.now()}` },
    })).id
    otherId = (await prisma.user.create({
      data: { email: `other-${Date.now()}@t.com`, username: `other${Date.now()}` },
    })).id
    removedPostId = (await prisma.post.create({
      data: { userId: ownerId, image: "data:image/png;base64,x", status: "REMOVED" },
    })).id
    publishedPostId = (await prisma.post.create({
      data: { userId: ownerId, image: "data:image/png;base64,x", status: "PUBLISHED" },
    })).id
  })

  afterAll(async () => {
    await prisma.appeal.deleteMany({ where: { userId: ownerId } })
    await prisma.post.deleteMany({ where: { userId: ownerId } })
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } })
    await prisma.$disconnect()
  })

  it("can create an appeal referencing a removed post", async () => {
    const appeal = await prisma.appeal.create({
      data: { userId: ownerId, postId: removedPostId, text: "This was wrongly removed." },
    })
    expect(appeal.postId).toBe(removedPostId)
    expect(appeal.status).toBe("PENDING")
    await prisma.appeal.delete({ where: { id: appeal.id } })
  })

  it("appeal with postId has null strikeId", async () => {
    const appeal = await prisma.appeal.create({
      data: { userId: ownerId, postId: removedPostId, text: "Post appeal test." },
    })
    expect(appeal.strikeId).toBeNull()
    await prisma.appeal.delete({ where: { id: appeal.id } })
  })

  it("getMyRemovedPosts logic: finds REMOVED posts for owner", async () => {
    const posts = await prisma.post.findMany({
      where: { userId: ownerId, status: "REMOVED" },
      select: { id: true, status: true },
    })
    expect(posts.some(p => p.id === removedPostId)).toBe(true)
    expect(posts.every(p => p.status === "REMOVED")).toBe(true)
  })

  it("getMyRemovedPosts logic: does not return PUBLISHED posts", async () => {
    const posts = await prisma.post.findMany({
      where: { userId: ownerId, status: "REMOVED" },
      select: { id: true },
    })
    expect(posts.some(p => p.id === publishedPostId)).toBe(false)
  })
})
