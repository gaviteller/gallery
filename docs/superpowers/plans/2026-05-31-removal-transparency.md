# Removal Transparency & Appeal Discoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give post owners a 15-day window to see removed content with a reason, and make the appeal flow easy to find from four touchpoints.

**Architecture:** Two new Post fields (`removedAt`, `removalReason`) power the grace period purely through query-time filtering — no new statuses. The profile page shows REMOVED posts to the owner only within 15 days. The appeal page reads `?postId` from the URL for pre-selection. Nav and notifications get direct "Appeals" links.

**Tech Stack:** Next.js App Router, tRPC v11, Prisma (PostgreSQL/Neon), Vitest, TypeScript

---

## File Map

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `removedAt DateTime?` and `removalReason String?` to Post |
| `prisma/migrations/20260531000000_removal_transparency/migration.sql` | Create |
| `server/routers/post.ts` | `getByUsername` — include REMOVED posts within 15 days for owner |
| `server/routers/user.ts` | `getMyRemovedPosts` — 15-day filter, return `removedAt` + `removalReason` |
| `app/api/cron/pending-expiry/route.ts` | Set `removedAt` + `removalReason` on auto-removal |
| `app/[username]/page.tsx` | Removed post overlay with reason + "Appeal →" link |
| `app/appeal/page.tsx` | Show reason on cards, read `?postId` URL param for pre-selection |
| `components/Navbar.tsx` | "Appeals" in dropdown + "Appeal →" on post_removed notifications |
| `components/BottomNav.tsx` | "Appeal →" on post_removed notifications |
| `gallery-admin/server/routers/admin.ts` | `resolvePendingPost` sets `removedAt` + `removalReason`; add `removalReason` input |
| `gallery-admin/app/pending/page.tsx` | Add reason input to Remove Now button |
| `tests/removal-transparency.test.ts` | Create — unit tests for 15-day window logic |
| `docs/roadmap.md` | Update |

---

### Task 1: Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260531000000_removal_transparency/migration.sql`

**Context:** The Post model is at line 163 of schema.prisma. Current fields after `flagReason String?` (line 177): `reportCount Int @default(0)`. Add two fields after `flagReason`.

- [ ] **Step 1: Add fields to schema.prisma**

In `prisma/schema.prisma`, after line 177 (`flagReason    String?`), add:

```prisma
  removedAt     DateTime?
  removalReason String?
```

The Post model should now look like:
```prisma
model Post {
  id            String     @id @default(cuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  image         String     @db.Text
  title         String?
  description   String?
  isAiGenerated Boolean    @default(false)
  isCommission  Boolean    @default(false)
  pinned        Boolean    @default(false)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  status        PostStatus @default(PUBLISHED)
  pendingAt     DateTime?
  flagReason    String?
  removedAt     DateTime?
  removalReason String?
  reportCount   Int        @default(0)
  likes         Like[]
  comments      Comment[]
  hashtags      Hashtag[]
  reports       Report[]
  appeals       Appeal[]
}
```

- [ ] **Step 2: Create migration file**

Create `prisma/migrations/20260531000000_removal_transparency/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "Post" ADD COLUMN "removedAt" TIMESTAMP(3),
ADD COLUMN "removalReason" TEXT;
```

- [ ] **Step 3: Apply migration**

Run:
```bash
cd C:\Users\gavri\OneDrive\Documents\Projects\gallery
npx prisma migrate deploy
npx prisma generate
```

Expected: Migration applied, client regenerated.

- [ ] **Step 4: Verify tests still pass**

```bash
npx vitest run
```

Expected: All tests pass (no schema-related failures).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260531000000_removal_transparency/
git commit -m "feat: add removedAt and removalReason fields to Post"
```

---

### Task 2: Update pending-expiry cron to set removedAt + removalReason

**Files:**
- Modify: `app/api/cron/pending-expiry/route.ts`

**Context:** This cron fires daily and sets `status: "REMOVED"` on posts that have been in PENDING_REVIEW for 14+ days. It's at `app/api/cron/pending-expiry/route.ts`. Currently the update only sets `status: "REMOVED"` — we need to also set `removedAt` and `removalReason`.

- [ ] **Step 1: Update the post update inside the transaction**

Replace the existing transaction block in `route.ts`:

```ts
await ctx.prisma.$transaction(async (tx) => {
  await tx.post.update({
    where: { id: post.id },
    data: { status: "REMOVED" },
  })
  ...
})
```

With:

```ts
await prisma.$transaction(async (tx) => {
  await tx.post.update({
    where: { id: post.id },
    data: {
      status: "REMOVED",
      removedAt: new Date(),
      removalReason: "This post was not resolved within the 14-day review period.",
    },
  })
  await tx.notification.create({
    data: { userId: post.userId, fromUserId: null, type: "post_auto_removed" },
  })
})
```

The full updated file:

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPostAutoRemovedEmail } from "@/lib/email"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const expired = await prisma.post.findMany({
    where: { status: "PENDING_REVIEW", pendingAt: { lt: cutoff } },
    select: { id: true, userId: true, user: { select: { email: true, username: true } } },
  })

  for (const post of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: post.id },
        data: {
          status: "REMOVED",
          removedAt: new Date(),
          removalReason: "This post was not resolved within the 14-day review period.",
        },
      })
      await tx.notification.create({
        data: { userId: post.userId, fromUserId: null, type: "post_auto_removed" },
      })
    })
    if (post.user.email) {
      void sendPostAutoRemovedEmail(post.user.email, { username: post.user.username ?? "there" })
    }
  }

  return NextResponse.json({ removed: expired.length })
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/pending-expiry/route.ts
git commit -m "feat: set removedAt and removalReason on auto-expiry cron"
```

---

### Task 3: Update `getByUsername` + `getMyRemovedPosts` tRPC queries

**Files:**
- Modify: `server/routers/post.ts` (lines 145–161)
- Modify: `server/routers/user.ts` (lines 170–176)
- Create: `tests/removal-transparency.test.ts`

**Context:**
- `post.getByUsername` at line 145 of `server/routers/post.ts` currently returns `status: { in: ["PUBLISHED", "PENDING_REVIEW"] }` for owners and `"PUBLISHED"` for others. We extend it to also return REMOVED posts within 15 days for the owner.
- `user.getMyRemovedPosts` at line 170 of `server/routers/user.ts` returns all REMOVED posts forever. We limit to 15 days and add `removedAt` + `removalReason` to the select.
- Tests use Vitest + `@vitest/mock`. Check existing tests in `tests/` for patterns — they use `vi.mock`, mock prisma, and test pure logic.

- [ ] **Step 1: Write failing tests**

Create `tests/removal-transparency.test.ts`:

```ts
import { describe, it, expect } from "vitest"

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000

function isWithin15Days(removedAt: Date | null): boolean {
  if (!removedAt) return false
  return Date.now() - removedAt.getTime() < FIFTEEN_DAYS_MS
}

describe("isWithin15Days", () => {
  it("returns true for a post removed 1 day ago", () => {
    const removedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    expect(isWithin15Days(removedAt)).toBe(true)
  })

  it("returns true for a post removed exactly 14 days ago", () => {
    const removedAt = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    expect(isWithin15Days(removedAt)).toBe(true)
  })

  it("returns false for a post removed 15 days ago", () => {
    const removedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 - 1000)
    expect(isWithin15Days(removedAt)).toBe(false)
  })

  it("returns false for a post removed 30 days ago", () => {
    const removedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    expect(isWithin15Days(removedAt)).toBe(false)
  })

  it("returns false for null removedAt", () => {
    expect(isWithin15Days(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/removal-transparency.test.ts
```

Expected: FAIL — `isWithin15Days is not defined`

- [ ] **Step 3: Create the utility**

Create `lib/removal.ts`:

```ts
const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000

export function isWithin15Days(removedAt: Date | null): boolean {
  if (!removedAt) return false
  return Date.now() - removedAt.getTime() < FIFTEEN_DAYS_MS
}

export const REMOVAL_GRACE_CUTOFF = () => new Date(Date.now() - FIFTEEN_DAYS_MS)
```

- [ ] **Step 4: Update test to import from lib**

Update the import in `tests/removal-transparency.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { isWithin15Days } from "@/lib/removal"

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000

// ... rest of tests unchanged
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/removal-transparency.test.ts
```

Expected: 5/5 PASS

- [ ] **Step 6: Update `post.getByUsername`**

In `server/routers/post.ts`, replace the `getByUsername` query (around line 154–160):

```ts
// Before:
return ctx.prisma.post.findMany({
  where: {
    userId: user.id,
    status: isOwner ? { in: ["PUBLISHED", "PENDING_REVIEW"] } : "PUBLISHED",
  },
  orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
})
```

With:

```ts
const graceCutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)

return ctx.prisma.post.findMany({
  where: isOwner
    ? {
        userId: user.id,
        OR: [
          { status: { in: ["PUBLISHED", "PENDING_REVIEW"] } },
          { status: "REMOVED", removedAt: { gte: graceCutoff } },
        ],
      }
    : { userId: user.id, status: "PUBLISHED" },
  orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
})
```

- [ ] **Step 7: Update `user.getMyRemovedPosts`**

In `server/routers/user.ts`, replace lines 170–176:

```ts
// Before:
getMyRemovedPosts: protectedProcedure.query(async ({ ctx }) => {
  return ctx.prisma.post.findMany({
    where: { userId: ctx.session.user.id, status: "REMOVED" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, image: true, updatedAt: true, flagReason: true },
  })
}),
```

With:

```ts
getMyRemovedPosts: protectedProcedure.query(async ({ ctx }) => {
  const graceCutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
  return ctx.prisma.post.findMany({
    where: {
      userId: ctx.session.user.id,
      status: "REMOVED",
      removedAt: { gte: graceCutoff },
    },
    orderBy: { removedAt: "desc" },
    select: { id: true, image: true, removedAt: true, removalReason: true },
  })
}),
```

Note: `flagReason` is removed from the select — it's internal. We now return `removedAt` and `removalReason` instead of `updatedAt` and `flagReason`.

- [ ] **Step 8: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add lib/removal.ts server/routers/post.ts server/routers/user.ts tests/removal-transparency.test.ts
git commit -m "feat: 15-day removal grace window in getByUsername and getMyRemovedPosts"
```

---

### Task 4: Profile page — removed post overlay

**Files:**
- Modify: `app/[username]/page.tsx`

**Context:** The profile grid is around line 526 of `app/[username]/page.tsx`. Posts are rendered in a `grid grid-cols-3` div. Currently a `PENDING_REVIEW` badge is shown at line 554. We need to add a REMOVED overlay for the owner when `post.status === "REMOVED"`. The post data from `getByUsername` now includes `removedAt` and `removalReason` for REMOVED posts.

The `PostItem` type (line 33) currently has:
```ts
  status: string
```
It needs `removedAt` and `removalReason` added. Check the existing type definition and extend it.

- [ ] **Step 1: Extend the PostItem type**

Find the `PostItem` type/interface near line 33 in `app/[username]/page.tsx`. It has `status: string`. Add:

```ts
  removedAt?: string | Date | null
  removalReason?: string | null
```

- [ ] **Step 2: Add the removed overlay to the post grid**

In the post grid, after the existing PENDING_REVIEW badge block (around line 554):

```tsx
{(post as PostItem).status === "PENDING_REVIEW" && (
  <div style={{ ... }}>⏳ Under review</div>
)}
```

Add immediately after it:

```tsx
{isOwn && (post as PostItem).status === "REMOVED" && (
  <div style={{
    position: "absolute", inset: 0,
    background: "rgba(0,0,0,0.72)",
    borderRadius: 4,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "6px 4px",
    gap: 4,
  }}>
    <span style={{ color: "#f87171", fontSize: 10, fontWeight: 700, textAlign: "center" }}>Removed</span>
    {(post as PostItem).removalReason && (
      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 8, textAlign: "center", lineHeight: 1.3 }}>
        {(post as PostItem).removalReason}
      </span>
    )}
    <a
      href={`/appeal?postId=${post.id}`}
      onClick={e => e.stopPropagation()}
      style={{
        marginTop: 2,
        color: "#a78bfa", fontSize: 9, fontWeight: 600,
        textDecoration: "underline",
      }}
    >
      Appeal →
    </a>
  </div>
)}
```

- [ ] **Step 3: Prevent click-through on removed posts**

The `<button onClick={() => setViewPost(post as PostItem)}>` wraps each post. We need to prevent opening the view modal for REMOVED posts (owner shouldn't "view" a post that's just showing the overlay). Update the onClick:

```tsx
<button
  onClick={() => {
    if ((post as PostItem).status === "REMOVED") return
    setViewPost(post as PostItem)
  }}
  ...
>
```

- [ ] **Step 4: Run the app and verify manually**

```bash
npx vitest run
```

Expected: All tests pass. (Visual check: a removed post on your own profile should show the dark overlay with "Removed", the reason text, and "Appeal →".)

- [ ] **Step 5: Commit**

```bash
git add app/[username]/page.tsx
git commit -m "feat: show removed post overlay with reason and appeal link on profile"
```

---

### Task 5: Appeal page — reason display + URL pre-selection

**Files:**
- Modify: `app/appeal/page.tsx`

**Context:** The appeal page is at `app/appeal/page.tsx`. It currently calls `getMyRemovedPosts` which now returns `{ id, image, removedAt, removalReason }` (changed in Task 3 — no longer `updatedAt`/`flagReason`). We need to:
1. Show `removalReason` below each removed post thumbnail
2. Read `?postId` from the URL and pre-select that post on mount

- [ ] **Step 1: Read postId from URL and pre-select on mount**

At the top of the component, add:

```tsx
import { useSearchParams } from "next/navigation"

// Inside the component, after existing state:
const searchParams = useSearchParams()

useEffect(() => {
  const preselect = searchParams.get("postId")
  if (preselect && removedPosts?.some(p => p.id === preselect)) {
    setSelectedPostId(preselect)
    setSelectedStrikeId(undefined)
  }
}, [searchParams, removedPosts])
```

- [ ] **Step 2: Show removalReason below each removed post card**

In the removed posts section (around line 79), after the `<img>` inside each post card, add a reason tooltip or label. Replace the removed posts map with:

```tsx
{removedPosts.map(p => {
  const alreadyAppealed = appeals?.some(a => a.postId === p.id && a.status === "PENDING")
  const isSelected = selectedPostId === p.id
  return (
    <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, maxWidth: 72 }}>
      <div
        onClick={() => {
          if (alreadyAppealed) return
          setSelectedPostId(prev => prev === p.id ? undefined : p.id)
          setSelectedStrikeId(undefined)
        }}
        style={{
          position: "relative",
          width: 72, height: 72,
          borderRadius: 8,
          overflow: "hidden",
          cursor: alreadyAppealed ? "default" : "pointer",
          border: `2px solid ${isSelected ? "rgba(176,68,248,0.8)" : "rgba(255,255,255,0.1)"}`,
          opacity: alreadyAppealed ? 0.5 : 1,
          flexShrink: 0,
        }}
      >
        <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {alreadyAppealed && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, textAlign: "center", padding: "0 4px" }}>
              Appealed
            </span>
          </div>
        )}
      </div>
      {p.removalReason && (
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, textAlign: "center", lineHeight: 1.3, maxWidth: 72 }}>
          {p.removalReason}
        </span>
      )}
    </div>
  )
})}
```

Also update the container div from `display: "flex", gap: 8, flexWrap: "wrap"` to `display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start"`.

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/appeal/page.tsx
git commit -m "feat: show removal reason on appeal page and support postId URL pre-selection"
```

---

### Task 6: Nav — Appeals link + notification appeal links

**Files:**
- Modify: `components/Navbar.tsx`
- Modify: `components/BottomNav.tsx`

**Context:**
- `Navbar.tsx`: The user dropdown menu (lines 170–208) has "Account settings", "Artist Dashboard", "Commission Chats", "Terms of Service", "Sign out". Add "Appeals" under "Account settings".
- `Navbar.tsx` notifications: Lines 61–67 define `post_removed_*` notification messages. Each notification is rendered as a plain text string. We need to make `post_removed_*` notifications render with an "Appeal →" link appended.
- `BottomNav.tsx`: Same notification text block at lines 129–136, same change needed.

- [ ] **Step 1: Add "Appeals" to the Navbar dropdown**

In `components/Navbar.tsx`, after the "Account settings" button (around line 172–177), add:

```tsx
<button
  onClick={() => { setMenuOpen(false); router.push("/appeal") }}
  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
>
  Appeals
</button>
```

- [ ] **Step 2: Make post_removed notifications show an "Appeal →" link in Navbar**

In `components/Navbar.tsx`, find where notifications are rendered. The notification text lookup (around line 61) uses a string map. Find where that text is rendered to the UI and make `post_removed_*` types render a link.

Look for the notification rendering block — it will look something like:
```tsx
<span>{notificationMessages[notification.type] ?? "..."}</span>
```

Change that block to:

```tsx
{(() => {
  const msg = notificationMessages[n.type] ?? "New notification"
  const isRemoval = n.type === "post_removed_tos" || n.type === "post_removed_moderator" || n.type === "post_auto_removed"
  return (
    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
      {msg}
      {isRemoval && (
        <> · <a href="/appeal" style={{ color: "#a78bfa", textDecoration: "underline" }} onClick={e => e.stopPropagation()}>Appeal →</a></>
      )}
    </span>
  )
})()}
```

Note: `post_removed_dmca` intentionally excluded — DMCA removals are hard-deletes, no appeal window applies.

- [ ] **Step 3: Same change in BottomNav.tsx**

Find the equivalent notification rendering in `components/BottomNav.tsx` and apply the same pattern — add "Appeal →" link for `post_removed_tos`, `post_removed_moderator`, `post_auto_removed`.

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/Navbar.tsx components/BottomNav.tsx
git commit -m "feat: add Appeals nav link and appeal CTA on post_removed notifications"
```

---

### Task 7: gallery-admin — set removedAt + removalReason on manual removal

**Files:**
- Modify: `gallery-admin/server/routers/admin.ts` (lines 955–990)
- Modify: `gallery-admin/app/pending/page.tsx`

**Context:**
- `resolvePendingPost` at line 955 accepts `{ postId, action: "remove" | "restore" }`. When `action === "remove"`, it sets `status: "REMOVED"` only. We need to also set `removedAt` and accept an optional `removalReason`.
- The pending page UI at `gallery-admin/app/pending/page.tsx` has a "Remove Now" button. We need to add a text input for the reason, required before removal. The admin must type a reason before the remove button is enabled.
- Note: gallery-admin has its own Prisma client and shares the same database, so the schema changes from Task 1 are already live.

- [ ] **Step 1: Update resolvePendingPost input schema**

In `gallery-admin/server/routers/admin.ts`, find `resolvePendingPost` (line 955). Update the input:

```ts
// Before:
.input(z.object({
  postId: z.string(),
  action: z.enum(["remove", "restore"]),
}))

// After:
.input(z.object({
  postId: z.string(),
  action: z.enum(["remove", "restore"]),
  removalReason: z.string().min(1).max(500).optional(),
}))
```

- [ ] **Step 2: Set removedAt and removalReason in the remove branch**

In the same procedure, update the `action === "remove"` branch:

```ts
// Before:
if (input.action === "remove") {
  await tx.post.update({
    where: { id: input.postId },
    data: { status: "REMOVED" },
  })

// After:
if (input.action === "remove") {
  await tx.post.update({
    where: { id: input.postId },
    data: {
      status: "REMOVED",
      removedAt: new Date(),
      removalReason: input.removalReason ?? "Removed by moderator following content review.",
    },
  })
```

- [ ] **Step 3: Update pending page UI to require a reason before removing**

In `gallery-admin/app/pending/page.tsx`, add per-post reason state and a text input:

Replace the entire component with:

```tsx
"use client"

import { useState } from "react"
import { trpc } from "@/components/providers"
import AdminLayout from "@/components/AdminLayout"

export default function PendingPage() {
  const { data: posts, isLoading, refetch } = trpc.admin.listPendingPosts.useQuery()
  const resolve = trpc.admin.resolvePendingPost.useMutation({ onSuccess: () => refetch() })
  const [reasons, setReasons] = useState<Record<string, string>>({})

  return (
    <AdminLayout>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <h1 className="hud-page-title">Pending Content</h1>
        <div className="hud-section-line" />
      </div>
      <p className="hud-empty" style={{ marginBottom: 24 }}>
        Sorted by soonest expiry · Auto-removed after 14 days
      </p>

      {isLoading && <p className="hud-empty">Loading…</p>}
      {posts?.length === 0 && <p className="hud-empty">No pending posts.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {posts?.map((post) => (
          <div key={post.id} className="hud-card" style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: 16 }}>
            <img src={post.image} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 4, flexShrink: 0, border: "1px solid var(--purple-border)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                <span className="hud-td-username">@{post.user.username ?? "—"}</span>
                <span className={`badge ${post.daysRemaining <= 2 ? "badge-pink" : "badge-warn"}`}>
                  {post.daysRemaining}d remaining
                </span>
              </div>
              <div className="hud-td-mono" style={{ marginBottom: 4 }}>Flag reason: {post.flagReason ?? "—"}</div>
              {post.pendingAt && (
                <div className="hud-td-mono" style={{ marginBottom: 8, fontSize: 10 }}>
                  Pending since {new Date(post.pendingAt).toLocaleDateString()}
                </div>
              )}
              <input
                type="text"
                placeholder="Removal reason shown to user (required to remove)"
                value={reasons[post.id] ?? ""}
                onChange={e => setReasons(prev => ({ ...prev, [post.id]: e.target.value }))}
                style={{
                  width: "100%", padding: "6px 10px", borderRadius: 6, marginBottom: 8,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "white", fontSize: 12, boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => resolve.mutate({ postId: post.id, action: "remove", removalReason: reasons[post.id] })}
                  disabled={resolve.isPending || !reasons[post.id]?.trim()}
                  className="btn-hud btn-hud-danger"
                >
                  Remove Now
                </button>
                <button
                  onClick={() => resolve.mutate({ postId: post.id, action: "restore" })}
                  disabled={resolve.isPending}
                  className="btn-hud btn-hud-muted"
                >
                  Clear — Restore to Published
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 4: Verify gallery-admin still builds**

```bash
cd C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Commit (from gallery-admin directory)**

```bash
git add server/routers/admin.ts app/pending/page.tsx
git commit -m "feat: set removedAt and removalReason on manual removal; require reason in pending UI"
```

- [ ] **Step 6: Switch back to gallery and run tests**

```bash
cd C:\Users\gavri\OneDrive\Documents\Projects\gallery
npx vitest run
```

Expected: All tests pass.

---

### Task 8: Roadmap update

**Files:**
- Modify: `docs/roadmap.md`

**Context:** Check the roadmap for any items that this work completes. The ToS/compliance section in Tier 1 had items about content moderation transparency.

- [ ] **Step 1: Update roadmap**

In `docs/roadmap.md`, find the Safety & Compliance section and mark the relevant item done, or add to Already Shipped:

Under `## ✅ Already shipped`, add:
```
- Removal transparency — 15-day grace window, removalReason shown on profile + appeal page, appeal link in nav/notifications
```

- [ ] **Step 2: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: mark removal transparency as shipped"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Schema: Task 1 adds `removedAt` + `removalReason`
- ✅ Profile page 15-day window: Task 3 (`getByUsername`) + Task 4 (overlay UI)
- ✅ Appeal page reason + pre-selection: Task 3 (`getMyRemovedPosts`) + Task 5
- ✅ Email touchpoint: already links to `/appeal`, no change needed — covered in spec
- ✅ Profile "Appeal →" link: Task 4
- ✅ In-app notification "Appeal →": Task 6
- ✅ Nav "Appeals" link: Task 6
- ✅ Admin manual removal sets fields: Task 7
- ✅ Auto-removal cron sets fields: Task 2

**Placeholder scan:** None found.

**Type consistency:** `removedAt` and `removalReason` used consistently across all tasks. `getMyRemovedPosts` returns `{ id, image, removedAt, removalReason }` — appeal page uses exactly those fields in Task 5.
