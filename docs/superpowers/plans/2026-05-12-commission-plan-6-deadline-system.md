# Commission Plan 6 — Deadline System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let artists set an estimated completion deadline on an accepted commission. Both parties get notified when a deadline is created or updated. A lazily-evaluated approaching-deadline alert fires when the buyer or artist opens the thread within 48 h of the deadline.

**Architecture:** `Commission` gets a `deadline DateTime?` and `deadlineNotificationSent Boolean @default(false)` column. Two new tRPC mutations (`setDeadline`, `updateDeadline`) handle changes and emit notifications + system messages. The deadline is displayed in the commission thread's pinned request card. On every `getById` call the server checks whether an approaching-deadline notification should fire (lazy evaluation — no cron required).

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 5 / PostgreSQL, Tailwind v4.

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `deadline DateTime?` and `deadlineNotificationSent Boolean @default(false)` to `Commission` |
| `server/routers/commission.ts` | Add `setDeadline` mutation; add approaching-deadline check inside `getById` |
| `app/professional-dms/[id]/page.tsx` | Show deadline in pinned card; artist sees "Set deadline" / "Update deadline" in action bar |

---

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `deadline` and `deadlineNotificationSent` to `Commission`**

In the `Commission` model, after `deliveredAt DateTime?`, add:
```prisma
deadline                  DateTime?
deadlineNotificationSent  Boolean   @default(false)
```

Full updated Commission model:
```prisma
model Commission {
  id                        String                  @id @default(cuid())
  buyerId                   String
  artistId                  String
  buyer                     User                    @relation("BuyerCommissions", fields: [buyerId], references: [id], onDelete: Cascade)
  artist                    User                    @relation("ArtistCommissions", fields: [artistId], references: [id], onDelete: Cascade)
  status                    CommissionRequestStatus @default(PENDING)
  description               String                  @db.Text
  dropdownSelections        Json                    @default("{}")
  referencePhotos           Json                    @default("[]")
  agreedPrice               Float?
  deliveredAt               DateTime?
  deadline                  DateTime?
  deadlineNotificationSent  Boolean                 @default(false)
  createdAt                 DateTime                @default(now())
  updatedAt                 DateTime                @updatedAt
  messages                  ProfessionalMessage[]
}
```

- [ ] **Step 2: Run migration**
```bash
npx prisma migrate dev --name add-commission-deadline
```
Expected: "Your database is now in sync with your schema."

- [ ] **Step 3: Commit**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add deadline fields to Commission schema"
```

---

### Task 2: Backend — setDeadline mutation + approaching-deadline check

**Files:**
- Modify: `server/routers/commission.ts`

- [ ] **Step 1: Add `setDeadline` mutation**

This mutation is usable by the artist on any non-closed commission. It sets or updates the deadline, creates a system message, and notifies the buyer.

Add after the `updatePrice` mutation:
```ts
setDeadline: protectedProcedure
  .input(z.object({
    id: z.string(),
    deadline: z.string().datetime(), // ISO string from client
  }))
  .mutation(async ({ ctx, input }) => {
    const commission = await ctx.prisma.commission.findUnique({
      where: { id: input.id },
      select: { artistId: true, buyerId: true, status: true, deadline: true },
    })
    if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
    if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
    const CLOSED = ["COMPLETE", "DECLINED", "CANCELLED"]
    if (CLOSED.includes(commission.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is closed" })

    const newDeadline = new Date(input.deadline)
    const isUpdate = commission.deadline !== null
    const formatted = newDeadline.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

    await ctx.prisma.commission.update({
      where: { id: input.id },
      data: { deadline: newDeadline, deadlineNotificationSent: false },
    })

    // System message
    await ctx.prisma.professionalMessage.create({
      data: {
        commissionId: input.id,
        senderId: ctx.session.user.id,
        text: isUpdate
          ? `Deadline updated to ${formatted}.`
          : `Deadline set: ${formatted}.`,
        isSystem: true,
      },
    })

    // Notify buyer
    const notifType = isUpdate ? `commission_deadline_updated:${input.id}` : `commission_deadline_set:${input.id}`
    await ctx.prisma.notification.create({
      data: { userId: commission.buyerId, fromUserId: ctx.session.user.id, type: notifType },
    })

    return { deadline: newDeadline }
  }),
```

- [ ] **Step 2: Update `getById` to check for approaching deadline**

Find the `getById` query. After fetching the commission and before returning it, add:

```ts
// Approaching-deadline notification (within 48 h, not yet sent)
if (
  result &&
  result.deadline &&
  !result.deadlineNotificationSent &&
  !["COMPLETE", "DECLINED", "CANCELLED"].includes(result.status)
) {
  const msUntil = new Date(result.deadline).getTime() - Date.now()
  const fortyEightHours = 48 * 60 * 60 * 1000
  if (msUntil > 0 && msUntil <= fortyEightHours) {
    // Mark as sent so this only fires once
    await ctx.prisma.commission.update({
      where: { id: input.id },
      data: { deadlineNotificationSent: true },
    })
    // Notify both parties
    const callerIsArtist = result.artistId === ctx.session?.user?.id
    const notifyUserId = callerIsArtist ? result.buyerId : result.artistId
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
}
```

Note: The `getById` query needs to include `deadline` and `deadlineNotificationSent` in its select. Find the select block and add:
```ts
deadline: true,
deadlineNotificationSent: true,
```

- [ ] **Step 3: Add deadline notification types to `Navbar.tsx`**

In `getNotificationText`, add entries for the new types:
```ts
commission_deadline_set: "set a deadline for your commission",
commission_deadline_updated: "updated the commission deadline",
commission_deadline_approaching: "commission deadline is approaching",
```

And `getNotificationLink` already handles the `commission_TYPE:ID` pattern → `/professional-dms/ID`.

- [ ] **Step 4: TypeScript check**
```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**
```bash
git add server/routers/commission.ts components/Navbar.tsx
git commit -m "feat: setDeadline mutation and approaching-deadline notification"
```

---

### Task 3: Commission thread UI — deadline display + set/update control

**Files:**
- Modify: `app/professional-dms/[id]/page.tsx`

- [ ] **Step 1: Add deadline state and mutation**

```ts
const [showDeadlinePicker, setShowDeadlinePicker] = useState(false)
const [deadlineInput, setDeadlineInput] = useState("")

const setDeadlineMutation = trpc.commission.setDeadline.useMutation({
  onSuccess: () => {
    utils.commission.getById.invalidate({ id })
    setShowDeadlinePicker(false)
    setDeadlineInput("")
  },
})
```

- [ ] **Step 2: Show deadline inside the collapsible request card**

After the `dropdownSelections` chips block and before the closing `</div>` of the card body, add:
```tsx
{commission.deadline && (
  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
    <p className="text-xs text-gray-600">
      Deadline: <span className="font-semibold">{new Date(commission.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
    </p>
    {(() => {
      const msLeft = new Date(commission.deadline).getTime() - Date.now()
      if (msLeft < 0) return <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">Overdue</span>
      if (msLeft < 48 * 60 * 60 * 1000) return <span className="text-[10px] font-semibold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">Due soon</span>
      return null
    })()}
  </div>
)}
```

- [ ] **Step 3: Add "Set deadline" control to the artist's ACCEPTED / IN_PROGRESS action bar**

In the `isArtist && commission.status === "ACCEPTED"` action block and `isArtist && commission.status === "IN_PROGRESS"` block, add a deadline control below the existing content:

```tsx
{/* Deadline control — shown for artist on any non-closed commission */}
{isArtist && !isClosed && (
  <div className="mt-2 pt-2 border-t border-gray-100">
    {showDeadlinePicker ? (
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={deadlineInput}
          onChange={e => setDeadlineInput(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => {
            if (!deadlineInput) return
            setDeadlineMutation.mutate({ id, deadline: new Date(deadlineInput).toISOString() })
          }}
          disabled={setDeadlineMutation.isPending || !deadlineInput}
          className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {setDeadlineMutation.isPending ? "…" : "Set"}
        </button>
        <button onClick={() => setShowDeadlinePicker(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
    ) : (
      <button
        onClick={() => {
          if (commission.deadline) {
            setDeadlineInput(new Date(commission.deadline).toISOString().split("T")[0])
          }
          setShowDeadlinePicker(true)
        }}
        className="text-xs text-blue-600 hover:underline"
      >
        {commission.deadline ? "Update deadline" : "Set deadline"}
      </button>
    )}
  </div>
)}
```

Place this block inside the outer `{!isClosed && ( <div ...> )}` action bar wrapper, at the very bottom (after all other action blocks).

- [ ] **Step 4: TypeScript check**
```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**
```bash
git add app/professional-dms/[id]/page.tsx
git commit -m "feat: deadline picker in commission thread with overdue/due-soon indicators"
```

---

### Task 4: Deploy

- [ ] **Step 1: Full build check**
```bash
npx tsc --noEmit
```

- [ ] **Step 2: Deploy**
```bash
npx vercel --prod
```
Expected: "Production: https://..."
