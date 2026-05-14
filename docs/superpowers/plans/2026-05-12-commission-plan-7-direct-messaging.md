# Commission Plan 7 — Direct Messaging System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a general-purpose DM system (separate from commission chats) so any two users can message each other. A new "Messages" tab appears in the bottom navigation between "Commissions" and "Profile".

**Architecture:** Two new Prisma models: `Conversation` (two participants) and `DirectMessage` (belongs to a conversation). A new `dm.ts` tRPC router handles `getOrCreate`, `getConversations`, `getMessages`, and `send`. Two new pages: `/messages` (conversation list) and `/messages/[id]` (thread). The bottom nav is updated from 4+center to 5+center by squeezing in Messages between Commissions and Profile.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 5 / PostgreSQL, NextAuth v4, Tailwind v4.

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `Conversation` and `DirectMessage` models |
| `server/routers/dm.ts` | **Create** — `getOrCreate`, `getConversations`, `getMessages`, `send` |
| `server/routers/_app.ts` | Register `dm` router |
| `app/messages/page.tsx` | **Create** — conversation list |
| `app/messages/[id]/page.tsx` | **Create** — DM thread with auto-refresh |
| `components/BottomNav.tsx` | Add Messages tab between Commissions and Profile |
| `components/Navbar.tsx` | `getNotificationLink` handles `dm:CONVERSATION_ID` → `/messages/ID` |

---

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `Conversation` and `DirectMessage` to `prisma/schema.prisma`**

Add these two models at the end of the file (before the final closing):

```prisma
model Conversation {
  id           String          @id @default(cuid())
  participantA String
  participantB String
  userA        User            @relation("ConversationA", fields: [participantA], references: [id], onDelete: Cascade)
  userB        User            @relation("ConversationB", fields: [participantB], references: [id], onDelete: Cascade)
  messages     DirectMessage[]
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@unique([participantA, participantB])
}

model DirectMessage {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId       String
  sender         User         @relation("SentDirectMessages", fields: [senderId], references: [id], onDelete: Cascade)
  text           String       @db.Text
  createdAt      DateTime     @default(now())

  @@index([conversationId])
}
```

- [ ] **Step 2: Add relations to `User` model**

In the `User` model, add after `sentProfessionalMessages`:
```prisma
conversationsAsA     Conversation[]  @relation("ConversationA")
conversationsAsB     Conversation[]  @relation("ConversationB")
sentDirectMessages   DirectMessage[] @relation("SentDirectMessages")
```

- [ ] **Step 3: Run migration**
```bash
npx prisma migrate dev --name add-direct-messaging
```
Expected: "Your database is now in sync with your schema."

- [ ] **Step 4: Commit**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: Conversation and DirectMessage models"
```

---

### Task 2: `dm.ts` tRPC router

**Files:**
- Create: `server/routers/dm.ts`

- [ ] **Step 1: Create `server/routers/dm.ts`**

```ts
import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"

export const dmRouter = router({

  // Get or create a conversation between the current user and another
  getOrCreate: protectedProcedure
    .input(z.object({ otherUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const other = input.otherUserId
      if (me === other) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot DM yourself" })

      // Canonical ordering: participantA < participantB (lexicographic)
      const [a, b] = me < other ? [me, other] : [other, me]

      const existing = await ctx.prisma.conversation.findUnique({
        where: { participantA_participantB: { participantA: a, participantB: b } },
      })
      if (existing) return existing

      return ctx.prisma.conversation.create({
        data: { participantA: a, participantB: b },
      })
    }),

  // List all conversations for the current user, most recent first
  getConversations: protectedProcedure.query(async ({ ctx }) => {
    const me = ctx.session.user.id

    const convos = await ctx.prisma.conversation.findMany({
      where: {
        OR: [{ participantA: me }, { participantB: me }],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        userA: { select: { id: true, username: true, name: true, image: true } },
        userB: { select: { id: true, username: true, name: true, image: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { text: true, createdAt: true, senderId: true },
        },
      },
    })

    return convos.map(c => {
      const other = c.participantA === me ? c.userB : c.userA
      const lastMsg = c.messages[0] ?? null
      return { id: c.id, other, lastMsg, updatedAt: c.updatedAt }
    })
  }),

  // Get messages for a specific conversation
  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const me = ctx.session.user.id

      const convo = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId },
        select: { participantA: true, participantB: true },
      })
      if (!convo) throw new TRPCError({ code: "NOT_FOUND" })
      if (convo.participantA !== me && convo.participantB !== me) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      return ctx.prisma.directMessage.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: "asc" },
        select: { id: true, text: true, senderId: true, createdAt: true },
      })
    }),

  // Send a message
  send: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      text: z.string().min(1).max(4000),
    }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id

      const convo = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId },
        select: { participantA: true, participantB: true },
      })
      if (!convo) throw new TRPCError({ code: "NOT_FOUND" })
      if (convo.participantA !== me && convo.participantB !== me) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const [msg] = await ctx.prisma.$transaction([
        ctx.prisma.directMessage.create({
          data: { conversationId: input.conversationId, senderId: me, text: input.text },
        }),
        ctx.prisma.conversation.update({
          where: { id: input.conversationId },
          data: { updatedAt: new Date() },
        }),
      ])

      // Notify the other party
      const otherId = convo.participantA === me ? convo.participantB : convo.participantA
      await ctx.prisma.notification.create({
        data: { userId: otherId, fromUserId: me, type: `dm:${input.conversationId}` },
      })

      return msg
    }),
})
```

- [ ] **Step 2: Register `dm` router in `server/routers/_app.ts`**

```ts
import { dmRouter } from "./dm"
// In the router definition:
dm: dmRouter,
```

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**
```bash
git add server/routers/dm.ts server/routers/_app.ts
git commit -m "feat: dm tRPC router with getOrCreate, getConversations, getMessages, send"
```

---

### Task 3: Conversation list page

**Files:**
- Create: `app/messages/page.tsx`

- [ ] **Step 1: Create `app/messages/page.tsx`**

```tsx
"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function MessagesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
  }, [status, router])

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  return <MessagesInner userId={session!.user.id} />
}

function MessagesInner({ userId }: { userId: string }) {
  const { data: convos, isLoading } = trpc.dm.getConversations.useQuery()
  const router = useRouter()

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-xl font-bold text-gray-900">Messages</h1>
      </div>

      {!convos || convos.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 font-medium">No messages yet</p>
          <p className="text-xs text-gray-400 mt-1">Visit someone's profile to start a conversation</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 bg-white">
          {convos.map(c => (
            <button
              key={c.id}
              onClick={() => router.push(`/messages/${c.id}`)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <Avatar src={c.other.image} name={c.other.name} username={c.other.username} size={44} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">@{c.other.username ?? "unknown"}</p>
                {c.lastMsg && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {c.lastMsg.senderId === userId ? "You: " : ""}{c.lastMsg.text}
                  </p>
                )}
              </div>
              {c.lastMsg && (
                <p className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(c.lastMsg.createdAt)}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**
```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add app/messages/page.tsx
git commit -m "feat: messages conversation list page"
```

---

### Task 4: DM thread page

**Files:**
- Create: `app/messages/[id]/page.tsx`

- [ ] **Step 1: Create `app/messages/[id]/page.tsx`**

```tsx
"use client"

import { use, useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"

function timeAgo(date: Date): string {
  const d = new Date(date)
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return d.toLocaleDateString()
}

export default function DMThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
  }, [status, router])

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  return <DMThread id={id} userId={session!.user.id} />
}

function DMThread({ id, userId }: { id: string; userId: string }) {
  const utils = trpc.useUtils()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Need conversation info — get it from the conversations list
  const { data: convos } = trpc.dm.getConversations.useQuery()
  const convo = convos?.find(c => c.id === id)

  const { data: messages, isLoading } = trpc.dm.getMessages.useQuery(
    { conversationId: id },
    { refetchInterval: 8000, refetchIntervalInBackground: false }
  )

  const [text, setText] = useState("")
  const sendMessage = trpc.dm.send.useMutation({
    onSuccess: () => {
      utils.dm.getMessages.invalidate({ conversationId: id })
      utils.dm.getConversations.invalidate()
      setText("")
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages?.length])

  function handleSend() {
    if (!text.trim()) return
    sendMessage.mutate({ conversationId: id, text: text.trim() })
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col h-screen pb-16">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <button onClick={() => router.push("/messages")} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {convo && (
          <button
            onClick={() => router.push(`/@${convo.other.username}`)}
            className="flex items-center gap-2 flex-1 min-w-0"
          >
            <Avatar src={convo.other.image} name={convo.other.name} username={convo.other.username} size={32} />
            <p className="text-sm font-semibold text-gray-900 truncate">@{convo.other.username}</p>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {messages && messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-8">Send a message to start the conversation</p>
        )}
        {messages?.map(msg => {
          const isMe = msg.senderId === userId
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
              <div className={`max-w-[80%] flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                  isMe
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-gray-100 text-gray-800 rounded-tl-sm"
                }`}>
                  {msg.text}
                </div>
                <p className="text-[10px] text-gray-400 px-1">{timeAgo(msg.createdAt)}</p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 bg-white flex gap-2 items-end">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Message…"
          rows={1}
          className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl text-sm text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 resize-none max-h-32"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sendMessage.isPending}
          className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-40 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**
```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add "app/messages/[id]/page.tsx"
git commit -m "feat: DM thread page with auto-refresh"
```

---

### Task 5: Add "Message" button on user profiles

Artists and buyers should be able to start a DM from a profile page. Add a "Message" button to the profile header (shown to non-owners when logged in).

**Files:**
- Modify: `app/[username]/page.tsx`

- [ ] **Step 1: Add `getOrCreate` mutation call in profile page component**

```ts
const getOrCreateDM = trpc.dm.getOrCreate.useMutation({
  onSuccess: (convo) => router.push(`/messages/${convo.id}`),
})
```

- [ ] **Step 2: Add Message button next to "Edit profile" in the profile header**

Find the block:
```tsx
{isOwn && (
  <Link href="/settings" ...>Edit profile</Link>
)}
```

Change to:
```tsx
{isOwn ? (
  <Link href="/settings" className="text-sm px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
    Edit profile
  </Link>
) : session && (
  <button
    onClick={() => getOrCreateDM.mutate({ otherUserId: profileUser.id })}
    disabled={getOrCreateDM.isPending}
    className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
  >
    {getOrCreateDM.isPending ? "Opening…" : "Message"}
  </button>
)}
```

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add "app/[username]/page.tsx"
git commit -m "feat: Message button on profile pages to start a DM"
```

---

### Task 6: Update notification system for DMs

**Files:**
- Modify: `components/Navbar.tsx`

- [ ] **Step 1: Add DM notification type handling in `getNotificationLink` and `getNotificationText`**

In `getNotificationLink`:
```ts
function getNotificationLink(type: string): string {
  if (type === "follow") return `/@${n.fromUser.username}`
  const [prefix, id] = type.split(":")
  if (prefix === "dm") return `/messages/${id}`
  return `/professional-dms/${id}`  // all commission_* types
}
```

In `getNotificationText`:
```ts
const map: Record<string, string> = {
  follow: "started following you",
  dm: "sent you a message",
  commission_request: "sent you a commission request",
  commission_message: "sent you a message",
  commission_accepted: "accepted your commission request",
  commission_declined: "declined your commission request",
  commission_cancelled: "cancelled their commission",
  commission_paid: "confirmed payment for their commission",
  commission_delivered: "delivered your commission",
  commission_complete: "confirmed commission receipt",
  commission_deadline_set: "set a deadline for your commission",
  commission_deadline_updated: "updated the commission deadline",
  commission_deadline_approaching: "commission deadline is approaching",
}
```

- [ ] **Step 2: TypeScript check**
```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add components/Navbar.tsx
git commit -m "feat: DM notification routing in Navbar"
```

---

### Task 7: Bottom navigation — add Messages tab

**Files:**
- Modify: `components/BottomNav.tsx`

The current nav has 4 tabs + a floating center Search button. Adding a 5th tab (Messages) while keeping the center button makes 6 slots — too many. Plan: keep the center Search button; make the 4 side tabs smaller by reducing padding.

New layout: `[Feed] [Shop] [●Search] [Commissions] [Messages] [Profile]`

- [ ] **Step 1: Add the Messages tab in `components/BottomNav.tsx`**

Find the Commissions link and add the Messages link immediately after it:

```tsx
{/* Messages */}
<Link
  href="/messages"
  className={`flex flex-col items-center gap-0.5 px-3 py-2 ${isActive("/messages") ? "text-gray-900" : "text-gray-400"}`}
>
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
  <span className="text-[10px] font-medium">Messages</span>
</Link>
```

- [ ] **Step 2: Reduce padding on all tabs to fit 6 items**

Change every tab's `px-4 py-2` to `px-3 py-2` to keep them from overflowing on small screens.

- [ ] **Step 3: Add unread DM count badge on the Messages tab**

Add a query for unread DM count. The simplest approach: query `dm.getConversations` and count conversations where `lastMsg.senderId !== userId`. For a more accurate count, add a `getUnreadCount` procedure to `dm.ts`:

```ts
// In dm.ts router, add:
getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
  // Count conversations where last message was not sent by me
  const me = ctx.session.user.id
  const convos = await ctx.prisma.conversation.findMany({
    where: { OR: [{ participantA: me }, { participantB: me }] },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { senderId: true } },
    },
  })
  const count = convos.filter(c => c.messages[0]?.senderId !== me).length
  return { count }
}),
```

Then in `BottomNav.tsx`:
```tsx
const { data: dmUnread } = trpc.dm.getUnreadCount.useQuery(undefined, {
  enabled: status === "authenticated",
  refetchInterval: 30000,
})
```

And on the Messages tab icon:
```tsx
<div className="relative">
  <svg .../>  {/* the chat icon */}
  {dmUnread && dmUnread.count > 0 && (
    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
      {dmUnread.count > 9 ? "9+" : dmUnread.count}
    </span>
  )}
</div>
```

- [ ] **Step 4: TypeScript check**
```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**
```bash
git add components/BottomNav.tsx server/routers/dm.ts
git commit -m "feat: Messages tab in bottom nav with unread badge"
```

---

### Task 8: Deploy

- [ ] **Step 1: Full build check**
```bash
npx tsc --noEmit
```

- [ ] **Step 2: Deploy**
```bash
npx vercel --prod
```
Expected: "Production: https://..."
