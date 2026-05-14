# Commission Plan 4 — Quick Wins & Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the existing commission system with a shared Avatar component, professional copy throughout, auto-delete read notifications after 24 h, and commission status changes rendered as system messages inside the chat thread.

**Architecture:** Four independent changes touching UI components, copy strings, the notification router, and the ProfessionalMessage model. The system-message feature requires a schema migration (`isSystem` flag on `ProfessionalMessage`) and updates to every mutation that changes commission status.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 5 / PostgreSQL, NextAuth v4, Tailwind v4.

---

## File Map

| File | Change |
|------|--------|
| `components/Avatar.tsx` | **Create** — reusable avatar component used everywhere |
| `app/[username]/page.tsx` | Replace inline avatar fallbacks with `<Avatar>` |
| `app/professional-dms/page.tsx` | Replace inline avatar fallbacks with `<Avatar>`, rename "Professional DMs" → "Commission Chats" |
| `app/professional-dms/[id]/page.tsx` | Replace inline avatar fallbacks, render system messages, rename labels |
| `app/professional-profile/page.tsx` | Rename "Professional Profile" → "Artist Dashboard", rename section headings |
| `app/commissions/page.tsx` | Replace inline avatar fallbacks with `<Avatar>` |
| `components/Navbar.tsx` | Rename menu items, replace inline avatar fallbacks |
| `components/BottomNav.tsx` | Rename "Professional DMs" link if present |
| `server/routers/notification.ts` | Auto-delete read notifications older than 24 h inside `getAll` |
| `server/routers/commission.ts` | Create system messages on every status-change mutation |
| `server/routers/commissionMessage.ts` | Pass `isSystem` flag through to create |
| `prisma/schema.prisma` | Add `isSystem Boolean @default(false)` to `ProfessionalMessage` |

---

### Task 1: Avatar component

**Files:**
- Create: `components/Avatar.tsx`

The app currently repeats this pattern in ~8 places:
```tsx
{user.image ? (
  <img src={user.image} className="w-9 h-9 rounded-full object-cover" alt="" />
) : (
  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">
    {(user.name ?? user.username ?? "?")[0].toUpperCase()}
  </div>
)}
```

Replace it with a proper component that uses a person placeholder SVG instead of a letter-initial fallback.

- [ ] **Step 1: Create `components/Avatar.tsx`**

```tsx
type Props = {
  src?: string | null
  name?: string | null
  username?: string | null
  size?: number   // px, default 36
  className?: string
}

export default function Avatar({ src, name, username, size = 36, className = "" }: Props) {
  const dim = `w-[${size}px] h-[${size}px]`

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? username ?? ""}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        style={{ width: size * 0.55, height: size * 0.55 }}
        stroke="#9ca3af"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  )
}
```

- [ ] **Step 2: Verify it renders — check TypeScript**
```bash
cd gallery && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Replace avatar patterns in `app/professional-dms/page.tsx`**

Find every occurrence of the inline avatar block and replace with:
```tsx
import Avatar from "@/components/Avatar"

// In CommissionRow:
<Avatar src={otherParty?.image} name={otherParty?.name} username={otherParty?.username} size={40} />
```

- [ ] **Step 4: Replace avatar patterns in `app/professional-dms/[id]/page.tsx`**

```tsx
import Avatar from "@/components/Avatar"

// Top bar other-party avatar:
<Avatar src={otherParty?.image} name={otherParty?.name} username={otherParty?.username} size={32} />

// Message bubbles (no avatar needed — messages are identified by bubble side)
// Active commissions in professional-profile use Avatar too
```

- [ ] **Step 5: Replace in `app/commissions/page.tsx` (ArtistCard info row)**

```tsx
import Avatar from "@/components/Avatar"

// Info row:
<Avatar src={artist.image} name={artist.name} username={artist.username} size={20} />
```

- [ ] **Step 6: Replace in `app/professional-profile/page.tsx` (Active Commissions section)**

```tsx
import Avatar from "@/components/Avatar"

// Each commission row:
<Avatar src={c.buyer?.image} name={c.buyer?.name} username={c.buyer?.username} size={36} />
```

- [ ] **Step 7: Replace in `components/Navbar.tsx` (notification panel)**

```tsx
import Avatar from "@/components/Avatar"

// Inside notifications map:
<Avatar src={n.fromUser.image} name={n.fromUser.name} username={n.fromUser.username} size={32} />
```

- [ ] **Step 8: Run TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 9: Commit**
```bash
git add components/Avatar.tsx app/professional-dms/page.tsx app/professional-dms/[id]/page.tsx app/commissions/page.tsx app/professional-profile/page.tsx components/Navbar.tsx
git commit -m "feat: shared Avatar component with person placeholder"
```

---

### Task 2: Professional naming pass

**Files:**
- Modify: `app/professional-dms/page.tsx`
- Modify: `app/professional-dms/[id]/page.tsx`
- Modify: `app/professional-profile/page.tsx`
- Modify: `components/Navbar.tsx`
- Modify: `components/BottomNav.tsx`

Rename map:
| Before | After |
|--------|-------|
| Professional DMs | Commission Chats |
| Professional Profile | Artist Dashboard |
| Professional profile (nav) | Artist Dashboard |
| Professional DMs (nav) | Commission Chats |
| Commission request (pinned card label) | Brief |
| Reference photos | Reference Images |
| Mark as delivered | Submit Delivery |
| Upload & mark delivered | Upload & Submit |
| Confirm receipt & release payment | Approve & Release Payment |
| Cancel request | Withdraw Request |
| Waiting for buyer payment | Awaiting Payment |

- [ ] **Step 1: Update `app/professional-dms/page.tsx`**

Change:
```tsx
<h1 className="text-xl font-bold text-gray-900 mb-6">Professional DMs</h1>
```
To:
```tsx
<h1 className="text-xl font-bold text-gray-900 mb-6">Commission Chats</h1>
```

- [ ] **Step 2: Update `app/professional-profile/page.tsx`**

Change:
```tsx
<h1 className="text-2xl font-bold text-gray-900 mb-1">Professional Profile</h1>
<p className="text-sm text-gray-500 mb-8">Manage your commission settings and view your business overview.</p>
```
To:
```tsx
<h1 className="text-2xl font-bold text-gray-900 mb-1">Artist Dashboard</h1>
<p className="text-sm text-gray-500 mb-8">Manage your commission settings and track your business.</p>
```

- [ ] **Step 3: Update `components/Navbar.tsx`**

Change menu item labels:
```tsx
// "Professional profile" → "Artist Dashboard"
// "Professional DMs" → "Commission Chats"
```

- [ ] **Step 4: Update action labels in `app/professional-dms/[id]/page.tsx`**

Make the following string replacements:
- `"Commission request"` (pinned card label) → `"Brief"`
- `"Reference photos"` → `"Reference Images"`
- `"Upload & mark delivered"` → `"Upload & Submit Delivery"`
- `"Mark as delivered"` → `"Submit Delivery"`
- `"Confirm receipt & release payment"` → `"Approve & Release Payment"`
- `"Cancel request"` → `"Withdraw Request"`
- `"Awaiting buyer payment"` / `"Waiting for payment"` → `"Awaiting Payment"`
- `"This thread is closed"` → `"This commission is closed"`

- [ ] **Step 5: Update `components/BottomNav.tsx`** if it has any hardcoded label strings.

- [ ] **Step 6: TypeScript check + commit**
```bash
npx tsc --noEmit
git add -A
git commit -m "feat: professional naming pass across commission UI"
```

---

### Task 3: Auto-delete read notifications after 24 h

**Files:**
- Modify: `server/routers/notification.ts`

Strategy: At the top of `getAll`, delete any notifications for this user that are `read = true` AND `createdAt < now - 24h`. This runs lazily (no cron needed) every time the user opens their notification panel.

- [ ] **Step 1: Update `server/routers/notification.ts`**

```ts
import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc"

export const notificationRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    // Lazily clean up read notifications older than 24 h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await ctx.prisma.notification.deleteMany({
      where: {
        userId: ctx.session.user.id,
        read: true,
        createdAt: { lt: cutoff },
      },
    })

    return ctx.prisma.notification.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        fromUser: {
          select: { username: true, name: true, image: true },
        },
      },
    })
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.notification.count({
      where: { userId: ctx.session.user.id, read: false },
    })
    return { count }
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({
      where: { userId: ctx.session.user.id, read: false },
      data: { read: true },
    })
  }),
})
```

- [ ] **Step 2: TypeScript check + commit**
```bash
npx tsc --noEmit
git add server/routers/notification.ts
git commit -m "feat: auto-delete read notifications after 24h"
```

---

### Task 4: Commission status changes as system messages in chat

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `server/routers/commission.ts`
- Modify: `app/professional-dms/[id]/page.tsx`

System messages are created by the server (not a real user) when a commission status changes. They render differently in the thread — centred, muted, no bubble.

Since `ProfessionalMessage.senderId` is a required FK, system messages will use the acting user's id as sender but be flagged with `isSystem = true` so the UI renders them as neutral status events.

- [ ] **Step 1: Add `isSystem` to `ProfessionalMessage` in `prisma/schema.prisma`**

In the `ProfessionalMessage` model, add after `fileUrl`:
```prisma
isSystem     Boolean  @default(false)
```

Full updated model:
```prisma
model ProfessionalMessage {
  id           String     @id @default(cuid())
  commissionId String
  commission   Commission @relation(fields: [commissionId], references: [id], onDelete: Cascade)
  senderId     String
  sender       User       @relation("SentProfessionalMessages", fields: [senderId], references: [id], onDelete: Cascade)
  text         String?    @db.Text
  fileUrl      String?    @db.Text
  isSystem     Boolean    @default(false)
  createdAt    DateTime   @default(now())

  @@index([commissionId])
}
```

- [ ] **Step 2: Run migration**
```bash
npx prisma migrate dev --name add-system-message-flag
```
Expected: "Your database is now in sync with your schema."

- [ ] **Step 3: Add helper in `server/routers/commission.ts`**

Add this helper function near the top of the file (after imports):
```ts
async function createSystemMessage(
  prisma: PrismaClient,
  commissionId: string,
  senderId: string,
  text: string
) {
  return prisma.professionalMessage.create({
    data: { commissionId, senderId, text, isSystem: true },
  })
}
```

Note: `PrismaClient` import comes from `@prisma/client`. Add it if not already imported:
```ts
import { Prisma, PrismaClient } from "@prisma/client"
```

Actually the `ctx.prisma` is typed as the Prisma client from the context. Use the context type instead:
```ts
async function createSystemMessage(
  prisma: { professionalMessage: { create: Function } },
  commissionId: string,
  senderId: string,
  text: string
) {
  return (prisma as any).professionalMessage.create({
    data: { commissionId, senderId, text, isSystem: true },
  })
}
```

A cleaner pattern — inline the call at each mutation site instead of a helper:
```ts
await ctx.prisma.professionalMessage.create({
  data: { commissionId: id, senderId: ctx.session.user.id, text: "...", isSystem: true },
})
```

Use the inline pattern throughout.

- [ ] **Step 4: Add system messages to every status-change mutation in `server/routers/commission.ts`**

In each mutation, after updating the commission status and creating the notification, add a `professionalMessage.create` call. Use the `id` from the mutation input (the commission id) and `ctx.session.user.id` as sender.

**`accept` mutation** — add after the commission update:
```ts
await ctx.prisma.professionalMessage.create({
  data: {
    commissionId: id,
    senderId: ctx.session.user.id,
    text: `Commission accepted at $${input.price}. Awaiting payment.`,
    isSystem: true,
  },
})
```

**`decline` mutation** — add after the update:
```ts
await ctx.prisma.professionalMessage.create({
  data: { commissionId: id, senderId: ctx.session.user.id, text: "Commission request declined.", isSystem: true },
})
```

**`cancel` mutation** — add after the update:
```ts
await ctx.prisma.professionalMessage.create({
  data: { commissionId: id, senderId: ctx.session.user.id, text: "Commission cancelled.", isSystem: true },
})
```

**`confirmPayment` mutation** — add after the update:
```ts
await ctx.prisma.professionalMessage.create({
  data: { commissionId: id, senderId: ctx.session.user.id, text: "Payment confirmed. Commission is now in progress.", isSystem: true },
})
```

**`markDelivered` mutation** — add after the update:
```ts
await ctx.prisma.professionalMessage.create({
  data: { commissionId: id, senderId: ctx.session.user.id, text: "Delivery submitted. Please review and approve.", isSystem: true },
})
```

**`confirmDelivery` mutation** — add after the update:
```ts
await ctx.prisma.professionalMessage.create({
  data: { commissionId: id, senderId: ctx.session.user.id, text: "Commission complete. Payment released to the artist.", isSystem: true },
})
```

- [ ] **Step 5: Update `app/professional-dms/[id]/page.tsx` — render system messages**

The `commission.messages` array now has an `isSystem` field. Update the messages render loop:

```tsx
{commission.messages.map(msg => {
  // System messages render as centred status pills
  if (msg.isSystem) {
    return (
      <div key={msg.id} className="flex justify-center my-3">
        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {msg.text}
        </span>
      </div>
    )
  }

  const isMe = msg.senderId === userId
  return (
    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
      <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {msg.fileUrl && (
          <img
            src={msg.fileUrl}
            alt="Delivered file"
            className={`max-w-full rounded-2xl border border-gray-200 ${isMe ? "rounded-tr-sm" : "rounded-tl-sm"}`}
          />
        )}
        {msg.text && (
          <div className={`px-4 py-2.5 rounded-2xl text-sm ${
            isMe
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-gray-100 text-gray-800 rounded-tl-sm"
          }`}>
            {msg.text}
          </div>
        )}
        <p className="text-[10px] text-gray-400 px-1">{timeAgo(msg.createdAt)}</p>
      </div>
    </div>
  )
})}
```

- [ ] **Step 6: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 7: Commit**
```bash
git add prisma/schema.prisma server/routers/commission.ts app/professional-dms/[id]/page.tsx
git commit -m "feat: commission status changes appear as system messages in chat"
```

---

### Task 5: Deploy

- [ ] **Step 1: Full build check**
```bash
npx tsc --noEmit
```

- [ ] **Step 2: Deploy**
```bash
npx vercel --prod
```
Expected: "Production: https://..."
