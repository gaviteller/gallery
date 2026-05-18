# Gallery Visual Identity Redesign — Design Spec
**Date:** 2026-05-18
**Status:** Approved

---

## 1. Goal

Make Gallery look and feel unmistakably like its own product — not an Instagram clone. The redesign keeps all existing functionality intact and changes only visual presentation. The target feel is a **friendly artist marketplace** where every creator feels like a shop owner, not a social media user.

---

## 2. Design Principles

| Principle | What it means in practice |
|---|---|
| **Dark background is the signature** | `#0D0D0F` everywhere. Don't dilute it with white or light surfaces. |
| **Gradient is the accent** | Pink→purple→cyan gradient on buttons, badges, active states, avatar rings. Never overwhelming. |
| **Artists are shops** | Every post header reads as a shop identity, not just a username. |
| **Cards, not feeds** | Posts have visible borders and breathing room. Not full-bleed edge-to-edge. |

---

## 3. Token Changes (Global)

These apply everywhere in the app via `globals.css` and shared components.

### 3.1 Avatar rings
All avatars across the app get a subtle gradient ring — always, not just when a story is active. Story ring gets a thicker/brighter version to distinguish it.

- **Default ring:** 1.5px gradient border at 40% opacity
- **Has unviewed story:** 2.5px gradient border at 100% opacity
- **Viewed story:** 1.5px white/25% ring

### 3.2 Card borders
All content cards (posts, shop items, commission cards) get:
- `border: 1px solid rgba(255,255,255,0.08)`
- `border-radius: 16px`
- `background: #141414` (slightly lifted from page bg)

### 3.3 Typography
Add a display font for headings (artist names on profiles, section titles). Use `Space Grotesk` from Google Fonts (weights: 400, 600, 700) — geometric, modern, feels designed not default. Body text stays Inter.

---

## 4. Feed Page (`app/page.tsx`)

### 4.1 Replace StoriesRow with FeaturedArtistsStrip

The circular Instagram-clone stories bubbles are replaced with a horizontal "Featured Artists" strip. Each bubble becomes a **rectangular art preview card** showing:
- Top 56px: artist's active story image if they have one, otherwise their avatar image (or gradient initial fallback)
- Artist's `@username` below
- Gradient ring only if they have an active story (clicking opens StoryViewer)
- Own card always first, shows "+" if no story

This is implemented as a rename/replacement of `StoriesRow` → `FeaturedArtistsStrip`. The underlying data (`story.getFeed`) stays the same.

**Card dimensions:** 64px wide × 80px tall. Rounded corners 10px. Image fills top 56px, username in bottom 24px.

### 4.2 Feed post cards

Each post changes from a full-bleed scroll item to an explicit card:

**Before (Instagram style):**
```
[edge-to-edge post, no border, no radius]
  avatar | @username · 2h
  [full width image, no margins]
  ♥ 142  💬 18
  @username caption text
```

**After (Gallery style):**
```
[card: bg #141414, border rgba(255,255,255,0.08), radius 16px, mx-3 my-2]
  [avatar with gradient ring] | Shop Name · Specialty  [Commission badge?]
                                @username · 2h
  [image, radius 12px, overflow hidden]
  [artwork title if present]
  ♥ 142  💬 18  [Share]
```

Key differences:
- Card has `mx-3` margin so it floats off the edge
- Avatar always has the subtle gradient ring
- Post header shows **two lines**: top line = artist's display name + specialty badge; second line = @username + timestamp
- If the artist has commissions open: a small `Commission open ↗` gradient-text badge in the header (right side)
- Artwork title (`post.title`) shown below image if present, in `Space Grotesk` 13px semibold
- Like/comment bar unchanged functionally, slightly refined visually

### 4.3 Commission open badge
A small badge in the post header. Fetching commission status on every feed post is expensive — instead, surface it only if `post.user` already has `commissionStatus` included in the feed query. Add `commissionStatus` to the `getFeed` user select.

Badge: `text-xs font-semibold` with gradient text, only shown when `commissionStatus === "OPEN" || "LIMITED"`.

---

## 5. Profile Page (`app/[username]/page.tsx`)

### 5.1 Banner header
Add a banner image slot above the avatar. The banner is a wide strip (height: 120px mobile, 160px desktop) behind the avatar area.

- If the user has set a `bannerImage` (new field, see §7): show it
- If no banner: show a gradient mesh using the brand colors (`linear-gradient(135deg, #1a0535 0%, #0d1a35 50%, #0a1a20 100%)`) — always looks intentional, never blank

The avatar sits half-overlapping the banner bottom edge (negative margin -40px).

### 5.2 Artist identity block
Below the avatar, the profile header becomes more shop-like:

```
[banner image or gradient]
        [avatar, overlapping bottom of banner]
  ARTIST NAME (Space Grotesk, 22px, bold)
  @username
  412 posts  ·  8.2k followers  ·  [Commission open badge if status is OPEN or LIMITED]
  [Follow button]  [Message button]
```

Artist name in Space Grotesk displays name (not username) prominently. Username is secondary.

### 5.3 Tab bar
Tabs stay (Posts / Shop / Commissions / About) but styled as pill tabs instead of underline tabs:
- Active: gradient background pill, white text
- Inactive: transparent, white/40 text

### 5.4 Profile grid
Post grid unchanged in structure (3-column). Each cell gets `border-radius: 4px` and `gap: 2px` (tighter, more curated feel vs Instagram's no-gap).

### 5.5 "Add story" button
Existing "Add story" text link below avatar is replaced with a small gradient-bordered pill button: `+ Story`.

---

## 6. New User Data: `bannerImage`

Add `bannerImage String? @db.Text` to the `User` model in Prisma. Artists can upload a banner from their Settings or Artist Dashboard page. This is a simple base64 image field (same pattern as profile image).

Migration: `20260518010000_add_banner_image`

Settings page gets a "Profile banner" upload section alongside the existing avatar upload.

---

## 7. Components Affected

| Component / File | Change |
|---|---|
| `components/StoriesRow.tsx` | Rename to `FeaturedArtistsStrip.tsx`, change bubble shape to rectangular cards |
| `app/page.tsx` | Import FeaturedArtistsStrip, update post card markup |
| `app/[username]/page.tsx` | Add banner, Space Grotesk, pill tabs, avatar ring |
| `components/Avatar.tsx` | Always show gradient ring at default opacity |
| `app/globals.css` | Add Space Grotesk import, card border token |
| `server/routers/post.ts` | Add `commissionStatus` to getFeed user select |
| `prisma/schema.prisma` | Add `bannerImage` to User |
| `app/settings/page.tsx` | Add banner image upload |

---

## 8. What Is NOT in This Spec

- Redesigning the commissions browse page (`/commissions`) — separate task
- Redesigning the messages UI
- New color palette — existing brand colors stay exactly the same
- Mobile bottom nav redesign
- Dark/light mode toggle
- Changing any functionality — all interactions stay identical
