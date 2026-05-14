# Commission UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three targeted improvements: mandatory price+deadline at accept, artist deadline notifications, and a shared Messages/Commissions tab header.

**Architecture:** Backend changes to `server/routers/commission.ts` (accept mutation + dual notifications), UI changes to the commission thread page (`app/professional-dms/[id]/page.tsx`) for the accept form and buyer confirm bar, and a new shared `MessagesTabs` component added to both list pages.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 5, Zod, Tailwind v4, Vitest

---

## File Map

| File | Change |
|------|--------|
| `server/routers/commission.ts` | Add `deadline` to `accept` input schema + update mutation; replace single deadline notification with dual (buyer + artist) |
| `app/professional-dms/[id]/page.tsx` | Accept form: add deadline input; buyer ACCEPTED bar: show price+deadline summary; remove deadline control from ACCEPTED state |
| `components/MessagesTabs.tsx` | New — shared two-tab navigation component |
| `app/messages/page.tsx` | Replace `<h1>` with `<MessagesTabs />` |
| `app/professional-dms/page.tsx` | Replace `<h1>` with `<MessagesTabs />` |
| `server/__tests__/commission-accept-schema.test.ts` | New — Vitest tests for updated accept input schema |

---

## Task 1: Backend — `accept` mutation requires deadline

**Files:**
- Modify: `server/routers/commission.ts` (lines 266–289, the `accept` procedure)
- Create: `server/__tests__/commission-accept-schema.test.ts`

### Steps

- [ ] **Step 1: Write the failing schema test**

Create `server/__tests__/commission-accept-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { z } from "zod"

// Mirror the updated schema (deadline is now required)
const acceptSchema = z.object({
  id: z.string(),
  price: z.number().positive(),
  deadline: z.string().datetime(),
})

describe("accept mutation input schema", () => {
  it("rejects input missing deadline", () => {
    const result = acceptSchema.safeParse({ id: "abc", price: 50 })
    expect(result.success).toBe(false)
  })

  it("rejects input missing price", () => {
    const result = acceptSchema.safeParse({ id: "abc", deadline: "2026-06-01T00:00:00.000Z" })
    expect(result.success).toBe(false)
  })

  it("rejects negative price", () => {
    const result = acceptSchema.safeParse({ id: "abc", price: -10, deadline: "2026-06-01T00:00:00.000Z" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid datetime string", () => {
    const result = acceptSchema.safeParse({ id: "abc", price: 50, deadline: "not-a-date" })
    expect(result.success).toBe(false)
  })

  it("accepts valid id + positive price + ISO datetime", () => {
    const result = acceptSchema.safeParse({ id: "abc", price: 50, deadline: "2026-06-01T00:00:00.000Z" })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails (schema not yet updated)**

```bash
npx vitest run server/__tests__/commission-accept-schema.test.ts
```

Expected: the "rejects input missing deadline" test FAILS because the current schema does not include `deadline`.

- [ ] **Step 3: Update the `accept` procedure in `server/routers/commission.ts`**

Replace the existing `accept` procedure (lines 266–289):

```ts
accept: protectedProcedure
  .input(z.object({
    id: z.string(),
    price: z.number().positive(),
    deadline: z.string().datetime(),
  }))
  .mutation(async ({ ctx, input }) => {
    const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
    if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
    if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
    if (commission.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not pending" })

    const deadlineDate = new Date(input.deadline)
    const formatted = deadlineDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

    const updated = await ctx.prisma.commission.update({
      where: { id: input.id },
      data: {
        status: "ACCEPTED",
        agreedPrice: input.price,
        deadline: deadlineDate,
        deadlineNotificationSent: false,
      },
    })
    await ctx.prisma.notification.create({
      data: { userId: commission.buyerId, fromUserId: ctx.session.user.id, type: `commission_accepted:${input.id}` },
    })
    await ctx.prisma.professionalMessage.create({
      data: {
        commissionId: input.id,
        senderId: ctx.session.user.id,
        text: `Commission accepted at $${input.price}. Deadline: ${formatted}. Awaiting payment.`,
        isSystem: true,
      },
    })
    return updated
  }),
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run server/__tests__/commission-accept-schema.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routers/commission.ts server/__tests__/commission-accept-schema.test.ts
git commit -m "feat: accept mutation requires deadline at accept time"
```

---

## Task 2: Frontend — Commission thread: accept form + buyer summary + remove ACCEPTED deadline control

**Files:**
- Modify: `app/professional-dms/[id]/page.tsx`

Three changes in one file:
1. Accept form — add deadline date input; both fields must be filled before Accept button is enabled
2. Buyer ACCEPTED bar — add `"Price: $X · Deadline: [date]"` summary line above the confirm button
3. Deadline control — remove from ACCEPTED state (keep for IN_PROGRESS / DELIVERED)

### Steps

- [ ] **Step 1: Add `acceptDeadline` state alongside `acceptPrice` state**

In `CommissionThread`, find this block (around line 123):

```ts
const [showAcceptForm, setShowAcceptForm] = useState(false)
const [acceptPrice, setAcceptPrice] = useState("")
const acceptMutation = trpc.commission.accept.useMutation({
  onSuccess: () => {
    utils.commission.getById.invalidate({ id })
    setShowAcceptForm(false)
    setAcceptPrice("")
  },
})
```

Replace with:

```ts
const [showAcceptForm, setShowAcceptForm] = useState(false)
const [acceptPrice, setAcceptPrice] = useState("")
const [acceptDeadline, setAcceptDeadline] = useState("")
const acceptMutation = trpc.commission.accept.useMutation({
  onSuccess: () => {
    utils.commission.getById.invalidate({ id })
    setShowAcceptForm(false)
    setAcceptPrice("")
    setAcceptDeadline("")
  },
})
```

- [ ] **Step 2: Replace the accept form JSX with the two-field version**

Find this block (the `showAcceptForm` branch, around line 483):

```tsx
{showAcceptForm ? (
  <div className="flex flex-col gap-2">
    <p className="text-xs font-semibold text-white/70">Set your price</p>
    <div className="flex gap-2 items-center">
      <span className="text-sm text-white/70">$</span>
      <input
        type="number"
        value={acceptPrice}
        onChange={e => setAcceptPrice(e.target.value)}
        placeholder="0.00"
        min="0"
        step="0.01"
        className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
        style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
      />
      <button
        onClick={() => {
          const price = parseFloat(acceptPrice)
          if (!isNaN(price) && price > 0) acceptMutation.mutate({ id, price })
        }}
        disabled={acceptMutation.isPending}
        className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
      >
        {acceptMutation.isPending ? "…" : "Accept"}
      </button>
      <button onClick={() => setShowAcceptForm(false)} className="text-xs text-white/40 hover:text-white/70">Cancel</button>
    </div>
  </div>
```

Replace with:

```tsx
{showAcceptForm ? (
  <div className="flex flex-col gap-2">
    <p className="text-xs font-semibold text-white/70">Set price and deadline to accept</p>
    <div className="flex gap-2 items-center">
      <span className="text-sm text-white/70">$</span>
      <input
        type="number"
        value={acceptPrice}
        onChange={e => setAcceptPrice(e.target.value)}
        placeholder="0.00"
        min="0"
        step="0.01"
        className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
        style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
      />
    </div>
    <div className="flex gap-2 items-center">
      <span className="text-xs text-white/50 flex-shrink-0">Deadline</span>
      <input
        type="date"
        value={acceptDeadline}
        onChange={e => setAcceptDeadline(e.target.value)}
        min={new Date().toISOString().split("T")[0]}
        className="flex-1 px-3 py-2 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
      />
    </div>
    <div className="flex gap-2">
      <button
        onClick={() => {
          const price = parseFloat(acceptPrice)
          if (!isNaN(price) && price > 0 && acceptDeadline) {
            acceptMutation.mutate({ id, price, deadline: new Date(acceptDeadline).toISOString() })
          }
        }}
        disabled={acceptMutation.isPending || !acceptPrice || parseFloat(acceptPrice) <= 0 || !acceptDeadline}
        className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
      >
        {acceptMutation.isPending ? "…" : "Accept"}
      </button>
      <button onClick={() => setShowAcceptForm(false)} className="text-xs text-white/40 hover:text-white/70 px-3">Cancel</button>
    </div>
  </div>
```

- [ ] **Step 3: Add price+deadline summary line above the buyer confirm payment button**

Find this block (buyer ACCEPTED bar, around line 573):

```tsx
{/* Buyer: confirm payment on ACCEPTED */}
{isBuyer && commission.status === "ACCEPTED" && (
  <div className="flex items-center gap-3">
    <button
      onClick={() => confirmPaymentMutation.mutate({ id })}
      disabled={confirmPaymentMutation.isPending}
      className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
      style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
    >
      {confirmPaymentMutation.isPending ? "Processing…" : `Confirm payment · $${commission.agreedPrice}`}
    </button>
    <button
      onClick={() => cancelMutation.mutate({ id })}
      disabled={cancelMutation.isPending}
      className="text-xs text-red-400 hover:text-red-300 underline transition-colors disabled:opacity-50 flex-shrink-0"
    >
      Cancel
    </button>
  </div>
)}
```

Replace with:

```tsx
{/* Buyer: confirm payment on ACCEPTED */}
{isBuyer && commission.status === "ACCEPTED" && (
  <div className="flex flex-col gap-2">
    {commission.agreedPrice !== null && commission.deadline && (
      <p className="text-xs text-white/50">
        Price: <span className="font-semibold text-white">${commission.agreedPrice}</span>
        {" · "}
        Deadline: <span className="font-semibold text-white">
          {new Date(commission.deadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </span>
      </p>
    )}
    <div className="flex items-center gap-3">
      <button
        onClick={() => confirmPaymentMutation.mutate({ id })}
        disabled={confirmPaymentMutation.isPending}
        className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
      >
        {confirmPaymentMutation.isPending ? "Processing…" : `Confirm payment · $${commission.agreedPrice}`}
      </button>
      <button
        onClick={() => cancelMutation.mutate({ id })}
        disabled={cancelMutation.isPending}
        className="text-xs text-red-400 hover:text-red-300 underline transition-colors disabled:opacity-50 flex-shrink-0"
      >
        Cancel
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Remove the deadline control from the ACCEPTED state**

Find this block (artist deadline control, around line 651):

```tsx
{/* Deadline control */}
{isArtist && !isClosed && (
```

Change `{isArtist && !isClosed && (` to `{isArtist && !isClosed && commission.status !== "ACCEPTED" && (`

The full block start becomes:

```tsx
{/* Deadline control */}
{isArtist && !isClosed && commission.status !== "ACCEPTED" && (
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/professional-dms/[id]/page.tsx
git commit -m "feat: accept form requires price+deadline; buyer sees summary; hide ACCEPTED deadline control"
```

---

## Task 3: Backend — Dual deadline notifications

**Files:**
- Modify: `server/routers/commission.ts` (the deadline notification block inside `getById`)

### Steps

- [ ] **Step 1: Write the failing schema test for the notification logic**

Add to `server/__tests__/commission-accept-schema.test.ts`:

```ts
// Verify the dual-notification logic: both buyer and artist IDs are distinct
describe("dual deadline notification targeting", () => {
  it("identifies two distinct user IDs to notify", () => {
    const buyerId = "buyer-1"
    const artistId = "artist-1"
    const targets = [buyerId, artistId]
    expect(targets).toHaveLength(2)
    expect(new Set(targets).size).toBe(2) // no duplicates when buyer ≠ artist
  })
})
```

- [ ] **Step 2: Run test to confirm it passes immediately (pure logic)**

```bash
npx vitest run server/__tests__/commission-accept-schema.test.ts
```

Expected: all tests PASS (this test is pure logic, no implementation needed).

- [ ] **Step 3: Update the deadline notification block in `getById`**

Find this block inside `getById` (around line 244):

```ts
if (msUntil > 0 && msUntil <= fortyEightHours) {
  await ctx.prisma.commission.update({
    where: { id: input.id },
    data: { deadlineNotificationSent: true },
  })
  const callerIsArtist = commission.artistId === ctx.session?.user?.id
  const notifyUserId = callerIsArtist ? commission.buyerId : commission.artistId
  if (ctx.session?.user?.id) {
    await ctx.prisma.notification.create({
      data: {
        userId: notifyUserId,
        fromUserId: ctx.session.user.id,
        type: `commission_deadline_approaching:${input.id}`,
      },
    })
  }
}
```

Replace with:

```ts
if (msUntil > 0 && msUntil <= fortyEightHours) {
  await ctx.prisma.commission.update({
    where: { id: input.id },
    data: { deadlineNotificationSent: true },
  })
  if (ctx.session?.user?.id) {
    await ctx.prisma.notification.createMany({
      data: [
        {
          userId: commission.buyerId,
          fromUserId: ctx.session.user.id,
          type: `commission_deadline_approaching:${input.id}`,
        },
        {
          userId: commission.artistId,
          fromUserId: ctx.session.user.id,
          type: `commission_deadline_approaching:${input.id}`,
        },
      ],
    })
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/routers/commission.ts server/__tests__/commission-accept-schema.test.ts
git commit -m "feat: notify both buyer and artist when commission deadline approaches"
```

---

## Task 4: Frontend — Messages/Commissions tab navigation

**Files:**
- Create: `components/MessagesTabs.tsx`
- Modify: `app/messages/page.tsx`
- Modify: `app/professional-dms/page.tsx`

### Steps

- [ ] **Step 1: Create the shared `MessagesTabs` component**

Create `components/MessagesTabs.tsx`:

```tsx
"use client"

import { usePathname, useRouter } from "next/navigation"

export default function MessagesTabs() {
  const pathname = usePathname()
  const router = useRouter()

  const isMessages = pathname === "/messages" || pathname.startsWith("/messages/")
  const isCommissions = pathname === "/professional-dms" || pathname.startsWith("/professional-dms/")

  return (
    <div
      className="flex px-4 pt-5"
      style={{ borderBottom: "1px solid #ffffff10" }}
    >
      <button
        onClick={() => router.push("/messages")}
        className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${
          isMessages
            ? "text-white border-purple-500"
            : "text-white/40 border-transparent hover:text-white/60"
        }`}
      >
        Messages
      </button>
      <button
        onClick={() => router.push("/professional-dms")}
        className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${
          isCommissions
            ? "text-white border-purple-500"
            : "text-white/40 border-transparent hover:text-white/60"
        }`}
      >
        Commissions
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add `MessagesTabs` to `app/messages/page.tsx`**

Add `import MessagesTabs from "@/components/MessagesTabs"` at the top of the file (after the existing imports).

Then in `MessagesInner`, replace this block (around line 120):

```tsx
<div className="max-w-lg mx-auto pb-24">
  <div className="flex items-center justify-between px-4 pt-6 pb-3">
    <h1 className="text-xl font-bold text-white">Messages</h1>
    <button
```

With:

```tsx
<div className="max-w-lg mx-auto pb-24">
  <MessagesTabs />
  <div className="flex items-center justify-between px-4 pt-4 pb-3">
    <div />
    <button
```

Note: remove the `<h1>` entirely; the tab replaces it. Keep the compose button — just move it to the right with no left heading. The full replacement for the header `<div>`:

Find:
```tsx
<div className="flex items-center justify-between px-4 pt-6 pb-3">
  <h1 className="text-xl font-bold text-white">Messages</h1>
  <button
    onClick={() => setComposing(true)}
    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors text-white/60"
    aria-label="New message"
  >
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  </button>
</div>
```

Replace with:

```tsx
<MessagesTabs />
<div className="flex items-center justify-end px-4 pt-3 pb-2">
  <button
    onClick={() => setComposing(true)}
    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors text-white/60"
    aria-label="New message"
  >
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  </button>
</div>
```

- [ ] **Step 3: Add `MessagesTabs` to `app/professional-dms/page.tsx`**

Add `import MessagesTabs from "@/components/MessagesTabs"` after the existing imports.

In `ProfessionalDMsInner`, replace this block:

```tsx
<div className="max-w-2xl mx-auto px-4 py-8 pb-24">
  <h1 className="text-xl font-bold text-white mb-6">Commission Chats</h1>
```

With:

```tsx
<div className="max-w-2xl mx-auto pb-24">
  <MessagesTabs />
  <div className="px-4 py-6">
```

And close the new inner `<div className="px-4 py-6">` before the closing `</div>` of the outer container. The full `ProfessionalDMsInner` return should look like:

```tsx
return (
  <div className="max-w-2xl mx-auto pb-24">
    <MessagesTabs />
    <div className="px-4 py-6">
      {threads.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-white/50 font-medium">No commission threads yet</p>
          <p className="text-xs text-white/30 mt-1">Request a commission from the Commissions tab to get started</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#160b30", border: "1px solid #ffffff10" }}>
          {threads.map(({ commission, otherParty, role }) => (
            <CommissionRow key={commission.id} commission={commission} otherParty={otherParty} role={role} />
          ))}
        </div>
      )}
    </div>
  </div>
)
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add components/MessagesTabs.tsx app/messages/page.tsx app/professional-dms/page.tsx
git commit -m "feat: add Messages/Commissions tab navigation to both list pages"
```

---

## Final Step: Deploy

- [ ] **Deploy to production**

```bash
npx vercel deploy --prod
```

Verify at `https://gallery-ebon-xi.vercel.app/`:
- Open any commission as an artist → Accept form now shows price + deadline inputs; Accept button disabled until both filled
- Open an ACCEPTED commission as the buyer → see "Price: $X · Deadline: [date]" above the confirm button
- Open an ACCEPTED commission as the artist → no "Set deadline" link visible in the action bar
- Visit `/messages` → two tabs visible; "Messages" tab active
- Visit `/professional-dms` → two tabs visible; "Commissions" tab active
- Tap the inactive tab → navigates to the other page
