# Notifications System Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the notification system so admin actions send branded "Gallery" notices, strikes are silent, and admins can send individual and mass notices.

**Architecture:** Schema migration makes fromUserId nullable and adds a message field. Gallery-admin router is updated to fire/remove notifications correctly. Gallery BottomNav gains rendering for system notification types. Two new admin pages handle individual and mass notice sending.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 5, TypeScript, Vitest — both repos share the same Postgres DB.

---

## Task 1: Schema migration (gallery repo)

- [ ] Edit `prisma/schema.prisma` in the gallery repo — update the `Notification` model:

```prisma
model Notification {
  id         String    @id @default(cuid())
  userId     String
  fromUserId String?                          // nullable — null for system/admin notices
  type       String
  message    String?                          // stores text for system notices and admin messages
  read       Boolean   @default(false)
  createdAt  DateTime  @default(now())
  user       User      @relation("ReceivedNotifications", fields: [userId], references: [id], onDelete: Cascade)
  fromUser   User?     @relation("SentNotifications", fields: [fromUserId], references: [id], onDelete: Cascade)
}
```

The `// "follow"` comment on the `type` field can be removed. The three changed lines vs. current schema are:
- `fromUserId String` → `fromUserId String?`
- Added `message    String?` field (after `type`)
- `fromUser   User` → `fromUser   User?`

- [ ] Run the migration from inside the gallery repo directory:

```bash
npx prisma migrate dev --name add_notification_message_nullable_sender
```

- [ ] Copy the updated `prisma/schema.prisma` to the gallery-admin repo and regenerate the client:

```bash
cp prisma/schema.prisma ../gallery-admin/prisma/schema.prisma
cd ../gallery-admin
npx prisma generate
cd ../gallery
```

- [ ] Write a Vitest test at `tests/notification-nullable-sender.test.ts` (gallery repo):

```ts
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
```

- [ ] Run `npx vitest run tests/notification-nullable-sender.test.ts` — verify it passes.

- [ ] Commit both repos:

```bash
# In gallery repo
git add prisma/schema.prisma prisma/migrations/ tests/notification-nullable-sender.test.ts
git commit -m "feat: make Notification.fromUserId nullable, add message field"

# In gallery-admin repo
cd ../gallery-admin
git add prisma/schema.prisma
git commit -m "chore: sync schema — Notification.fromUserId nullable, message field"
cd ../gallery
```

---

## Task 2: Fix gallery-admin router notifications

File: `gallery-admin/server/routers/admin.ts`

### 2a — `issueStrike`: remove notification entirely

- [ ] In `issueStrike`, delete the entire `await tx.notification.create(...)` block inside the `$transaction`. The transaction should only create the strike row:

```ts
return ctx.prisma.$transaction(async tx => {
  const s = await tx.strike.create({
    data: {
      userId: input.userId,
      issuedById: ctx.session.user.id,
      level: input.level,
      violation: input.violation,
      isSelling: isSellingViolation(input.violation),
      contentId: input.contentId,
      contentType: input.contentType,
      notes: input.notes,
    },
  })
  return s
})
```

### 2b — `issueBan`: set fromUserId null, add message

- [ ] In `issueBan`, replace the `notification.create` call inside the `$transaction`:

```ts
return ctx.prisma.$transaction(async tx => {
  const u = await tx.user.update({
    where: { id: input.userId },
    data: { bannedUntil: getBanDate(input.duration), banReason: input.reason },
    select: { id: true, bannedUntil: true },
  })
  const parts = ["Your account has been suspended."]
  if (input.duration) parts.push(`Duration: ${input.duration}.`)
  if (input.reason) parts.push(`Reason: ${input.reason}.`)
  const message = parts.join(" ")
  await tx.notification.create({
    data: {
      userId: input.userId,
      fromUserId: null,
      type: "ban",
      message,
    },
  })
  return u
})
```

### 2c — `liftBan`: add notification

- [ ] In `liftBan`, the procedure currently calls `ctx.prisma.user.update(...)` directly (no transaction). Wrap it in a transaction and add the notification:

```ts
return ctx.prisma.$transaction(async tx => {
  const u = await tx.user.update({
    where: { id: input.userId },
    data: { bannedUntil: null, banReason: null },
    select: { id: true, bannedUntil: true },
  })
  await tx.notification.create({
    data: {
      userId: input.userId,
      fromUserId: null,
      type: "lift_ban",
      message: "Your account suspension has been lifted.",
    },
  })
  return u
})
```

### 2d — `deletePost`: fetch post owner and add notification

- [ ] In `deletePost`, look up the post before deleting so we have `userId`, then notify:

```ts
deletePost: modProcedure
  .input(z.object({ postId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const post = await ctx.prisma.post.findUnique({
      where: { id: input.postId },
      select: { userId: true },
    })
    if (!post) throw new TRPCError({ code: "NOT_FOUND" })
    await ctx.prisma.$transaction(async tx => {
      await tx.post.delete({ where: { id: input.postId } })
      await tx.notification.create({
        data: {
          userId: post.userId,
          fromUserId: null,
          type: "post_deleted",
          message: "A post on your account was removed for violating Gallery's Terms of Service.",
        },
      })
    })
    return { success: true }
  }),
```

### 2e — `approveAppeal`: set fromUserId null, add message

- [ ] In `approveAppeal`, update the `notification.create` inside the `$transaction`:

```ts
await tx.notification.create({
  data: {
    userId: appeal.userId,
    fromUserId: null,
    type: "appeal_approved",
    message: "Your appeal has been approved. The action has been reversed.",
  },
})
```

### 2f — `denyAppeal`: set fromUserId null, add message

- [ ] In `denyAppeal`, update the `notification.create` inside the `$transaction`:

```ts
await tx.notification.create({
  data: {
    userId: appeal.userId,
    fromUserId: null,
    type: "appeal_denied",
    message: "Your appeal has been reviewed and denied.",
  },
})
```

### 2g — `reverseStrike`: add notification

- [ ] In `reverseStrike`, wrap the update in a transaction and add the notification. The current procedure has `strike.userId` available after the `findUnique`:

```ts
reverseStrike: modProcedure
  .input(z.object({ strikeId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const strike = await ctx.prisma.strike.findUnique({ where: { id: input.strikeId } })
    if (!strike) throw new TRPCError({ code: "NOT_FOUND" })
    return ctx.prisma.$transaction(async tx => {
      const s = await tx.strike.update({
        where: { id: input.strikeId },
        data: { reversed: true },
      })
      await tx.notification.create({
        data: {
          userId: strike.userId,
          fromUserId: null,
          type: "strike_reversed",
          message: "A moderation action on your account has been reversed.",
        },
      })
      return s
    })
  }),
```

- [ ] Run `npx tsc --noEmit` from the gallery-admin root — verify no TypeScript errors.

- [ ] Commit:

```bash
cd ../gallery-admin
git add server/routers/admin.ts
git commit -m "feat: fix admin router notifications — strikes silent, system sender for all mod actions"
cd ../gallery
```

---

## Task 3: Update gallery notification UI

File: `gallery/components/BottomNav.tsx`

The `NotificationPanel` component at line 79 must be updated to handle system notifications (where `fromUser` is `null`) safely.

### 3a — Determine system notification types

The following `type` strings are system/admin notices (no `fromUser`):
`ban`, `lift_ban`, `post_deleted`, `appeal_approved`, `appeal_denied`, `strike_reversed`, `site_notice`

### 3b — Replace the `notifications.map(...)` block

- [ ] Replace the entire `notifications.map((n) => { ... })` section (lines 105–144) with the following:

```tsx
notifications.map((n) => {
  const isSystem = n.fromUserId === null || n.fromUser === null

  function getLink(): string | null {
    if (isSystem) return null
    if (n.type === "follow") return `/@${n.fromUser!.username}`
    const [prefix, id] = n.type.split(":")
    if (prefix === "dm") return `/messages/${id}`
    return `/professional-dms/${id}`
  }

  function getText(): string {
    if (n.message) return n.message
    const map: Record<string, string> = {
      follow: "started following you",
      dm: "sent you a message",
      commission_request: "sent you a commission request",
      commission_accepted: "accepted your commission",
      commission_declined: "declined your commission",
      commission_delivered: "delivered your commission",
      commission_complete: "marked commission complete",
      ban: "Your account has been suspended.",
      lift_ban: "Your account suspension has been lifted.",
      post_deleted: "A post was removed from your account.",
      appeal_approved: "Your appeal has been approved.",
      appeal_denied: "Your appeal has been denied.",
      strike_reversed: "A moderation action has been reversed.",
    }
    const prefix = n.type.split(":")[0]
    return map[prefix] ?? n.type
  }

  const link = getLink()

  return (
    <button
      key={n.id}
      onClick={() => {
        onClose()
        markAllRead.mutate(undefined, { onSuccess: () => utils.notification.unreadCount.invalidate() })
        if (link) router.push(link)
      }}
      className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
      style={{ background: !n.read ? "rgba(176,68,248,0.08)" : "transparent" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
      onMouseLeave={e => (e.currentTarget.style.background = !n.read ? "rgba(176,68,248,0.08)" : "transparent")}
    >
      {isSystem ? (
        <div
          className="flex-shrink-0 flex items-center justify-center text-white font-bold text-base"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
          }}
        >
          🛡
        </div>
      ) : (
        <Avatar src={n.fromUser!.image} name={n.fromUser!.name} username={n.fromUser!.username} size={32} />
      )}
      <p className="text-sm text-white/80 flex-1 min-w-0">
        <span className="font-semibold text-white">
          {isSystem ? "Gallery" : `@${n.fromUser!.username}`}
        </span>{" "}
        {getText()}
      </p>
    </button>
  )
})
```

### 3c — Verify the tRPC notification query includes the new fields

- [ ] Check `server/routers/notification.ts` (gallery repo). Confirm that `getAll` selects `fromUserId`, `message`, and the `fromUser` relation. If `fromUserId` or `message` are absent from the `select`, add them. Example shape required:

```ts
select: {
  id: true,
  type: true,
  read: true,
  createdAt: true,
  fromUserId: true,   // must be present
  message: true,      // must be present
  fromUser: {
    select: { username: true, image: true, name: true },
  },
}
```

- [ ] Run `npx tsc --noEmit` from the gallery root — verify no TypeScript errors.

- [ ] Commit:

```bash
git add components/BottomNav.tsx
# If notification router was changed:
git add server/routers/notification.ts
git commit -m "feat: render system notifications in BottomNav — Gallery avatar, null-safe fromUser"
```

---

## Task 4: sendNotice procedure + user detail UI (gallery-admin)

### 4a — Add `sendNotice` procedure

File: `gallery-admin/server/routers/admin.ts`

- [ ] Add the following procedure to `adminRouter`, before the closing `})`:

```ts
// ── Notices ──────────────────────────────────────────────────────────────────

sendNotice: modProcedure
  .input(z.object({
    userId: z.string(),
    message: z.string().min(1).max(1000),
  }))
  .mutation(async ({ ctx, input }) => {
    await ctx.prisma.notification.create({
      data: {
        userId: input.userId,
        fromUserId: null,
        type: "site_notice",
        message: input.message,
      },
    })
    return { success: true }
  }),
```

### 4b — Add "Send Notice" section to user detail page

File: `gallery-admin/app/users/[id]/page.tsx`

- [ ] Add the following state variables inside the component (alongside existing state at the top):

```ts
const NOTICE_TEMPLATES: Record<string, string> = {
  "Account Warning": "Your account has received a warning from Gallery. Please review our Terms of Service.",
  "Terms Reminder": "Reminder: Gallery's Terms of Service require all content to meet our community standards.",
  "Account Review": "Your account is currently under review. You may continue using Gallery normally while this is in progress.",
  "Good Standing": "Your account has been reviewed and is in good standing. Thank you for being part of the Gallery community.",
  Custom: "",
}

const [noticeTemplate, setNoticeTemplate] = useState<string>("Account Warning")
const [noticeMessage, setNoticeMessage] = useState<string>(NOTICE_TEMPLATES["Account Warning"])
const [noticeSent, setNoticeSent] = useState(false)
const [noticeError, setNoticeError] = useState<string | null>(null)

const sendNotice = trpc.admin.sendNotice.useMutation({
  onSuccess: () => {
    setNoticeSent(true)
    setNoticeError(null)
    setTimeout(() => setNoticeSent(false), 3000)
  },
  onError: (err) => {
    setNoticeError(err.message)
  },
})
```

- [ ] Add a handler for template selection changes (place alongside the state above):

```ts
function handleTemplateChange(label: string) {
  setNoticeTemplate(label)
  if (label !== "Custom") {
    setNoticeMessage(NOTICE_TEMPLATES[label])
  }
}
```

- [ ] Add the "Send Notice" section JSX. Place it **before** the `{/* Ban modal */}` comment (i.e., between the Posts grid and the modals):

```tsx
{/* Send Notice */}
<div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Send Notice</p>
  <select
    value={noticeTemplate}
    onChange={e => handleTemplateChange(e.target.value)}
    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14 }}
  >
    {Object.keys(NOTICE_TEMPLATES).map(label => (
      <option key={label} value={label}>{label}</option>
    ))}
  </select>
  <textarea
    value={noticeMessage}
    onChange={e => setNoticeMessage(e.target.value)}
    rows={4}
    placeholder="Notice message…"
    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
  />
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <button
      onClick={() => sendNotice.mutate({ userId: id, message: noticeMessage })}
      disabled={!noticeMessage.trim() || sendNotice.isPending}
      style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(176,68,248,0.2)", border: "1px solid rgba(176,68,248,0.4)", color: "#c084fc", cursor: "pointer" }}
    >
      {sendNotice.isPending ? "Sending…" : "Send Notice"}
    </button>
    {noticeSent && <span style={{ color: "#4ade80", fontSize: 13 }}>✓ Notice sent</span>}
    {noticeError && <span style={{ color: "#f87171", fontSize: 13 }}>{noticeError}</span>}
  </div>
</div>
```

- [ ] Run `npx tsc --noEmit` from the gallery-admin root.

- [ ] Commit:

```bash
cd ../gallery-admin
git add server/routers/admin.ts app/users/
git commit -m "feat: sendNotice procedure + Send Notice UI on user detail page"
cd ../gallery
```

---

## Task 5: sendMassNotice + notices page (gallery-admin)

### 5a — Add `getUserCount` and `sendMassNotice` procedures

File: `gallery-admin/server/routers/admin.ts`

- [ ] Add the following two procedures to `adminRouter` in the `// ── Notices ──` section (after `sendNotice`):

```ts
getUserCount: modProcedure
  .query(async ({ ctx }) => {
    const count = await ctx.prisma.user.count({
      where: { bannedUntil: null },
    })
    return { count }
  }),

sendMassNotice: adminProcedure
  .input(z.object({
    message: z.string().min(1).max(1000),
  }))
  .mutation(async ({ ctx, input }) => {
    const activeUsers = await ctx.prisma.user.findMany({
      where: { bannedUntil: null },
      select: { id: true },
    })
    await ctx.prisma.notification.createMany({
      data: activeUsers.map((u) => ({
        userId: u.id,
        fromUserId: null,
        type: "site_notice",
        message: input.message,
      })),
    })
    return { count: activeUsers.length }
  }),
```

> **Note on `getUserCount`:** The spec and the `sendMassNotice` target "non-banned users". In the current schema, `bannedUntil` being non-null means the user is banned (whether the ban has expired or not). To be consistent with `issueBan`/`liftBan` which set `bannedUntil: null` on lift, we use `where: { bannedUntil: null }` to match only users who have never been banned or had their ban lifted. If the intent is to exclude only users with a future `bannedUntil`, change to `where: { OR: [{ bannedUntil: null }, { bannedUntil: { lte: new Date() } }] }`. Confirm with product before shipping.

### 5b — Create the notices page

File: `gallery-admin/app/notices/page.tsx` (new file)

- [ ] Create the file:

```tsx
"use client"

import { useState } from "react"
import AdminLayout from "@/components/AdminLayout"
import { trpc } from "@/components/providers"

export default function NoticesPage() {
  const [message, setMessage] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)
  const [sentCount, setSentCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: countData } = trpc.admin.getUserCount.useQuery()
  const userCount = countData?.count ?? 0

  const sendMassNotice = trpc.admin.sendMassNotice.useMutation({
    onSuccess: (data) => {
      setSentCount(data.count)
      setShowConfirm(false)
      setMessage("")
      setError(null)
    },
    onError: (err) => {
      setError(err.message)
      setShowConfirm(false)
    },
  })

  return (
    <AdminLayout>
      <div style={{ maxWidth: 600 }}>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
          Send Notice to All Users
        </h1>

        {sentCount !== null ? (
          <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <p style={{ color: "#4ade80", fontSize: 16, fontWeight: 600 }}>✓ Sent to {sentCount} users.</p>
          </div>
        ) : null}

        {error && (
          <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <p style={{ color: "#f87171", fontSize: 14 }}>{error}</p>
          </div>
        )}

        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Notice Message
          </p>
          <textarea
            value={message}
            onChange={e => { setMessage(e.target.value); setSentCount(null) }}
            rows={6}
            placeholder="Write your notice here…"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
          />
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 6 }}>
            {message.length}/1000 characters
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!message.trim() || message.length > 1000}
            style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "rgba(176,68,248,0.2)", border: "1px solid rgba(176,68,248,0.4)", color: "#c084fc", cursor: "pointer" }}
          >
            Send to All
          </button>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
            Will notify {userCount} active users
          </span>
        </div>

        {/* Confirmation dialog */}
        {showConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 28, width: 380 }}>
              <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Confirm Mass Notice</h2>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
                This will send a notice to <strong style={{ color: "white" }}>{userCount} users</strong>. Are you sure?
              </p>
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.5, margin: 0 }}>{message}</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowConfirm(false)}
                  style={{ flex: 1, padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", cursor: "pointer", fontSize: 14 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => sendMassNotice.mutate({ message })}
                  disabled={sendMassNotice.isPending}
                  style={{ flex: 1, padding: 10, borderRadius: 8, background: "rgba(176,68,248,0.25)", border: "1px solid rgba(176,68,248,0.5)", color: "#c084fc", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
                >
                  {sendMassNotice.isPending ? "Sending…" : "Send to All"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
```

### 5c — Add "Notices" to admin nav

File: `gallery-admin/components/AdminLayout.tsx`

- [ ] Update the `navItems` array — insert `{ href: "/notices", label: "Notices" }` between Posts and Appeals:

```ts
const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/posts", label: "Posts" },
  { href: "/notices", label: "Notices" },
  { href: "/appeals", label: "Appeals" },
]
```

- [ ] Run `npx tsc --noEmit` from the gallery-admin root.

- [ ] Commit:

```bash
cd ../gallery-admin
git add server/routers/admin.ts app/notices/page.tsx components/AdminLayout.tsx
git commit -m "feat: sendMassNotice procedure, notices page, Notices nav link"
cd ../gallery
```

---

## Self-review checklist

- [x] Schema migration is non-destructive (additive nullable fields only)
- [x] `fromUserId` is nullable in both the Prisma schema and all new `notification.create` calls
- [x] `message` is populated for every system notification type
- [x] `issueStrike` no longer creates any notification row
- [x] `liftBan` now uses a transaction to create its notification atomically
- [x] `deletePost` fetches the post before deleting so `userId` is available for the notification
- [x] `reverseStrike` (gallery-admin) fetches the strike before the transaction so `strike.userId` is in scope
- [x] `getLink()` in BottomNav returns `null` for system types — click only marks read
- [x] `getText()` prefers `n.message` over hardcoded fallback strings
- [x] `n.fromUser!` non-null assertions are only used inside the `!isSystem` branch
- [x] `getUserCount` and `sendMassNotice` target `bannedUntil: null` consistently
- [x] `sendMassNotice` is guarded by `adminProcedure`; `sendNotice` and `getUserCount` are guarded by `modProcedure`
- [x] `npx tsc --noEmit` is run in every task
- [x] Every task has a git commit
- [x] No TBDs, no placeholder code
