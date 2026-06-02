# Discovery Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the `/search` idle state into a discovery screen with Rising Stars, Spotlight, and You Might Like sections, and inject discovery posts into the home feed.

**Architecture:** Three new tRPC procedures (`discovery.risingStars`, `discovery.spotlight`, `discovery.forYou`) score and rank artists/posts using heuristics computed in JS after a Prisma fetch — no schema changes. The `/search` page conditionally renders a `<DiscoveryScreen>` when no query is typed; typing replaces it with existing search results. The home feed `getFeed` injects 2 discovery posts on the first page.

**Tech Stack:** tRPC v11, Prisma (PostgreSQL), Next.js 16 App Router, Vitest, React, Tailwind CSS

---

## File Map

| Action | Path |
|--------|------|
| Create | `server/routers/discovery.ts` |
| Modify | `server/routers/_app.ts` — register discoveryRouter |
| Create | `tests/server/discovery.test.ts` |
| Create | `components/discovery/ArtistDiscoveryCard.tsx` |
| Create | `components/discovery/ArtistScrollRow.tsx` |
| Create | `components/discovery/ForYouGrid.tsx` |
| Create | `components/discovery/FilteredArtistList.tsx` |
| Modify | `app/search/page.tsx` — add idle discovery state + filter route |
| Modify | `server/routers/post.ts` — inject discovery posts in getFeed |
| Modify | `docs/roadmap.md` |

---

### Task 1: discovery tRPC router — risingStars + spotlight

**Files:**
- Create: `server/routers/discovery.ts`
- Modify: `server/routers/_app.ts`
- Test: `tests/server/discovery.test.ts`

**Context:** Follow the same pattern as `server/routers/search.ts`. Use `publicProcedure` from `@/lib/trpc`. The scoring logic runs in JS after fetching a candidate pool from Prisma — no raw SQL needed. `CommissionRequestStatus.COMPLETE` is the enum value for finished commissions. Followers are stored in a `Follow` model: `user.followers` is the `Follow[]` relation where `followingId = user.id`.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/discovery.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { createCallerFactory } from "@/lib/trpc"
import { appRouter } from "@/server/routers/_app"

const createCaller = createCallerFactory(appRouter)

const mockArtist = {
  id: "user-1",
  username: "nova_ink",
  name: "Nova Ink",
  image: null,
  commissionStatus: "OPEN" as const,
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  _count: { followers: 500 },
  posts: [{ _count: { likes: 200 } }, { _count: { likes: 150 } }],
  artistCommissions: [{ buyerRating: 5 }, { buyerRating: 4 }],
}

const mockSpotlightArtist = {
  id: "user-2",
  username: "luminara",
  name: "Luminara Arts",
  image: null,
  commissionStatus: "OPEN" as const,
  createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), // 200 days ago
  _count: { followers: 10000 },
  posts: [{ _count: { likes: 3000 } }],
  artistCommissions: [{ buyerRating: 5 }],
}

const mockPrisma = {
  block: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  follow: { findMany: vi.fn() },
  post: { findMany: vi.fn(), count: vi.fn() },
}

function getCaller() {
  return createCaller({ session: null, prisma: mockPrisma as any })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.block.findMany.mockResolvedValue([])
})

describe("discovery.risingStars", () => {
  it("returns scored rising stars sorted by score", async () => {
    mockPrisma.user.findMany.mockResolvedValue([mockArtist])
    const caller = getCaller()
    const result = await caller.discovery.risingStars({ limit: 15 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].username).toBe("nova_ink")
    expect(result.items[0].followerCount).toBe(500)
    expect(result.total).toBe(1)
  })

  it("returns empty when no candidates", async () => {
    mockPrisma.user.findMany.mockResolvedValue([])
    const caller = getCaller()
    const result = await caller.discovery.risingStars({ limit: 15 })
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it("respects limit", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...mockArtist, id: `u-${i}`, username: `user${i}` }))
    mockPrisma.user.findMany.mockResolvedValue(many)
    const caller = getCaller()
    const result = await caller.discovery.risingStars({ limit: 3 })
    expect(result.items).toHaveLength(3)
  })
})

describe("discovery.spotlight", () => {
  it("returns scored spotlight artists", async () => {
    mockPrisma.user.findMany.mockResolvedValue([mockSpotlightArtist])
    const caller = getCaller()
    const result = await caller.discovery.spotlight({ limit: 15 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].username).toBe("luminara")
    expect(result.items[0].followerCount).toBe(10000)
  })

  it("returns empty when no candidates", async () => {
    mockPrisma.user.findMany.mockResolvedValue([])
    const caller = getCaller()
    const result = await caller.discovery.spotlight({ limit: 15 })
    expect(result.items).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/server/discovery.test.ts
```
Expected: FAIL — `Cannot find module '@/server/routers/discovery'` or similar.

- [ ] **Step 3: Create `server/routers/discovery.ts`**

```typescript
import { z } from "zod"
import { router, publicProcedure } from "@/lib/trpc"
import type { PrismaClient } from "@prisma/client"

// ── Block helper ─────────────────────────────────────────────────────────────

async function getBlockedIds(
  prisma: PrismaClient,
  userId: string | undefined
): Promise<Set<string>> {
  const blocked = new Set<string>()
  if (!userId) return blocked
  const relations = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  })
  for (const b of relations) {
    blocked.add(b.blockerId === userId ? b.blockedId : b.blockerId)
  }
  return blocked
}

// ── Scoring ───────────────────────────────────────────────────────────────────

type ScoredCandidate = {
  id: string
  username: string | null
  name: string | null
  image: string | null
  commissionStatus: "OPEN" | "LIMITED" | "CLOSED"
  createdAt: Date
  _count: { followers: number }
  posts: { _count: { likes: number } }[]
  artistCommissions: { buyerRating: number | null }[]
}

function avgRating(commissions: { buyerRating: number | null }[]): number {
  const ratings = commissions.map(c => c.buyerRating).filter((r): r is number => r !== null)
  return ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
}

function totalLikes(posts: { _count: { likes: number } }[]): number {
  return posts.reduce((s, p) => s + p._count.likes, 0)
}

/** Rising Star score: weighted by follower + like growth per account-age-day */
function scoreRisingStar(u: ScoredCandidate): number {
  const ageDays = Math.max(1, (Date.now() - u.createdAt.getTime()) / 86_400_000)
  const followerScore = u._count.followers / ageDays
  const likeScore = totalLikes(u.posts) / ageDays
  const ratingScore = avgRating(u.artistCommissions) / 5
  return followerScore * 0.4 + likeScore * 0.35 + ratingScore * 0.25
}

/** Spotlight score: weighted by absolute followers, commissions, likes, rating */
function scoreSpotlight(u: ScoredCandidate): number {
  const completedCount = u.artistCommissions.length
  return (
    u._count.followers * 0.4 +
    completedCount * 10 * 0.3 +
    totalLikes(u.posts) * 0.15 +
    (avgRating(u.artistCommissions) / 5) * 100 * 0.15
  )
}

function toArtistCard(u: ScoredCandidate) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    image: u.image,
    commissionStatus: u.commissionStatus,
    followerCount: u._count.followers,
  }
}

// ── Shared select ─────────────────────────────────────────────────────────────

const CANDIDATE_SELECT = {
  id: true,
  username: true,
  name: true,
  image: true,
  commissionStatus: true,
  createdAt: true,
  _count: { select: { followers: true } },
  posts: {
    where: { status: "PUBLISHED" as const },
    select: { _count: { select: { likes: true } } },
  },
  artistCommissions: {
    where: { status: "COMPLETE" as const, buyerRating: { not: null } },
    select: { buyerRating: true },
  },
} as const

// ── Router ────────────────────────────────────────────────────────────────────

export const discoveryRouter = router({
  risingStars: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(15) }))
    .query(async ({ ctx, input }) => {
      const blockedIds = await getBlockedIds(ctx.prisma, ctx.session?.user?.id)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

      const candidates = await ctx.prisma.user.findMany({
        where: {
          createdAt: { gte: ninetyDaysAgo },
          username: { not: null },
          posts: { some: { status: "PUBLISHED" } },
          bannedUntil: null,
          ...(blockedIds.size > 0 ? { id: { notIn: [...blockedIds] } } : {}),
        },
        select: CANDIDATE_SELECT,
        take: 100,
        orderBy: { createdAt: "desc" },
      })

      const items = (candidates as ScoredCandidate[])
        .map(u => ({ u, score: scoreRisingStar(u) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit)
        .map(({ u }) => toArtistCard(u))

      return { items, total: candidates.length }
    }),

  spotlight: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(15) }))
    .query(async ({ ctx, input }) => {
      const blockedIds = await getBlockedIds(ctx.prisma, ctx.session?.user?.id)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

      const candidates = await ctx.prisma.user.findMany({
        where: {
          createdAt: { lt: ninetyDaysAgo },
          username: { not: null },
          posts: { some: { status: "PUBLISHED" } },
          bannedUntil: null,
          ...(blockedIds.size > 0 ? { id: { notIn: [...blockedIds] } } : {}),
        },
        select: CANDIDATE_SELECT,
        take: 200,
        orderBy: { createdAt: "asc" },
      })

      const items = (candidates as ScoredCandidate[])
        .map(u => ({ u, score: scoreSpotlight(u) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit)
        .map(({ u }) => toArtistCard(u))

      return { items, total: candidates.length }
    }),
})
```

- [ ] **Step 4: Register in `server/routers/_app.ts`**

Add after the last import:
```typescript
import { discoveryRouter } from "./discovery"
```

Add to the router object:
```typescript
discovery: discoveryRouter,
```

- [ ] **Step 5: Run the tests — verify they pass**

```bash
npx vitest run tests/server/discovery.test.ts
```
Expected: PASS — all 5 tests green.

- [ ] **Step 6: Commit**

```bash
git add server/routers/discovery.ts server/routers/_app.ts tests/server/discovery.test.ts
git commit -m "feat: discovery tRPC router — risingStars and spotlight"
```

---

### Task 2: discovery.forYou procedure

**Files:**
- Modify: `server/routers/discovery.ts` (add `forYou`)
- Modify: `tests/server/discovery.test.ts` (add forYou tests)

**Context:** `forYou` returns recent popular posts from artists the current user does NOT follow. Uses cursor-based pagination (cursor = last post id). Excludes the user's own posts and blocked users. Falls back gracefully when logged out (returns recent popular posts from anyone).

- [ ] **Step 1: Add forYou tests to `tests/server/discovery.test.ts`**

Append to the file:

```typescript
describe("discovery.forYou", () => {
  it("returns posts for anonymous user", async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      { id: "post-1", image: "img1", description: "cool art", user: { username: "luna" }, _count: { likes: 50 } },
    ])
    const caller = getCaller()
    const result = await caller.discovery.forYou({ limit: 9 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe("post-1")
    expect(result.nextCursor).toBeUndefined()
  })

  it("respects limit", async () => {
    const posts = Array.from({ length: 20 }, (_, i) => ({
      id: `post-${i}`,
      image: `img${i}`,
      description: null,
      user: { username: `user${i}` },
      _count: { likes: i },
    }))
    mockPrisma.post.findMany.mockResolvedValue(posts.slice(0, 9))
    const caller = getCaller()
    const result = await caller.discovery.forYou({ limit: 9 })
    expect(result.items).toHaveLength(9)
  })

  it("excludes followed users when session present", async () => {
    mockPrisma.follow.findMany.mockResolvedValue([{ followingId: "followed-user" }])
    mockPrisma.post.findMany.mockResolvedValue([])
    const caller = createCaller({ session: { user: { id: "me" } } as any, prisma: mockPrisma as any })
    await caller.discovery.forYou({ limit: 9 })
    const callArgs = mockPrisma.post.findMany.mock.calls[0][0]
    expect(callArgs.where.userId.notIn).toContain("followed-user")
    expect(callArgs.where.userId.notIn).toContain("me")
  })
})
```

- [ ] **Step 2: Run new tests — verify they fail**

```bash
npx vitest run tests/server/discovery.test.ts
```
Expected: FAIL — `discovery.forYou is not a function`.

- [ ] **Step 3: Add `forYou` to `server/routers/discovery.ts`**

Add inside the `router({...})` object after `spotlight`:

```typescript
  forYou: publicProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(9),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      const blockedIds = await getBlockedIds(ctx.prisma, userId)

      const followedIds = userId
        ? (await ctx.prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true },
          })).map((f: { followingId: string }) => f.followingId)
        : []

      const excludeIds = [
        ...followedIds,
        ...(userId ? [userId] : []),
        ...blockedIds,
      ]

      const where = {
        status: "PUBLISHED" as const,
        user: { username: { not: null } },
        ...(excludeIds.length > 0 ? { userId: { notIn: excludeIds } } : {}),
      }

      const items = await ctx.prisma.post.findMany({
        where,
        select: {
          id: true,
          image: true,
          description: true,
          user: { select: { username: true } },
          _count: { select: { likes: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      })

      return { items }
    }),
```

- [ ] **Step 4: Run all discovery tests — verify they pass**

```bash
npx vitest run tests/server/discovery.test.ts
```
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/routers/discovery.ts tests/server/discovery.test.ts
git commit -m "feat: discovery.forYou — paginated posts from non-followed artists"
```

---

### Task 3: ArtistDiscoveryCard + ArtistScrollRow components

**Files:**
- Create: `components/discovery/ArtistDiscoveryCard.tsx`
- Create: `components/discovery/ArtistScrollRow.tsx`

**Context:** The app uses a dark theme (`#0d0d0f` background). Styling follows the existing aesthetic — rounded panels, `rgba(255,255,255,0.08)` borders, gradient fallback avatars. Import `Avatar` from `@/components/Avatar` and `Link` from `next/link`. The app already has `Avatar` — check its props: `src`, `name`, `username`, `size`.

- [ ] **Step 1: Create `components/discovery/ArtistDiscoveryCard.tsx`**

```typescript
import Link from "next/link"
import Avatar from "@/components/Avatar"

export type DiscoveryArtist = {
  id: string
  username: string | null
  name: string | null
  image: string | null
  commissionStatus: "OPEN" | "LIMITED" | "CLOSED"
  followerCount: number
}

export default function ArtistDiscoveryCard({ artist }: { artist: DiscoveryArtist }) {
  if (!artist.username) return null

  function formatFollowers(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  return (
    <Link
      href={`/@${artist.username}`}
      className="flex-shrink-0 w-[72px] text-center focus:outline-none"
    >
      {/* Card */}
      <div
        className="relative overflow-hidden mb-1.5"
        style={{
          width: 72,
          height: 88,
          borderRadius: 12,
          background: "#141414",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Top area: avatar */}
        <div className="absolute top-0 left-0 w-full" style={{ height: 60 }}>
          <Avatar
            src={artist.image}
            name={artist.name}
            username={artist.username}
            size={72}
          />
        </div>
        {/* Bottom label */}
        <div
          className="absolute bottom-0 left-0 w-full flex items-center justify-center"
          style={{ height: 28, background: "rgba(0,0,0,0.65)" }}
        >
          <span
            className="text-[9px] text-white/80 truncate px-1"
            style={{ maxWidth: 64 }}
          >
            @{artist.username}
          </span>
        </div>
      </div>
      {/* Follower count */}
      <span className="text-[8px] text-white/40">
        {formatFollowers(artist.followerCount)} followers
      </span>
    </Link>
  )
}
```

- [ ] **Step 2: Create `components/discovery/ArtistScrollRow.tsx`**

```typescript
import ArtistDiscoveryCard, { type DiscoveryArtist } from "./ArtistDiscoveryCard"
import Link from "next/link"

type Props = {
  label: string
  labelColor: string
  filterParam: "rising-stars" | "spotlight"
  items: DiscoveryArtist[]
  total: number
}

export default function ArtistScrollRow({ label, labelColor, filterParam, items, total }: Props) {
  if (items.length === 0) return null

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-2.5 px-4">
        <span
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: labelColor }}
        >
          {label}
        </span>
        <Link
          href={`/search?filter=${filterParam}`}
          className="text-[10px] text-white/35 hover:text-white/60 transition-colors"
        >
          See all →
        </Link>
      </div>

      {/* Scrollable row */}
      <div
        className="flex gap-2.5 px-4 pb-1 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((artist) => (
          <ArtistDiscoveryCard key={artist.id} artist={artist} />
        ))}
        {/* See all ghost card */}
        {total > items.length && (
          <Link
            href={`/search?filter=${filterParam}`}
            className="flex-shrink-0 w-[72px] flex flex-col items-center"
          >
            <div
              className="flex items-center justify-center mb-1.5"
              style={{
                width: 72,
                height: 88,
                borderRadius: 12,
                border: "1px dashed rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <span className="text-[9px] text-white/30 text-center leading-tight">
                See<br />all →
              </span>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/discovery/ArtistDiscoveryCard.tsx components/discovery/ArtistScrollRow.tsx
git commit -m "feat: ArtistDiscoveryCard and ArtistScrollRow components"
```

---

### Task 4: ForYouGrid + FilteredArtistList components

**Files:**
- Create: `components/discovery/ForYouGrid.tsx`
- Create: `components/discovery/FilteredArtistList.tsx`

**Context:** `ForYouGrid` is a 3-column post grid with infinite scroll that calls `discovery.forYou`. Tap a post → navigate to `/@{username}`. `FilteredArtistList` is the full paginated list shown when user taps "See all →" for Rising Stars or Spotlight — it calls `discovery.risingStars` or `discovery.spotlight` with increasing limits.

- [ ] **Step 1: Create `components/discovery/ForYouGrid.tsx`**

```typescript
"use client"
import Link from "next/link"
import { useState } from "react"
import { trpc } from "@/components/providers"

export default function ForYouGrid() {
  const [limit, setLimit] = useState(9)
  const { data } = trpc.discovery.forYou.useQuery({ limit })

  const items = data?.items ?? []
  if (items.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5 px-4">
        <span
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: "rgba(0,180,238,0.9)" }}
        >
          ❤ You Might Like
        </span>
      </div>

      <div className="grid grid-cols-3 gap-0.5 px-4">
        {items.map((post) => (
          <Link
            key={post.id}
            href={post.user.username ? `/@${post.user.username}` : "#"}
            className="aspect-square rounded-md overflow-hidden relative"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <img
              src={post.image}
              alt={post.description ?? ""}
              className="w-full h-full object-cover"
            />
          </Link>
        ))}
      </div>

      {items.length === limit && (
        <button
          onClick={() => setLimit(l => l + 9)}
          className="w-full py-2.5 mt-3 text-xs font-semibold text-white/40 hover:text-white/70 transition-colors"
        >
          Load more
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/discovery/FilteredArtistList.tsx`**

```typescript
"use client"
import { useState } from "react"
import { trpc } from "@/components/providers"
import ArtistDiscoveryCard from "./ArtistDiscoveryCard"

type Filter = "rising-stars" | "spotlight"

export default function FilteredArtistList({ filter }: { filter: Filter }) {
  const [limit, setLimit] = useState(20)

  // Both hooks must always be called — React rules of hooks
  const risingData = trpc.discovery.risingStars.useQuery(
    { limit },
    { enabled: filter === "rising-stars" }
  )
  const spotlightData = trpc.discovery.spotlight.useQuery(
    { limit },
    { enabled: filter === "spotlight" }
  )

  const data = filter === "rising-stars" ? risingData.data : spotlightData.data
  const items = data?.items ?? []
  const total = data?.total ?? 0

  if (items.length === 0) {
    return (
      <p className="text-sm text-white/40 text-center mt-12">
        No artists found yet.
      </p>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 px-4">
        {items.map((artist) => (
          <ArtistDiscoveryCard key={artist.id} artist={artist} />
        ))}
      </div>

      {items.length < total && (
        <button
          onClick={() => setLimit(l => l + 20)}
          className="w-full py-2.5 mt-4 text-xs font-semibold text-white/40 hover:text-white/70 transition-colors rounded-xl"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Load more
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/discovery/ForYouGrid.tsx components/discovery/FilteredArtistList.tsx
git commit -m "feat: ForYouGrid and FilteredArtistList discovery components"
```

---

### Task 5: Wire discovery into /search page

**Files:**
- Modify: `app/search/page.tsx`

**Context:** The existing `SearchInner` component already reads `?q` and `?tab` from the URL. We need to:
1. When `q` is empty and no `filter` param → show `<DiscoveryScreen>` (three sections)
2. When `filter=rising-stars` or `filter=spotlight` → show `<FilteredArtistList>` with back button
3. Keep all existing search behaviour unchanged when `q` is non-empty

The `DiscoveryScreen` is a new component defined in the same file that renders two `<ArtistScrollRow>` instances and one `<ForYouGrid>`.

- [ ] **Step 1: Add imports to `app/search/page.tsx`**

At the top, add after existing imports:
```typescript
import ArtistScrollRow from "@/components/discovery/ArtistScrollRow"
import ForYouGrid from "@/components/discovery/ForYouGrid"
import FilteredArtistList from "@/components/discovery/FilteredArtistList"
```

- [ ] **Step 2: Add `DiscoveryScreen` component to `app/search/page.tsx`**

Add this component definition before `SearchInner`:

```typescript
// ── Discovery screen (shown when no query) ────────────────────────────────────

function DiscoveryScreen() {
  const { data: risingData } = trpc.discovery.risingStars.useQuery({ limit: 15 })
  const { data: spotlightData } = trpc.discovery.spotlight.useQuery({ limit: 15 })

  return (
    <div className="flex flex-col gap-5 pb-24 pt-3">
      <ArtistScrollRow
        label="⬆ Rising Stars"
        labelColor="rgba(255,200,0,0.9)"
        filterParam="rising-stars"
        items={risingData?.items ?? []}
        total={risingData?.total ?? 0}
      />

      {/* Divider */}
      {(risingData?.items.length ?? 0) > 0 && (
        <div className="mx-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
      )}

      <ArtistScrollRow
        label="✦ Spotlight"
        labelColor="rgba(176,68,248,0.9)"
        filterParam="spotlight"
        items={spotlightData?.items ?? []}
        total={spotlightData?.total ?? 0}
      />

      {/* Divider */}
      {(spotlightData?.items.length ?? 0) > 0 && (
        <div className="mx-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
      )}

      <ForYouGrid />
    </div>
  )
}
```

- [ ] **Step 3: Modify `SearchInner` in `app/search/page.tsx`**

Add `filter` to the params read at the top of `SearchInner` (after `const tab = ...`):
```typescript
const filter = searchParams.get("filter") as "rising-stars" | "spotlight" | null
```

Add the filter label lookup after the `tabLabels` object:
```typescript
const filterLabels: Record<string, string> = {
  "rising-stars": "⬆ Rising Stars",
  "spotlight": "✦ Spotlight",
}
const filterColors: Record<string, string> = {
  "rising-stars": "rgba(255,200,0,0.9)",
  "spotlight": "rgba(176,68,248,0.9)",
}
```

Replace the sticky search bar's back-button section. Currently it shows back button only when `tab` is set. Extend it to also show when `filter` is set:

```typescript
{(tab || filter) && (
  <button
    onClick={() => {
      if (filter) router.push("/search")
      else goBack()
    }}
    className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mb-2"
  >
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
    {filter ? "Back to discover" : "Back to results"}
  </button>
)}
```

Add label display below back button (add after the existing `{tab && ...}` label block):
```typescript
{filter && (
  <p
    className="text-[11px] font-bold uppercase tracking-widest mt-2 px-1"
    style={{ color: filterColors[filter] }}
  >
    {filterLabels[filter]}
  </p>
)}
```

In the results section, add the new states before `{!tab && ...}`:

```typescript
{/* Filter view: full Rising Stars or Spotlight list */}
{filter && !enabled && (
  <FilteredArtistList filter={filter} />
)}

{/* Discovery screen: no query, no filter */}
{!filter && !enabled && (
  <DiscoveryScreen />
)}
```

Also remove the existing empty-query blank state. Currently when `!tab && !enabled` nothing renders. With the above, `<DiscoveryScreen>` fills that gap automatically.

- [ ] **Step 4: Run the dev server and verify visually**

```bash
npm run dev
```

1. Open http://localhost:3000 and navigate to Search tab
2. With no query typed: should see Rising Stars, Spotlight, You Might Like sections
3. Tap "See all →" on Rising Stars: URL changes to `/search?filter=rising-stars`, full list shown
4. Back button returns to `/search` (discovery screen)
5. Type a query: discovery screen replaced by Artists/Posts/Shop results
6. Clear query: discovery screen returns

- [ ] **Step 5: Commit**

```bash
git add app/search/page.tsx
git commit -m "feat: /search idle state shows discovery screen — Rising Stars, Spotlight, You Might Like"
```

---

### Task 6: Feed injection

**Files:**
- Modify: `server/routers/post.ts`

**Context:** The existing `getFeed` procedure (line 42) fetches 300 recent posts, scores them, and returns `PAGE_SIZE = 12` posts per page. We inject 2 discovery posts (from non-followed artists) at positions 4 and 9 of the **first page only** (cursor === 0). We fetch these separately with a simple `post.findMany` ordered by likes, excluding followed + blocked users. No new DB queries on subsequent pages.

- [ ] **Step 1: Locate the injection point in `server/routers/post.ts`**

Find the block where `rankedPage` (or the final returned array) is assembled. Look for where the scored posts are sliced to `PAGE_SIZE`. It will look something like:

```typescript
const rankedPage = scored
  .sort((a, b) => b.score - a.score)
  .slice(input.cursor, input.cursor + PAGE_SIZE)
```

- [ ] **Step 2: Add discovery injection after the ranked page is assembled**

After `rankedPage` is computed, add:

```typescript
// ── Discovery injection (first page only) ─────────────────────────────────
if (input.cursor === 0 && userId) {
  const discoveryPosts = await ctx.prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      user: { username: { not: null } },
      userId: {
        notIn: [userId, ...[...followingSet], ...[...blockedUserIds]],
      },
    },
    include: {
      user: { select: { id: true, username: true, name: true, image: true, commissionStatus: true } },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 2,
  })

  // Insert at positions 4 and 9 (if they exist)
  const injectAt = [4, 9]
  let offset = 0
  for (const pos of injectAt) {
    const adjusted = pos + offset
    if (discoveryPosts.length === 0) break
    if (adjusted <= rankedPage.length) {
      const inject = discoveryPosts.shift()!
      rankedPage.splice(adjusted, 0, {
        ...inject,
        isFollowing: false,
        isOwnPost: false,
        likedByMe: false,
        viewerHasReported: false,
      })
      offset++
    }
  }
}
```

**Note:** `rankedPage` must be a `let` array (mutable), not `const`. If it's currently `const`, change it to `let`.

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```
Expected: same pass count as before (feed injection only runs with a real DB session, mocked tests unaffected). Fix any TypeScript errors — the injected post must match the existing post shape exactly.

- [ ] **Step 4: Manually verify feed injection**

Start the dev server. Log in. Scroll the home feed. Every ~5 posts should include a post from someone you don't follow (with no visible label — just a regular post).

- [ ] **Step 5: Commit**

```bash
git add server/routers/post.ts
git commit -m "feat: inject discovery posts at positions 4 and 9 in home feed (first page only)"
```

---

### Task 7: Roadmap update

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Mark Rising Stars as shipped**

In the Discovery & Search section of Tier 1, change:
```markdown
- [ ] Rising Stars / Artist Spotlight rotating feature slot
```
to:
```markdown
- [x] Rising Stars / Artist Spotlight rotating feature slot
```

- [ ] **Step 2: Add to Already shipped section**

At the bottom of the `## ✅ Already shipped` section, add:
```markdown
- Discovery screen — `/search` idle state shows Rising Stars (new artists gaining traction), Spotlight (established artists), and You Might Like post grid; feed injects discovery posts at positions 4 and 9 on first page
```

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: mark Rising Stars / Artist Spotlight as shipped"
```
