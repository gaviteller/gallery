# Trust Score — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calculate and display a Trust Score for artists on their profile. Score = average buyer rating + cancellation rate + selling-related strikes. Visible after 10 completed commissions, with a tap-to-expand breakdown. Buyers can flag a rating as retaliatory.

**Architecture:** Add a `getTrustScore` tRPC query on the commission router. Score is computed live from DB data. Display it on the profile page after the stats row, with a collapsible breakdown panel. Add a `flagRating` procedure for rating dispute flow.

**Tech Stack:** tRPC v11, Prisma ORM, Next.js App Router

---

## Business Rules (ToS §14)

- Trust Score = average buyer rating (1–5) + cancellation rate + selling-related strikes
- Displayed **only after 10 completed commissions** — shows "New Artist" badge before that
- Tapping opens full breakdown: avg rating, total commissions, cancellation rate, strike note
- Buyer cancellation count visible to artist **before** accepting a commission request
- Rating dispute: buyer can flag a rating as retaliatory → queued for human review
  - If confirmed retaliatory: Minor strike against buyer (this plan records the flag; Tier 2 adds the review queue)

---

## Trust Score Formula

```
avgRating    = average of all non-null buyerRating values on COMPLETE commissions (1–5 scale)
cancelRate   = (post-payment artist cancellations / total accepted commissions) * 100  (%)
strikeNote   = text — "Strikes may affect this score" (actual strike system is Tier 2)

displayScore = avgRating   (shown as X.X / 5.0)
```

The profile shows:
- The numeric average rating (e.g., "4.2 / 5.0")
- "New Artist" if completedCount < 10
- Tapping opens: avg rating, total completed, cancellation rate, total ratings

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ratingFlagged Boolean @default(false)` to `Commission` model |
| `prisma/migrations/20260519000001_rating_flag/migration.sql` | Migration |
| `server/routers/commission.ts` | Add `getTrustScore` query; add `flagRating` mutation; update `getById` to return `buyerCancellationCount` on buyer |
| `app/[username]/page.tsx` | Add Trust Score display between stats and action buttons |

---

### Task 1: Schema — add `ratingFlagged` to Commission

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add field to Commission model**

  In `prisma/schema.prisma`, add after `buyerRating Int?`:

  ```prisma
  ratingFlagged      Boolean   @default(false)
  ```

- [ ] **Step 2: Create migration**

  ```bash
  npx prisma migrate dev --name rating_flag
  ```

  Expected: migration created and applied locally

- [ ] **Step 3: Commit**

  ```bash
  git add prisma/schema.prisma prisma/migrations/
  git commit -m "feat(schema): add ratingFlagged field to Commission"
  ```

---

### Task 2: Add `getTrustScore` procedure

**Files:**
- Modify: `server/routers/commission.ts`

- [ ] **Step 1: Write the test**

  Create `__tests__/trust-score.test.ts`:

  ```typescript
  import { describe, it, expect } from "vitest"

  // Pure logic functions extracted from what we'll put in the router
  function computeTrustScore(commissions: Array<{
    status: string
    buyerRating: number | null
    cancelledBy: string | null
  }>) {
    const completed = commissions.filter(c => c.status === "COMPLETE")
    const completedCount = completed.length

    const ratings = completed.filter(c => c.buyerRating !== null).map(c => c.buyerRating as number)
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null

    const accepted = commissions.filter(c => !["PENDING", "DECLINED"].includes(c.status))
    const artistCancels = accepted.filter(c => c.cancelledBy === "artist").length
    const cancelRate = accepted.length > 0
      ? Math.round((artistCancels / accepted.length) * 100)
      : 0

    return { completedCount, avgRating, cancelRate, ratingCount: ratings.length }
  }

  describe("computeTrustScore", () => {
    it("returns null avgRating with no ratings", () => {
      const result = computeTrustScore([
        { status: "COMPLETE", buyerRating: null, cancelledBy: null },
      ])
      expect(result.avgRating).toBeNull()
      expect(result.completedCount).toBe(1)
    })

    it("averages ratings correctly", () => {
      const result = computeTrustScore([
        { status: "COMPLETE", buyerRating: 5, cancelledBy: null },
        { status: "COMPLETE", buyerRating: 4, cancelledBy: null },
        { status: "COMPLETE", buyerRating: 3, cancelledBy: null },
      ])
      expect(result.avgRating).toBe(4.0)
      expect(result.ratingCount).toBe(3)
    })

    it("rounds to 1 decimal place", () => {
      const result = computeTrustScore([
        { status: "COMPLETE", buyerRating: 5, cancelledBy: null },
        { status: "COMPLETE", buyerRating: 4, cancelledBy: null },
      ])
      expect(result.avgRating).toBe(4.5)
    })

    it("calculates cancel rate as percentage", () => {
      const result = computeTrustScore([
        { status: "IN_PROGRESS", buyerRating: null, cancelledBy: null },
        { status: "CANCELLED", buyerRating: null, cancelledBy: "artist" },
        { status: "COMPLETE", buyerRating: 5, cancelledBy: null },
      ])
      // 1 artist cancel out of 3 accepted = 33%
      expect(result.cancelRate).toBe(33)
    })

    it("0 cancel rate with no cancellations", () => {
      const result = computeTrustScore([
        { status: "COMPLETE", buyerRating: 5, cancelledBy: null },
        { status: "COMPLETE", buyerRating: 4, cancelledBy: null },
      ])
      expect(result.cancelRate).toBe(0)
    })

    it("returns completedCount 0 with no completed commissions", () => {
      const result = computeTrustScore([])
      expect(result.completedCount).toBe(0)
      expect(result.avgRating).toBeNull()
    })
  })
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  npx vitest run __tests__/trust-score.test.ts
  ```

  Expected: PASS (pure logic, no router dependency)

- [ ] **Step 3: Add `getTrustScore` to `server/routers/commission.ts`**

  Add this procedure after `getProfile`:

  ```typescript
  getTrustScore: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const artist = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true },
      })
      if (!artist) throw new TRPCError({ code: "NOT_FOUND" })

      const commissions = await ctx.prisma.commission.findMany({
        where: {
          artistId: artist.id,
          status: { notIn: ["PENDING", "DECLINED"] },
        },
        select: { status: true, buyerRating: true, cancelledBy: true },
      })

      const completed = commissions.filter(c => c.status === "COMPLETE")
      const completedCount = completed.length

      const ratings = completed
        .filter(c => c.buyerRating !== null)
        .map(c => c.buyerRating as number)
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null

      const artistCancels = commissions.filter(c => c.cancelledBy === "artist").length
      const cancelRate = commissions.length > 0
        ? Math.round((artistCancels / commissions.length) * 100)
        : 0

      return {
        completedCount,
        avgRating,
        cancelRate,
        ratingCount: ratings.length,
        hasScore: completedCount >= 10,
      }
    }),
  ```

- [ ] **Step 4: Run tests + build check**

  ```bash
  npx vitest run __tests__/trust-score.test.ts
  npx tsc --noEmit
  ```

  Expected: all PASS, no type errors

- [ ] **Step 5: Commit**

  ```bash
  git add server/routers/commission.ts __tests__/trust-score.test.ts
  git commit -m "feat: add getTrustScore tRPC procedure"
  ```

---

### Task 3: Add `flagRating` procedure

**Files:**
- Modify: `server/routers/commission.ts`

The artist can flag a buyer's rating as retaliatory. This records the flag for human review. (The review queue UI is Tier 2 — for now this just sets `ratingFlagged = true` and posts a system message in the commission thread.)

- [ ] **Step 1: Write test**

  Add to `__tests__/trust-score.test.ts`:

  ```typescript
  describe("flagRating eligibility", () => {
    function canFlagRating(commission: {
      status: string
      buyerRating: number | null
      ratingFlagged: boolean
    }, role: "artist" | "buyer"): boolean {
      if (role !== "artist") return false
      if (commission.status !== "COMPLETE") return false
      if (commission.buyerRating === null) return false
      if (commission.ratingFlagged) return false
      return true
    }

    it("artist can flag a completed, rated, unflagged commission", () => {
      expect(canFlagRating({ status: "COMPLETE", buyerRating: 1, ratingFlagged: false }, "artist")).toBe(true)
    })

    it("buyer cannot flag", () => {
      expect(canFlagRating({ status: "COMPLETE", buyerRating: 1, ratingFlagged: false }, "buyer")).toBe(false)
    })

    it("cannot flag already flagged", () => {
      expect(canFlagRating({ status: "COMPLETE", buyerRating: 1, ratingFlagged: true }, "artist")).toBe(false)
    })

    it("cannot flag if no rating yet", () => {
      expect(canFlagRating({ status: "COMPLETE", buyerRating: null, ratingFlagged: false }, "artist")).toBe(false)
    })
  })
  ```

- [ ] **Step 2: Run test**

  ```bash
  npx vitest run __tests__/trust-score.test.ts
  ```

  Expected: PASS

- [ ] **Step 3: Add `flagRating` to `server/routers/commission.ts`**

  Add after `submitRating`:

  ```typescript
  flagRating: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== me) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "COMPLETE") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not complete" })
      if (commission.buyerRating === null) throw new TRPCError({ code: "BAD_REQUEST", message: "No rating to dispute" })
      if (commission.ratingFlagged) throw new TRPCError({ code: "BAD_REQUEST", message: "Rating already flagged" })

      await ctx.prisma.$transaction([
        ctx.prisma.commission.update({
          where: { id: input.id },
          data: { ratingFlagged: true },
        }),
        ctx.prisma.professionalMessage.create({
          data: {
            commissionId: input.id,
            senderId: me,
            text: "Artist has flagged this rating as potentially retaliatory. The rating has been queued for human review.",
            isSystem: true,
          },
        }),
      ])

      return ctx.prisma.commission.findUnique({ where: { id: input.id } })
    }),
  ```

- [ ] **Step 4: Build check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 5: Commit**

  ```bash
  git add server/routers/commission.ts __tests__/trust-score.test.ts
  git commit -m "feat: add flagRating procedure for rating dispute flow"
  ```

---

### Task 4: Display Trust Score on profile page

**Files:**
- Modify: `app/[username]/page.tsx`

Add a Trust Score row between the stats block and the action buttons. When `hasScore` is false (< 10 completions), show "New Artist" badge. When true, show the numeric score and tap-to-expand breakdown.

- [ ] **Step 1: Add the `getTrustScore` query**

  In `app/[username]/page.tsx`, add after the `commissionProfile` query (around line 70):

  ```typescript
  const { data: trustScore } = trpc.commission.getTrustScore.useQuery({ username })
  ```

- [ ] **Step 2: Add Trust Score state**

  Add after the `showMutuals` state:

  ```typescript
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false)
  ```

- [ ] **Step 3: Add the Trust Score JSX block**

  Insert this block between the stats block and the action buttons section.
  The stats block ends around line 311 (`</div>` after the mutuals button).
  The action buttons section starts with the comment `{/* Action buttons */}`.

  Insert immediately after the stats `</div>`:

  ```tsx
  {/* Trust Score */}
  {trustScore && (commissionProfile?.commissionStatus === "OPEN" || commissionProfile?.commissionStatus === "LIMITED" || (isOwn && commissionProfile)) && (
    <div style={{ marginTop: 10 }}>
      {trustScore.hasScore ? (
        <div>
          <button
            onClick={() => setShowScoreBreakdown(prev => !prev)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "5px 12px", cursor: "pointer" }}
          >
            {/* Stars */}
            <span style={{ color: "#facc15", fontSize: 13 }}>
              {"★".repeat(Math.round(trustScore.avgRating ?? 0))}{"☆".repeat(5 - Math.round(trustScore.avgRating ?? 0))}
            </span>
            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>
              {trustScore.avgRating?.toFixed(1) ?? "—"} / 5.0
            </span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
              ({trustScore.ratingCount} {trustScore.ratingCount === 1 ? "rating" : "ratings"})
            </span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
              {showScoreBreakdown ? "▲" : "▼"}
            </span>
          </button>

          {/* Breakdown panel */}
          {showScoreBreakdown && (
            <div style={{ marginTop: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Average rating</span>
                <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>{trustScore.avgRating?.toFixed(1) ?? "—"} / 5.0</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Completed commissions</span>
                <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>{trustScore.completedCount}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Artist cancel rate</span>
                <span style={{ color: trustScore.cancelRate > 20 ? "#f87171" : "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>{trustScore.cancelRate}%</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          ✦ New Artist
        </span>
      )}
    </div>
  )}
  ```

- [ ] **Step 4: Show buyer cancellation count on CommissionRequestModal (for artists to see before accepting)**

  This is visible to the artist when reviewing a commission request. The modal is at `components/CommissionRequestModal.tsx`. First check what data it receives:

  ```bash
  grep -n "buyerCancellationCount\|cancellation" components/CommissionRequestModal.tsx || echo "not found"
  ```

  The modal receives `artistId` and `artistUsername`. The commission request is submitted by the buyer. When an artist views incoming requests in `app/professional-profile/page.tsx` or similar, we'd want to show the buyer's cancellation count.

  For now, update the `getById` query in `server/routers/commission.ts` to include the buyer's `buyerCancellationCount` so it appears in the commission thread where the artist decides to accept:

  Find the `getById` procedure and add `buyerCancellationCount` to the buyer select:

  ```typescript
  buyer: {
    select: {
      id: true,
      username: true,
      name: true,
      image: true,
      buyerCancellationCount: true,  // ADD THIS
    },
  },
  ```

  Then in `app/professional-dms/[id]/page.tsx`, show it in the commission brief card when the viewer is the artist and status is PENDING or ACCEPTED:

  Find the commission brief section (the pinned card at the top of the thread that shows the request details). Add a line after buyer info:

  ```tsx
  {isArtist && commission.status === "PENDING" && (commission.buyer as any).buyerCancellationCount > 0 && (
    <p style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>
      ⚠ This buyer has {(commission.buyer as any).buyerCancellationCount} previous cancellation{(commission.buyer as any).buyerCancellationCount !== 1 ? "s" : ""}
    </p>
  )}
  ```

- [ ] **Step 5: Add "Flag rating" button on completed commissions (artist side)**

  In `app/professional-dms/[id]/page.tsx`, find the rating display section (where `buyerRating` is shown after completion). Add a "Flag as retaliatory" button for the artist:

  ```tsx
  {isArtist && commission.status === "COMPLETE" && commission.buyerRating !== null && !commission.ratingFlagged && (
    <button
      onClick={() => {
        if (!confirm("Flag this rating as retaliatory? It will be queued for human review.")) return
        trpc.commission.flagRating.useMutation() // see note below
      }}
      style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: 4 }}
    >
      Flag as retaliatory
    </button>
  )}
  ```

  **Note:** Add `flagRatingMutation` to the mutation list at the top of `CommissionThread` alongside the other mutations:

  ```typescript
  const flagRatingMutation = trpc.commission.flagRating.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })
  ```

  Then use it in the button:

  ```tsx
  {isArtist && commission.status === "COMPLETE" && commission.buyerRating !== null && !commission.ratingFlagged && (
    <button
      onClick={() => {
        if (!confirm("Flag this rating as retaliatory? It will be queued for human review.")) return
        flagRatingMutation.mutate({ id })
      }}
      style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: 4 }}
    >
      Flag as retaliatory
    </button>
  )}
  ```

- [ ] **Step 6: Build check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors

- [ ] **Step 7: Commit**

  ```bash
  git add app/[username]/page.tsx app/professional-dms/[id]/page.tsx server/routers/commission.ts
  git commit -m "feat: Trust Score display on profile, buyer cancel count in thread, flag rating button"
  ```
