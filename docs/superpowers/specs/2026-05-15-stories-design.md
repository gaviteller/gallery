# Stories — Design Spec
**Date:** 2026-05-15
**Updated:** 2026-05-18
**Status:** Approved

---

## 1. Overview

Instagram-style 24-hour disappearing stories. Images only. Stories appear in a horizontal row at the top of the feed page and as a gradient ring on avatars across the app. Users can add a story from both the feed row and their own profile page.

---

## 2. Data Model

### Story
```prisma
model Story {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  image     String   @db.Text
  createdAt DateTime @default(now())
  expiresAt DateTime

  views     StoryView[]
}
```

### StoryView
```prisma
model StoryView {
  id       String   @id @default(cuid())
  storyId  String
  story    Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)
  viewerId String
  viewer   User     @relation(fields: [viewerId], references: [id], onDelete: Cascade)
  viewedAt DateTime @default(now())

  @@unique([storyId, viewerId])
}
```

`expiresAt` is set to `createdAt + 24 hours` at creation time. All queries filter `expiresAt > now()`. Stories are not deleted — they simply stop appearing. A cleanup cron can be added later.

---

## 3. Backend (tRPC — `server/routers/story.ts`)

### `story.create`
- Protected
- Input: `{ image: z.string().min(1) }` (base64 data URL, max ~7MB string)
- Sets `expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)`
- Returns the created story

### `story.getFeed`
- Protected
- No input
- Returns active stories (`expiresAt > now`) from: the current user + everyone they follow
- Grouped by user: `{ userId, username, name, image, stories: Story[], hasUnviewed: boolean }`
- `hasUnviewed` is true if any story in the group has no `StoryView` record for the current user
- Current user's group is **always first** in the list, even if they have no stories (so the row is never empty for logged-in users)

### `story.getByUsername`
- Public
- Input: `{ username: z.string() }`
- Returns active stories for that user only
- Used by the profile page to determine whether to show the ring

### `story.markViewed`
- Protected
- Input: `{ storyId: z.string() }`
- Upserts a `StoryView` record (uses `@@unique` constraint — safe to call multiple times)

Register `storyRouter` in `server/routers/_app.ts`.

---

## 4. Frontend

### 4.1 StoriesRow component (`components/StoriesRow.tsx`)

A horizontally scrollable row of avatar bubbles. Rendered at the top of the feed page, above the post list. **Always visible** — at minimum shows the logged-in user's own bubble with a "+" icon.

**Each bubble:**
- Gradient ring if the user has at least one active story (`hasUnviewed` → bright gradient; all viewed → muted ring)
- Own avatar with no story: "+" icon overlay
- Own avatar with active story: gradient ring, tap → opens `StoryViewer`
- Other users: tap → opens `StoryViewer`

**Own avatar is always first.**

### 4.2 StoryViewer component (`components/StoryViewer.tsx`)

Full-screen dark overlay triggered when a user taps a story bubble.

- Image fills the screen (`object-cover`)
- Username + avatar + "X hours ago" at the top
- Close button top-right
- Calls `story.markViewed` on open
- **Auto-advances** after **10 seconds** per story
- **Progress bars** at the top: one bar per story, the active one fills left-to-right over 10 seconds
- Tap right side of screen → advance immediately to next story (or close if last)
- Tap left side → go back to previous story (or do nothing if first)
- When the last story ends → closes the viewer

### 4.3 StoryUpload component (`components/StoryUpload.tsx`)

Modal triggered from two places (see 4.4 and 4.5).

- File picker (`<input type="file" accept="image/*">`)
- On pick: compress to JPEG at 800px max dimension, convert to base64 (same pattern as existing card image uploads in `app/professional-profile/page.tsx`)
- Preview of selected image
- "Share story" button → calls `story.create` → closes modal → invalidates `story.getFeed`
- Cancel button

### 4.4 Feed page (`app/page.tsx`)

Add `<StoriesRow />` above the post feed. The `StoriesRow` renders own avatar:
- No active story → "+" overlay → tap opens `StoryUpload`
- Active story → gradient ring → tap opens `StoryViewer`

### 4.5 Profile page (`app/[username]/page.tsx`)

- Avatar gets a gradient ring when `getByUsername` returns at least one active story
- **On own profile:** tapping the avatar always opens `StoryUpload` (to add another story or start one)
- **On other profiles:** tapping the avatar opens `StoryViewer` if they have an active story
- On own profile: "Add story" text button below the avatar

---

## 5. Image Handling

Same pattern as existing profile card image uploads:
- Client-side resize to max 800px using `<canvas>`
- Convert to JPEG base64 data URL
- Store in `Story.image` as `@db.Text`
- No external storage required

---

## 6. Behaviour Decisions

| Question | Decision |
|---|---|
| Auto-advance? | Yes — 10 seconds per story |
| Progress indicator | Filling bar per story (not just dots) |
| Stories row when user has no stories | Always visible — shows own "+" bubble |
| Own feed bubble with active story | Tap → opens viewer |
| Own profile avatar with active story | Tap → opens upload |
| Last story ends | Closes viewer |

---

## 7. What Is NOT in This Spec

- Video stories
- Story replies (replying via DM)
- Links to shop listings or commission requests from stories
- Story deletion UI (stories expire automatically)
- Cleanup cron to purge expired stories from the database
- "Seen by" viewer list
- Pause on tap-and-hold
