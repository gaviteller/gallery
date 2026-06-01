# Full Search Design

**Date:** 2026-05-31

---

## Overview

Replace the limited search modal (users + hashtags only) with a full `/search` page that returns results across three categories: Artists, Posts, and Shop. Entry points are the BottomNav Search tab and a new search icon in the Navbar. Results are grouped in sections with "See all →" links — the Spotify-style overview that shows breadth at a glance.

---

## Entry Points

### BottomNav (mobile)
- The Search tab currently opens a `SearchModal`. Remove the modal entirely.
- Search tab click → `router.push('/search')`.
- When the user is already on `/search`, clicking the tab focuses the search input instead of navigating.

### Navbar (desktop/top bar)
- Add a search icon button to the left of the notification bell.
- Click → `router.push('/search')`.
- No inline search bar in the navbar — the `/search` page is the search destination.

---

## The `/search` Page

### URL Structure
`/search?q=watercolor`

- `q` param is the live query string, written on every keystroke (debounced 300ms).
- Shareable and back-button friendly — browser history entry on each search.
- Empty `q` → show a blank search page (no results, no empty-state message needed beyond the input).

### Layout
1. **Sticky search bar** at the top of the page (same visual style as the rest of the app — dark background, rounded input, magnifier icon, ✕ clear button).
2. **Grouped result sections** below, stacked vertically and scrollable:
   - Artists
   - Posts
   - Shop
3. Each section has a coloured section label + "See all N →" count link on the right.
4. If a section has zero results it is hidden entirely (no empty section headers).
5. If all sections are empty → single centred message: "No results for "[query]"".

### Artists Section
- Shows top 5 matching users.
- Match on `username` or `name` (case-insensitive, already done by `user.search`).
- Each row: avatar • display name + `@username` • commission status badge.
  - Badge: green `OPEN`, amber `LIMITED`, nothing for `CLOSED`.
- Tap row → navigate to `/@{username}`.
- "See all N →" → `/search?q=...&tab=artists` (filtered view, full list).

### Posts Section
- Shows top 6 matching posts in a 3-column grid.
- Match on `description` containing the query (case-insensitive) OR hashtag matching.
- Each cell: square-cropped post image with post title/description overlay at bottom.
- Tap cell → navigate to the post (TBD: post detail page; for now navigate to `/@{username}`).
- "See all N →" → `/search?q=...&tab=posts`.

### Shop Section
- Shows top 4 matching shop items as a vertical list.
- Match on `title` or `description` containing the query (case-insensitive).
- Each row: thumbnail • title • `@username` • price (right-aligned, amber).
- Tap row → navigate to `/@{username}` (shop tab).
- "See all N →" → `/search?q=...&tab=shop`.

### Tab Views (`?tab=artists|posts|shop`)
- When a `tab` param is present, show only that category's full paginated results.
- A back arrow returns to the overview (`/search?q=...`).
- Pagination: cursor-based, 20 items per page.

---

## tRPC

### New router: `server/routers/search.ts`

Three procedures:

**`search.artists`** — wraps and extends the existing `user.search`:
- Input: `{ query: string, cursor?: string, limit?: number }`
- Returns: array of `{ id, username, name, image, commissionStatus }` + total count.
- Respects block relationships (reuse existing block-filter logic from `user.search`).
- Default limit 5 for overview, 20 for tab view.

**`search.posts`** — new:
- Input: `{ query: string, cursor?: string, limit?: number }`
- Match: posts where `status = PUBLISHED` AND (`description ilike %query%` OR has a hashtag matching the query).
- Returns: `{ id, image, description, user: { username } }` + total count.
- Default limit 6 for overview, 20 for tab view.

**`search.shop`** — new:
- Input: `{ query: string, cursor?: string, limit?: number }`
- Match: shop items where `title ilike %query%` OR `description ilike %query%`.
- Returns: `{ id, image, title, price, user: { username } }` + total count.
- Default limit 4 for overview, 20 for tab view.

Register `searchRouter` in `server/routers/_app.ts`.

---

## Components

### `app/search/page.tsx`
- `"use client"` — reads/writes `?q` and `?tab` via `useSearchParams` / `router.replace`.
- Wraps inner component in `<Suspense>` (required for `useSearchParams`).
- Calls all three search procedures in parallel when `q.trim().length >= 1`.
- Renders `<ArtistsSection>`, `<PostsSection>`, `<ShopSection>` or tab-specific full view.

### Internal section components (co-located in the same file or a `search/` folder):
- `<ArtistsSection results count onSeeAll />`
- `<PostsSection results count onSeeAll />`
- `<ShopSection results count onSeeAll />`

---

## Updating Existing Components

### `components/BottomNav.tsx`
- Remove `SearchModal` component and its state (`searchOpen`).
- Change Search tab `onClick` from `() => setSearchOpen(true)` to `() => router.push('/search')`.
- When `pathname === '/search'`, treat Search tab as active (highlight it).

### `components/Navbar.tsx`
- Add a search icon button to the left of the notification bell.
- `onClick` → `router.push('/search')`.
- Use the same `w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm` pill style as the existing buttons.

---

## Styling

Follows the existing dark-panel aesthetic:
- Section label colour: Artists = purple (`rgba(176,68,248,0.9)`), Posts = cyan (`rgba(0,180,238,0.9)`), Shop = amber (`rgba(255,200,0,0.9)`).
- "See all →" text: `text-white/35`, `text-xs`.
- Section dividers: `gap-5` between sections, no explicit horizontal rules.
- Artist rows: same style as the existing `SearchModal` people rows.
- Post grid cells: `aspect-square`, `rounded-md`, image fills cell, description overlay at bottom (semi-transparent black pill).
- Shop rows: thumbnail `40×40 rounded-md` + text + price, `bg-white/[0.04]` card background.

---

## What Is NOT Changing
- `hashtag.search` is removed from the BottomNav modal (modal is deleted entirely) — hashtag results are not included in the new search page. Hashtag pages remain accessible via `#tag` links in posts.
- The existing `user.search` procedure is kept as-is (used elsewhere); the new `search.artists` procedure calls the same underlying Prisma query.
- No changes to the post detail page, shop page, or user profile page.

---

## File Map

| Action | Path |
|--------|------|
| Create | `server/routers/search.ts` |
| Modify | `server/routers/_app.ts` — register searchRouter |
| Create | `app/search/page.tsx` |
| Modify | `components/BottomNav.tsx` — remove modal, change Search tab |
| Modify | `components/Navbar.tsx` — add search icon button |
