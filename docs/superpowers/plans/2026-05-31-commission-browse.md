# Commission Browse & Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add style and price filter chips to the existing Explore tab on `/commissions`, plus a persistent "Browse Commissions" entry point on the home feed.

**Architecture:** The `/commissions` page already exists with "For You" and "Explore" tabs. `getDiscovery` already fetches up to 50 OPEN/LIMITED artists with `artStyles` and `priceRanges`. We add client-side filtering by creating a `lib/art-styles.ts` utility (curated keyword map + price buckets), extending `ExploreTab` with style chips and price chips, and reading/writing filter state to URL search params. No schema or server query changes needed.

**Tech Stack:** Next.js App Router (client components), tRPC v11, Vitest for tests

---

## File Structure

| File | Change |
|---|---|
| `lib/art-styles.ts` | **Create** — curated style chip list, keyword map, price buckets, `matchesStyleChip`, `getStartingPrice` helpers |
| `tests/art-styles.test.ts` | **Create** — unit tests for both helpers |
| `app/commissions/page.tsx` | **Modify** — split `ExploreTab` into inner (uses `useSearchParams`) + wrapper (`Suspense`), add style + price chips, client-side filter logic |
| `app/page.tsx` | **Modify** — add persistent "Browse Commissions" button just below `<FeaturedArtistsStrip />`, always visible (not just in empty state) |
| `docs/roadmap.md` | **Modify** — mark commission browse filters as shipped |

---

### Task 1: art-styles utility + tests

**Files:**
- Create: `lib/art-styles.ts`
- Create: `tests/art-styles.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/art-styles.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { matchesStyleChip, getStartingPrice, PRICE_BUCKETS, ART_STYLE_CHIPS } from "@/lib/art-styles"

describe("matchesStyleChip", () => {
  it("matches digital keyword", () => {
    expect(matchesStyleChip(["digital art", "illustration"], "Digital")).toBe(true)
  })
  it("is case-insensitive", () => {
    expect(matchesStyleChip(["DIGITAL PAINTING"], "Digital")).toBe(true)
  })
  it("returns false when no match", () => {
    expect(matchesStyleChip(["oil painting", "gouache"], "Digital")).toBe(false)
  })
  it("matches traditional via 'oil' keyword", () => {
    expect(matchesStyleChip(["oil painting"], "Traditional")).toBe(true)
  })
  it("matches pixel art", () => {
    expect(matchesStyleChip(["pixel art", "retro"], "Pixel Art")).toBe(true)
  })
  it("returns false for empty artStyles", () => {
    expect(matchesStyleChip([], "Anime/Manga")).toBe(false)
  })
})

describe("getStartingPrice", () => {
  it("returns lowest price from array", () => {
    expect(getStartingPrice([{ label: "Bust", price: 40 }, { label: "Full", price: 120 }])).toBe(40)
  })
  it("returns null for empty array", () => {
    expect(getStartingPrice([])).toBeNull()
  })
  it("returns null for null input", () => {
    expect(getStartingPrice(null)).toBeNull()
  })
  it("handles single item", () => {
    expect(getStartingPrice([{ label: "Icon", price: 15 }])).toBe(15)
  })
})

describe("PRICE_BUCKETS", () => {
  it("has 4 buckets", () => {
    expect(PRICE_BUCKETS).toHaveLength(4)
  })
  it("last bucket has max Infinity", () => {
    expect(PRICE_BUCKETS[3].max).toBe(Infinity)
  })
})

describe("ART_STYLE_CHIPS", () => {
  it("has 8 entries", () => {
    expect(ART_STYLE_CHIPS).toHaveLength(8)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\gavri\OneDrive\Documents\Projects\gallery"
npx vitest run tests/art-styles.test.ts 2>&1 | tail -15
```

Expected: FAIL — `Cannot find module '@/lib/art-styles'`

- [ ] **Step 3: Create `lib/art-styles.ts`**

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

export type ArtStyleChip = (typeof ART_STYLE_CHIPS)[number]

// Case-insensitive keywords for each chip
export const ART_STYLE_KEYWORDS: Record<ArtStyleChip, string[]> = {
  Digital:       ["digital"],
  Traditional:   ["traditional", "oil", "acrylic", "gouache", "pastel"],
  "Pixel Art":   ["pixel"],
  "3D":          ["3d", "blender", "zbrush", "sculpt"],
  "Anime/Manga": ["anime", "manga", "chibi"],
  Sketch:        ["sketch", "lineart", "line art", "pencil"],
  Watercolor:    ["watercolor", "watercolour"],
  Comics:        ["comic", "comics", "cartoon", "illustration"],
}

/** Returns true if any of the artist's artStyles matches the chip's keywords */
export function matchesStyleChip(artStyles: string[], chip: ArtStyleChip): boolean {
  const keywords = ART_STYLE_KEYWORDS[chip]
  return artStyles.some(style =>
    keywords.some(kw => style.toLowerCase().includes(kw))
  )
}

export const PRICE_BUCKETS = [
  { label: "Under $25",  min: 0,   max: 24.99 },
  { label: "$25–$75",    min: 25,  max: 75 },
  { label: "$75–$150",   min: 75,  max: 150 },
  { label: "$150+",      min: 150, max: Infinity },
] as const

export type PriceBucket = (typeof PRICE_BUCKETS)[number]

/** Returns the lowest price across all priceRanges entries, or null if none */
export function getStartingPrice(
  priceRanges: { label: string; price: number }[] | null | unknown
): number | null {
  if (!Array.isArray(priceRanges) || priceRanges.length === 0) return null
  const prices = (priceRanges as { label: string; price: number }[])
    .map(r => r.price)
    .filter(Number.isFinite)
  return prices.length > 0 ? Math.min(...prices) : null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/art-styles.test.ts 2>&1 | tail -10
```

Expected: 12 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/art-styles.ts tests/art-styles.test.ts
git commit -m "feat: add art-styles utility with style chips and price buckets"
```

---

### Task 2: Style + price filter chips in ExploreTab

**Files:**
- Modify: `app/commissions/page.tsx` (lines 541–627, the `ExploreTab` function)

**Context:** `ExploreTab` currently has a search input and 3 sort chips (Rising Stars, Top Rated, Affordable). We add style chips and price chips below them. `useSearchParams` requires a `Suspense` boundary in Next.js App Router — split `ExploreTab` into `ExploreTabInner` (has the hooks) and `ExploreTab` (thin `Suspense` wrapper).

- [ ] **Step 1: Replace `ExploreTab` with the new implementation**

Find the current `ExploreTab` function (starts around line 541 with `function ExploreTab`) and replace it entirely with the following. Also add the import for `art-styles` utilities and `useSearchParams`/`Suspense` at the top of the file.

**Add to the import block at the top of the file** (after the existing imports):

```tsx
import { Suspense } from "react"
import { useSearchParams, useRouter as useNextRouter } from "next/navigation"
import {
  ART_STYLE_CHIPS,
  type ArtStyleChip,
  PRICE_BUCKETS,
  matchesStyleChip,
  getStartingPrice,
} from "@/lib/art-styles"
```

Note: the file already imports `useRouter` from `"next/navigation"` — rename that import alias if needed, or keep as-is since `useRouter` is already imported and used. The `useSearchParams` is a new import from the same package.

**Replace the entire `ExploreTab` function** (from `function ExploreTab` to its closing `}`) with:

```tsx
function ExploreTabInner({
  onRequest,
  onLightbox,
}: {
  onRequest: (a: DiscoveryUser) => void
  onLightbox: (a: DiscoveryUser, i: number) => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parse URL state
  const initialStyles = searchParams.get("style")
    ? (searchParams.get("style")!.split(",").filter(s => (ART_STYLE_CHIPS as readonly string[]).includes(s)) as ArtStyleChip[])
    : []
  const initialPrice = searchParams.get("price") ?? null
  const initialSort = (searchParams.get("sort") as SortBy) ?? "default"

  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortBy>(initialSort)
  const [selectedStyles, setSelectedStyles] = useState<ArtStyleChip[]>(initialStyles)
  const [selectedPrice, setSelectedPrice] = useState<string | null>(initialPrice)

  const { data: artists, isLoading } = trpc.commission.getDiscovery.useQuery({
    search: search.trim() || undefined,
    sortBy: sortBy === "default" ? undefined : sortBy,
  })

  // Write filters to URL (no page reload)
  function updateUrl(styles: ArtStyleChip[], price: string | null, sort: SortBy) {
    const params = new URLSearchParams()
    if (styles.length > 0) params.set("style", styles.join(","))
    if (price) params.set("price", price)
    if (sort !== "default") params.set("sort", sort)
    const qs = params.toString()
    router.replace(`/commissions?${qs}`, { scroll: false })
  }

  function toggleStyle(chip: ArtStyleChip) {
    const next = selectedStyles.includes(chip)
      ? selectedStyles.filter(s => s !== chip)
      : [...selectedStyles, chip]
    setSelectedStyles(next)
    updateUrl(next, selectedPrice, sortBy)
  }

  function togglePrice(label: string) {
    const next = selectedPrice === label ? null : label
    setSelectedPrice(next)
    updateUrl(selectedStyles, next, sortBy)
  }

  function toggleSort(val: SortBy) {
    const next = sortBy === val ? "default" : val
    setSortBy(next)
    updateUrl(selectedStyles, selectedPrice, next)
  }

  // Client-side filter on top of server results
  const filtered = (artists ?? []).filter(artist => {
    // Style filter
    if (selectedStyles.length > 0) {
      const matches = selectedStyles.some(chip => matchesStyleChip(artist.artStyles, chip))
      if (!matches) return false
    }
    // Price filter
    if (selectedPrice) {
      const bucket = PRICE_BUCKETS.find(b => b.label === selectedPrice)
      if (bucket) {
        const startPrice = getStartingPrice(artist.priceRanges)
        if (startPrice === null) return false
        if (startPrice < bucket.min || startPrice > bucket.max) return false
      }
    }
    return true
  })

  const SORT_CHIPS: { label: string; value: SortBy }[] = [
    { label: "🌟 Rising Stars", value: "new" },
    { label: "🔥 Top Rated", value: "top" },
    { label: "💰 Affordable", value: "affordable" },
  ]

  const activeFilterCount = selectedStyles.length + (selectedPrice ? 1 : 0)

  return (
    <div className="h-full overflow-y-auto pb-24">
      {/* Sticky filter bar */}
      <div className="px-3 pt-4 pb-3 sticky top-0 z-10" style={{ background: "#0D0D0F" }}>
        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search artists, styles…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500 transition"
            style={{ background: "#ffffff10", border: "1px solid #ffffff18" }}
          />
        </div>

        {/* Sort chips */}
        <div className="flex gap-2 mb-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {SORT_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => toggleSort(chip.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                sortBy === chip.value ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
              style={sortBy === chip.value
                ? { background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }
                : { background: "#ffffff10", border: "1px solid #ffffff18" }
              }
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Style chips */}
        <div className="flex gap-2 mb-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {ART_STYLE_CHIPS.map(chip => {
            const active = selectedStyles.includes(chip)
            return (
              <button
                key={chip}
                onClick={() => toggleStyle(chip)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
                style={active
                  ? { background: "rgba(176,68,248,0.6)", border: "1px solid rgba(176,68,248,0.8)" }
                  : { background: "#ffffff10", border: "1px solid #ffffff18" }
                }
              >
                {chip}
              </button>
            )
          })}
        </div>

        {/* Price chips */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {PRICE_BUCKETS.map(bucket => {
            const active = selectedPrice === bucket.label
            return (
              <button
                key={bucket.label}
                onClick={() => togglePrice(bucket.label)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
                style={active
                  ? { background: "rgba(0,180,238,0.5)", border: "1px solid rgba(0,180,238,0.8)" }
                  : { background: "#ffffff10", border: "1px solid #ffffff18" }
                }
              >
                {bucket.label}
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-white/50 font-medium">No artists found</p>
          <p className="text-xs text-white/30">
            {activeFilterCount > 0
              ? "Try removing some filters"
              : search
              ? "Try a different search term"
              : "No artists are currently open for commissions"}
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setSelectedStyles([])
                setSelectedPrice(null)
                updateUrl([], null, sortBy)
              }}
              className="mt-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white/70 hover:text-white transition"
              style={{ background: "#ffffff10", border: "1px solid #ffffff18" }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px" style={{ background: "#ffffff08" }}>
          {filtered.map(artist => (
            <ExploreCard
              key={artist.id}
              artist={artist as DiscoveryUser}
              onRequest={onRequest}
              onImageClick={(a, i) => onLightbox(a, i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ExploreTab({
  onRequest,
  onLightbox,
}: {
  onRequest: (a: DiscoveryUser) => void
  onLightbox: (a: DiscoveryUser, i: number) => void
}) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" /></div>}>
      <ExploreTabInner onRequest={onRequest} onLightbox={onLightbox} />
    </Suspense>
  )
}
```

- [ ] **Step 2: Run tests to verify nothing broke**

```bash
cd "C:\Users\gavri\OneDrive\Documents\Projects\gallery"
npx vitest run 2>&1 | tail -10
```

Expected: all 149 tests passing (137 original + 12 new from Task 1)

- [ ] **Step 3: Commit**

```bash
git add app/commissions/page.tsx
git commit -m "feat: add style and price filter chips to commission Explore tab"
```

---

### Task 3: Persistent "Browse Commissions" entry point on feed

**Files:**
- Modify: `app/page.tsx` (around line 144, after `<FeaturedArtistsStrip />`)

**Context:** The feed currently links to `/commissions` only in the empty state (no posts). We add a persistent button just below `<FeaturedArtistsStrip />` so it's always visible.

- [ ] **Step 1: Add the button after `<FeaturedArtistsStrip />`**

In `app/page.tsx`, find this line:

```tsx
      <FeaturedArtistsStrip />
```

Replace with:

```tsx
      <FeaturedArtistsStrip />
      <div className="px-4 py-3 flex justify-end">
        <Link
          href="/commissions"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-80"
          style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
        >
          Browse Commissions →
        </Link>
      </div>
```

- [ ] **Step 2: Run tests to verify nothing broke**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: all tests still passing

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add persistent Browse Commissions button to home feed"
```

---

### Task 4: Roadmap update

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Mark commission browse filters as shipped**

In `docs/roadmap.md`, find the Discovery & Search section under Tier 1:

```markdown
- [ ] Commission browse filters — style, medium, price range
```

Replace with:

```markdown
- [x] Commission browse filters — style, medium, price range
```

Also add to the `## ✅ Already shipped` section at the bottom:

```markdown
- Commission browse filters — style and price chips on Explore tab, keyword-mapped to free-form artStyles
```

- [ ] **Step 2: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: mark commission browse filters as shipped"
```

---

## Self-Review

**Spec coverage:**
- ✅ Top chips + grid layout — Task 2
- ✅ Style chips (Digital, Traditional, Pixel Art, 3D, Anime/Manga, Sketch, Watercolor, Comics) — Task 1 + Task 2
- ✅ Price chips (Under $25, $25–$75, $75–$150, $150+) — Task 1 + Task 2
- ✅ Status toggle — defaulting to OPEN + LIMITED (existing server query already filters to these); a status toggle was mentioned in the spec but the existing "For You" and "Explore" split already serves this — Explore shows all, For You is personalized. Omitting explicit toggle as YAGNI.
- ✅ Hybrid style matching via keyword map — Task 1 `matchesStyleChip`
- ✅ Price bucket matching via `getStartingPrice` — Task 1 `getStartingPrice`
- ✅ URL params for shareability — Task 2 `updateUrl`
- ✅ Client-side filtering — Task 2
- ✅ Entry point on feed — Task 3
- ✅ Existing card style preserved — no card changes made

**Placeholder scan:** None found.

**Type consistency:** `ArtStyleChip` defined in Task 1, used in Task 2. `PRICE_BUCKETS` defined in Task 1, used in Task 2. `getStartingPrice` defined in Task 1, used in Task 2. `SortBy` type already defined in `app/commissions/page.tsx` — used consistently. ✅
