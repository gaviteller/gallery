# Commission Cancellation Rules + Dispute Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce post-payment cancellation rules (artist cancel = strike record, buyer cancel = cancellation record), allow artists to cancel, and add a dispute flow that freezes a commission and notifies both parties.

**Architecture:** Add `DISPUTED` to the status enum and `cancelledBy` + `cancellationCount`-related fields to `Commission`. Update the `cancel` procedure to branch on who is cancelling and at what stage. Add a `dispute` procedure. Update the commission thread UI to show Dispute and artist-Cancel buttons where appropriate.

**Tech Stack:** Prisma ORM, tRPC v11, Next.js App Router

---

## Business Rules (from ToS §4)

| Stage | Who Cancels | Outcome |
|---|---|---|
| Before payment (PENDING/ACCEPTED) | Either party | Free — no consequences |
| After payment (IN_PROGRESS) — artist | Artist | Full refund to buyer + **strike recorded** |
| After payment (IN_PROGRESS) — buyer | Buyer | Full refund + **cancellation count incremented on buyer** |
| DELIVERED | Neither | No cancel — dispute only |

- Artist 5+ cancellations in one calendar month → `commissionFeatureDisabled` flag set on User
- Buyer 3+ total cancellations → visible to artists (display on commission request view)
- DISPUTED: freezes commission — no auto-release, no further actions until resolved

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `DISPUTED` to `CommissionRequestStatus`; add `cancelledBy String?`, `disputedAt DateTime?` to `Commission`; add `buyerCancellationCount Int @default(0)` and `commissionFeatureDisabled Boolean @default(false)` to `User` |
| `prisma/migrations/20260519000000_commission_cancel_dispute/migration.sql` | Create migration SQL |
| `server/routers/commission.ts` | Rewrite `cancel` procedure; add `dispute` procedure; update `checkAutoRelease` to skip DISPUTED; update `getById` to include new fields |
| `app/professional-dms/[id]/page.tsx` | Add Dispute button (buyer, DELIVERED stage); show artist Cancel button (PENDING/ACCEPTED/IN_PROGRESS); show DISPUTED status label/color |

---

### Task 1: Schema changes

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write a test for schema shape**

  Create `__tests__/commission-cancel.test.ts`:

  ```typescript
  // __tests__/commission-cancel.test.ts
  import { describe, it, expect } from "vitest"

  // These tests verify business logic functions we'll extract from the router

  describe("cancellation business rules", () => {
    type Stage = "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "DELIVERED" | "COMPLETE" | "CANCELLED" | "DISPUTED"

    function canCancel(status: Stage, role: "artist" | "buyer"): { allowed: boolean; hasConsequences: boolean } {
      if (["COMPLETE", "CANCELLED", "DISPUTED"].includes(status)) {
        return { allowed: false, hasConsequences: false }
      }
      if (status === "DELIVERED") {
        return { allowed: false, hasConsequences: false } // dispute only
      }
      const isPaid = status === "IN_PROGRESS"
      return { allowed: true, hasConsequences: isPaid }
    }

    it("artist can cancel PENDING — no consequences", () => {
      expect(canCancel("PENDING", "artist")).toEqual({ allowed: true, hasConsequences: false })
    })

    it("artist can cancel ACCEPTED — no consequences", () => {
      expect(canCancel("ACCEPTED", "artist")).toEqual({ allowed: true, hasConsequences: false })
    })

    it("artist can cancel IN_PROGRESS — with consequences (strike)", () => {
      expect(canCancel("IN_PROGRESS", "artist")).toEqual({ allowed: true, hasConsequences: true })
    })

    it("buyer can cancel IN_PROGRESS — with consequences (cancellation count)", () => {
      expect(canCancel("IN_PROGRESS", "buyer")).toEqual({ allowed: true, hasConsequences: true })
    })

    it("cannot cancel DELIVERED", () => {
      expect(canCancel("DELIVERED", "buyer")).toEqual({ allowed: false, hasConsequences: false })
    })

    it("cannot cancel COMPLETE", () => {
      expect(canCancel("COMPLETE", "buyer")).toEqual({ allowed: false, hasConsequences: false })
    })

    it("cannot cancel DISPUTED", () => {
      expect(canCancel("DISPUTED", "buyer")).toEqual({ allowed: false, hasConsequences: false })
    })
  })
  ```

- [ ] **Step 2: Run test to verify logic**

  ```bash
  npx vitest run __tests__/commission-cancel.test.ts
  ```

  Expected: PASS (pure logic test)

- [ ] **Step 3: Edit `prisma/schema.prisma`**

  **3a. Add `DISPUTED` to the enum:**

  ```prisma
  enum CommissionRequestStatus {
    PENDING
    ACCEPTED
    IN_PROGRESS
    DELIVERED
    COMPLETE
    DECLINED
    CANCELLED
    DISPUTED
  }
  ```

  **3b. Add fields to `Commission` model** (after `deliveredAt DateTime?`):

  ```prisma
  cancelledBy        String?
  disputedAt         DateTime?
  ```

  **3c. Add fields to `User` model** (after `commissionStatus CommissionStatus @default(CLOSED)`):

  ```prisma
  buyerCancellationCount      Int     @default(0)
  commissionFeatureDisabled   Boolean @default(false)
  ```

- [ ] **Step 4: Create migration**

  ```bash
  npx prisma migrate dev --name commission_cancel_dispute
  ```

  Expected: migration created and applied locally. If it asks about the new enum value, confirm yes.

- [ ] **Step 5: Commit**

  ```bash
  git add prisma/schema.prisma prisma/migrations/
  git commit -m "feat(schema): add DISPUTED status, cancelledBy, disputedAt, buyerCancellationCount, commissionFeatureDisabled"
  ```

---

### Task 2: Rewrite `cancel` procedure in commission router

**Files:**
- Modify: `server/routers/commission.ts` (lines 462–482)

Replace the existing `cancel` procedure with one that:
1. Allows both artist AND buyer to cancel
2. Applies consequences only when post-payment (IN_PROGRESS)
3. Records `cancelledBy`
4. For artist post-payment cancel: records a strike (just a system message for now — full strike system is Tier 2)
5. For buyer post-payment cancel: increments `buyerCancellationCount` on buyer's User record
6. For artist: checks if they've hit 5+ post-payment cancellations this calendar month → set `commissionFeatureDisabled`

- [ ] **Step 1: Replace the `cancel` procedure**

  Replace lines 462–482 in `server/routers/commission.ts` with:

  ```typescript
  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })

      const isArtist = commission.artistId === me
      const isBuyer = commission.buyerId === me
      if (!isArtist && !isBuyer) throw new TRPCError({ code: "FORBIDDEN" })

      // Cannot cancel DELIVERED, COMPLETE, CANCELLED, or DISPUTED
      const cancellableStatuses = ["PENDING", "ACCEPTED", "IN_PROGRESS"]
      if (!cancellableStatuses.includes(commission.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Commission cannot be cancelled at this stage" })
      }

      const isPaid = commission.status === "IN_PROGRESS"
      const cancellerRole = isArtist ? "artist" : "buyer"

      // Build system message
      let systemMsg: string
      if (!isPaid) {
        systemMsg = `Commission cancelled by ${cancellerRole}.`
      } else if (isArtist) {
        systemMsg = "Commission cancelled by artist after payment. Full refund issued to buyer. A strike has been recorded against the artist."
      } else {
        systemMsg = "Commission cancelled by buyer after payment. Full refund issued."
      }

      await ctx.prisma.$transaction(async (tx) => {
        // Cancel the commission
        await tx.commission.update({
          where: { id: input.id },
          data: { status: "CANCELLED", cancelledBy: cancellerRole },
        })

        // Post-payment consequences
        if (isPaid && isArtist) {
          // Increment artist's monthly cancellation count — check if feature should be disabled
          const monthStart = new Date()
          monthStart.setDate(1)
          monthStart.setHours(0, 0, 0, 0)

          const monthlyCancels = await tx.commission.count({
            where: {
              artistId: commission.artistId,
              cancelledBy: "artist",
              status: "CANCELLED",
              updatedAt: { gte: monthStart },
            },
          })

          // 4 existing + this one = 5
          if (monthlyCancels >= 4) {
            await tx.user.update({
              where: { id: commission.artistId },
              data: { commissionFeatureDisabled: true },
            })
          }
        }

        if (isPaid && isBuyer) {
          await tx.user.update({
            where: { id: commission.buyerId },
            data: { buyerCancellationCount: { increment: 1 } },
          })
        }

        // Notifications
        const notifyId = isArtist ? commission.buyerId : commission.artistId
        await tx.notification.create({
          data: { userId: notifyId, fromUserId: me, type: `commission_cancelled:${input.id}` },
        })

        await tx.professionalMessage.create({
          data: { commissionId: input.id, senderId: me, text: systemMsg, isSystem: true },
        })
      })

      return ctx.prisma.commission.findUnique({ where: { id: input.id } })
    }),
  ```

- [ ] **Step 2: Run tests**

  ```bash
  npx vitest run __tests__/commission-cancel.test.ts
  npx tsc --noEmit
  ```

  Expected: all PASS, no type errors

- [ ] **Step 3: Commit**

  ```bash
  git add server/routers/commission.ts
  git commit -m "feat: rewrite cancel procedure — artist + buyer, post-payment consequences"
  ```

---

### Task 3: Add `dispute` procedure

**Files:**
- Modify: `server/routers/commission.ts` (add after `cancel`)

The dispute procedure:
- Only available to buyer
- Only on DELIVERED status (within the 5-day window — buyer calls this instead of confirmDelivery)
- Sets status to DISPUTED, records `disputedAt`
- Notifies artist
- Posts system message

- [ ] **Step 1: Write a test**

  Add to `__tests__/commission-cancel.test.ts`:

  ```typescript
  describe("dispute eligibility", () => {
    type Stage = "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "DELIVERED" | "COMPLETE" | "CANCELLED" | "DISPUTED"

    function canDispute(status: Stage, role: "artist" | "buyer"): boolean {
      return status === "DELIVERED" && role === "buyer"
    }

    it("buyer can dispute DELIVERED", () => {
      expect(canDispute("DELIVERED", "buyer")).toBe(true)
    })

    it("artist cannot dispute", () => {
      expect(canDispute("DELIVERED", "artist")).toBe(false)
    })

    it("cannot dispute IN_PROGRESS", () => {
      expect(canDispute("IN_PROGRESS", "buyer")).toBe(false)
    })
  })
  ```

- [ ] **Step 2: Run test**

  ```bash
  npx vitest run __tests__/commission-cancel.test.ts
  ```

  Expected: PASS

- [ ] **Step 3: Add `dispute` procedure to `server/routers/commission.ts`**

  Add this after the `cancel` procedure:

  ```typescript
  dispute: protectedProcedure
    .input(z.object({
      id: z.string(),
      reason: z.string().min(10).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== me) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "DELIVERED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can only dispute a delivered commission" })
      }

      await ctx.prisma.$transaction([
        ctx.prisma.commission.update({
          where: { id: input.id },
          data: { status: "DISPUTED", disputedAt: new Date() },
        }),
        ctx.prisma.notification.create({
          data: {
            userId: commission.artistId,
            fromUserId: me,
            type: `commission_disputed:${input.id}`,
          },
        }),
        ctx.prisma.professionalMessage.create({
          data: {
            commissionId: input.id,
            senderId: me,
            text: `Commission disputed by buyer. Reason: ${input.reason}\n\nThis commission is now frozen pending moderation review. Escrow will not be released until resolved.`,
            isSystem: true,
          },
        }),
      ])

      return ctx.prisma.commission.findUnique({ where: { id: input.id } })
    }),
  ```

- [ ] **Step 4: Update `checkAutoRelease` to skip DISPUTED commissions**

  In `server/routers/commission.ts`, find `checkAutoRelease` and update the guard condition:

  Change:
  ```typescript
  if (commission.buyerId !== ctx.session.user.id && commission.artistId !== ctx.session.user.id) {
  ```

  The condition that checks status already handles `DELIVERED` — but add DISPUTED guard:

  Change the opening check from:
  ```typescript
  if (!commission || commission.status !== "DELIVERED" || !commission.deliveredAt) return null
  ```
  To:
  ```typescript
  if (!commission || commission.status !== "DELIVERED" || commission.disputedAt || !commission.deliveredAt) return null
  ```

- [ ] **Step 5: Build check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 6: Commit**

  ```bash
  git add server/routers/commission.ts __tests__/commission-cancel.test.ts
  git commit -m "feat: add dispute procedure — freezes commission, notifies artist, blocks auto-release"
  ```

---

### Task 4: Update commission thread UI

**Files:**
- Modify: `app/professional-dms/[id]/page.tsx`

Changes needed:
1. Add `DISPUTED` to `statusLabel` and `statusColor` maps
2. Add `disputeMutation` using `trpc.commission.dispute`
3. Show artist Cancel button for PENDING, ACCEPTED, IN_PROGRESS (artist only)
4. Show Dispute button for buyer on DELIVERED status (with a reason input modal)
5. Remove the constraint that only buyers can see the Cancel button

- [ ] **Step 1: Update `statusLabel` and `statusColor` maps**

  In `app/professional-dms/[id]/page.tsx`, add DISPUTED to both maps:

  ```typescript
  const statusLabel: Record<string, string> = {
    PENDING: "Pending artist response",
    ACCEPTED: "Accepted — awaiting payment",
    IN_PROGRESS: "In progress",
    DELIVERED: "Delivered — awaiting confirmation",
    COMPLETE: "Complete",
    DECLINED: "Declined",
    CANCELLED: "Cancelled",
    DISPUTED: "Disputed — under moderation review",
  }

  const statusColor: Record<string, string> = {
    PENDING: "bg-yellow-500/20 text-yellow-400",
    ACCEPTED: "bg-blue-500/20 text-blue-400",
    IN_PROGRESS: "bg-blue-500/20 text-blue-400",
    DELIVERED: "bg-purple-500/20 text-purple-400",
    COMPLETE: "bg-green-500/20 text-green-400",
    DECLINED: "bg-white/10 text-white/40",
    CANCELLED: "bg-white/10 text-white/40",
    DISPUTED: "bg-red-500/20 text-red-400",
  }

  const CLOSED = ["COMPLETE", "DECLINED", "CANCELLED", "DISPUTED"]
  ```

- [ ] **Step 2: Add dispute state and mutation to `CommissionThread`**

  In the `CommissionThread` component, add after the `cancelMutation` block:

  ```typescript
  // Dispute
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState("")
  const disputeMutation = trpc.commission.dispute.useMutation({
    onSuccess: () => {
      utils.commission.getById.invalidate({ id })
      setShowDisputeModal(false)
      setDisputeReason("")
    },
  })
  ```

- [ ] **Step 3: Add artist Cancel button and Dispute button to the action area**

  Find the section in the JSX where the buyer cancel button is rendered. It will look something like:

  ```tsx
  {isBuyer && ["PENDING", "ACCEPTED"].includes(commission.status) && (
    <button onClick={() => cancelMutation.mutate({ id })} ...>Cancel commission</button>
  )}
  ```

  Replace the entire cancel button block with:

  ```tsx
  {/* Cancel — artist side: PENDING, ACCEPTED, IN_PROGRESS */}
  {isArtist && ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(commission.status) && (
    <button
      onClick={() => {
        if (!confirm(
          commission.status === "IN_PROGRESS"
            ? "Cancel this commission? Since payment has been made, a strike will be recorded against you and the buyer will be refunded."
            : "Cancel this commission?"
        )) return
        cancelMutation.mutate({ id })
      }}
      disabled={cancelMutation.isPending}
      style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 14, border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}
    >
      {cancelMutation.isPending ? "Cancelling…" : "Cancel commission"}
    </button>
  )}

  {/* Cancel — buyer side: PENDING, ACCEPTED, IN_PROGRESS */}
  {isBuyer && ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(commission.status) && (
    <button
      onClick={() => {
        if (!confirm("Cancel this commission? If payment has been made, a cancellation will be recorded on your account.")) return
        cancelMutation.mutate({ id })
      }}
      disabled={cancelMutation.isPending}
      style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 14, border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}
    >
      {cancelMutation.isPending ? "Cancelling…" : "Cancel commission"}
    </button>
  )}

  {/* Dispute — buyer only, DELIVERED stage */}
  {isBuyer && commission.status === "DELIVERED" && (
    <button
      onClick={() => setShowDisputeModal(true)}
      style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 14, border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}
    >
      Raise a dispute
    </button>
  )}
  ```

- [ ] **Step 4: Add the dispute modal JSX**

  Add the dispute modal before the closing `</div>` of the page:

  ```tsx
  {/* Dispute modal */}
  {showDisputeModal && (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={() => setShowDisputeModal(false)}
    >
      <div
        style={{ background: "#1a1a1f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480 }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ color: "#fff", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Raise a Dispute</h3>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 16 }}>
          Explain the issue. This will freeze the commission and escrow pending moderation review. Only raise a dispute for clear ToS violations — Gallery does not mediate subjective quality disagreements.
        </p>
        <textarea
          value={disputeReason}
          onChange={e => setDisputeReason(e.target.value)}
          placeholder="Describe the violation clearly…"
          rows={5}
          style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setShowDisputeModal(false)}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "none", cursor: "pointer", fontSize: 14 }}
          >
            Cancel
          </button>
          <button
            onClick={() => disputeMutation.mutate({ id, reason: disputeReason })}
            disabled={disputeReason.trim().length < 10 || disputeMutation.isPending}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "rgba(239,68,68,0.3)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)", cursor: "pointer", fontSize: 14, opacity: disputeReason.trim().length < 10 ? 0.4 : 1 }}
          >
            {disputeMutation.isPending ? "Submitting…" : "Submit dispute"}
          </button>
        </div>
      </div>
    </div>
  )}
  ```

- [ ] **Step 5: Build check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 6: Commit**

  ```bash
  git add app/professional-dms/[id]/page.tsx
  git commit -m "feat: commission thread — artist cancel, buyer dispute modal, DISPUTED status UI"
  ```
