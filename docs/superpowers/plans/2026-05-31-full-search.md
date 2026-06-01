# Full Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the BottomNav search modal with a full `/search` page that returns grouped results across Artists, Posts, and Shop, reachable from both the BottomNav and a new Navbar search button.

**Architecture:** A new `searchRouter` adds three tRPC procedures (artists, posts, shop). A new `app/search/page.tsx` calls them in parallel and renders a grouped results overview; when `?tab=` is set it shows a single category's full paginated list. `BottomNav` and `Navbar` are updated to navigate to `/search` instead of opening a modal.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma (PostgreSQL), Vitest, Tailwind CSS

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `server/routers/search.ts` | Three tRPC procedures: artists, posts, shop |
| Modify | `server/routers/_app.ts` | Register searchRouter |
| Create | `tests/server/search.test.ts` | Unit tests for all three procedures |
| Create | `app/search/page.tsx` | Full search page (overview + tab views) |
| Modify | `components/BottomNav.tsx` | Remove SearchModal; Search tab → `/search` |
| Modify | `components/Navbar.tsx` | Add search icon button → `/search` |

---

## Task 1: `search` tRPC router + registration + tests

**Files:**
- Create: `server/routers/search.ts`
- Modify: `server/routers/_app.ts`
- Create: `tests/server/search.test.ts`

### Background

Tests use `createCallerFactory(appRouter)` — the pattern from `tests/server/user.test.ts`. The router must be registered in `_app.ts` before tests can call `caller.search.*`. Prisma is mocked with `vi.fn()`.

The three procedures:

- **`search.artists`** — finds users by `username` or `name` (case-insensitive), respects block relationships, returns `commissionStatus`. Default limit 20.
- **`search.posts`** — finds published posts where `description` contains the query OR the post has a hashtag matching the query. Returns `id, image, description, user { username }`. Default limit 20.
- **`search.shop`** — finds shop items where `title` or `description` contains the query. Returns `id, image, title, price, user { username }`. Default limit 20.

All three return `{ items: [...], total: number }`.

---

- [ ] **Step 1: Write the failing tests**

Create `tests/server/search.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { createCallerFactory } from "@/lib/trpc"
import { appRouter } from "@/server/routers/_app"

const createCaller = createCallerFactory(appRouter)

// ── shared mock objects ──────────────────────────────────────────────────────

const mockUser = {
  id: "user-1",
  username: "luna",
  name: "Luna Artworks",
  image: null,
  commissionStatus: "OPEN" as const,
}

const mockPost = {
  id: "post-1",
  image: "data:image/jpeg;base64,abc",
  description: "A watercolor landscape",
  user: { username: "luna" },
}

const mockShopItem = {
  id: "shop-1",
  image: "data:image/jpeg;base64,def",
  title: "Watercolor Brush Set",
  description: "Digital brushes",
  price: 24,
  user: { username: "luna" },
}

const mockPrisma = {
  block: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  post: { findMany: vi.fn(), count: vi.fn() },
  shopItem: { findMany: vi.fn(), count: vi.fn() },
}

function getCaller() {
  return createCaller({ session: null, prisma: mockPrisma as any })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.block.findMany.mockResolvedValue([])
})

// ── search.artists ───────────────────────────────────────────────────────────

describe("search.artists", () => {
  it("returns matching users with commissionStatus", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([mockUser])  // items
    mockPrisma.user.findMany.mockResolvedValueOnce([mockUser])  // count via length
    const caller = getCaller()
    const result = await caller.search.artists({ query: "luna" })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].commissionStatus).toBe("OPEN")
    expect(result.items[0].username).toBe("luna")
  })

  it("returns empty items when no match", async () => {
    mockPrisma.user.findMany.mockResolvedValue([])
    const caller = getCaller()
    const result = await caller.search.artists({ query: "zzznomatch" })
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it("passes query to prisma with insensitive mode", async () => {
    mockPrisma.user.findMany.mockResolvedValue([mockUser])
    const caller = getCaller()
    await caller.search.artists({ query: "LUNA" })
    const call = mockPrisma.user.findMany.mock.calls[0][0]
    expect(call.where.OR[0].username.mode).toBe("insensitive")
  })
})

// ── search.posts ─────────────────────────────────────────────────────────────

describe("search.posts", () => {
  it("returns published posts matching description", async () => {
    mockPrisma.post.findMany.mockResolvedValue([mockPost])
    mockPrisma.post.count.mockResolvedValue(1)
    const caller = getCaller()
    const result = await caller.search.posts({ query: "watercolor" })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].description).toBe("A watercolor landscape")
    expect(result.total).toBe(1)
  })

  it("only searches PUBLISHED posts", async () => {
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.post.count.mockResolvedValue(0)
    const caller = getCaller()
    await caller.search.posts({ query: "watercolor" })
    const call = mockPrisma.post.findMany.mock.calls[0][0]
    expect(call.where.status).toBe("PUBLISHED")
  })

  it("returns empty when no match", async () => {
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.post.count.mockResolvedValue(0)
    const caller = getCaller()
    const result = await caller.search.posts({ query: "zzznomatch" })
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ── search.shop ──────────────────────────────────────────────────────────────

describe("search.shop", () => {
  it("returns shop items matching title", async () => {
    mockPrisma.shopItem.findMany.mockResolvedValue([mockShopItem])
    mockPrisma.shopItem.count.mockResolvedValue(1)
    const caller = getCaller()
    const result = await caller.search.shop({ query: "brush" })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].title).toBe("Watercolor Brush Set")
    expect(result.items[0].price).toBe(24)
  })

  it("returns empty when no match", async () => {
    mockPrisma.shopItem.findMany.mockResolvedValue([])
    mockPrisma.shopItem.count.mockResolvedValue(0)
    const caller = getCaller()
    const result = await caller.search.shop({ query: "zzznomatch" })
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it("searches both title and description", async () => {
    mockPrisma.shopItem.findMany.mockResolvedValue([mockShopItem])
    mockPrisma.shopItem.count.mockResolvedValue(1)
    const caller = getCaller()
    await caller.search.shop({ query: "digital" })
    const call = mockPrisma.shopItem.findMany.mock.calls[0][0]
    expect(call.where.OR).toHaveLength(2)
    expect(call.where.OR[0].title).toBeDefined()
    expect(call.where.OR[1].description).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/server/search.test.ts
```

Expected: FAIL — `caller.search is undefined` (router not created yet).

- [ ] **Step 3: Create `server/routers/search.ts`**

```typescript
import { z } from "zod"
import { router, publicProcedure } from "@/lib/trpc"

export const searchRouter = router({
  artists: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const blockedIds = new Set<string>()

      if (ctx.session?.user?.id) {
        const blockRelations = await ctx.prisma.block.findMany({
          where: {
            OR: [
              { blockerId: ctx.session.user.id },
              { blockedId: ctx.session.user.id },
            ],
          },
          select: { blockerId: true, blockedId: true },
        })
        for (const b of blockRelations) {
          blockedIds.add(b.blockerId === ctx.session.user.id ? b.blockedId : b.blockerId)
        }
      }

      const where = {
        OR: [
          { username: { contains: input.query, mode: "insensitive" as const } },
          { name: { contains: input.query, mode: "insensitive" as const } },
        ],
        username: { not: null },
        ...(blockedIds.size > 0 ? { id: { notIn: [...blockedIds] } } : {}),
      }

      const items = await ctx.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          name: true,
          image: true,
          commissionStatus: true,
        },
        take: input.limit,
        orderBy: { username: "asc" },
      })

      // Run count with same where to get total (re-use findMany result length when limit not exceeded)
      const total = items.length < input.limit
        ? items.length
        : await ctx.prisma.user.count({ where })

      return { items, total }
    }),

  posts: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const where = {
        status: "PUBLISHED" as const,
        OR: [
          { description: { contains: input.query, mode: "insensitive" as const } },
          { hashtags: { some: { tag: { contains: input.query, mode: "insensitive" as const } } } },
        ],
      }

      const [items, total] = await Promise.all([
        ctx.prisma.post.findMany({
          where,
          select: {
            id: true,
            image: true,
            description: true,
            user: { select: { username: true } },
          },
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        ctx.prisma.post.count({ where }),
      ])

      return { items, total }
    }),

  shop: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const where = {
        OR: [
          { title: { contains: input.query, mode: "insensitive" as const } },
          { description: { contains: input.query, mode: "insensitive" as const } },
        ],
      }

      const [items, total] = await Promise.all([
        ctx.prisma.shopItem.findMany({
          where,
          select: {
            id: true,
            image: true,
            title: true,
            price: true,
            user: { select: { username: true } },
          },
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        ctx.prisma.shopItem.count({ where }),
      ])

      return { items, total }
    }),
})
```

- [ ] **Step 4: Register in `server/routers/_app.ts`**

Add the import and router entry:

```typescript
import { router } from "@/lib/trpc"
import { userRouter } from "./user"
import { postRouter } from "./post"
import { followRouter } from "./follow"
import { notificationRouter } from "./notification"
import { interactionRouter } from "./interaction"
import { hashtagRouter } from "./hashtag"
import { shopRouter } from "./shop"
import { commissionRouter } from "./commission"
import { commissionMessageRouter } from "./commissionMessage"
import { dmRouter } from "./dm"
import { pushRouter } from "./push"
import { storyRouter } from "./story"
import { dmcaRouter } from "./dmca"
import { authRouter } from "./auth"
import { blockRouter } from "./block"
import { searchRouter } from "./search"

export const appRouter = router({
  user: userRouter,
  post: postRouter,
  follow: followRouter,
  notification: notificationRouter,
  interaction: interactionRouter,
  hashtag: hashtagRouter,
  shop: shopRouter,
  commission: commissionRouter,
  commissionMessage: commissionMessageRouter,
  dm: dmRouter,
  push: pushRouter,
  story: storyRouter,
  dmca: dmcaRouter,
  auth: authRouter,
  block: blockRouter,
  search: searchRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run tests/server/search.test.ts
```

Expected: PASS — all 8 tests green.

- [ ] **Step 6: Run full suite to confirm no regressions**

```bash
npx vitest run
```

Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add server/routers/search.ts server/routers/_app.ts tests/server/search.test.ts
git commit -m "feat: search tRPC router — artists, posts, shop"
```

---

## Task 2: `/search` page — overview mode

**Files:**
- Create: `app/search/page.tsx`

### Background

- `"use client"` page — reads `?q` and `?tab` via `useSearchParams`.
- Must be wrapped in `<Suspense>` because `useSearchParams()` suspends on the server.
- Calls `trpc.search.artists`, `trpc.search.posts`, `trpc.search.shop` in parallel using the **overview limits** (5 / 6 / 4 items) only when `q.trim().length >= 1`.
- Writes query changes to the URL with `router.replace('/search?q=...', { scroll: false })`, debounced 300ms.
- The `?tab=` param switches to a single-section full-list view (handled in Task 3).
- This task covers only the **overview mode** (no `?tab`).

The design language:
- Page background: `#0d0d0f` (the app's dark background)
- Sticky search bar: matches the mockup — `rounded-2xl`, magnifier icon, ✕ clear button, `background: rgba(255,255,255,0.08)`, `border: 1px solid rgba(255,255,255,0.12)`
- Section label colours: Artists = `rgba(176,68,248,0.9)`, Posts = `rgba(0,180,238,0.9)`, Shop = `rgba(255,200,0,0.9)`
- "See all N →" link: `text-[10px] text-white/35`
- Section gap: `gap-5` flex column

Artist row: 36px avatar (gradient fallback) + name + `@username` + commission status badge.
- Badge styles: OPEN = `bg-green-500/25 text-green-400 border border-green-500/30`, LIMITED = `bg-amber-500/20 text-amber-400 border border-amber-500/30`

Post grid: 3-column, `aspect-square rounded-md overflow-hidden`, image fills cell, description pill overlay.

Shop row: 40px thumbnail + title + `@username` + price (amber, font-bold).

---

- [ ] **Step 1: Create `app/search/page.tsx` — overview mode only**

```tsx
"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"

// ── Commission status badge ──────────────────────────────────────────────────

function CommissionBadge({ status }: { status: "OPEN" | "LIMITED" | "CLOSED" }) {
  if (status === "OPEN") {
    return (
      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md"
        style={{ background: "rgba(0,200,120,0.25)", color: "rgba(0,230,130,0.9)", border: "1px solid rgba(0,200,120,0.3)" }}>
        OPEN
      </span>
    )
  }
  if (status === "LIMITED") {
    return (
      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md"
        style={{ background: "rgba(255,160,0,0.2)", color: "rgba(255,185,0,0.9)", border: "1px solid rgba(255,160,0,0.3)" }}>
        LIMITED
      </span>
    )
  }
  return null
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, color, total, onSeeAll }: {
  label: string
  color: string
  total: number
  onSeeAll: () => void
}) {
  return (
    <div className="flex justify-between items-center mb-2.5">
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
      {total > 0 && (
        <button onClick={onSeeAll} className="text-[10px] text-white/35 hover:text-white/60 transition-colors">
          See all {total} →
        </button>
      )}
    </div>
  )
}

// ── Artists section ───────────────────────────────────────────────────────────

type ArtistItem = { id: string; username: string | null; name: string | null; image: string | null; commissionStatus: "OPEN" | "LIMITED" | "CLOSED" }

function ArtistsSection({ items, total, onSeeAll }: { items: ArtistItem[]; total: number; onSeeAll: () => void }) {
  const router = useRouter()
  if (items.length === 0) return null
  return (
    <div>
      <SectionHeader label="Artists" color="rgba(176,68,248,0.9)" total={total} onSeeAll={onSeeAll} />
      <div className="flex flex-col">
        {items.map((user) => (
          <button
            key={user.id}
            onClick={() => router.push(`/@${user.username}`)}
            className="flex items-center gap-2.5 py-2 border-b last:border-b-0 text-left hover:bg-white/[0.03] rounded-lg px-1 transition-colors"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            <Avatar src={user.image} name={user.name} username={user.username} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white truncate">{user.name ?? `@${user.username}`}</span>
                <CommissionBadge status={user.commissionStatus} />
              </div>
              <span className="text-[10px] text-white/40">@{user.username}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Posts section ─────────────────────────────────────────────────────────────

type PostItem = { id: string; image: string; description: string | null; user: { username: string | null } }

function PostsSection({ items, total, onSeeAll }: { items: PostItem[]; total: number; onSeeAll: () => void }) {
  const router = useRouter()
  if (items.length === 0) return null
  return (
    <div>
      <SectionHeader label="Posts" color="rgba(0,180,238,0.9)" total={total} onSeeAll={onSeeAll} />
      <div className="grid grid-cols-3 gap-1">
        {items.map((post) => (
          <button
            key={post.id}
            onClick={() => router.push(`/@${post.user.username}`)}
            className="aspect-square rounded-md overflow-hidden relative"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <img src={post.image} alt={post.description ?? ""} className="w-full h-full object-cover" />
            {post.description && (
              <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1"
                style={{ background: "rgba(0,0,0,0.6)" }}>
                <p className="text-[7px] text-white truncate">{post.description}</p>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Shop section ──────────────────────────────────────────────────────────────

type ShopItem = { id: string; image: string; title: string; price: number; user: { username: string | null } }

function ShopSection({ items, total, onSeeAll }: { items: ShopItem[]; total: number; onSeeAll: () => void }) {
  const router = useRouter()
  if (items.length === 0) return null
  return (
    <div>
      <SectionHeader label="Shop" color="rgba(255,200,0,0.9)" total={total} onSeeAll={onSeeAll} />
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => router.push(`/@${item.user.username}`)}
            className="flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-white/[0.06] transition-colors"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <img src={item.image} alt={item.title} className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-white truncate">{item.title}</p>
              <p className="text-[10px] text-white/40">@{item.user.username}</p>
            </div>
            <span className="text-[11px] font-bold flex-shrink-0" style={{ color: "rgba(255,200,0,0.9)" }}>
              ${item.price}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main search inner component ───────────────────────────────────────────────

function SearchInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const initialQ = searchParams.get("q") ?? ""
  const [inputValue, setInputValue] = useState(initialQ)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const query = searchParams.get("q") ?? ""
  const enabled = query.trim().length >= 1

  // Debounce URL writes
  function handleInput(value: string) {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const qs = value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ""
      router.replace(`${pathname}${qs}`, { scroll: false })
    }, 300)
  }

  function handleClear() {
    setInputValue("")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    router.replace(pathname, { scroll: false })
  }

  function goTab(tab: string) {
    router.push(`/search?q=${encodeURIComponent(query)}&tab=${tab}`)
  }

  const { data: artistsData } = trpc.search.artists.useQuery(
    { query, limit: 5 },
    { enabled }
  )
  const { data: postsData } = trpc.search.posts.useQuery(
    { query, limit: 6 },
    { enabled }
  )
  const { data: shopData } = trpc.search.shop.useQuery(
    { query, limit: 4 },
    { enabled }
  )

  const hasArtists = (artistsData?.items.length ?? 0) > 0
  const hasPosts = (postsData?.items.length ?? 0) > 0
  const hasShop = (shopData?.items.length ?? 0) > 0
  const hasAnyResults = hasArtists || hasPosts || hasShop
  const searchedAndEmpty = enabled && artistsData && postsData && shopData && !hasAnyResults

  return (
    <div className="min-h-screen" style={{ background: "#0d0d0f" }}>
      {/* Sticky search bar */}
      <div className="sticky top-0 z-10 px-4 py-3" style={{ background: "#0d0d0f", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            autoFocus
            type="text"
            value={inputValue}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search artists, posts, shop…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
          {inputValue && (
            <button onClick={handleClear} className="text-white/40 hover:text-white/70 transition-colors text-xs">✕</button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-4 flex flex-col gap-5 pb-24">
        {searchedAndEmpty && (
          <p className="text-sm text-white/40 text-center mt-12">No results for &ldquo;{query}&rdquo;</p>
        )}

        {hasArtists && (
          <ArtistsSection
            items={artistsData!.items}
            total={artistsData!.total}
            onSeeAll={() => goTab("artists")}
          />
        )}

        {hasPosts && (
          <PostsSection
            items={postsData!.items}
            total={postsData!.total}
            onSeeAll={() => goTab("posts")}
          />
        )}

        {hasShop && (
          <ShopSection
            items={shopData!.items}
            total={shopData!.total}
            onSeeAll={() => goTab("shop")}
          />
        )}
      </div>
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d0f" }}>
        <p className="text-white/40 text-sm">Loading…</p>
      </div>
    }>
      <SearchInner />
    </Suspense>
  )
}
```

- [ ] **Step 2: Start the dev server (if not already running) and verify the page loads**

```bash
# In a new terminal
npm run dev
```

Navigate to `http://localhost:3000/search` — you should see a dark page with a search bar and no results. Type "luna" — if the DB has a user with that username, you should see an Artists section.

- [ ] **Step 3: Commit**

```bash
git add app/search/page.tsx
git commit -m "feat: /search page — overview grouped results"
```

---

## Task 3: `/search` page — tab views

**Files:**
- Modify: `app/search/page.tsx`

### Background

When `?tab=artists|posts|shop` is present, show only that category's full paginated list instead of the grouped overview. A back arrow navigates back to the overview (`/search?q=...`).

Pagination: load 20 items, with a "Load more" button that increases the limit. Use a `limit` state variable starting at 20, incrementing by 20 on each "Load more" click. The query re-runs with the new limit.

No separate route file — this is state within `SearchInner`. The `?tab=` param is read from `searchParams`.

---

- [ ] **Step 1: Add tab-view logic to `app/search/page.tsx`**

Replace the `SearchInner` function with this updated version (the section components, `CommissionBadge`, and `SectionHeader` helper components above it stay the same):

```tsx
function SearchInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const initialQ = searchParams.get("q") ?? ""
  const tab = searchParams.get("tab") as "artists" | "posts" | "shop" | null
  const [inputValue, setInputValue] = useState(initialQ)
  const [limit, setLimit] = useState(20)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const query = searchParams.get("q") ?? ""
  const enabled = query.trim().length >= 1

  // Reset limit when query or tab changes
  useEffect(() => {
    setLimit(20)
  }, [query, tab])

  // Debounce URL writes
  function handleInput(value: string) {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams()
      if (value.trim()) params.set("q", value.trim())
      if (tab) params.set("tab", tab)
      const qs = params.toString()
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
    }, 300)
  }

  function handleClear() {
    setInputValue("")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    router.replace(pathname, { scroll: false })
  }

  function goTab(t: string) {
    router.push(`/search?q=${encodeURIComponent(query)}&tab=${t}`)
  }

  function goBack() {
    router.push(`/search?q=${encodeURIComponent(query)}`)
  }

  // Overview queries (small limits)
  const overviewEnabled = enabled && !tab
  const { data: artistsData } = trpc.search.artists.useQuery({ query, limit: 5 }, { enabled: overviewEnabled })
  const { data: postsData } = trpc.search.posts.useQuery({ query, limit: 6 }, { enabled: overviewEnabled })
  const { data: shopData } = trpc.search.shop.useQuery({ query, limit: 4 }, { enabled: overviewEnabled })

  // Tab queries (full paginated)
  const { data: tabArtists } = trpc.search.artists.useQuery({ query, limit }, { enabled: enabled && tab === "artists" })
  const { data: tabPosts } = trpc.search.posts.useQuery({ query, limit }, { enabled: enabled && tab === "posts" })
  const { data: tabShop } = trpc.search.shop.useQuery({ query, limit }, { enabled: enabled && tab === "shop" })

  const hasArtists = (artistsData?.items.length ?? 0) > 0
  const hasPosts = (postsData?.items.length ?? 0) > 0
  const hasShop = (shopData?.items.length ?? 0) > 0
  const hasAnyResults = hasArtists || hasPosts || hasShop
  const searchedAndEmpty = overviewEnabled && artistsData && postsData && shopData && !hasAnyResults

  const tabColors = { artists: "rgba(176,68,248,0.9)", posts: "rgba(0,180,238,0.9)", shop: "rgba(255,200,0,0.9)" }
  const tabLabels = { artists: "Artists", posts: "Posts", shop: "Shop" }

  return (
    <div className="min-h-screen" style={{ background: "#0d0d0f" }}>
      {/* Sticky search bar */}
      <div className="sticky top-0 z-10 px-4 py-3" style={{ background: "#0d0d0f", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {tab && (
          <button onClick={goBack} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mb-2">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to results
          </button>
        )}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            autoFocus
            type="text"
            value={inputValue}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search artists, posts, shop…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
          {inputValue && (
            <button onClick={handleClear} className="text-white/40 hover:text-white/70 transition-colors text-xs">✕</button>
          )}
        </div>
        {tab && (
          <p className="text-[11px] font-bold uppercase tracking-widest mt-2 px-1"
            style={{ color: tabColors[tab] }}>
            {tabLabels[tab]}
          </p>
        )}
      </div>

      {/* Results */}
      <div className="px-4 py-4 flex flex-col gap-5 pb-24">

        {/* Overview mode */}
        {!tab && (
          <>
            {searchedAndEmpty && (
              <p className="text-sm text-white/40 text-center mt-12">No results for &ldquo;{query}&rdquo;</p>
            )}
            {hasArtists && (
              <ArtistsSection items={artistsData!.items} total={artistsData!.total} onSeeAll={() => goTab("artists")} />
            )}
            {hasPosts && (
              <PostsSection items={postsData!.items} total={postsData!.total} onSeeAll={() => goTab("posts")} />
            )}
            {hasShop && (
              <ShopSection items={shopData!.items} total={shopData!.total} onSeeAll={() => goTab("shop")} />
            )}
          </>
        )}

        {/* Tab: Artists */}
        {tab === "artists" && tabArtists && (
          <>
            {tabArtists.items.length === 0 ? (
              <p className="text-sm text-white/40 text-center mt-12">No artists found for &ldquo;{query}&rdquo;</p>
            ) : (
              <ArtistsSection items={tabArtists.items} total={tabArtists.total} onSeeAll={() => {}} />
            )}
            {tabArtists.items.length < tabArtists.total && (
              <button
                onClick={() => setLimit(l => l + 20)}
                className="w-full py-2.5 text-xs font-semibold text-white/50 hover:text-white transition-colors rounded-xl"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Load more
              </button>
            )}
          </>
        )}

        {/* Tab: Posts */}
        {tab === "posts" && tabPosts && (
          <>
            {tabPosts.items.length === 0 ? (
              <p className="text-sm text-white/40 text-center mt-12">No posts found for &ldquo;{query}&rdquo;</p>
            ) : (
              <PostsSection items={tabPosts.items} total={tabPosts.total} onSeeAll={() => {}} />
            )}
            {tabPosts.items.length < tabPosts.total && (
              <button
                onClick={() => setLimit(l => l + 20)}
                className="w-full py-2.5 text-xs font-semibold text-white/50 hover:text-white transition-colors rounded-xl"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Load more
              </button>
            )}
          </>
        )}

        {/* Tab: Shop */}
        {tab === "shop" && tabShop && (
          <>
            {tabShop.items.length === 0 ? (
              <p className="text-sm text-white/40 text-center mt-12">No shop items found for &ldquo;{query}&rdquo;</p>
            ) : (
              <ShopSection items={tabShop.items} total={tabShop.total} onSeeAll={() => {}} />
            )}
            {tabShop.items.length < tabShop.total && (
              <button
                onClick={() => setLimit(l => l + 20)}
                className="w-full py-2.5 text-xs font-semibold text-white/50 hover:text-white transition-colors rounded-xl"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify tab navigation in the browser**

Navigate to `http://localhost:3000/search?q=watercolor`. If any Artists results show, click "See all N →" — the URL should update to `/search?q=watercolor&tab=artists` and the full artist list should show with a "Back to results" link. Clicking back should return to the overview.

- [ ] **Step 3: Commit**

```bash
git add app/search/page.tsx
git commit -m "feat: /search tab views — full category results with load more"
```

---

## Task 4: Update `BottomNav` — remove modal, wire Search tab

**Files:**
- Modify: `components/BottomNav.tsx`

### Background

The current `BottomNav.tsx` has a `SearchModal` component (lines 11–77) and opens it via `setSearchOpen(true)` when the Search tab is clicked. We need to:

1. Delete the entire `SearchModal` function and its state.
2. Remove the `trpc` import line that's only used by `SearchModal` (`trpc.user.search`, `trpc.hashtag.search`).
3. Change the Search tab's `onClick` to `router.push('/search')`.
4. Mark the Search tab as active when `pathname === '/search'` or `pathname.startsWith('/search')`.
5. Remove the `{searchOpen && <SearchModal ...>}` render at the bottom.
6. Remove the `searchOpen` state variable.

Read the full current file first to get exact line ranges, then make targeted edits. The file is large — do not rewrite it wholesale, edit only what's listed above.

---

- [ ] **Step 1: Remove `SearchModal` function and `searchOpen` state from `BottomNav.tsx`**

The `SearchModal` function spans approximately lines 11–77. Remove it entirely:

```diff
- function SearchModal({ onClose }: { onClose: () => void }) {
-   ... (entire function body, ~66 lines)
- }
```

Remove the `useState` import of `searchOpen` (line ~196):

```diff
- const [searchOpen, setSearchOpen] = useState(false)
```

Remove the render at the bottom of the component (line ~289):

```diff
- {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
```

- [ ] **Step 2: Update Search tab `onClick` and active state**

Find the Search tab entry in the `tabs` array (approximately):

```tsx
{
  icon: <svg ...search icon.../>,
  label: "Search",
  href: undefined,
  onClick: () => setSearchOpen(true),
},
```

Change it to navigate and mark active when on `/search`:

```tsx
{
  icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
  label: "Search",
  href: "/search",
  onClick: undefined,
},
```

(The tab renderer already uses `href` to navigate via `router.push` and to determine active state via `pathname === item.href` or similar — check the existing `isActive` logic and make sure `/search` is treated as the active tab when `pathname.startsWith('/search')`.)

- [ ] **Step 3: Remove unused imports**

Remove the `trpc` import if it was only used by `SearchModal`. Check the file — if `trpc` is used elsewhere in `BottomNav`, keep it.

- [ ] **Step 4: Verify in browser**

Navigate to `http://localhost:3000`. Tap the Search icon in the bottom nav — you should land on `/search`. No modal should appear. The Search icon should be highlighted when you're on `/search`.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass (no BottomNav tests exist, but confirm no regressions).

- [ ] **Step 6: Commit**

```bash
git add components/BottomNav.tsx
git commit -m "feat: BottomNav search tab navigates to /search (removes modal)"
```

---

## Task 5: Update `Navbar` — add search icon button

**Files:**
- Modify: `components/Navbar.tsx`

### Background

The Navbar currently shows notification bell + hamburger menu in the top-right. Add a search icon button to the **left of the notification bell**, using the same `w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm` pill style.

---

- [ ] **Step 1: Add search button to `Navbar.tsx`**

In the return JSX of the `Navbar` component, find this section:

```tsx
return (
  <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
    {/* Notification bell */}
    <div className="relative" ref={notifRef}>
```

Add the search button immediately before the notification bell div:

```tsx
return (
  <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
    {/* Search */}
    <button
      onClick={() => router.push("/search")}
      className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
      aria-label="Search"
    >
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>

    {/* Notification bell */}
    <div className="relative" ref={notifRef}>
```

- [ ] **Step 2: Verify in browser**

At `http://localhost:3000`, the top-right should show: Search icon • Bell icon • Hamburger. Clicking the search icon navigates to `/search`.

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/Navbar.tsx
git commit -m "feat: Navbar search icon button → /search"
```

---

## Task 6: Roadmap update

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Mark roadmap item complete**

In `docs/roadmap.md`, find:

```markdown
- [ ] Full search — artists, posts, shop, commissions in one grouped results page
```

Change to:

```markdown
- [x] Full search — artists, posts, shop, commissions in one grouped results page
```

And add to the "Already shipped" section at the bottom:

```markdown
- Full search — `/search` page with grouped Artists / Posts / Shop sections, "See all →" tab views, debounced URL state, search icon in Navbar and BottomNav
```

- [ ] **Step 2: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: mark full search as shipped"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|------------|
| Entry point: BottomNav Search tab → `/search` | Task 4 |
| Entry point: Navbar search icon → `/search` | Task 5 |
| `/search?q=` URL structure, debounced writes | Task 2 |
| Grouped sections: Artists, Posts, Shop | Task 2 |
| Artists: avatar + name + commission badge | Task 2 |
| Posts: 3-col grid with image + overlay | Task 2 |
| Shop: thumbnail + title + price list | Task 2 |
| Empty sections hidden | Task 2 (each section returns null when empty) |
| "No results" message | Task 2 |
| "See all N →" links | Task 2 |
| Tab views with full paginated list | Task 3 |
| "Load more" pagination | Task 3 |
| Back arrow from tab to overview | Task 3 |
| Block relationships respected in artist search | Task 1 (searchRouter.artists) |
| tRPC: artists/posts/shop procedures + tests | Task 1 |
| Roadmap updated | Task 6 |

All requirements covered. No placeholders. Types consistent across tasks (`ArtistItem`, `PostItem`, `ShopItem` defined in Task 2 and reused in Task 3 — they're in the same file so no drift possible).

**One note:** The BottomNav task (Task 4) says to check the existing `isActive` logic and adapt it — the implementer must read the current BottomNav `tabs` array and `isActive` check before editing. The current code uses `pathname === item.href` or a starts-with check. Make sure `/search` active detection uses `pathname.startsWith('/search')` not strict equality, so the tab stays highlighted on `/search?q=foo` and `/search?q=foo&tab=artists`.
