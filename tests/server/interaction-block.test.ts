import { describe, it, expect, vi, beforeEach } from "vitest"
import { createCallerFactory } from "@/lib/trpc"
import { appRouter } from "@/server/routers/_app"

vi.mock("@/lib/sendPush", () => ({ sendPushToUser: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/lib/ai-scan", () => ({ scanComment: vi.fn().mockResolvedValue(undefined) }))
import { sendPushToUser } from "@/lib/sendPush"

const createCaller = createCallerFactory(appRouter)

const db = {
  user: { findUnique: vi.fn(), findFirst: vi.fn() },
  post: { findUnique: vi.fn() },
  like: { deleteMany: vi.fn(), create: vi.fn() },
  commentLike: { deleteMany: vi.fn(), create: vi.fn() },
  comment: { create: vi.fn(), deleteMany: vi.fn() },
  block: { deleteMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  follow: { deleteMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}
const asViewer = (id = "me") => createCaller({ session: { user: { id } } as never, prisma: db as never })

beforeEach(() => {
  vi.clearAllMocks()
  db.user.findUnique.mockImplementation(async ({ select }: { select: Record<string, boolean> }) =>
    select.bannedUntil ? { bannedUntil: null } : { username: "liker", name: "Liker" })
})

describe("interaction.toggleLike", () => {
  it("unlikes when a like existed", async () => {
    db.like.deleteMany.mockResolvedValue({ count: 1 })
    expect(await asViewer().interaction.toggleLike({ postId: "p1" })).toEqual({ liked: false })
    expect(db.like.create).not.toHaveBeenCalled()
  })

  it("likes and notifies the post owner when no like existed", async () => {
    db.like.deleteMany.mockResolvedValue({ count: 0 })
    db.post.findUnique.mockResolvedValue({ userId: "owner" })
    expect(await asViewer().interaction.toggleLike({ postId: "p1" })).toEqual({ liked: true })
    expect(db.like.create).toHaveBeenCalledWith({ data: { userId: "me", postId: "p1" } })
    expect(sendPushToUser).toHaveBeenCalledWith(db, "owner", expect.objectContaining({ body: "Liker liked your post" }))
  })

  it("does not notify when liking your own post", async () => {
    db.like.deleteMany.mockResolvedValue({ count: 0 })
    db.post.findUnique.mockResolvedValue({ userId: "me" })
    await asViewer().interaction.toggleLike({ postId: "p1" })
    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})

describe("interaction.deleteComment", () => {
  it("only deletes the viewer's own comment", async () => {
    await asViewer().interaction.deleteComment({ id: "c1" })
    expect(db.comment.deleteMany).toHaveBeenCalledWith({ where: { id: "c1", userId: "me" } })
  })
})

describe("block.toggle", () => {
  it("unblocks when already blocked", async () => {
    db.user.findFirst.mockResolvedValue({ id: "them" })
    db.block.deleteMany.mockResolvedValue({ count: 1 })
    expect(await asViewer().block.toggle({ username: "them" })).toEqual({ blocked: false })
    expect(db.block.create).not.toHaveBeenCalled()
  })

  it("blocks and removes follows both ways when not blocked", async () => {
    db.user.findFirst.mockResolvedValue({ id: "them" })
    db.block.deleteMany.mockResolvedValue({ count: 0 })
    expect(await asViewer().block.toggle({ username: "them" })).toEqual({ blocked: true })
    expect(db.block.create).toHaveBeenCalledWith({ data: { blockerId: "me", blockedId: "them" } })
    expect(db.follow.deleteMany).toHaveBeenCalled()
  })

  it("refuses to block yourself", async () => {
    db.user.findFirst.mockResolvedValue({ id: "me" })
    await expect(asViewer().block.toggle({ username: "me" })).rejects.toThrow("You cannot block yourself.")
  })
})
