# Removal Transparency & Appeal Discoverability Design

**Date:** 2026-05-29

---

## Goal

Give users visibility into why their content was removed, a 15-day window to see and appeal it, and make the appeal flow easy to find.

## Architecture

Two new fields on `Post` (`removedAt`, `removalReason`) power the 15-day visibility window and reason display. No new status or cron jobs needed — the window is purely query-based. Appeal discoverability is improved through four touchpoints: email (existing), profile overlay, in-app notification, and nav.

## Tech Stack

Next.js App Router, tRPC v11, Prisma (PostgreSQL), Resend (email already wired)

---

## Schema Changes

Add to the `Post` model in `prisma/schema.prisma`:

```prisma
removedAt     DateTime?
removalReason String?
```

- `removedAt` — set to `now()` whenever a post transitions to `REMOVED` status (both manual admin removal and auto-removal cron)
- `removalReason` — user-facing explanation shown on profile and appeal page
- `flagReason` — unchanged, remains internal only

**Migration:** `prisma/migrations/YYYYMMDD_removal_transparency/migration.sql`

---

## Profile Page (Owner View)

**Query change (`post.getByUsername`):**
- Currently returns `PUBLISHED + PENDING_REVIEW` to owner
- Extend to also return `REMOVED` posts where `removedAt >= now - 15 days`, owner only
- Non-owners never see REMOVED posts

**UI (removed post card in profile grid):**
- Semi-transparent dark overlay on the image
- "Removed" badge in the top-right corner
- Clicking opens an inline detail view showing:
  - `removalReason` text
  - "Appeal →" button linking to `/appeal?postId=<id>`
- After 15 days from `removedAt`, post silently drops out of the query — no status change needed

---

## Appeal Page (`/appeal`)

**`getMyRemovedPosts` query change:**
- Currently returns all REMOVED posts for the user forever
- Limit to posts where `removedAt >= now - 15 days` (appeal window matches visibility window)
- Each removed post card shows `removalReason` below the thumbnail

**Pre-selection via URL param:**
- `/appeal?postId=<id>` pre-selects that post in the appeal form
- The "Appeal →" link from the profile page passes this param

---

## Appeal Discoverability

| Touchpoint | Change |
|---|---|
| Removal email | Already links to `/appeal` — no change |
| Profile page | "Appeal →" on removed post overlay (see above) |
| In-app notification | `post_removed` notification card gets an "Appeal →" link |
| Nav | "Appeals" link added to user dropdown menu |

---

## Admin Side

**Manual removal (gallery-admin):**
- `removalReason` input added to the remove post action (required)
- Saved to `Post.removalReason` on removal
- `Post.removedAt` set to `now()` at the same time

**Auto-removal cron (gallery-admin):**
- When transitioning post to REMOVED after 14 days in PENDING_REVIEW:
  - Set `Post.removedAt = now()`
  - Set `Post.removalReason = "This post was not resolved within the 14-day review period."`

---

## What This Does Not Change

- `flagReason` — still internal only, not shown to users
- DMCA removals — those hard-delete the post, no grace period applies
- Appeal rules — still one pending appeal at a time, min 20 chars
- Post status enum — no new statuses added
