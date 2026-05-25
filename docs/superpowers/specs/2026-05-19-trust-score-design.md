# Trust Score — Design Spec

*Date: 2026-05-19*
*Status: Approved*

---

## Overview

The Trust Score is a public metric shown on artist profiles that tells buyers how reliable an artist is as a seller. It is based on buyer ratings from completed commissions, adjusted downward by selling-related strikes. Non-selling strikes (content violations, social conduct) do not affect it.

---

## Formula

```
Trust Score = avg_buyer_rating
            − (count of Minor selling strikes   × 0.1)
            − (count of Moderate selling strikes × 0.3)
            − (count of Severe selling strikes   × 0.8)

Floor: 1.0   (score cannot go below 1.0)
Ceiling: 5.0 (score cannot exceed 5.0)
```

The score is computed live from DB data — no stored field needed.

---

## Visibility Rules

- **Shown** when artist has 10+ completed commissions
- **"New Artist"** badge shown when artist has fewer than 10 completed commissions
- **Suspended** shown when artist account has a Zero Tolerance ban (account is banned anyway)
- Visible on: profile header (always), Commissions tab info card

---

## Tiers

| Score Range | Label | Display Color |
|---|---|---|
| 4.5 – 5.0 | Excellent | Green |
| 3.5 – 4.4 | Good | Blue |
| 2.5 – 3.4 | Fair | Yellow |
| 1.0 – 2.4 | Poor | Red |
| < 10 completions | New Artist | Grey |
| Zero Tolerance ban | Suspended | Red |

---

## What Counts as a Selling-Related Strike

Only strikes from these specific violations reduce the Trust Score:

**Commission violations:**
- Artist cancels post-payment (any amount of established post-payment cancellations)
- Fake delivery — marking delivered without delivering (Moderate)
- False advertising — example work doesn't represent real skill (Minor → commission ban path)
- Bait and switch — delivering something materially different from brief (Moderate)
- Off-platform payment requests (Minor)
- Commission farming — accepting beyond capacity, repeatedly failing timelines (Minor)

**Shop violations:**
- False advertising on shop listings (Minor)

**Does NOT affect Trust Score:**
- Unlabelled AI art strike
- Content violations (gore, harassment, hate speech, etc.)
- Spam
- FTC disclosure violations
- Any social or community conduct strikes
- Strikes unrelated to selling

---

## Breakdown Panel

Tapping the Trust Score opens an expandable breakdown showing:

1. **Label + score** — e.g. "Excellent · 4.7 / 5.0"
2. **Average buyer rating** — raw avg from completed commissions
3. **Completed commissions** — total count
4. **Artist cancel rate** — % of accepted commissions cancelled post-payment by artist
5. **Selling strikes applied** — numeric deduction shown (e.g. "−0.3 from 1 Moderate strike")
   - If no selling strikes: "No selling strikes"

---

## Backend Changes

### `getTrustScore` procedure (already exists — needs updating)

Current return shape:
```typescript
{ completedCount, avgRating, cancelRate, ratingCount, hasScore }
```

New return shape:
```typescript
{
  completedCount: number
  avgRating: number | null        // raw avg before deductions
  finalScore: number | null       // avgRating minus strike deductions, floored at 1.0
  tier: "excellent" | "good" | "fair" | "poor" | "new_artist" | "suspended" | null
  cancelRate: number              // % post-payment artist cancels
  ratingCount: number
  hasScore: boolean               // completedCount >= 10
  strikeDeduction: number         // total points deducted from strikes
  sellingStrikeCount: number      // number of selling strikes applied
}
```

### Strike data needed

The `Strike` model does not exist yet (Tier 2). Until it does:
- `strikeDeduction` and `sellingStrikeCount` return 0
- `finalScore` equals `avgRating` (no deduction yet)
- When the Strike model ships in Tier 2, `getTrustScore` is updated to pull selling-related strikes and apply deductions

### Tier function (pure, extractable)

```typescript
function computeTier(
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
```

---

## Frontend Changes

### Profile header (existing Trust Score block)

Replace current display (raw stars + "X.X / 5.0") with:

- **Label chip** — coloured pill showing tier label (Excellent / Good / Fair / Poor / New Artist)
- **Numeric score** — "4.7" shown next to label
- **Tap to expand** — breakdown panel below

Example collapsed: `● Excellent  4.7  ▼`
Example expanded: shows breakdown rows listed above

### Commissions tab info card (already shows Trust Score)

Replace current static "New Artist" placeholder with:
- Same label chip + numeric score
- No breakdown (compact context — full breakdown is on the header)

### Colour mapping

| Tier | Colour |
|---|---|
| excellent | `#4ade80` (green) |
| good | `#60a5fa` (blue) |
| fair | `#facc15` (yellow) |
| poor | `#f87171` (red) |
| new_artist | `rgba(255,255,255,0.4)` (grey) |
| suspended | `#f87171` (red) |

---

## Edge Cases

- **No ratings yet but 10+ completions** — `avgRating` is null, `finalScore` is null, show "New Artist" (buyers haven't rated yet, can't score)
- **Score floor** — if deductions push below 1.0, display 1.0
- **Strike deduction exceeds rating** — floored at 1.0, never shows negative or zero
- **Suspended artist** — account banned, profile likely inaccessible, but if somehow visible show "Suspended" in red
- **Score displayed to own profile owner** — always visible regardless of commission status (so artists can see their own score)
- **Score displayed to visitors** — only shown when artist is OPEN or LIMITED for commissions

---

## Future (when Strike system ships in Tier 2)

Update `getTrustScore` to:
1. Query `Strike` records for this artist where `isSelling = true`
2. Sum deductions by level
3. Apply to `avgRating` to produce `finalScore`
4. Return updated `strikeDeduction` and `sellingStrikeCount`

No schema changes needed at that point — all computed live.
