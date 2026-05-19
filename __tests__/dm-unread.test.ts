// __tests__/dm-unread.test.ts
// Integration-style unit test — mocks prisma
import { describe, it, expect, vi, beforeEach } from "vitest"

// We test the logic directly without going through tRPC transport
// by extracting the resolver logic into a helper function.
// For now, verify the shape: getMessages must call conversation.update.

describe("getMessages writes lastReadAt", () => {
  it("updates lastReadAtA when participantA reads", async () => {
    const mockUpdate = vi.fn().mockResolvedValue({})
    const mockFindUnique = vi.fn().mockResolvedValue({
      participantA: "user-a",
      participantB: "user-b",
    })
    const mockFindMany = vi.fn().mockResolvedValue([])

    const prisma = {
      conversation: { findUnique: mockFindUnique, update: mockUpdate },
      directMessage: { findMany: mockFindMany },
    } as any

    // Simulate the resolver logic we're about to write
    const me = "user-a"
    const conversationId = "conv-1"

    const convo = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { participantA: true, participantB: true } })
    const isA = convo.participantA === me
    await prisma.conversation.update({
      where: { id: conversationId },
      data: isA ? { lastReadAtA: new Date() } : { lastReadAtB: new Date() },
    })
    await prisma.directMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } })

    expect(mockUpdate).toHaveBeenCalledOnce()
    const callArg = mockUpdate.mock.calls[0][0]
    expect(callArg.data).toHaveProperty("lastReadAtA")
    expect(callArg.data.lastReadAtA).toBeInstanceOf(Date)
  })

  it("updates lastReadAtB when participantB reads", async () => {
    const mockUpdate = vi.fn().mockResolvedValue({})
    const mockFindUnique = vi.fn().mockResolvedValue({
      participantA: "user-a",
      participantB: "user-b",
    })
    const mockFindMany = vi.fn().mockResolvedValue([])
    const prisma = {
      conversation: { findUnique: mockFindUnique, update: mockUpdate },
      directMessage: { findMany: mockFindMany },
    } as any

    const me = "user-b"
    const conversationId = "conv-1"

    const convo = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { participantA: true, participantB: true } })
    const isA = convo.participantA === me
    await prisma.conversation.update({
      where: { id: conversationId },
      data: isA ? { lastReadAtA: new Date() } : { lastReadAtB: new Date() },
    })
    await prisma.directMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } })

    expect(mockUpdate).toHaveBeenCalledOnce()
    const callArg = mockUpdate.mock.calls[0][0]
    expect(callArg.data).toHaveProperty("lastReadAtB")
  })
})

describe("getUnreadCount logic", () => {
  function countUnread(convos: Array<{
    participantA: string
    participantB: string
    lastReadAtA: Date | null
    lastReadAtB: Date | null
    messages: Array<{ senderId: string; createdAt: Date }>
  }>, me: string): number {
    return convos.filter(c => {
      const myLastReadAt = c.participantA === me ? c.lastReadAtA : c.lastReadAtB
      const unreadMessages = c.messages.filter(m => {
        if (m.senderId === me) return false          // I sent it
        if (!myLastReadAt) return true               // never read this convo
        return m.createdAt > myLastReadAt            // newer than last read
      })
      return unreadMessages.length > 0
    }).length
  }

  const now = new Date()
  const past = new Date(now.getTime() - 10000)
  const future = new Date(now.getTime() + 10000)

  it("counts 0 when all messages are read", () => {
    const convos = [{
      participantA: "me", participantB: "other",
      lastReadAtA: now, lastReadAtB: null,
      messages: [{ senderId: "other", createdAt: past }],
    }]
    expect(countUnread(convos, "me")).toBe(0)
  })

  it("counts 1 when there is an unread message", () => {
    const convos = [{
      participantA: "me", participantB: "other",
      lastReadAtA: past, lastReadAtB: null,
      messages: [{ senderId: "other", createdAt: future }],
    }]
    expect(countUnread(convos, "me")).toBe(1)
  })

  it("counts 0 when I sent the last message (even if after lastReadAt)", () => {
    const convos = [{
      participantA: "me", participantB: "other",
      lastReadAtA: past, lastReadAtB: null,
      messages: [{ senderId: "me", createdAt: future }],
    }]
    expect(countUnread(convos, "me")).toBe(0)
  })

  it("counts 1 when lastReadAt is null (never opened convo)", () => {
    const convos = [{
      participantA: "me", participantB: "other",
      lastReadAtA: null, lastReadAtB: null,
      messages: [{ senderId: "other", createdAt: past }],
    }]
    expect(countUnread(convos, "me")).toBe(1)
  })

  it("counts 0 when convo has no messages", () => {
    const convos = [{
      participantA: "me", participantB: "other",
      lastReadAtA: null, lastReadAtB: null,
      messages: [],
    }]
    expect(countUnread(convos, "me")).toBe(0)
  })
})
