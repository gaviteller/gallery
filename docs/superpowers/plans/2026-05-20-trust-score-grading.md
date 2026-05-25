# Trust Score Grading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Trust Score system to show tier labels (Excellent / Good / Fair / Poor / New Artist) with colour-coded chips, replacing the raw star display, and extend the `getTrustScore` procedure to return `finalScore`, `tier`, `strikeDeduction`, and `sellingStrikeCount` (deductions = 0 until the Strike model ships in Tier 2).

**Architecture:** A pure `computeTier` utility lives in `server/lib/trustScore.ts` and is shared between the tRPC procedure and any future callers. The procedure wraps the existing DB query and applies the formula. The profile page frontend consumes the new fields — no breaking change to the query signature, just additional fields returned.

**Tech Stack:** TypeScript, tRPC v11, Prisma, React (Next.js App Router), Vitest

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `server/lib/trustScore.ts` | `computeTier` pure function, `TrustTier` type, label/colour maps |
| Create | `tests/server/trustScore.test.ts` | Unit tests for `computeTier` covering all branches |
| Modify | `server/routers/commission.ts` lines 722–761 | Update `getTrustScore` return shape to include `finalScore`, `tier`, `strikeDeduction`, `sellingStrikeCount` |
| Modify | `app/[username]/page.tsx` lines 316–363 | Profile header Trust Score block — replace stars with tier chip + score |
| Modify | `app/[username]/page.tsx` lines 340–355 | Breakdown panel — add tier label, selling strikes row |
| Modify | `app/[username]/page.tsx` lines 561–575 | Commissions tab info card — replace stars with tier chip |
| Modify | `docs/roadmap.md` | Check off Trust Score grading design task |
| Modify | `C:\Users\gavri\OneDrive\Documents\art socail\Gallery\Product\Roadmap.md` | Sync Obsidian copy |

---

## Task 1: `computeTier` utility + tests

**Files:**
- Create: `server/lib/trustScore.ts`
- Create: `tests/server/trustScore.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/server/trustScore.test.ts
import { describe, it, expect } from "vitest"
import { computeTier, TIER_LABELS, TIER_COLORS, type TrustTier } from "@/server/lib/trustScore"

describe("computeTier", () => {
  it("returns suspended when isSuspended is true regardless of score", () => {
    expect(computeTier(4.9, true, true)).toBe("suspended")
    expect(computeTier(null, false, true)).toBe("suspended")
  })

  it("returns new_artist when hasScore is false", () => {
    expect(computeTier(null, false, false)).toBe("new_artist")
  })

  it("returns new_artist when finalScore is null even if hasScore is true", () => {
    expect(computeTier(null, true, false)).toBe("new_artist")
  })

  it("returns excellent for scores 4.5 to 5.0", () => {
    expect(computeTier(5.0, true, false)).toBe("excellent")
    expect(computeTier(4.5, true, false)).toBe("excellent")
    expect(computeTier(4.7, true, false)).toBe("excellent")
  })

  it("returns good for scores 3.5 to 4.4", () => {
    expect(computeTier(4.4, true, false)).toBe("good")
    expect(computeTier(3.5, true, false)).toBe("good")
    expect(computeTier(3.8, true, false)).toBe("good")
  })

  it("returns fair for scores 2.5 to 3.4", () => {
    expect(computeTier(3.4, true, false)).toBe("fair")
    expect(computeTier(2.5, true, false)).toBe("fair")
    expect(computeTier(3.0, true, false)).toBe("fair")
  })

  it("returns poor for scores 1.0 to 2.4", () => {
    expect(computeTier(2.4, true, false)).toBe("poor")
    expect(computeTier(1.0, true, false)).toBe("poor")
    expect(computeTier(1.5, true, false)).toBe("poor")
  })

  it("TIER_LABELS has an entry for every tier", () => {
    const tiers: TrustTier[] = ["excellent", "good", "fair", "poor", "new_artist", "suspended"]
    tiers.forEach(t => expect(TIER_LABELS[t]).toBeTruthy())
  })

  it("TIER_COLORS has an entry for every tier", () => {
    const tiers: TrustTier[] = ["excellent", "good", "fair", "poor", "new_artist", "suspended"]
    tiers.forEach(t => expect(TIER_COLORS[t]).toBeTruthy())
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
npx vitest run tests/server/trustScore.test.ts
```

Expected: `FAIL — Cannot find module '@/server/lib/trustScore'`

- [ ] **Step 3: Create `server/lib/trustScore.ts`**

```typescript
// server/lib/trustScore.ts

export type TrustTier =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "new_artist"
  | "suspended"

/**
 * Compute the Trust Score tier from a final score.
 * Pure function — no side effects, no DB access.
 *
 * @param finalScore  avgRating minus strike deductions, floored at 1.0. null = no ratings yet.
 * @param hasScore    true when the artist has 10+ completed commissions
 * @param isSuspended true when the artist has a Zero Tolerance ban
 */
export function computeTier(
  finalScore: number | null,
  hasScore: boolean,
  isSuspended: boolean
): TrustTier {
  if (isSuspended) return "suspended"
  if (!hasScore || finalScore === null) return "new_artist"
  if (finalScore >= 4.5) return "excellent"
  if (finalScore >= 3.5) return "good"
  if (finalScore >= 2.5) return "fair"
  return "poor"
}

export const TIER_LABELS: Record<TrustTier, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  new_artist: "New Artist",
  suspended: "Suspended",
}

export const TIER_COLORS: Record<TrustTier, string> = {
  excellent: "#4ade80",
  good: "#60a5fa",
  fair: "#facc15",
  poor: "#f87171",
  new_artist: "rgba(255,255,255,0.4)",
  suspended: "#f87171",
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/server/trustScore.test.ts
```

Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/lib/trustScore.ts tests/server/trustScore.test.ts
git commit -m "feat: add computeTier utility with tests"
```

---

## Task 2: Update `getTrustScore` procedure

**Files:**
- Modify: `server/routers/commission.ts` (the `getTrustScore` procedure, currently lines 722–761)

- [ ] **Step 1: Replace the `getTrustScore` implementation**

Find this block in `server/routers/commission.ts`:

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

Replace with:

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
      const hasScore = completedCount >= 10

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

      // Strike deductions are 0 until the Strike model ships in Tier 2
      const strikeDeduction = 0
      const sellingStrikeCount = 0

      const finalScore = avgRating !== null
        ? Math.max(1.0, Math.round((avgRating - strikeDeduction) * 10) / 10)
        : null

      const tier = computeTier(finalScore, hasScore, false)

      return {
        completedCount,
        avgRating,
        finalScore,
        tier,
        cancelRate,
        ratingCount: ratings.length,
        hasScore,
        strikeDeduction,
        sellingStrikeCount,
      }
    }),
```

- [ ] **Step 2: Add the import for `computeTier` at the top of `server/routers/commission.ts`**

Find the existing imports at the top of the file (the `import { z } from "zod"` line area) and add:

```typescript
import { computeTier } from "@/server/lib/trustScore"
```

- [ ] **Step 3: Run all tests to confirm nothing broken**

```bash
npx vitest run
```

Expected: all tests PASS (no regressions)

- [ ] **Step 4: Commit**

```bash
git add server/routers/commission.ts
git commit -m "feat: extend getTrustScore with finalScore, tier, strikeDeduction"
```

---

## Task 3: Update profile header Trust Score display

**Files:**
- Modify: `app/[username]/page.tsx`

The profile header Trust Score block is at lines 316–363. It currently shows raw stars + "X.X / 5.0". Replace it with a coloured tier chip + numeric score, and update the breakdown panel to show the new fields.

- [ ] **Step 1: Add the tier colour/label import at the top of `app/[username]/page.tsx`**

Add to the existing imports (after the component imports):

```typescript
import { TIER_LABELS, TIER_COLORS } from "@/server/lib/trustScore"
```

- [ ] **Step 2: Replace the Trust Score block in the profile header**

Find this exact block (lines 316–363):

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

Replace with:

```tsx
        {/* Trust Score */}
        {trustScore && (commissionProfile?.commissionStatus === "OPEN" || commissionProfile?.commissionStatus === "LIMITED" || (isOwn && commissionProfile)) && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setShowScoreBreakdown(prev => !prev)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "5px 12px", cursor: "pointer" }}
            >
              {/* Tier colour dot */}
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: TIER_COLORS[trustScore.tier], flexShrink: 0 }} />
              {/* Tier label */}
              <span style={{ color: TIER_COLORS[trustScore.tier], fontSize: 13, fontWeight: 700 }}>
                {TIER_LABELS[trustScore.tier]}
              </span>
              {/* Numeric score — only shown when there is a score */}
              {trustScore.finalScore !== null && (
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                  {trustScore.finalScore.toFixed(1)}
                </span>
              )}
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                {showScoreBreakdown ? "▲" : "▼"}
              </span>
            </button>

            {/* Breakdown panel */}
            {showScoreBreakdown && (
              <div style={{ marginTop: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Label + score header */}
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ color: TIER_COLORS[trustScore.tier], fontSize: 13, fontWeight: 700 }}>{TIER_LABELS[trustScore.tier]}</span>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>
                    {trustScore.finalScore !== null ? `${trustScore.finalScore.toFixed(1)} / 5.0` : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Average buyer rating</span>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>
                    {trustScore.avgRating !== null ? `${trustScore.avgRating.toFixed(1)} / 5.0` : "—"}
                    {trustScore.ratingCount > 0 && <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}> ({trustScore.ratingCount})</span>}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Completed commissions</span>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>{trustScore.completedCount}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Artist cancel rate</span>
                  <span style={{ color: trustScore.cancelRate > 20 ? "#f87171" : "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>{trustScore.cancelRate}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Selling strikes</span>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>
                    {trustScore.sellingStrikeCount === 0
                      ? "None"
                      : `−${trustScore.strikeDeduction.toFixed(1)} from ${trustScore.sellingStrikeCount} strike${trustScore.sellingStrikeCount === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 3: Commit**

```bash
git add app/[username]/page.tsx
git commit -m "feat: update profile header Trust Score to tier chip display"
```

---

## Task 4: Update Commissions tab info card

**Files:**
- Modify: `app/[username]/page.tsx` (Commissions tab info card, lines 561–575)

- [ ] **Step 1: Replace the Trust Score row in the Commissions tab info card**

Find this block inside the Commissions tab (around lines 561–575):

```tsx
                {/* Trust score */}
                {trustScore && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">Trust Score</span>
                    {trustScore.hasScore ? (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full text-white/80" style={{ background: "#ffffff10" }}>
                        <span style={{ color: "#facc15" }}>{"★".repeat(Math.round(trustScore.avgRating ?? 0))}</span>
                        {" "}{trustScore.avgRating?.toFixed(1)} / 5.0
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full text-white/40" style={{ background: "#ffffff10" }}>
                        New Artist
                      </span>
                    )}
                  </div>
                )}
```

Replace with:

```tsx
                {/* Trust score */}
                {trustScore && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">Trust Score</span>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: "#ffffff10" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: TIER_COLORS[trustScore.tier], display: "inline-block", flexShrink: 0 }} />
                      <span style={{ color: TIER_COLORS[trustScore.tier], fontWeight: 700 }}>{TIER_LABELS[trustScore.tier]}</span>
                      {trustScore.finalScore !== null && (
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>{trustScore.finalScore.toFixed(1)}</span>
                      )}
                    </span>
                  </div>
                )}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add app/[username]/page.tsx
git commit -m "feat: update commissions tab Trust Score to tier chip display"
```

---

## Task 5: Update roadmaps

**Files:**
- Modify: `docs/roadmap.md`
- Modify: `C:\Users\gavri\OneDrive\Documents\art socail\Gallery\Product\Roadmap.md`

- [ ] **Step 1: Mark the design task as complete in `docs/roadmap.md`**

Find:
```markdown
- [ ] **DESIGN: Define full Trust Score grading formula** — how avg rating, cancel rate, and strikes combine into a final grade/label (e.g. Excellent / Good / Fair / Poor), thresholds, visual display, and how strikes reduce the score once the Tier 2 strike system is live
```

Replace with:
```markdown
- [x] **DESIGN: Define full Trust Score grading formula** — Excellent/Good/Fair/Poor tiers with colour chips; strike deductions tracked (0 until Tier 2 Strike model ships)
```

- [ ] **Step 2: Sync the Obsidian roadmap**

Apply the same change in `C:\Users\gavri\OneDrive\Documents\art socail\Gallery\Product\Roadmap.md`:

Find:
```markdown
- [ ] **DESIGN: Define full Trust Score grading formula** — how avg rating, cancel rate, and strikes combine into a final grade/label (e.g. Excellent / Good / Fair / Poor), thresholds, visual display, and how strikes reduce the score once the Tier 2 strike system is live
```

Replace with:
```markdown
- [x] **DESIGN: Define full Trust Score grading formula** — Excellent/Good/Fair/Poor tiers with colour chips; strike deductions tracked (0 until Tier 2 Strike model ships)
```

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: mark Trust Score grading design as complete"
```
