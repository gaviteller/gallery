# Safety & Moderation — Remaining Features Design

Date: 2026-05-27

---

## Already Built (Do Not Rebuild)

The following Safety & Moderation items are complete and should not be touched:

- Report button on home feed (`app/page.tsx`) and profile page (`app/[username]/page.tsx`)
- `ReportModal` component (`components/ReportModal.tsx`)
- `post.report` tRPC procedure: 3 distinct reports → `PENDING_REVIEW` + `post_pending_review` notification
- `PostStatus` enum: `PUBLISHED`, `PENDING_REVIEW`, `REMOVED`
- Post fields: `status`, `pendingAt`, `flagReason`, `reportCount`
- 14-day auto-removal cron job (`app/api/cron/pending-expiry/route.ts`)
- In-app notifications: `post_pending_review`, `post_auto_removed`
- gallery-admin Reports Queue page (`app/reports/page.tsx`, `app/reports/[postId]/page.tsx`)
- gallery-admin Pending Content page (`app/pending/page.tsx`)
- `Appeal` model, `submitAppeal` tRPC procedure, `/appeal` page (for strikes)

---

## What We're Building

Two new features:

1. **Auto-watermark** — `Gallery | @username` burned diagonally into artwork at upload time
2. **Post removal appeals** — users can appeal REMOVED posts; admins review in gallery-admin

Email notifications are deferred (no email service in this project yet).

---

## Part 1: Auto-Watermark

### Goal

Every post image gets `Gallery | @username` burned in as a diagonal, semi-transparent watermark before the base64 is stored to the database.

### Implementation

**New file: `lib/watermark.ts`**

```ts
/**
 * Draws "Gallery | @username" diagonally across the center of the image.
 * Returns a new JPEG base64 data URL with the watermark burned in.
 */
export function applyWatermark(dataUrl: string, username: string): Promise<string>
```

- Creates an `Image`, loads the dataUrl
- Creates an offscreen `<canvas>` at the image's natural dimensions
- Draws the image at full size
- Translates to center, rotates -45°
- Draws `Gallery | @${username}` in bold white, `globalAlpha = 0.28`, `shadowColor = rgba(0,0,0,0.7)`, `shadowBlur = 8`
- Font size = `Math.floor(width * 0.072)` (scales with image)
- Returns `canvas.toDataURL("image/jpeg", 0.9)`

**Modify: `app/[username]/page.tsx`**

In the Share button's `onClick`, before calling `createPost.mutate`:

```ts
const watermarked = await applyWatermark(uploadImage!, session.user.username ?? "gallery")
createPost.mutate({ image: watermarked, ... })
```

Add a `isWatermarking` state flag to show "Posting…" during the async step and prevent double-submit.

### Testing

File: `tests/watermark.test.ts`
- Uses `// @vitest-environment jsdom` docblock
- Tests:
  1. `applyWatermark` returns a string starting with `data:image/jpeg`
  2. Result is different from the input (watermark was applied)
  3. Returns a valid data URL when given a tiny 1×1 pixel PNG

---

## Part 2: Post Removal Appeals

### Goal

When a post is REMOVED (by moderator action or 14-day auto-expiry), the post owner can submit an appeal. Gallery-admin moderators see the appeal in the existing Appeals queue and can approve (restore the post) or deny it.

### Schema Changes (`prisma/schema.prisma`)

Add `postId` to the `Appeal` model:

```prisma
model Appeal {
  // ... existing fields ...
  postId  String?
  post    Post?   @relation(fields: [postId], references: [id], onDelete: SetNull)
}
```

Add `appeals` relation to `Post`:

```prisma
model Post {
  // ... existing fields ...
  appeals Appeal[]
}
```

Constraint: `strikeId`, `dmcaRequestId`, and `postId` are all optional, but at least one must be set (enforced in tRPC, not at DB level).

### gallery (user-facing) tRPC Changes

**`server/routers/user.ts`**

New query: `getMyRemovedPosts`

```ts
getMyRemovedPosts: protectedProcedure.query(async ({ ctx }) => {
  return ctx.prisma.post.findMany({
    where: { userId: ctx.session.user.id, status: "REMOVED" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, image: true, updatedAt: true, flagReason: true },
  })
})
```

Update `submitAppeal` input schema:

```ts
z.object({
  strikeId: z.string().optional(),
  postId:   z.string().optional(),
  text:     z.string().min(10).max(2000),
}).refine(d => d.strikeId || d.postId, { message: "Must appeal a strike or a post." })
```

Additional guards when `postId` is provided:
- Post must exist and `userId === callerId` — throw `FORBIDDEN` otherwise
- Post `status` must be `"REMOVED"` — throw `BAD_REQUEST` if not
- No existing PENDING appeal for the same post from this user — throw `CONFLICT` if duplicate

`getMyAppeals` — currently selects `{ id, status, text, createdAt, reviewedAt }`. Add `postId: true, strikeId: true` to the select so the appeal page can render "Already appealed" badges on removed posts.

### gallery Appeal Page Changes (`app/appeal/page.tsx`)

Add new state: `selectedPostId: string | undefined`

Add a new section below the strikes list: **"Your removed posts"**

```
If you have removed posts, they appear here. Select one to appeal its removal.

[post thumbnail]  Removed on Jan 5 · Reason: Community reports
```

- Thumbnail: small image, border highlight when selected
- Shows removal date + `flagReason`
- Selecting a post clears any selected strike (mutually exclusive selection)

Submit logic:
- If `selectedPostId` set: `submitAppeal.mutate({ postId: selectedPostId, text })`
- If `selectedStrikeId` set: `submitAppeal.mutate({ strikeId: selectedStrikeId, text })`

Empty state: if no removed posts, section is not shown.

Already-appealed posts: if a PENDING or APPROVED appeal exists for the post, show "Already appealed" badge (non-clickable).

### gallery-admin Changes

**`server/routers/admin.ts`**

Update `approveAppeal`:

```ts
// After existing strike reversal logic:
if (appeal.postId) {
  await tx.post.update({
    where: { id: appeal.postId },
    data: {
      status: "PUBLISHED",
      pendingAt: null,
      flagReason: null,
      reportCount: 0,
    },
  })
}
```

Update `getAppeal` include to add `post`:

```ts
include: {
  user: { select: { id, username, bannedUntil, banReason, receivedStrikes: ... } },
  strike: true,
  post: { select: { id: true, image: true, status: true, flagReason: true } },
}
```

Update `listAppeals` include to expose `postId` and `strikeId` (already returned via full appeal row — verify select includes them).

**`app/appeals/page.tsx`** (gallery-admin)

- Show badge "Strike Appeal" or "Post Removal Appeal" alongside each appeal row
- If `appeal.postId` is set, show a small post thumbnail (40×40px) next to the username

**`app/appeals/[id]/page.tsx`** (gallery-admin)

- If `appeal.post` is present, show a post preview card:
  - Image thumbnail (100×100px)
  - Current status badge (REMOVED / PUBLISHED)
  - Flag reason
- Approve button logic unchanged (backend handles the post restore)

---

## Testing

### gallery project

- `tests/watermark.test.ts` — watermark utility (jsdom environment)
- `tests/post-appeal.test.ts` — DB-level: submit appeal for removed post, duplicate prevention, wrong-owner guard, non-removed post guard

### gallery-admin project

- No new tests needed (approve/deny procedures already have coverage via the strike appeal flow; the `postId` branch is additive)

---

## Error Handling

| Scenario | Response |
|---|---|
| `applyWatermark` image fails to load | Reject promise — upload fails with "Image processing error" |
| Appeal submitted for non-REMOVED post | `BAD_REQUEST`: "This post is not removed." |
| Appeal submitted for post owned by another user | `FORBIDDEN` |
| Duplicate post appeal | `CONFLICT`: "You already have a pending appeal for this post." |
| Admin approves post appeal but post was already restored | No-op (idempotent update) |

---

## Out of Scope

- Email notifications (deferred — no email service configured)
- Watermark toggle per-user or per-post
- Watermark on existing posts (only new uploads going forward)
