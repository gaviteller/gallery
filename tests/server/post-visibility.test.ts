import { describe, it, expect, vi, beforeEach } from "vitest"
import { createCallerFactory } from "@/lib/trpc"
import { appRouter } from "@/server/routers/_app"
import { extractPostIdFromUrl } from "@/server/routers/dmca"

const createCaller = createCallerFactory(appRouter)
const DAY = 24 * 60 * 60 * 1000

const db = {
  post: { findUnique: vi.fn(), findMany: vi.fn() },
  user: { findFirst: vi.fn() },
  dmcaRequest: { create: vi.fn() },
}
const asViewer = (id: string | null) =>
  createCaller({ session: id ? ({ user: { id } } as never) : null, prisma: db as never })

const post = (status: string, removedDaysAgo?: number) => ({
  id: "p1",
  userId: "owner",
  status,
  removedAt: removedDaysAgo === undefined ? null : new Date(Date.now() - removedDaysAgo * DAY),
  user: { id: "owner", username: "owner", name: null, image: null },
  hashtags: [],
})

beforeEach(() => vi.clearAllMocks())

describe("post.getOne visibility", () => {
  it("anyone can open a published post", async () => {
    db.post.findUnique.mockResolvedValue(post("PUBLISHED"))
    await expect(asViewer(null).post.getOne({ id: "p1" })).resolves.toMatchObject({ id: "p1" })
  })

  it("strangers can't open a removed or under-review post", async () => {
    for (const hidden of [post("REMOVED", 1), post("PENDING_REVIEW")]) {
      db.post.findUnique.mockResolvedValue(hidden)
      await expect(asViewer("stranger").post.getOne({ id: "p1" })).rejects.toThrow()
      await expect(asViewer(null).post.getOne({ id: "p1" })).rejects.toThrow()
    }
  })

  it("the owner can open their post under review or removed within 15 days", async () => {
    db.post.findUnique.mockResolvedValue(post("PENDING_REVIEW"))
    await expect(asViewer("owner").post.getOne({ id: "p1" })).resolves.toBeTruthy()
    db.post.findUnique.mockResolvedValue(post("REMOVED", 3))
    await expect(asViewer("owner").post.getOne({ id: "p1" })).resolves.toBeTruthy()
  })

  it("not even the owner can open a post removed more than 15 days ago", async () => {
    db.post.findUnique.mockResolvedValue(post("REMOVED", 20))
    await expect(asViewer("owner").post.getOne({ id: "p1" })).rejects.toThrow()
  })
})

describe("post.getByUsername ownership comes from the session, not the input", () => {
  it("a stranger passing the owner's id still only sees published posts", async () => {
    db.user.findFirst.mockResolvedValue({ id: "owner" })
    db.post.findMany.mockResolvedValue([])
    await asViewer("stranger").post.getByUsername({ username: "owner", viewerUserId: "owner" })
    expect(db.post.findMany.mock.calls[0][0].where).toEqual({ userId: "owner", status: "PUBLISHED" })
  })
})

describe("hashtag.getPosts", () => {
  it("only returns published posts", async () => {
    db.post.findMany.mockResolvedValue([])
    await asViewer(null).hashtag.getPosts({ tag: "#Fantasy" })
    expect(db.post.findMany.mock.calls[0][0].where).toMatchObject({ status: "PUBLISHED", hashtags: { some: { tag: "fantasy" } } })
  })
})

describe("DMCA post links", () => {
  it("understands real post URLs", () => {
    expect(extractPostIdFromUrl("https://gallery.app/@artist_1/cmabc123")).toBe("cmabc123")
    expect(extractPostIdFromUrl("https://gallery.app/artist_1/cmabc123")).toBe("cmabc123")
    expect(extractPostIdFromUrl("https://gallery.app/posts/cmabc123")).toBe("cmabc123")
  })

  it("rejects links that aren't post links", () => {
    expect(extractPostIdFromUrl("https://gallery.app/@artist_1")).toBeNull()
    expect(extractPostIdFromUrl("https://gallery.app/shop/orders/abc")).toBeNull()
    expect(extractPostIdFromUrl("not a url")).toBeNull()
  })

  it("links the request only when the post really exists", async () => {
    db.post.findUnique.mockResolvedValueOnce({ id: "cmabc123" })
    await asViewer(null).dmca.submit({
      claimantName: "A", claimantEmail: "a@b.co",
      postUrl: "https://gallery.app/@artist_1/cmabc123",
      description: "x".repeat(60),
    })
    expect(db.dmcaRequest.create.mock.calls[0][0].data.postId).toBe("cmabc123")

    db.post.findUnique.mockResolvedValueOnce(null)
    await asViewer(null).dmca.submit({
      claimantName: "A", claimantEmail: "a@b.co",
      postUrl: "https://gallery.app/@artist_1/doesnotexist",
      description: "x".repeat(60),
    })
    expect(db.dmcaRequest.create.mock.calls[1][0].data.postId).toBeNull()
  })
})
