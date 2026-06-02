# Discovery Screen Design

**Date:** 2026-06-01

---

## Overview

Transform the `/search` idle state (no query typed) into a full discovery screen with three sections: Rising Stars, Spotlight, and You Might Like. When the user types a query, the discovery sections disappear and the existing search results (Artists / Posts / Shop) take over as normal.

Additionally, the home feed injects posts from Rising Star and Spotlight artists naturally, with no labels — just mixed in alongside posts from followed artists.

---

## The /search Idle Screen

### Layout (top to bottom)

1. **Sticky search bar** — same as current, at top of page
2. **Rising Stars section** — horizontal scrollable row of artist cards
3. Divider
4. **Spotlight section** — horizontal scrollable row of artist cards
5. Divider
6. **You Might Like section** — 3-column post thumbnail grid

### Behaviour

- When `q` param is empty or absent → show discovery screen
- When user types → discovery sections unmount, existing `<ArtistsSection>`, `<PostsSection>`, `<ShopSection>` render as today
- Back-button friendly — URL state unchanged while browsing discovery

---

## Section 1: Rising Stars

**Label:** `⬆ RISING STARS` (amber — `rgba(255,200,0,0.9)`)

**What it is:** New artists who are performing well relative to their account age. Not every new artist qualifies — only those gaining traction.

### Artist Cards
- Width: 72px, height: 88px, rounded corners
- Top: artist's avatar/banner image (or gradient initial fallback)
- Bottom overlay: `@username`
- Below card: follower count
- Horizontal scroll, 5 cards visible at a time, 15 total
- Last item: "See all →" ghost card

### "See all →"
- Navigates to `/search?filter=rising-stars`
- Shows a full paginated list of Rising Star artists (same card style, vertical list)
- Back arrow returns to `/search` idle screen

### Rising Star Algorithm (computed at query time, no schema changes)
Score = weighted combination of:
- **Follower-to-age ratio** — followers gained per day since account creation (weight: 40%)
- **Like-to-age ratio** — total post likes per day since account creation (weight: 35%)
- **Commission rating** — avg rating if they have completed commissions (weight: 25%)

Eligibility:
- Account created within the last **90 days**
- Has at least **1 published post**
- Not banned, not blocked by current user

Ordered by score descending. Top 15 returned.

---

## Section 2: Spotlight

**Label:** `✦ SPOTLIGHT` (purple — `rgba(176,68,248,0.9)`)

**What it is:** Established artists who are already doing well on the platform.

### Artist Cards
- Same card format as Rising Stars
- Below card: follower count

### "See all →"
- Navigates to `/search?filter=spotlight`
- Full paginated list of Spotlight artists

### Spotlight Algorithm (computed at query time, no schema changes)
Score = weighted combination of:
- **Total followers** (weight: 40%)
- **Completed commissions** — count of COMPLETE status commissions (weight: 30%)
- **Recent activity** — has posted in the last 30 days (weight: 15%)
- **Avg commission rating** (weight: 15%)

Eligibility:
- Account created **more than 90 days ago**
- Has at least **5 published posts**
- Not banned, not blocked by current user

Ordered by score descending. Top 15 returned.

---

## Section 3: You Might Like

**Label:** `❤ YOU MIGHT LIKE` (cyan — `rgba(0,180,238,0.9)`)

**What it is:** Posts from artists the current user doesn't follow, selected by a simple heuristic.

### Post Grid
- 3-column square-crop grid (same style as existing PostsSection)
- Tap → navigate to post (or `/@username` for now)
- Shows 9 posts initially, infinite scroll loads more

### Algorithm (simple heuristic, no schema changes)
- Posts where `status = PUBLISHED` AND `userId NOT IN followedUserIds` AND `userId NOT IN blockedIds`
- Ordered by: `likeCount DESC, createdAt DESC`
- Excludes posts from users the current user follows
- No personalisation beyond "popular posts you haven't seen from people you don't follow"

---

## Feed Integration

- The home feed algorithm injects posts from Rising Star and Spotlight artists
- **No labels shown** in the feed — posts appear naturally alongside followed artists' posts
- Only injects posts from artists the user does **not** follow
- Every ~5th post slot in the feed can be a Rising Star or Spotlight injection
- Block filtering applies — blocked users never injected

---

## tRPC

### New router: `server/routers/discovery.ts`

Three procedures:

**`discovery.risingStars`**
- Input: `{ limit?: number }` (default 15, max 50)
- Returns: `{ items: [{ id, username, name, image, followerCount, commissionStatus }], total }`
- Computes score in Prisma `orderBy` raw or post-sorts in JS

**`discovery.spotlight`**
- Input: `{ limit?: number }` (default 15, max 50)
- Returns: same shape as risingStars

**`discovery.forYou`**
- Input: `{ limit?: number, cursor?: string }` (default 9)
- Returns: `{ items: [{ id, image, description, user: { username } }], nextCursor }`
- Cursor-based pagination for infinite scroll

Register `discoveryRouter` in `server/routers/_app.ts`.

---

## Components

### `app/search/page.tsx` — modify existing
- When `q.trim() === ""` and no `tab` param → render `<DiscoveryScreen>` instead of search sections
- When `filter` param present → render `<FilteredArtistList filter="rising-stars"|"spotlight">`

### New components (co-located in `app/search/` or `components/discovery/`):
- `<DiscoveryScreen />` — renders all three sections
- `<ArtistScrollRow label colorHex items onSeeAll />` — reusable for Rising Stars + Spotlight
- `<ArtistDiscoveryCard artist />` — 72×88 card with image, username, follower count
- `<ForYouGrid />` — 3-col post grid with infinite scroll
- `<FilteredArtistList filter />` — full paginated list for "See all" views

---

## File Map

| Action | Path |
|--------|------|
| Create | `server/routers/discovery.ts` |
| Modify | `server/routers/_app.ts` — register discoveryRouter |
| Modify | `app/search/page.tsx` — add idle/discovery state |
| Create | `components/discovery/ArtistScrollRow.tsx` |
| Create | `components/discovery/ArtistDiscoveryCard.tsx` |
| Create | `components/discovery/ForYouGrid.tsx` |
| Create | `components/discovery/FilteredArtistList.tsx` |

---

## What Is NOT Changing
- Existing search results (Artists / Posts / Shop) — untouched when query is active
- Feed ranking algorithm — only adds injection slots, doesn't replace existing logic
- No DB schema changes — all scores computed at query time
- `search.artists`, `search.posts`, `search.shop` procedures — unchanged
