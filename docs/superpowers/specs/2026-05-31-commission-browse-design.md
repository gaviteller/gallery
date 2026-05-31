# Commission Browse & Filter Design

**Date:** 2026-05-31

---

## Goal

Give buyers a dedicated page to discover artists who are open for commissions, with filters for art style and price range. Entry point is the home feed.

## Architecture

A new `/commissions` page fetches all OPEN/LIMITED artists via a single tRPC query, then filters client-side by style chip and price bucket. Style chips use a curated keyword map (`lib/art-styles.ts`) to match against artists' free-form `artStyles` tags. Filter state is reflected in URL search params for shareability. No schema changes needed — all required data (`artStyles`, `priceRanges`, `commissionCardImages`, `commissionStatus`) already exists on the `User` model.

## Tech Stack

Next.js App Router, tRPC v11, Prisma (PostgreSQL) — client-side filtering only, no new DB queries beyond a single fetch.

---

## Entry Point

A "Browse Commissions →" button/link added to `app/page.tsx`, placed just below the Featured Artists strip. Routes to `/commissions`.

---

## Page: `/commissions`

**Route:** `app/commissions/page.tsx`

### Filter Bar

Three filter rows across the top:

**Style (multi-select chips):**
- Digital · Traditional · Pixel Art · 3D · Anime/Manga · Sketch · Watercolor · Comics
- Multiple chips can be active at once
- An artist matches if any of their `artStyles` contains a keyword for any selected chip

**Price (single-select chips):**
- Under $25 · $25–$75 · $75–$150 · $150+
- Matches against the artist's lowest price across all their `priceRanges` entries
- `priceRanges` is `Json?` stored as `[{ label: string, price: number }]`

**Status (toggle, defaults to both):**
- Open only — `commissionStatus === "OPEN"`
- Open + Limited — `commissionStatus` in `["OPEN", "LIMITED"]`

All active filters are written to URL search params (`?style=digital,pixel&price=25-75&status=open`) and read on mount so links are shareable.

### Artist Grid

3-column grid (responsive). Each card reuses the existing commission card style from the profile page:
- `commissionCardImages` strip (up to 3 shown)
- Avatar + display name + `@username`
- Style tags from `artStyles`
- Starting price (lowest value in `priceRanges`, or "Price on request" if none set)
- OPEN / LIMITED status badge
- Clicking the card navigates to `/@username`

Empty state: "No artists match your filters. Try removing some filters."

Zero artists total: "No artists are currently open for commissions."

### Data Query

New `commission.browse` tRPC procedure (`server/routers/commission.ts`):

```ts
browse: publicProcedure.query(async ({ ctx }) => {
  // Exclude blocked users if session exists
  const blockedIds = // same block-exclusion logic as user.search

  return ctx.prisma.user.findMany({
    where: {
      commissionStatus: { in: ["OPEN", "LIMITED"] },
      sellingEnabled: true,
      ...(blockedIds.size > 0 ? { id: { notIn: [...blockedIds] } } : {}),
    },
    select: {
      id: true,
      username: true,
      name: true,
      image: true,
      commissionStatus: true,
      artStyles: true,
      priceRanges: true,
      commissionCardImages: true,
    },
    orderBy: { createdAt: "desc" },
  })
})
```

---

## Style Keyword Map

New file `lib/art-styles.ts`:

```ts
export const ART_STYLE_CHIPS = [
  "Digital",
  "Traditional",
  "Pixel Art",
  "3D",
  "Anime/Manga",
  "Sketch",
  "Watercolor",
  "Comics",
] as const

export type ArtStyleChip = typeof ART_STYLE_CHIPS[number]

// Keywords that map to each chip — case-insensitive substring match
export const ART_STYLE_KEYWORDS: Record<ArtStyleChip, string[]> = {
  "Digital":       ["digital"],
  "Traditional":   ["traditional", "oil", "acrylic", "gouache", "pastel"],
  "Pixel Art":     ["pixel"],
  "3D":            ["3d", "blender", "zbrush", "sculpt"],
  "Anime/Manga":   ["anime", "manga", "chibi"],
  "Sketch":        ["sketch", "lineart", "line art", "pencil"],
  "Watercolor":    ["watercolor", "watercolour"],
  "Comics":        ["comic", "comics", "cartoon", "illustration"],
}

export function matchesStyleChip(artStyles: string[], chip: ArtStyleChip): boolean {
  const keywords = ART_STYLE_KEYWORDS[chip]
  return artStyles.some(style =>
    keywords.some(kw => style.toLowerCase().includes(kw))
  )
}
```

---

## Price Bucket Logic

```ts
export const PRICE_BUCKETS = [
  { label: "Under $25",  min: 0,   max: 24.99 },
  { label: "$25–$75",    min: 25,  max: 75 },
  { label: "$75–$150",   min: 75,  max: 150 },
  { label: "$150+",      min: 150, max: Infinity },
] as const

// Returns lowest price in the artist's priceRanges, or null if none set
function getStartingPrice(priceRanges: unknown): number | null {
  if (!Array.isArray(priceRanges) || priceRanges.length === 0) return null
  const prices = priceRanges.map((r: { price: number }) => r.price).filter(Number.isFinite)
  return prices.length > 0 ? Math.min(...prices) : null
}
```

An artist matches a price bucket if their starting price falls within `[min, max]`. Artists with no price data are excluded when a price filter is active.

---

## URL Params

| Param | Values | Example |
|---|---|---|
| `style` | comma-separated chip names | `?style=Digital,Pixel+Art` |
| `price` | bucket label slug | `?price=25-75` |
| `status` | `open` or `all` | `?status=open` |

Params are read with `useSearchParams` (inside a `Suspense` boundary) and written with `router.replace` on filter change (no page reload).

---

## What This Does Not Change

- Artist profile pages — unchanged
- Commission settings (professional profile page) — unchanged
- Existing `commission.getProfile` query — unchanged
- Nav — no new nav items; entry is feed page only
- `artStyles` field — remains free-form; no normalization at write time

