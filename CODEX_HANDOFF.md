# Gallery — Codex Visual Implementation Package
**Date:** 2026-09-22  
**Purpose:** Give Codex everything it needs to implement and extend the Gallery visual redesign — including the full source code of every visual file.

---

## What You Are Building

An art-focused social platform. Think Instagram + Etsy + commission marketplace for artists. The visual redesign is a custom dark art-platform aesthetic with a distinctive paint-drip header, gradient sidebar, and card-based feed layout. The CSS design system is already written — your job is to integrate it correctly and fix known issues.

**Working exclusively in localhost. Do NOT touch Vercel.**

---

## CRITICAL: Database Setup First

The Neon cloud DB is over quota — all API calls return 500 until you set up local Postgres.

1. Install PostgreSQL from https://www.postgresql.org/download/windows/ (password: `password`, port: `5432`)
2. Create database: `psql -U postgres -c "CREATE DATABASE gallery;"`
3. Update `.env.local`:
   ```
   DATABASE_URL=postgresql://postgres:password@localhost:5432/gallery
   ```
4. Run: `npx prisma migrate deploy && npx prisma generate`
5. Start: `npm run dev`

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2.6 App Router, Turbopack |
| Language | TypeScript |
| API | tRPC v11 + React Query v5 |
| ORM | Prisma 5 + PostgreSQL |
| Auth | NextAuth v4 |
| Styling | Custom CSS (`app/gallery-final.css`, `app/gallery-feed.css`) — NOT Tailwind for visual redesign |
| Images | Cloudinary + UploadThing |

**IMPORTANT:** Before writing any Next.js code, read `node_modules/next/dist/docs/` — this version has breaking API changes from older Next.js.

---

## Current State

### What's Committed (last commit: `d69067a`)
Full working platform: auth, feed, search, shop, commissions, messaging, notifications, AI moderation, admin panel.

### What's Uncommitted (working tree — must commit before doing more work)
Modified files:
- `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/search/page.tsx`, `app/shop/page.tsx`
- `components/BottomNav.tsx`, `components/Navbar.tsx`
- `components/FeaturedArtistsStrip.tsx`, `components/StoriesRow.tsx`
- `lib/watermark.ts`, `server/routers/auth.ts`, `package.json`

New files (not committed):
- `app/gallery-final.css` — main design system (MOST IMPORTANT)
- `app/gallery-feed.css` — feed/explore/shop CSS
- `components/GalleryDesktopSidebar.tsx` — desktop left sidebar
- `components/GalleryRightRail.tsx` — right rail (suggested artists + trending)
- `public/header-drip-top.png`, `public/header-drip-bottom.png` — paint drip header assets
- `design-references/` — reference screenshots

**ACTION: Commit all uncommitted files first.**

---

## Design System

### CSS Variables (defined in both `gallery-final.css` and `gallery-feed.css`)
```css
--gallery-bg: #070811          /* dark background */
--gallery-panel: #0b0c16       /* card surfaces */
--gallery-line: #2b273f        /* borders */
--gallery-text: #f8f7fb        /* primary text */
--gallery-muted: #968ab5       /* muted text */
--gallery-pink: #ff28b7
--gallery-purple: #b646ff
--gallery-violet: #6c57ff
--gallery-blue: #21b8ff
--gallery-gradient: linear-gradient(90deg,#ff28b7 0%,#b646ff 39%,#6c57ff 65%,#21b8ff 100%)
--gallery-shell-width: 1163px
--gallery-side: 226px          /* sidebar width */
--gallery-center: 594px        /* main content column */
--gallery-rail: 285px          /* right rail */
```

### Desktop Layout (≥1163px)
```
[226px sidebar] [16px gap] [594px center feed] [16px gap] [285px right rail]
= 1163px total shell
```

### Paint Drip Header
- 160px tall, `background: var(--gallery-bg)`
- Drip images: `public/header-drip-top.png` (top edge) + `public/header-drip-bottom.png` (hangs below)
- Bell (notifications) + profile avatar in top right
- No logo on desktop (was removed)

### Gallery Shell Pages
These pages show the Gallery sidebar + header:
```tsx
const isGalleryShell = isFeedHome || pathname.startsWith("/search") || pathname.startsWith("/shop")
```
Defined in both `components/Navbar.tsx` (line 146) and `components/BottomNav.tsx` (line 166).

### Design Reference Images
```
design-references/feed-desktop.png
design-references/feed-mobile.png
design-references/explore-desktop.png
design-references/shop-desktop.png
```

---

## Developer Rules (Follow These Exactly)

1. **Mockup first, code second** — For any visual change, show a mockup and wait for explicit approval before touching files.
2. **Full replacement, not partial edits** — "Replace appearance" means rewrite the entire visual layer.
3. **Don't act during discussions** — Wait for "build it" / "write it" before coding.
4. **Everything is localhost until told otherwise** — Do NOT deploy to Vercel.
5. **Payment features are last priority** — Don't touch Stripe unless explicitly asked.
6. **Commission reference photos and DM delivery attachments are NOT auto-scanned** — private context, report-only.
7. **NEXTAUTH_SECRET must be set in Vercel before going live** (not done yet).

---

## What Needs To Be Done

### High Priority
1. **Fix Follow button bug** in `GalleryRightRail` — clicking Follow sometimes navigates to the artist profile instead of triggering the mutation. The `FollowButton` component uses `type="button"` which is correct, but there may be a z-index issue where the `Link` element behind intercepts the click. Fix the z-index/positioning so the button click is always captured.

2. **Extend gallery shell to more pages** — Currently `isGalleryShell` only covers `/`, `/search`, `/shop`. Consider extending to `/commissions` and other key routes. Confirm with user before changing.

3. **Dashboard page** (`/dashboard` or `/professional-profile`) — Artists need to see earnings, orders, commission stats. The shell exists but content is placeholder.

4. **Commit all uncommitted files** — Run `git add` and `git commit` on all the visual files listed above.

### Medium Priority
5. **AI moderation — commission photos** — `lib/ai-scan.ts` is NOT wired into `server/routers/commission.ts` for reference/delivery photos. Wire it in (but respect the security constraint: these are private, report-only).

---

## Full Source Code of Visual Files

### `app/gallery-final.css` — Main Design System (648 lines)
```css
/* ========================================================================== 
   GALLERY — FINAL APPROVED VISUAL PASS
   Shared shell + Feed desktop + Explore desktop + Shop desktop + Feed mobile.
   ========================================================================== */

:root {
  --gallery-shell-width: 1163px;
  --gallery-side: 226px;
  --gallery-shell-gap: 16px;
  --gallery-center: 594px;
  --gallery-rail: 285px;
  --gallery-bg: #070811;
  --gallery-panel: #0b0c16;
  --gallery-panel-2: #10111d;
  --gallery-line: #2b273f;
  --gallery-line-bright: #49345f;
  --gallery-text: #f8f7fb;
  --gallery-muted: #968ab5;
  --gallery-pink: #ff28b7;
  --gallery-purple: #b646ff;
  --gallery-violet: #6c57ff;
  --gallery-blue: #21b8ff;
  --gallery-gradient: linear-gradient(90deg,#ff28b7 0%,#b646ff 39%,#6c57ff 65%,#21b8ff 100%);
}

html, body { background: var(--gallery-bg); }
body { overflow-x: hidden; }

/* SHARED DESKTOP HEADER */
@media (min-width: 1163px) {
  .gallery-desktop-header {
    display: block !important;
    width: 100%;
    height: 160px;
    position: relative;
    z-index: 45;
    background: var(--gallery-bg) !important;
    overflow: visible;
  }
  .gallery-desktop-header-inner {
    width: var(--gallery-shell-width) !important;
    height: 160px !important;
    margin: 0 auto !important;
    position: relative;
    background: transparent !important;
  }
  .gallery-header-paint-code {
    position: absolute !important;
    inset: 0 !important;
    z-index: 0 !important;
    pointer-events: none;
    overflow: visible !important;
  }
  .gallery-drip-top-img {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 32px !important;
    object-fit: cover !important;
    object-position: top !important;
    display: block !important;
  }
  .gallery-drip-bottom-img {
    position: absolute !important;
    bottom: -35px !important;
    left: 0 !important;
    width: 100% !important;
    height: 70px !important;
    object-fit: cover !important;
    display: block !important;
    pointer-events: none !important;
  }
  .gallery-code-brand { display: none !important; }
  .gallery-global-search {
    left: 370px !important;
    top: 29px !important;
    width: 449px !important;
    height: 49px !important;
    border-radius: 999px !important;
    border-color: #554072 !important;
    background: linear-gradient(180deg,rgba(12,13,24,.94),rgba(8,9,17,.98)) !important;
  }
  .gallery-header-actions { right: 50px !important; top: 26px !important; gap: 16px !important; }
  .gallery-round-button,.gallery-profile-circle { width: 50px !important; height: 50px !important; }
}

/* APPROVED DESKTOP SIDEBAR */
.gallery-shell-sidebar { display: none; }

@media (min-width: 1163px) {
  .gallery-shell-sidebar {
    display: flex !important;
    position: fixed;
    top: 160px;
    bottom: 0;
    left: calc(50% - 581.5px);
    width: 226px;
    z-index: 44;
    flex-direction: column;
    padding: 22px 0 28px 16px;
    background: var(--gallery-bg);
    border: 0;
    overflow: visible;
  }
  .gallery-shell-nav-list {
    display: flex;
    flex-direction: column;
    width: 210px;
    gap: 5px;
  }
  .gallery-shell-nav-item {
    width: 210px;
    height: 57px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 17px;
    border: 1px solid transparent;
    border-radius: 14px;
    color: #c9c0de;
    background: transparent;
    text-decoration: none;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    position: relative;
    transition: background .14s ease,border-color .14s ease,color .14s ease;
  }
  button.gallery-shell-nav-item { font: inherit; text-align: left; }
  .gallery-shell-nav-item svg { flex: 0 0 auto; color: #b8a7e8; }
  .gallery-shell-nav-item:hover { color: #fff; background: rgba(118,77,169,.08); }
  .gallery-shell-nav-item.is-active {
    color: #fff;
    background: linear-gradient(90deg,rgba(255,40,183,.34),rgba(78,57,143,.14));
    border-color: #4d3563;
    box-shadow: 0 0 22px rgba(255,40,183,.07), inset 0 1px rgba(255,255,255,.018);
  }
  .gallery-shell-nav-item.is-active svg { color: #fff; }
  .gallery-shell-icon-wrap { width: 25px; height: 25px; display: inline-grid; place-items: center; position: relative; flex: 0 0 auto; }
  .gallery-shell-icon-wrap > i {
    position: absolute;
    top: -4px;
    right: -8px;
    min-width: 15px;
    height: 15px;
    padding: 0 3px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--gallery-pink);
    color: white;
    font-size: 8px;
    font-style: normal;
    font-weight: 800;
    border: 2px solid var(--gallery-bg);
  }
  .gallery-shell-notification-wrap { position: relative; }
  .gallery-shell-notification-panel {
    position: fixed;
    left: calc(50% - 581.5px + 226px);
    top: 160px;
    width: 310px;
    max-height: calc(100vh - 180px);
    overflow: hidden;
    z-index: 205;
    border: 1px solid var(--gallery-line);
    border-radius: 0 16px 16px 0;
    background: #0d0e19;
    box-shadow: 18px 18px 55px rgba(0,0,0,.42);
  }
  .gallery-shell-notification-head { height: 52px; display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid var(--gallery-line); }
  .gallery-shell-notification-head strong { font-family:"Playfair Display",Georgia,serif;font-size:15px; }
  .gallery-shell-notification-head button { border:0;background:none;color:var(--gallery-muted);font-size:23px;cursor:pointer; }
  .gallery-shell-notification-list { max-height: calc(100vh - 232px); overflow-y:auto; }
  .gallery-shell-notification-list > p { padding:28px 14px;text-align:center;color:var(--gallery-muted);font-size:12px; }
  .gallery-shell-notification-list > button { width:100%;display:flex;align-items:center;gap:10px;padding:11px 14px;border:0;border-bottom:1px solid #1d1b2a;background:transparent;color:var(--gallery-text);text-align:left;cursor:pointer; }
  .gallery-shell-notification-list > button.is-unread { background:rgba(131,77,178,.1); }
  .gallery-shell-notification-list > button > span:last-child { font-size:11px;line-height:1.35; }
  .gallery-system-avatar { width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--gallery-gradient);font-weight:800;flex:0 0 auto; }
  .gallery-shell-nav-divider { width: 206px; height: 1px; margin: 15px 0 10px; background: #292537; }
  .gallery-shell-create-post {
    width: 210px;
    height: 57px;
    border-radius: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: var(--gallery-gradient);
    color: white;
    text-decoration: none;
    font-size: 15px;
    font-weight: 750;
    box-shadow: 0 13px 30px rgba(58,103,255,.16);
  }
  .gallery-shell-create-post span { font-size: 25px; font-weight: 300; line-height: 1; }
  .gallery-shell-user-avatar {
    position: absolute;
    left: 20px;
    bottom: 28px;
    width: 49px;
    height: 49px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: var(--gallery-gradient);
    color: #15111c;
    text-decoration: none;
    font-size: 14px;
    font-weight: 800;
    box-shadow: 0 0 18px rgba(130,78,255,.15);
  }
  .gallery-shell-user-avatar img { width:100%;height:100%;object-fit:cover; }

  /* Layout: 226 sidebar + 16 gap + 895 page content */
  body:has(.gallery-feed-page) .main-layout,
  body:has(.gallery-explore-page) .main-layout,
  body:has(.gallery-shop-page) .main-layout {
    width: 895px !important;
    max-width: 895px !important;
    margin-left: calc(50% - 339.5px) !important;
    margin-right: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    min-height: calc(100vh - 160px) !important;
  }
  body:has(.gallery-feed-page) .main-layout > footer,
  body:has(.gallery-explore-page) .main-layout > footer,
  body:has(.gallery-shop-page) .main-layout > footer { display:none !important; }
}

/* RIGHT RAIL */
.gallery-right-rail,
.feed-right-col { width: 285px; min-width: 285px; display: flex; flex-direction: column; gap: 15px; }
.gallery-discovery { padding: 17px; }
.gallery-right-combined { min-height: 596px; }
.gallery-suggested-list { display:flex;flex-direction:column; }
.gallery-suggested-person {
  min-height: 73px;
  display: grid;
  grid-template-columns: 48px minmax(0,1fr) auto;
  align-items: center;
  gap: 10px;
  border-bottom: 0;
}
.gallery-suggested-avatar-link { width:48px;height:48px;border-radius:50%;overflow:hidden;text-decoration:none;display:grid;place-items:center; }
.gallery-suggested-avatar-link img { width:100%;height:100%;object-fit:cover;border-radius:50%; }
.gallery-suggested-avatar { width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--gallery-gradient);color:white;font-weight:800; }
.gallery-suggested-meta { min-width:0;display:flex;flex-direction:column;text-decoration:none; }
.gallery-suggested-meta b { color:var(--gallery-text);font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.gallery-suggested-meta span { margin-top:3px;color:var(--gallery-muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.gallery-follow { min-width:64px;height:34px;padding:0 10px;border:1px solid #dc2dd3;border-radius:8px;background:transparent;color:#ff60da;font-size:12px;font-weight:700;display:grid;place-items:center;text-decoration:none;cursor:pointer; }
.gallery-follow:hover { background:rgba(255,40,183,.07); }
.gallery-follow.is-following { opacity:.55; }
.gallery-right-rule { height:1px;background:#252234;margin:10px 0 15px; }
.gallery-trending-head { margin-bottom: 2px; }
.gallery-trending-list { display:block; }
.gallery-trend { height:47px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #252234;text-decoration:none; }
.gallery-trend:last-child { border-bottom:0; }
.gallery-trend > span { color:#f4f2f8;font-size:13px;font-style:normal; }
.gallery-trend > em { color:#9e92be;font-size:12px;font-style:normal; }
.gallery-right-empty { margin:10px 0;color:var(--gallery-muted);font-size:11px; }

/* PROMO CARD */
.gallery-promo-card {
  height: 445px;
  position: relative;
  overflow: hidden;
  border-radius: 17px;
  background:
    radial-gradient(circle at 12% 82%,rgba(255,42,183,.12),transparent 24%),
    radial-gradient(circle at 87% 13%,rgba(34,188,255,.11),transparent 24%),
    linear-gradient(180deg,#0d0e19,#0a0b14) !important;
}
.gallery-promo-paint {
  position:absolute;left:0;right:0;top:0;height:94px;
  background:var(--gallery-gradient);
  clip-path:polygon(0 0,100% 0,100% 47%,92% 47%,92% 76%,88% 76%,88% 47%,74% 47%,74% 94%,69% 94%,69% 47%,55% 47%,55% 70%,50% 70%,50% 47%,35% 47%,35% 86%,30% 86%,30% 47%,15% 47%,15% 74%,10% 74%,10% 47%,0 47%);
}
.gallery-promo-side-drip { position:absolute;background:var(--gallery-gradient);border-radius:999px; }
.gallery-promo-side-drip-one { width:14px;height:62px;left:17px;top:248px;transform:rotate(4deg); }
.gallery-promo-side-drip-two { width:12px;height:12px;right:19px;top:314px; }
.gallery-promo-copy {
  position:absolute;top:126px;left:28px;right:24px;
  display:flex;flex-direction:column;
  color:#31afff;
  font-family:"Segoe Script","Brush Script MT",cursive;
  font-size:47px;line-height:.98;text-align:center;
  transform:rotate(-9deg);
  text-shadow:0 0 16px rgba(44,177,255,.14);
}
.gallery-promo-button { left:18px !important;right:18px !important;bottom:28px !important;height:54px !important;border-radius:13px !important;font-size:15px !important; }
.gallery-promo-bottom-paint { position:absolute;right:22px;bottom:-22px;width:11px;height:40px;border-radius:0 0 12px 12px;background:#20baff; }

/* FEED DESKTOP */
@media (min-width:1163px) {
  .gallery-feed-page { width:895px;min-height:calc(100vh - 160px); }
  .feed-wide-wrap { width:895px;display:grid !important;grid-template-columns:594px 285px;gap:16px;align-items:start; }
  .feed-main-col { width:594px !important;max-width:594px !important;min-width:594px !important; }
  .feed-right-col { width:285px !important;min-width:285px !important;display:flex !important; }

  .gallery-stories-card { min-height:165px;padding:13px 15px 14px;margin:0 0 15px;border-radius:17px; }
  .gallery-composer { margin:0 0 14px;padding:18px 18px 15px;border-radius:17px; }
  .gallery-post { margin:0 0 14px;border-radius:17px;overflow:hidden; }
  .gallery-post-head { min-height:70px;padding:13px 16px; }
  .gallery-art-button { display:block;width:100%;padding:0 18px; }
  .gallery-post-art { width:100%;max-height:560px;object-fit:cover;border-radius:8px !important; }
  .gallery-post-footer { padding:13px 16px 17px; }
  .gallery-tags { margin-top:10px; }
}

/* FEED MOBILE */
@media (max-width:767px) {
  body:has(.gallery-feed-page) .main-layout {
    width:100% !important;
    max-width:none !important;
    margin:0 !important;
    padding-top:112px !important;
    padding-bottom:94px !important;
  }
  body:has(.gallery-feed-page) .main-layout > footer { display:none !important; }

  .gallery-feed-mobile-topnav {
    display:flex !important;
    height:112px !important;
    padding:0 14px 0 17px !important;
    align-items:center !important;
    justify-content:space-between !important;
    border:0 !important;
    background:var(--gallery-bg) !important;
    overflow:visible !important;
    isolation:isolate;
  }
  .gallery-mobile-header-paint-code { position:absolute!important;inset:0!important;z-index:0!important;pointer-events:none; }
  .gallery-mobile-header-paint-code svg { width:100%!important;height:112px!important;display:block;overflow:visible; }

  .gallery-feed-page { width:100%;padding:12px 12px 8px; }
  .feed-wide-wrap,.feed-main-col { width:100%!important;max-width:none!important;display:block!important; }
  .gallery-right-rail,.feed-right-col { display:none!important; }

  .gallery-stories-card {
    margin:0 0 14px!important;
    min-height:122px!important;
    padding:14px 14px 12px!important;
    border:1px solid transparent!important;
    border-radius:18px!important;
    background:linear-gradient(#0b0c16,#0b0c16) padding-box,var(--gallery-gradient) border-box!important;
  }
  .gallery-stories-heading { display:none!important; }
  .gallery-composer { display:none!important; }

  .gallery-post {
    margin:0 0 16px!important;
    border:1px solid transparent!important;
    border-radius:18px!important;
    background:linear-gradient(#0b0c16,#0b0c16) padding-box,var(--gallery-gradient) border-box!important;
    overflow:hidden!important;
    box-shadow:0 12px 34px rgba(0,0,0,.24);
  }
  .gallery-post-head { min-height:68px!important;padding:12px 14px 9px!important;grid-template-columns:46px 1fr auto!important;gap:11px!important; }
  .gallery-author-avatar { width:46px!important;height:46px!important; }
  .gallery-author-name { font-family:"Playfair Display",Georgia,serif!important;font-size:17px!important;line-height:1.08!important; }
  .gallery-post-art { width:100%!important;max-height:none!important;object-fit:cover!important;border-radius:13px!important; }
  .gallery-post-footer { padding:12px 14px 14px!important; }
  .gallery-engagement { gap:27px!important; }

  .gallery-feed-mobile-bottomnav {
    left:16px!important;
    right:16px!important;
    bottom:12px!important;
    height:68px!important;
    padding:8px 20px!important;
    border:1px solid transparent!important;
    border-radius:34px!important;
    background:linear-gradient(#0d0d18,#0d0d18) padding-box,var(--gallery-gradient) border-box!important;
    box-shadow:0 14px 38px rgba(0,0,0,.46)!important;
  }
  .gallery-feed-mobile-bottomnav > a { transform:scale(1.03)!important; }
  .gallery-feed-mobile-bottomnav > a:nth-child(3) { width:48px!important;height:48px!important;border-radius:13px!important;background:var(--gallery-gradient)!important;font-size:27px!important; }
}

/* Tablet fallback: use existing mobile nav */
@media (min-width:768px) and (max-width:1162px) {
  .gallery-shell-sidebar { display:none!important; }
  .mobile-topnav { display:flex !important; }
  .mobile-bottomnav { display:flex !important; }
  .gallery-desktop-header { display:none !important; }
  .main-layout {
    max-width: 720px !important;
    width: calc(100% - 40px) !important;
    margin: 0 auto !important;
    padding-top: 62px !important;
    padding-bottom: 86px !important;
  }
}

/* Desktop feed: only center column scrolls */
@media (min-width:1163px) {
  body:has(.gallery-feed-page) {
    overflow: hidden;
    height: 100vh;
  }
  body:has(.gallery-feed-page) .main-layout {
    overflow: hidden !important;
    height: calc(100vh - 160px) !important;
    min-height: unset !important;
  }
  .feed-main-col {
    height: calc(100vh - 160px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #3d3354 transparent;
  }
  .feed-right-col {
    height: calc(100vh - 160px);
    overflow-y: auto;
    scrollbar-width: none;
  }
  .feed-right-col::-webkit-scrollbar { display: none; }
}
```

---

### `components/GalleryDesktopSidebar.tsx` — Desktop Left Sidebar
```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"

type NavIcon = "home" | "explore" | "shop" | "commissions" | "notifications" | "messages" | "dashboard" | "profile"

function Icon({ type }: { type: NavIcon }) {
  const props = { width: 25, height: 25, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  if (type === "home") return <svg {...props}><path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-7h6v7"/></svg>
  if (type === "explore") return <svg {...props}><circle cx="11" cy="11" r="7.5"/><path d="m20 20-3.7-3.7"/></svg>
  if (type === "shop") return <svg {...props}><path d="M5 8h14l-1 13H6z"/><path d="M8 8a4 4 0 0 1 8 0"/></svg>
  if (type === "commissions") return <svg {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
  if (type === "notifications") return <svg {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9"/><path d="M10 21h4"/></svg>
  if (type === "messages") return <svg {...props}><path d="M4 5h16v12H8l-4 3z"/></svg>
  if (type === "dashboard") return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.8 3.4-7 8-7s7.2 2.2 8 7"/></svg>
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data: notifications } = trpc.notification.getAll.useQuery()
  const markAllRead = trpc.notification.markAllRead.useMutation()
  const utils = trpc.useUtils()
  const router = useRouter()

  useEffect(() => {
    markAllRead.mutate(undefined, { onSuccess: () => utils.notification.unreadCount.invalidate() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function textFor(n: NonNullable<typeof notifications>[number]) {
    if (n.message) return n.message
    const type = n.type.split(":")[0]
    const labels: Record<string, string> = {
      follow: "started following you",
      dm: "sent you a message",
      commission_request: "sent you a commission request",
      commission_accepted: "accepted your commission request",
      commission_declined: "declined your commission request",
      ban: "Your account has been suspended.",
      lift_ban: "Your account suspension has been lifted.",
      post_removed_tos: "A post was removed for violating our Terms of Service.",
      appeal_approved: "Your appeal has been approved.",
      appeal_denied: "Your appeal has been denied.",
      site_notice: "A message from the Gallery team.",
    }
    return labels[type ?? ""] ?? n.type
  }

  function linkFor(n: NonNullable<typeof notifications>[number]) {
    if (!n.fromUser) return null
    if (n.type === "follow") return `/@${n.fromUser.username}`
    const [prefix, id] = n.type.split(":")
    if (prefix === "dm") return `/messages/${id}`
    if (id) return `/professional-dms/${id}`
    return null
  }

  return (
    <div className="gallery-shell-notification-panel">
      <div className="gallery-shell-notification-head"><strong>Notifications</strong><button onClick={onClose}>×</button></div>
      <div className="gallery-shell-notification-list">
        {!notifications?.length ? <p>No notifications yet</p> : notifications.map(n => {
          const link = linkFor(n)
          return (
            <button key={n.id} className={!n.read ? "is-unread" : ""} onClick={() => { onClose(); if (link) router.push(link) }}>
              {n.fromUser ? <Avatar src={n.fromUser.image} name={n.fromUser.name} username={n.fromUser.username} size={34} /> : <span className="gallery-system-avatar">G</span>}
              <span><b>{n.fromUser ? `@${n.fromUser.username}` : "Gallery"}</b> {textFor(n)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function GalleryDesktopSidebar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)
  const { data: unread } = trpc.notification.unreadCount.useQuery(undefined, { enabled: status === "authenticated", refetchInterval: 30000 })
  const { data: dmUnread } = trpc.dm.getUnreadCount.useQuery(undefined, { enabled: status === "authenticated", refetchInterval: 30000 })

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setNotificationsOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  if (status !== "authenticated") return null
  const username = session?.user?.username ?? ""
  const profileHref = username ? `/@${username}` : "/"
  const itemClass = (active: boolean) => `gallery-shell-nav-item${active ? " is-active" : ""}`

  return (
    <aside className="gallery-shell-sidebar desktop-sidenav" aria-label="Gallery navigation">
      <nav className="gallery-shell-nav-list">
        <Link href="/" className={itemClass(pathname === "/")}><Icon type="home"/><span>Feed</span></Link>
        <Link href="/shop" className={itemClass(pathname.startsWith("/shop"))}><Icon type="shop"/><span>Shop</span></Link>
        <Link href="/commissions" className={itemClass(pathname.startsWith("/commissions"))}><Icon type="commissions"/><span>Commissions</span></Link>
        <Link href="/search" className={itemClass(pathname.startsWith("/search"))}><Icon type="explore"/><span>Explore</span></Link>

        <div ref={notificationRef} className="gallery-shell-notification-wrap">
          <button type="button" className={itemClass(notificationsOpen)} onClick={() => setNotificationsOpen(v => !v)}>
            <span className="gallery-shell-icon-wrap"><Icon type="notifications"/>{!!unread?.count && <i>{unread.count > 9 ? "9+" : unread.count}</i>}</span>
            <span>Notifications</span>
          </button>
          {notificationsOpen && <NotificationPanel onClose={() => setNotificationsOpen(false)} />}
        </div>

        <Link href="/messages" className={itemClass(pathname.startsWith("/messages"))}>
          <span className="gallery-shell-icon-wrap"><Icon type="messages"/>{!!dmUnread?.count && <i>{dmUnread.count > 9 ? "9+" : dmUnread.count}</i>}</span>
          <span>Messages</span>
        </Link>
        <Link href="/professional-profile" className={itemClass(pathname.startsWith("/professional-profile"))}><Icon type="dashboard"/><span>Dashboard</span></Link>
        <Link href={profileHref} className={itemClass(!!username && pathname.startsWith(`/@${username}`))}><Icon type="profile"/><span>Profile</span></Link>

        <div className="gallery-shell-nav-divider" />
        <Link href={profileHref} className="gallery-shell-create-post"><span>＋</span>Create Post</Link>
      </nav>
    </aside>
  )
}
```

---

### `components/GalleryRightRail.tsx` — Right Rail
```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { trpc } from "@/components/providers"

type Variant = "combined" | "split"

function FollowButton({ username }: { username: string | null }) {
  const [following, setFollowing] = useState(false)
  const follow = trpc.follow.follow.useMutation({ onSuccess: () => setFollowing(true) })
  if (!username) return null
  return (
    <button
      type="button"
      className={`gallery-follow${following ? " is-following" : ""}`}
      disabled={following || follow.isPending}
      onClick={() => follow.mutate({ username })}
    >
      {following ? "Following" : follow.isPending ? "…" : "Follow"}
    </button>
  )
}

export function GalleryPromoCard() {
  return (
    <section className="gallery-card gallery-promo-card" aria-label="Create something">
      <div className="gallery-promo-paint" aria-hidden="true" />
      <div className="gallery-promo-side-drip gallery-promo-side-drip-one" aria-hidden="true" />
      <div className="gallery-promo-side-drip gallery-promo-side-drip-two" aria-hidden="true" />
      <div className="gallery-promo-copy"><span>Anyone</span><span>can be</span><span>an artist!</span></div>
      <Link href="/professional-profile" className="gallery-promo-button">Create Something <span>›</span></Link>
      <div className="gallery-promo-bottom-paint" aria-hidden="true" />
    </section>
  )
}

export default function GalleryRightRail({ variant = "combined", showPromo = true }: { variant?: Variant; showPromo?: boolean }) {
  const { data: suggested } = trpc.discovery.risingStars.useQuery({ limit: 5 })
  const { data: trending } = trpc.discovery.trendingTags.useQuery({ limit: 6 })

  const suggestedBlock = (
    <>
      <div className="gallery-section-title"><h2>{variant === "split" ? "Suggested Artists" : "Suggested"}</h2><Link href="/search?filter=rising-stars">See All</Link></div>
      <div className="gallery-suggested-list">
        {(suggested?.items ?? []).slice(0, 5).map(artist => (
          <div className="gallery-suggested-person" key={artist.id}>
            <Link href={artist.username ? `/@${artist.username}` : "#"} className="gallery-suggested-avatar-link">
              {artist.image ? <img src={artist.image} alt="" /> : <span className="gallery-suggested-avatar">{(artist.name ?? artist.username ?? "?")[0]?.toUpperCase()}</span>}
            </Link>
            <Link href={artist.username ? `/@${artist.username}` : "#"} className="gallery-suggested-meta"><b>{artist.name ?? artist.username}</b><span>@{artist.username}</span></Link>
            <FollowButton username={artist.username} />
          </div>
        ))}
        {!suggested?.items?.length && <p className="gallery-right-empty">No suggestions yet</p>}
      </div>
    </>
  )

  const trendingBlock = (
    <>
      <div className="gallery-section-title gallery-trending-head"><h2>{variant === "split" ? "Trending Tags" : "Trending"}</h2>{variant === "split" && <Link href="/search">See All</Link>}</div>
      <div className="gallery-trending-list">
        {(trending?.items ?? []).map(item => (
          <Link key={item.tag} href={`/search?q=${encodeURIComponent(item.tag)}`} className="gallery-trend">
            <span>{item.tag.startsWith("#") ? item.tag : `#${item.tag}`}</span>
            <em>{item.count >= 1000 ? `${(item.count / 1000).toFixed(item.count >= 10000 ? 0 : 1)}k` : item.count}</em>
          </Link>
        ))}
        {!trending?.items?.length && <p className="gallery-right-empty">Trending tags will appear here.</p>}
      </div>
    </>
  )

  return (
    <aside className="gallery-right-rail">
      {variant === "combined" ? (
        <section className="gallery-card gallery-discovery gallery-right-combined">
          {suggestedBlock}
          <div className="gallery-right-rule" />
          {trendingBlock}
        </section>
      ) : (
        <>
          <section className="gallery-card gallery-discovery gallery-explore-suggested">{suggestedBlock}</section>
          <section className="gallery-card gallery-discovery gallery-explore-trends">{trendingBlock}</section>
        </>
      )}
      {showPromo && <GalleryPromoCard />}
    </aside>
  )
}
```

---

## Key File Locations

```
gallery/
├── app/
│   ├── gallery-final.css          ← Main Gallery CSS (IMPORTANT)
│   ├── gallery-feed.css           ← Feed/explore/shop CSS
│   ├── globals.css                ← Global styles
│   ├── layout.tsx                 ← Root layout — loads fonts, providers
│   ├── page.tsx                   ← Feed/home page
│   ├── search/page.tsx            ← Search/explore page
│   ├── shop/page.tsx              ← Shop browse page
│   └── commissions/page.tsx       ← Commission browse
├── components/
│   ├── Navbar.tsx                 ← Top nav + mobile header + Gallery desktop header
│   ├── BottomNav.tsx              ← Mobile bottom bar + old desktop side nav
│   ├── GalleryDesktopSidebar.tsx  ← NEW desktop left sidebar (226px)
│   ├── GalleryRightRail.tsx       ← NEW right rail (285px)
│   ├── FeaturedArtistsStrip.tsx   ← Stories row component
│   └── providers.tsx              ← tRPC + React Query providers
├── server/routers/
│   ├── _app.ts                    ← tRPC root router
│   ├── post.ts, shop.ts, commission.ts, follow.ts, discovery.ts
│   └── notification.ts, dm.ts
├── lib/
│   ├── ai-scan.ts                 ← AI moderation (OpenRouter LLM)
│   └── trpc.ts                    ← tRPC setup
├── prisma/schema.prisma           ← Full DB schema
└── public/
    ├── header-drip-top.png        ← Paint drip header asset
    └── header-drip-bottom.png     ← Paint drip header asset
```

## How `isGalleryShell` Works

In **both** `Navbar.tsx` (line 146) and `BottomNav.tsx` (line 166):
```tsx
const isFeedHome = pathname === "/"
const isGalleryShell = isFeedHome || pathname.startsWith("/search") || pathname.startsWith("/shop")
```

When `isGalleryShell = true`:
- `Navbar.tsx` renders the 160px paint-drip desktop header
- `BottomNav.tsx` renders `<GalleryDesktopSidebar />` instead of the old narrow icon sidebar
- The feed mobile bottom nav gets a gradient pill style

When `isGalleryShell = false`:
- Desktop shows the old narrow 62px icon sidebar
- Mobile shows the standard top nav with logo

---

## How to Run

```bash
cd gallery
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
# → http://localhost:3000
```

Delete `.next/` if you get 404s on all routes and restart.

---

## Immediate First Steps for Codex

1. **Install local PostgreSQL** and set `DATABASE_URL` in `.env.local` (see Database Setup above)
2. **Commit all uncommitted files:**
   ```bash
   git add app/gallery-final.css app/gallery-feed.css components/GalleryDesktopSidebar.tsx components/GalleryRightRail.tsx public/header-drip-top.png public/header-drip-bottom.png app/page.tsx app/search/page.tsx app/shop/page.tsx components/Navbar.tsx components/BottomNav.tsx components/FeaturedArtistsStrip.tsx components/StoriesRow.tsx app/globals.css app/layout.tsx lib/watermark.ts server/routers/auth.ts package.json
   git commit -m "feat: gallery visual redesign — shell, sidebar, right rail, feed/explore/shop desktop+mobile"
   ```
3. **Fix the Follow button bug** in `components/GalleryRightRail.tsx` — the `FollowButton` has `type="button"` which is correct, but the parent `gallery-suggested-person` grid row likely has a `Link` that overlaps the button hitbox. Add `position: relative; z-index: 1` to `.gallery-follow` in the CSS, or add `e.preventDefault()` / `e.stopPropagation()` if needed.
4. **Verify the site renders correctly** at `http://localhost:3000` — feed desktop, feed mobile, /search, /shop

---

## Security Constraints (Non-Negotiable)

- Commission reference photos and DM delivery attachments are **NOT auto-scanned** — private context, report-only
- **Do NOT add Stripe keys to Vercel** until actively working on payments
- **NEXTAUTH_SECRET must be set in Vercel** before going live (currently not done)
- Everything stays in localhost until explicitly told to move to Vercel

---

## Full Source: `components/Navbar.tsx` — Top Nav / Gallery Header (350 lines)

```tsx
"use client"

import { useSession, signOut } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { trpc } from "@/components/providers"
import Link from "next/link"
import Avatar from "@/components/Avatar"

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data: notifications } = trpc.notification.getAll.useQuery()
  const markAllRead = trpc.notification.markAllRead.useMutation()
  const utils = trpc.useUtils()
  const router = useRouter()

  useEffect(() => {
    markAllRead.mutate(undefined, {
      onSuccess: () => utils.notification.unreadCount.invalidate(),
    })
  }, [])

  return (
    <div className="absolute top-12 right-0 w-72 rounded-2xl shadow-lg overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Notifications</p>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {!notifications || notifications.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--muted)" }}>No notifications yet</p>
        ) : (
          notifications.map((n) => {
            const isSystem = n.fromUserId === null || n.fromUser === null

            function getNotificationLink(): string | null {
              if (isSystem) return null
              if (n.type === "follow") return `/@${n.fromUser!.username}`
              const [prefix, id] = n.type.split(":")
              if (prefix === "dm") return `/messages/${id}`
              return `/professional-dms/${id}`
            }
            function getNotificationText(): string {
              if (n.message) return n.message
              const prefix = n.type.split(":")[0]
              const map: Record<string, string> = {
                follow: "started following you",
                dm: "sent you a message",
                commission_request: "sent you a commission request",
                commission_message: "sent you a message",
                commission_accepted: "accepted your commission request",
                commission_declined: "declined your commission request",
                commission_cancelled: "cancelled their commission",
                commission_paid: "confirmed payment for their commission",
                commission_delivered: "delivered your commission",
                commission_complete: "confirmed commission receipt",
                commission_deadline_set: "set a deadline for your commission",
                commission_deadline_updated: "updated the commission deadline",
                commission_deadline_approaching: "commission deadline is approaching",
                ban: "Your account has been suspended.",
                lift_ban: "Your account suspension has been lifted.",
                post_deleted: "A post was removed from your account.",
                post_removed_tos: "A post was removed for violating our Terms of Service.",
                post_removed_dmca: "A post was removed following a DMCA copyright claim.",
                post_removed_moderator: "A post was removed following a moderation review.",
                post_auto_removed: "A post was automatically removed after 14 days in pending review.",
                post_pending_review: "One of your posts has been flagged and is under review.",
                appeal_approved: "Your appeal has been approved.",
                appeal_denied: "Your appeal has been denied.",
                strike_reversed: "A moderation action has been reversed.",
                site_notice: n.message ?? "A message from the Gallery team.",
              }
              return map[prefix] ?? n.type
            }

            const link = getNotificationLink()
            const isRemoval = ["post_removed_tos", "post_removed_moderator", "post_auto_removed"].includes(n.type)

            return (
              <button
                key={n.id}
                onClick={() => { onClose(); if (link) router.push(link) }}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                style={{ background: !n.read ? "rgba(120,75,160,0.1)" : "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = !n.read ? "rgba(120,75,160,0.1)" : "transparent")}
              >
                {isSystem ? (
                  <div className="flex-shrink-0 flex items-center justify-center text-white font-bold text-base"
                    style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)" }}>
                    🛡
                  </div>
                ) : (
                  <Avatar src={n.fromUser!.image} name={n.fromUser!.name} username={n.fromUser!.username} size={32} />
                )}
                <p className="text-sm" style={{ color: "var(--text)" }}>
                  <span className="font-semibold">{isSystem ? "Gallery" : `@${n.fromUser!.username}`}</span>{" "}
                  {getNotificationText()}
                  {isRemoval && (
                    <> · <Link href="/appeal" className="text-violet-400 underline" onClick={e => e.stopPropagation()}>Appeal →</Link></>
                  )}
                </p>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export default function Navbar() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [notifOpen, setNotifOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const desktopNotifRef = useRef<HTMLDivElement>(null)

  const { data: unread } = trpc.notification.unreadCount.useQuery(undefined, {
    enabled: status === "authenticated",
    refetchInterval: 30000,
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      const insideMobile = notifRef.current?.contains(target) ?? false
      const insideDesktop = desktopNotifRef.current?.contains(target) ?? false
      if (!insideMobile && !insideDesktop) setNotifOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  if (status === "loading" || status === "unauthenticated") return null

  const username = session?.user?.username
  const isFeedHome = pathname === "/"
  // KEY: which pages show the Gallery shell (desktop header + new sidebar)
  const isGalleryShell = isFeedHome || pathname.startsWith("/search") || pathname.startsWith("/shop")

  return (
    <>
      {/* Slide-out menu — always present, all routes */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 70, width: 240, background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
            {/* ... slide-out menu content ... */}
          </div>
        </>
      )}

      {/* Gallery desktop header — 160px, paint drip, shown when isGalleryShell */}
      {isGalleryShell && (
        <header className="gallery-desktop-header" aria-label="Gallery header">
          <div className="gallery-desktop-header-inner">
            <div className="gallery-header-paint-code" aria-hidden="true" />
            <div className="gallery-header-actions">
              <div ref={desktopNotifRef} style={{ position: 'relative' }}>
                <button className="gallery-round-button" onClick={() => setNotifOpen(v => !v)} aria-label="Notifications">
                  <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10 21h4"/></svg>
                  {unread && unread.count > 0 && <span className="gallery-notification-badge">{unread.count > 9 ? '9+' : unread.count}</span>}
                </button>
                {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
              </div>
              <Link href={username ? `/@${username}` : '/'} className="gallery-profile-circle" aria-label="Profile">
                {session?.user?.image ? <img src={session.user.image} alt="" /> : (session?.user?.name ?? username ?? 'G').slice(0, 2).toUpperCase()}
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* Mobile top nav — shown on mobile only (CSS hides on desktop) */}
      {isFeedHome ? (
        // Feed home: full paint-drip mobile header with inline SVG
        <div className="top-nav mobile-topnav gallery-feed-mobile-topnav">
          {/* ... paint drip SVG + Gallery brand + mobile action buttons ... */}
        </div>
      ) : (
        // Other pages: compact mobile nav with logo
        <div className="top-nav mobile-topnav" style={{ background: "var(--nav)", borderBottom: "1px solid var(--border)", /* ... */ }}>
          {/* ... logo + notification + search + menu buttons ... */}
        </div>
      )}
    </>
  )
}
```

> **Note for Codex:** The actual file at `components/Navbar.tsx` has the full inline SVG paint drip and all menu content. The snippet above shows the key structure — specifically `isGalleryShell` (line 146) and the conditional `{isGalleryShell && <header className="gallery-desktop-header">}` block. Don't truncate the real file when editing — always read it first with the Read tool.

---

## Full Source: `components/BottomNav.tsx` — Mobile Bottom Bar + Sidebar Toggle (422 lines)

```tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Link from "next/link"
import Avatar from "@/components/Avatar"
import GalleryDesktopSidebar from "@/components/GalleryDesktopSidebar"

// ... DesktopNotifPanel (used by old narrow sidebar), SideItem component ...

export default function BottomNav() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  // ...state, queries...

  const isFeedHome = pathname === "/"
  // KEY: same pattern as Navbar.tsx — must stay in sync
  const isGalleryShell = isFeedHome || pathname.startsWith("/search") || pathname.startsWith("/shop")

  return (
    <>
      {/* NEW Gallery sidebar — shown on gallery shell pages */}
      {isGalleryShell && <GalleryDesktopSidebar />}

      {/* OLD narrow 62px icon sidebar — shown on all OTHER pages */}
      {!isGalleryShell && (
        <nav className="desktop-sidenav" style={{ width: 62, /* ... */ }}>
          {/* ... icon-only nav items ... */}
        </nav>
      )}

      {/* Desktop slide-out menu — shown when hamburger clicked */}
      {menuOpen && ( /* ... */ )}

      {/* Mobile bottom bar — always shown on mobile */}
      <nav className={`mobile-bottomnav${isFeedHome ? " gallery-feed-mobile-bottomnav" : ""}`}
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, /* ... */ }}>
        {/* Home | Search | + (create) | Messages | Profile */}
      </nav>
    </>
  )
}
```

> **Note for Codex:** The critical logic is at line 166: `const isGalleryShell = isFeedHome || pathname.startsWith("/search") || pathname.startsWith("/shop")` and line 180: `{isGalleryShell && <GalleryDesktopSidebar />}`. When extending the shell to new pages, update this condition AND the same condition in `Navbar.tsx` line 146. Always read the real file before editing.

---

## GitHub Workflow

The remote is `origin` on GitHub. Branch is `master`.

```bash
# Check what's uncommitted
git status

# Stage specific files (never git add -A blindly — check for .env or secrets first)
git add app/gallery-final.css app/gallery-feed.css components/GalleryDesktopSidebar.tsx components/GalleryRightRail.tsx

# Commit
git commit -m "feat: description of what you built"

# Push to GitHub
git push origin master

# See recent commits
git log --oneline -10

# See full diff of uncommitted changes
git diff

# Create a branch for bigger features
git checkout -b feature/my-feature-name
# ... make changes ...
git push origin feature/my-feature-name
# Create PR on GitHub: https://github.com/GavrielTeller/gallery
```

**Never commit `.env` or `.env.local`** — they contain secrets. These are already in `.gitignore`.

**Never push to Vercel** — this is all localhost dev. Auto-deploy from `master` branch is live on Vercel but all NEW work stays local until the user says to move it.

---

## tRPC Pattern (Reference)

Most data operations go through tRPC. The pattern is:

```tsx
// In a client component:
import { trpc } from "@/components/providers"

// Query
const { data, isLoading } = trpc.discovery.risingStars.useQuery({ limit: 5 })

// Mutation
const follow = trpc.follow.follow.useMutation({ onSuccess: () => refetch() })
follow.mutate({ username: "someuser" })

// Router location: server/routers/<name>.ts
// Root router: server/routers/_app.ts
```

tRPC routes: `post`, `shop`, `commission`, `follow`, `discovery`, `notification`, `dm`, `auth`, `admin`, `user`, `upload`

---

## Environment Variables (`.env.local`)

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/gallery
NEXTAUTH_SECRET=<any random string for dev>
NEXTAUTH_URL=http://localhost:3000
CLOUDINARY_CLOUD_NAME=<your cloudinary>
CLOUDINARY_API_KEY=<your cloudinary key>
CLOUDINARY_API_SECRET=<your cloudinary secret>
UPLOADTHING_SECRET=<uploadthing>
UPLOADTHING_APP_ID=<uploadthing>
OPENROUTER_API_KEY=<openrouter — for AI moderation>
```

Don't add Stripe keys until actively working on payments.
