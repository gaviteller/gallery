# Content Moderation Queue — Design Spec

*Date: 2026-05-25*
*Status: Approved*

---

## Overview

A three-layer content moderation system per ToS §7.1: AI scan on upload, community reports, and account enforcement. This spec covers the data model, gallery UI, and gallery-admin UI for all three subsystems. The gallery-admin panel lives in the separate `gallery-admin` repo at `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin`.

---

## Subsystem A: Community Reports

### Schema additions — `gallery/prisma/schema.prisma`

Add to the `Post` model:

```prisma
reportCount Int      @default(0)  // denormalised count; incremented on each new Report row
reports     Report[]
```

New models and enums:

```prisma
model Report {
  id         String       @id @default(cuid())
  postId     String
  post       Post         @relation(fields: [postId], references: [id], onDelete: Cascade)
  reporterId String
  reporter   User         @relation("SubmittedReports", fields: [reporterId], references: [id], onDelete: Cascade)
  reason     ReportReason
  notes      String?      @db.Text
  status     ReportStatus @default(PENDING)
  createdAt  DateTime     @default(now())
  reviewedAt DateTime?

  @@unique([postId, reporterId])
  @@index([postId])
  @@index([status])
}

enum ReportReason {
  SPAM
  HARASSMENT
  HATE_SPEECH
  GORE
  CSAM
  COPYRIGHT
  UNLABELLED_AI
  OTHER
}

enum ReportStatus {
  PENDING
  REVIEWED_REMOVED
  REVIEWED_KEPT
}
```

Add to `User`:

```prisma
submittedReports Report[] @relation("SubmittedReports")
```

### Auto-flag threshold

When a `post.report` mutation runs and the resulting `reportCount` reaches 3 from distinct accounts, the procedure sets `post.status = PENDING_REVIEW` and `post.pendingAt = now()` in the same transaction (see Subsystem B). Admins see the post in the Pending queue; no real-time notification is sent to the admin.

### tRPC procedure — `post.report`

- **Location:** `src/server/api/routers/post.ts`
- **Type:** `protectedProcedure`
- **Input:** `z.object({ postId: z.string(), reason: z.nativeEnum(ReportReason), notes: z.string().max(500).optional() })`
- **Logic:**
  1. Verify the post exists and the caller is not the post owner (users cannot report their own posts).
  2. Create the `Report` row (DB unique constraint on `[postId, reporterId]` will throw if already reported; surface this as a user-friendly error).
  3. Increment `post.reportCount` atomically with `increment: 1`.
  4. If `post.reportCount >= 3` and `post.status = PUBLISHED`, set `post.status = PENDING_REVIEW`, `post.pendingAt = now()`, `post.flagReason = "Reached community report threshold"`.
  5. Return `{ success: true }`.
- **Name:** `post.report`

### Gallery UI — Report button

**Location:** post card component used in the feed (`src/components/PostCard.tsx`) and profile grid.

- Render a small "⚑ Report" button in the post card action area, visible to all authenticated users who do not own the post.
- Clicking opens a modal (`src/components/ReportModal.tsx`):
  - Reason dropdown with human-readable labels mapping to `ReportReason` enum values:
    - `SPAM` → "Spam"
    - `HARASSMENT` → "Harassment"
    - `HATE_SPEECH` → "Hate Speech"
    - `GORE` → "Gore / Graphic Violence"
    - `CSAM` → "Child Safety"
    - `COPYRIGHT` → "Copyright Violation"
    - `UNLABELLED_AI` → "Unlabelled AI-Generated Content"
    - `OTHER` → "Other"
  - Optional notes textarea (max 500 characters).
  - "Submit Report" button — calls `api.post.report.useMutation()`.
- After a successful submit: modal closes, button label changes to "Reported" and is disabled. This state is determined at load time by including `viewerHasReported: Boolean` on the post query response.
- If the user has already reported (DB unique constraint error or `viewerHasReported = true`): show toast "You have already reported this post."

### gallery-admin — Reports queue

**File:** `app/reports/page.tsx` (in `gallery-admin` repo)

- Lists all posts that have at least one `PENDING` report, sorted by `reportCount` descending (most-reported first).
- Each row displays: post thumbnail, poster @username, `reportCount`, most frequent `ReportReason` among the post's reports, date of first report.
- Clicking a row navigates to a detail view (`app/reports/[postId]/page.tsx`):
  - Shows the post image at full size.
  - Table of all reports for the post: reporter @username, reason (human-readable), notes, date.
  - Two action buttons:
    - **"Remove Post"** — hard-deletes the post, sends a notification to the post owner ("Your post was removed for violating our Terms of Service."), sets all `Report.status = REVIEWED_REMOVED` for this post.
    - **"Keep Post"** — dismisses all reports (sets `Report.status = REVIEWED_KEPT`), resets `post.reportCount = 0`, leaves `post.status = PUBLISHED`.
- **Nav:** Add a "Reports" link to `AdminLayout` between "Posts" and "Appeals".

---

## Subsystem B: Content Pending State

### Schema additions — `gallery/prisma/schema.prisma`

Add to the `Post` model:

```prisma
status      PostStatus @default(PUBLISHED)
pendingAt   DateTime?  // timestamp when the post entered PENDING_REVIEW
flagReason  String?    // human-readable reason shown to the owner
```

New enum:

```prisma
enum PostStatus {
  PUBLISHED
  PENDING_REVIEW
  REMOVED
}
```

### How content enters `PENDING_REVIEW`

Two entry paths:

1. **AI scan on upload** — The `post.create` procedure calls an AI moderation service after saving the image. If the service returns a flag, the procedure sets `status = PENDING_REVIEW`, `pendingAt = now()`, `flagReason = "<AI flag reason>"` on the newly created post in the same transaction.
2. **Report threshold** — The `post.report` procedure sets `status = PENDING_REVIEW`, `pendingAt = now()`, `flagReason = "Reached community report threshold"` when `reportCount` reaches 3 (see Subsystem A).

### User-facing visibility rules

- `PENDING_REVIEW` posts are returned by feed and profile queries **only** when `post.userId = session.user.id`. All other users receive no indication the post exists.
- In the post owner's feed and profile grid, a `PENDING_REVIEW` post is rendered with a yellow "⚠ Under Review" badge overlaid on the thumbnail.
- The owner receives a push/in-app notification at the moment the post enters `PENDING_REVIEW`:
  - **Type:** `"post_pending_review"`
  - **Text:** "One of your posts is under review for a potential Terms of Service violation. You have 14 days to challenge or remove it."
  - The notification links to the post's detail page, which shows a "Challenge this decision" button linking to `/appeals/new?postId=<id>` and a "Remove post" button calling `post.delete`.

### Auto-removal cron job

**File:** `src/app/api/cron/pending-expiry/route.ts` (in `gallery` repo)

- `GET` handler, secured with a `CRON_SECRET` header check against `process.env.CRON_SECRET`.
- Runs daily (registered with the deployment platform's cron scheduler to `GET /api/cron/pending-expiry` every 24 hours).
- Query: all posts where `status = PENDING_REVIEW` AND `pendingAt < now() - 14 days`.
- For each matched post:
  1. Set `status = REMOVED`.
  2. Send notification to post owner:
     - **Type:** `"post_auto_removed"`
     - **Text:** "A post that was under review has been automatically removed after 14 days."
- Returns `{ removed: number }`.

### gallery-admin — Pending queue

**File:** `app/pending/page.tsx` (in `gallery-admin` repo)

- Lists all posts with `status = PENDING_REVIEW`, sorted by `pendingAt` ascending (soonest to expire first).
- Each row: post thumbnail, poster @username, `flagReason`, `pendingAt` date, days remaining until auto-removal (computed as `14 - daysSince(pendingAt)`, shown in red when ≤ 2 days).
- Two action buttons per row:
  - **"Remove Now"** — sets `post.status = REMOVED`, notifies post owner ("Your post has been removed by a moderator for violating our Terms of Service.").
  - **"Clear — Restore to Published"** — sets `post.status = PUBLISHED`, clears `pendingAt` and `flagReason`, resets `reportCount = 0`, dismisses all associated `PENDING` reports (sets `Report.status = REVIEWED_KEPT`).
- **Nav:** Add a "Pending" link to `AdminLayout` between "Posts" and "Reports".

---

## Subsystem C: DMCA Queue

### Schema additions — `gallery/prisma/schema.prisma`

```prisma
model DmcaRequest {
  id            String     @id @default(cuid())
  claimantName  String
  claimantEmail String
  postId        String?    // resolved post ID if known; null if only postUrl provided
  postUrl       String?    @db.Text
  description   String     @db.Text
  status        DmcaStatus @default(PENDING)
  createdAt     DateTime   @default(now())
  reviewedAt    DateTime?
  resolution    String?    @db.Text

  @@index([status])
  @@index([claimantEmail])
}

enum DmcaStatus {
  PENDING
  REMOVED        // post removed; counter-notice window open
  COUNTER_FILED  // post owner has filed a counter-notice via Appeal
  RESOLVED       // fully closed
  REJECTED       // no violation found
}
```

### Gallery UI — DMCA form

**File:** `src/app/dmca/page.tsx` (in `gallery` repo)

- Public page, no authentication required.
- Form fields:
  - Claimant name (required, text input)
  - Claimant email (required, email input)
  - Post URL or post ID (required, text input; label: "Link to the post you believe infringes your copyright")
  - Description of the copyright claim (required, textarea; label: "Describe your original work and how it is being infringed")
  - Submit button: "Submit DMCA Takedown Request"
- On submit:
  - tRPC mutation `dmca.submit` (public procedure) creates a `DmcaRequest` row.
  - If the provided URL matches a known post URL pattern (`/posts/<id>`), extract and store the `postId`; otherwise store only `postUrl`.
  - Show success message: "Your DMCA request has been received. We will respond within 14 days as required by law."
- **Footer link:** Add "DMCA / Copyright" link to the site footer pointing to `/dmca`.

### tRPC procedure — `dmca.submit`

- **Location:** `src/server/api/routers/dmca.ts`
- **Type:** `publicProcedure`
- **Input:**
  ```ts
  z.object({
    claimantName: z.string().min(1).max(200),
    claimantEmail: z.string().email(),
    postUrl: z.string().url(),
    description: z.string().min(50).max(5000),
  })
  ```
- **Logic:**
  1. Attempt to extract `postId` from `postUrl` using a regex match on `/posts/([a-z0-9]+)`.
  2. Create `DmcaRequest` row with resolved `postId` (or `null`) and the raw `postUrl`.
  3. Return `{ success: true }`.
- **Name:** `dmca.submit`

### gallery-admin — DMCA queue

**File:** `app/dmca/page.tsx` (in `gallery-admin` repo)

- Lists all `DmcaRequest` rows with `status = PENDING`, sorted by `createdAt` ascending (oldest first).
- Each row: claimant email, link to the post (using `postId` or `postUrl`), date filed, days since filed (shown in red when > 10 days to flag approaching 14-day deadline).
- Clicking a row opens the full detail view (`app/dmca/[id]/page.tsx`):
  - Shows claimant name, email, post link, full description, current status.
  - Action buttons:
    - **"Remove Post & Notify"** — hard-deletes the post, sets `DmcaRequest.status = REMOVED` and `reviewedAt = now()`, sends notification to the post owner: "Your post has been removed in response to a DMCA takedown request. You have the right to file a counter-notice if you believe this removal was in error. Visit [link to appeal page] to do so.", sends email confirmation to claimant.
    - **"Reject"** — sets `DmcaRequest.status = REJECTED` and `reviewedAt = now()`, records `resolution` text (required text area before confirming), sends email to claimant noting no violation was found.
  - If `status = REMOVED`: show a "Mark Counter-Notice Filed" button that sets `DmcaRequest.status = COUNTER_FILED` when the post owner has submitted an appeal referencing this takedown.

### Counter-notice flow

- When a post owner's appeal (`Appeal` model) is submitted and includes a DMCA counter-notice (indicated by a `dmcaRequestId` field on the appeal — add `dmcaRequestId String?` to `Appeal`), the admin reviewing the appeal can mark the linked `DmcaRequest.status = COUNTER_FILED` from the Appeals detail page.
- Add `dmcaRequestId String?` and `dmcaRequest DmcaRequest? @relation(fields: [dmcaRequestId], references: [id])` to the `Appeal` model. Add `appeals Appeal[]` to `DmcaRequest`.
- The counter-notice is then reviewed by the admin as part of the normal Appeals workflow (ToS §7.5: 5 business-day SLA, human reviewer separate from original decision).

### Three-strike DMCA ban warning

- When an admin views a user's profile in gallery-admin (`app/users/[id]/page.tsx`), compute the count of confirmed DMCA violations: `DmcaRequest` rows where `status IN (REMOVED, RESOLVED)` and `postId` belongs to this user.
- If count >= 3, display a prominent red warning banner: "This user has 3 or more confirmed DMCA violations. Consider issuing a permanent ban per ToS §9.6."
- This is a display-only warning; the ban itself is issued manually through the existing Strike/Ban system.

### Nav addition

Add a "DMCA" link to `AdminLayout` in gallery-admin, placed after "Appeals".

---

## Summary of File Changes

### gallery repo (`C:\Users\gavri\OneDrive\Documents\Projects\gallery`)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `PostStatus`, `ReportReason`, `ReportStatus`, `DmcaStatus` enums; add `Report`, `DmcaRequest` models; add `status`, `pendingAt`, `flagReason`, `reportCount`, `reports` to `Post`; add `submittedReports` to `User`; add `dmcaRequestId` to `Appeal` |
| `src/server/api/routers/post.ts` | Add `post.report` protectedProcedure; update feed/profile queries to filter by `status` |
| `src/server/api/routers/dmca.ts` | New router with `dmca.submit` publicProcedure |
| `src/app/api/cron/pending-expiry/route.ts` | New cron route handler for auto-removal |
| `src/app/dmca/page.tsx` | New public DMCA submission form page |
| `src/components/PostCard.tsx` | Add Report button and "Under Review" badge |
| `src/components/ReportModal.tsx` | New modal component for report submission |

### gallery-admin repo (`C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin`)

| File | Change |
|------|--------|
| `app/reports/page.tsx` | New reports queue page |
| `app/reports/[postId]/page.tsx` | New report detail page with Remove/Keep actions |
| `app/pending/page.tsx` | New pending content queue page |
| `app/dmca/page.tsx` | New DMCA queue page |
| `app/dmca/[id]/page.tsx` | New DMCA request detail page |
| `components/AdminLayout.tsx` | Add "Pending", "Reports", "DMCA" nav links |
| `app/users/[id]/page.tsx` | Add DMCA violation count warning banner |
