# DMCA Counter-Notice Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full DMCA counter-notice lifecycle — soft-delete posts on DMCA removal so they can be restored, let artists file counter-notices in-app, and auto-restore posts after 14 days if no legal action is taken; auto-ban users with 3+ confirmed violations.

**Architecture:** Schema adds two fields to `DmcaRequest`. The admin app's `resolveDmcaRequest` mutation switches from hard-deleting posts to soft-deleting (`status=REMOVED`), captures the DMCA request ID for the removal email, and checks for a 3rd violation permanent ban. A new `dmca.fileCounterNotice` protectedProcedure in the main gallery app validates ownership and transitions the request to COUNTER_FILED. A client-side page at `/dmca/counter-notice` shows a sworn declaration form. A daily cron job checks for COUNTER_FILED requests older than 14 days and restores their posts.

**Tech Stack:** Prisma migration, tRPC v11 protectedProcedure, Next.js App Router "use client" page, Resend email via gallery-admin/lib/email.ts, Bearer-token-protected cron route.

---

## Files

- **Modify:** `prisma/schema.prisma` — add `counterNoticedAt` and `counterNoticeText` to `DmcaRequest`
- **Modify:** `gallery-admin/server/routers/admin.ts` — change `resolveDmcaRequest` to soft-delete, add 3-violation ban, pass `dmcaRequestId` to email
- **Modify:** `gallery-admin/lib/email.ts` — update `sendDmcaRemovedEmail` to accept `dmcaRequestId` and link to counter-notice page
- **Modify:** `server/routers/dmca.ts` — add `fileCounterNotice` protectedProcedure
- **Create:** `app/dmca/counter-notice/page.tsx` — artist-facing counter-notice form
- **Create:** `app/api/cron/dmca-restore/route.ts` — daily cron that restores posts after 14-day window

---

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add two new optional fields to `DmcaRequest`**

In `prisma/schema.prisma`, find the `DmcaRequest` model and add the two new fields after `resolution`:

```prisma
model DmcaRequest {
  id                String     @id @default(cuid())
  claimantName      String
  claimantEmail     String
  postId            String?
  postUrl           String?
  description       String
  status            DmcaStatus @default(PENDING)
  createdAt         DateTime   @default(now())
  reviewedAt        DateTime?
  resolution        String?
  counterNoticedAt  DateTime?
  counterNoticeText String?
  appeals           Appeal[]

  @@index([status])
  @@index([claimantEmail])
}
```

- [ ] **Step 2: Generate and run the migration**

```bash
cd C:\Users\gavri\OneDrive\Documents\Projects\gallery
npx prisma migrate dev --name add_dmca_counter_notice_fields
```

Expected output: migration created and applied, Prisma client regenerated.

- [ ] **Step 3: Verify schema applied**

```bash
npx prisma db pull --print | grep -A 5 "counterNoticedAt"
```

Expected: the two new fields appear.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add counterNoticedAt and counterNoticeText to DmcaRequest"
```

---

### Task 2: Soft-delete + email link update (gallery-admin)

**Files:**
- Modify: `gallery-admin/server/routers/admin.ts` — `resolveDmcaRequest` mutation
- Modify: `gallery-admin/lib/email.ts` — `sendDmcaRemovedEmail`

- [ ] **Step 1: Update `sendDmcaRemovedEmail` to accept `dmcaRequestId` and link to counter-notice page**

In `gallery-admin/lib/email.ts`, replace the existing `sendDmcaRemovedEmail` function (lines 207–219) with:

```typescript
export async function sendDmcaRemovedEmail(to: string, opts: {
  username: string
  claimantName: string
  dmcaRequestId: string
}) {
  await send(to, "A post has been removed from your account following a DMCA claim", layout(
    "DMCA Takedown",
    `${heading("DMCA takedown notice")}
     ${body(`Hi @${opts.username}, a post on your Gallery account has been removed following a DMCA copyright claim filed by ${opts.claimantName}.`)}
     ${body("Under the Digital Millennium Copyright Act, we are required to remove content when we receive a valid takedown notice.")}
     ${body("If you believe this removal was made in error, you may file a counter-notice. You have 14 days to do so — after which the removal becomes permanent.")}
     ${btn(`${GALLERY_URL}/dmca/counter-notice?id=${opts.dmcaRequestId}`, "File a counter-notice")}`
  ))
}
```

- [ ] **Step 2: Change `resolveDmcaRequest` from hard-delete to soft-delete**

In `gallery-admin/server/routers/admin.ts`, inside `resolveDmcaRequest`, replace this block inside the transaction:

```typescript
// OLD — hard delete
const post = await tx.post.findUnique({
  where: { id: dmca.postId },
  select: { id: true, userId: true, user: { select: { email: true, username: true } } },
})
if (post) {
  removedPostOwner = post.user
  await tx.post.delete({ where: { id: dmca.postId } })
  await tx.notification.create({
    data: { userId: post.userId, fromUserId: ctx.session.user.id, type: "post_removed_dmca" },
  })
}
```

with:

```typescript
// NEW — soft delete
const post = await tx.post.findUnique({
  where: { id: dmca.postId },
  select: { id: true, userId: true, user: { select: { email: true, username: true } } },
})
if (post) {
  removedPostOwner = { ...post.user, userId: post.userId }
  await tx.post.update({
    where: { id: dmca.postId },
    data: {
      status: "REMOVED",
      removedAt: new Date(),
      removalReason: "Removed following a DMCA copyright takedown request.",
    },
  })
  await tx.notification.create({
    data: { userId: post.userId, fromUserId: ctx.session.user.id, type: "post_removed_dmca" },
  })
}
```

Also update the `removedPostOwner` type at the top of the mutation to include `userId`:

```typescript
let removedPostOwner: { email: string | null; username: string | null; userId: string } | undefined
```

- [ ] **Step 3: Update `sendDmcaRemovedEmail` call to pass `dmcaRequestId`**

Still in `resolveDmcaRequest`, find the existing email call after the transaction:

```typescript
// OLD
if (input.action === "remove_post" && removedPostOwner?.email) {
  void sendDmcaRemovedEmail(removedPostOwner.email, {
    username: removedPostOwner.username ?? "there",
    claimantName: dmca.claimantName,
  })
}
```

Replace with:

```typescript
// NEW
if (input.action === "remove_post" && removedPostOwner?.email) {
  void sendDmcaRemovedEmail(removedPostOwner.email, {
    username: removedPostOwner.username ?? "there",
    claimantName: dmca.claimantName,
    dmcaRequestId: input.id,
  })
}
```

- [ ] **Step 4: Commit**

```bash
cd C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin
git add lib/email.ts server/routers/admin.ts
git commit -m "feat: soft-delete post on DMCA removal, update counter-notice email link"
```

---

### Task 3: 3-violation permanent ban

**Files:**
- Modify: `gallery-admin/server/routers/admin.ts` — `resolveDmcaRequest` mutation (add ban logic after the transaction)

- [ ] **Step 1: Add the violation count + ban logic after the transaction block in `resolveDmcaRequest`**

After the `if (input.action === "remove_post" && removedPostOwner?.email) { ... }` block, add:

```typescript
// Auto-ban after 3 confirmed DMCA violations
if (input.action === "remove_post" && removedPostOwner?.userId) {
  const userPostIds = (
    await ctx.prisma.post.findMany({
      where: { userId: removedPostOwner.userId },
      select: { id: true },
    })
  ).map((p) => p.id)

  const violationCount = await ctx.prisma.dmcaRequest.count({
    where: {
      postId: { in: userPostIds },
      status: { in: ["REMOVED", "RESOLVED"] },
    },
  })

  if (violationCount >= 3) {
    await ctx.prisma.user.update({
      where: { id: removedPostOwner.userId },
      data: {
        bannedUntil: new Date("9999-12-31"),
        banReason: "Three confirmed DMCA copyright violations",
      },
    })
    await ctx.prisma.notification.create({
      data: {
        userId: removedPostOwner.userId,
        fromUserId: null,
        type: "ban",
        message: "Your account has been permanently suspended due to three confirmed DMCA copyright violations.",
      },
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin
git add server/routers/admin.ts
git commit -m "feat: auto-permanent-ban users with 3+ confirmed DMCA violations"
```

---

### Task 4: `fileCounterNotice` mutation

**Files:**
- Modify: `server/routers/dmca.ts`

- [ ] **Step 1: Add import for `protectedProcedure` and `TRPCError`**

In `server/routers/dmca.ts`, update the imports at the top:

```typescript
import { z } from "zod"
import { router, publicProcedure, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
```

- [ ] **Step 2: Add `fileCounterNotice` mutation to the router**

In `server/routers/dmca.ts`, add the new procedure inside the `router({...})` call, after `submit`:

```typescript
fileCounterNotice: protectedProcedure
  .input(z.object({
    dmcaRequestId: z.string(),
    statement: z.string().min(20).max(5000),
  }))
  .mutation(async ({ ctx, input }) => {
    const dmca = await ctx.prisma.dmcaRequest.findUnique({
      where: { id: input.dmcaRequestId },
      select: { id: true, status: true, postId: true },
    })
    if (!dmca) throw new TRPCError({ code: "NOT_FOUND" })
    if (dmca.status !== "REMOVED") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A counter-notice can only be filed for posts that have been removed via DMCA.",
      })
    }
    if (!dmca.postId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No post is linked to this DMCA request.",
      })
    }

    // Verify the linked post belongs to the calling user
    const post = await ctx.prisma.post.findUnique({
      where: { id: dmca.postId },
      select: { userId: true },
    })
    if (!post) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "The post linked to this DMCA request no longer exists.",
      })
    }
    if (post.userId !== ctx.session.user.id) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }

    return ctx.prisma.dmcaRequest.update({
      where: { id: input.dmcaRequestId },
      data: {
        status: "COUNTER_FILED",
        counterNoticedAt: new Date(),
        counterNoticeText: input.statement,
      },
    })
  }),
```

- [ ] **Step 3: Verify the full file compiles cleanly**

```bash
cd C:\Users\gavri\OneDrive\Documents\Projects\gallery
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors referencing `dmca.ts`.

- [ ] **Step 4: Commit**

```bash
git add server/routers/dmca.ts
git commit -m "feat: add dmca.fileCounterNotice protectedProcedure"
```

---

### Task 5: Counter-notice page

**Files:**
- Create: `app/dmca/counter-notice/page.tsx`

This page reads `?id=` from the URL, shows a sworn declaration form, calls `dmca.fileCounterNotice` on submit, and shows a success state. Auth is required — unauthenticated visitors see a sign-in prompt (matching the pattern in `/appeal`).

- [ ] **Step 1: Create the page file**

```tsx
"use client"

import { useState, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { trpc } from "@/components/providers"

function CounterNoticeInner() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const dmcaRequestId = searchParams.get("id") ?? ""

  const [statement, setStatement] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const fileCounterNotice = trpc.dmca.fileCounterNotice.useMutation({
    onSuccess: () => setSubmitted(true),
  })

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          Please sign in to file a counter-notice.
        </p>
      </div>
    )
  }

  if (!dmcaRequestId) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
        <p style={{ color: "#f87171", fontSize: 14 }}>
          Invalid link — no DMCA request ID found. Please use the link from your removal email.
        </p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
        <div style={{
          padding: 24, borderRadius: 16,
          background: "rgba(0,200,100,0.08)",
          border: "1px solid rgba(0,200,100,0.25)",
        }}>
          <p style={{ color: "#4ade80", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            Counter-notice filed
          </p>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Your counter-notice has been received. We are required to forward it to the claimant.
            If no legal action is initiated within 14 days, your post will be automatically restored.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        File a DMCA Counter-Notice
      </h1>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        If you believe your post was removed in error, you may file a counter-notice under the DMCA.
        We will forward your statement to the claimant. If they do not initiate legal proceedings within
        14 days, your post will be restored.
      </p>

      <div style={{
        padding: "14px 16px", borderRadius: 10, marginBottom: 24,
        background: "rgba(255,180,0,0.08)",
        border: "1px solid rgba(255,180,0,0.25)",
      }}>
        <p style={{ color: "rgba(255,180,0,0.9)", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          <strong>Legal declaration:</strong> By submitting this form, you declare under penalty of perjury
          that you have a good-faith belief the content was removed as a result of a mistake or
          misidentification, and that you consent to the jurisdiction of the federal district court
          for your judicial district.
        </p>
      </div>

      <label style={{ display: "block", color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 8 }}>
        Your statement <span style={{ color: "rgba(255,255,255,0.3)" }}>(min 20 characters)</span>
      </label>
      <textarea
        value={statement}
        onChange={e => setStatement(e.target.value)}
        placeholder="Explain why you believe this removal was made in error. Include any evidence that you own or have the right to use this content."
        minLength={20}
        maxLength={5000}
        rows={7}
        style={{
          width: "100%", borderRadius: 12, padding: "12px 14px",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
          color: "white", fontSize: 14, resize: "vertical",
          outline: "none", boxSizing: "border-box",
        }}
      />
      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "right", marginTop: 4 }}>
        {statement.length} / 5000
      </p>

      {fileCounterNotice.error && (
        <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>
          {fileCounterNotice.error.message}
        </p>
      )}

      <button
        onClick={() => fileCounterNotice.mutate({ dmcaRequestId, statement })}
        disabled={fileCounterNotice.isPending || statement.length < 20}
        style={{
          marginTop: 12, width: "100%", padding: "12px",
          borderRadius: 12,
          background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
          color: "white", fontSize: 14, fontWeight: 600,
          opacity: fileCounterNotice.isPending || statement.length < 20 ? 0.5 : 1,
          cursor: fileCounterNotice.isPending || statement.length < 20 ? "not-allowed" : "pointer",
          border: "none",
        }}
      >
        {fileCounterNotice.isPending ? "Submitting…" : "Submit Counter-Notice"}
      </button>
    </div>
  )
}

export default function CounterNoticePage() {
  return (
    <Suspense>
      <CounterNoticeInner />
    </Suspense>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\gavri\OneDrive\Documents\Projects\gallery
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors referencing `counter-notice`.

- [ ] **Step 3: Commit**

```bash
git add app/dmca/counter-notice/page.tsx
git commit -m "feat: add /dmca/counter-notice page for artist DMCA counter-notices"
```

---

### Task 6: DMCA restore cron job

**Files:**
- Create: `app/api/cron/dmca-restore/route.ts`

- [ ] **Step 1: Create the cron route**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const cutoff = new Date(Date.now() - FOURTEEN_DAYS_MS)

  const eligible = await prisma.dmcaRequest.findMany({
    where: {
      status: "COUNTER_FILED",
      counterNoticedAt: { lt: cutoff },
    },
    select: { id: true, postId: true },
  })

  if (eligible.length === 0) {
    return NextResponse.json({ restored: 0 })
  }

  let restored = 0

  for (const dmca of eligible) {
    await prisma.$transaction(async (tx) => {
      if (dmca.postId) {
        await tx.post.updateMany({
          where: { id: dmca.postId, status: "REMOVED" },
          data: { status: "PUBLISHED" },
        })
      }
      await tx.dmcaRequest.update({
        where: { id: dmca.id },
        data: { status: "RESOLVED" },
      })
    })
    restored++
  }

  return NextResponse.json({ restored })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\gavri\OneDrive\Documents\Projects\gallery
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/dmca-restore/route.ts
git commit -m "feat: add /api/cron/dmca-restore cron job (restores posts after 14-day counter-notice window)"
```

---

### Task 7: Roadmap update + deploy

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Update roadmap**

In `docs/roadmap.md`, change:
```
- [ ] DMCA takedown form + 14-day response + counter-notice flow (3 confirmed violations = permanent ban)
```
to:
```
- [x] DMCA takedown form + 14-day response + counter-notice flow (3 confirmed violations = permanent ban)
```

- [ ] **Step 2: Commit**

```bash
git add docs/roadmap.md
git commit -m "chore: mark DMCA counter-notice flow as complete"
```

- [ ] **Step 3: Deploy gallery to production**

```bash
cd C:\Users\gavri\OneDrive\Documents\Projects\gallery
npx vercel --prod
```

Expected: build succeeds, deployment URL printed, aliased to `https://gallery-ebon-xi.vercel.app`.

- [ ] **Step 4: Deploy gallery-admin to production**

```bash
cd C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin
npx vercel --prod
```

Expected: build succeeds.
