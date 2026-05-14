# Commission Completion Flow — Design Spec
**Date:** 2026-05-14
**Status:** Approved

---

## 1. Overview

When a commission reaches COMPLETE status, three sequential in-thread cards guide the buyer and artist through: rating the experience, granting display permission for the finished work, and optionally sharing that work to the artist's public feed.

---

## 2. New Schema Fields

All four fields are added to the `Commission` model:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `buyerRating` | `Int?` | `null` | 1–5 star rating from the buyer. Null until rated. |
| `displayAsExample` | `Boolean` | `false` | Buyer approved the artist to show this work publicly. |
| `displayPermissionAnswered` | `Boolean` | `false` | Buyer has responded to the display permission prompt (yes or no). Hides Card 2. |
| `artistFeedShareOffered` | `Boolean` | `false` | Artist has responded to the "share to feed?" prompt. Hides Card 3. |

---

## 3. The Three Cards

Cards appear inline in the commission thread (`app/professional-dms/[id]/page.tsx`), rendered below the message list. They are conditional — each card disappears once its action is taken.

### Card 1 — Rating (buyer only)

**Trigger:** `status === "COMPLETE"` AND `buyerRating === null` AND viewer is the buyer.

**UI:** Five tappable star icons. Tapping a star selects it (highlights 1–N). A "Submit rating" button confirms. No skip option — the card stays until rated.

**On submit:** Calls `commission.submitRating({ id, rating })`. Sets `buyerRating`. Card disappears. Card 2 immediately appears.

**Artist is not shown the raw score** — it feeds into the Trust Score calculation only.

---

### Card 2 — Display permission (buyer only)

**Trigger:** `status === "COMPLETE"` AND `buyerRating !== null` AND `displayPermissionAnswered === false` AND viewer is the buyer.

**UI:** Text: *"Can [artist username] display this work in their portfolio?"* with **Yes** and **No** buttons side by side.

**On Yes:** Calls `commission.setDisplayPermission({ id, allow: true })`. Sets `displayAsExample = true`, `displayPermissionAnswered = true`. Card disappears.

**On No:** Calls `commission.setDisplayPermission({ id, allow: false })`. Sets `displayPermissionAnswered = true`. Card disappears. No further action.

---

### Card 3 — Share to feed (artist only)

**Trigger:** `status === "COMPLETE"` AND `displayAsExample === true` AND `artistFeedShareOffered === false` AND viewer is the artist.

**UI:** Shows a thumbnail of the delivered image (from the most recent message with a `fileUrl`). Text: *"Your buyer approved this work for your portfolio! Want to also post it to your feed?"* with **Post to feed** and **Not now** buttons.

**On "Post to feed":** Calls `commission.shareToFeed({ id })`. Creates a `Post` with `image = fileUrl`, `isCommission = true`, `description = null`. Sets `artistFeedShareOffered = true`. Card disappears.

**On "Not now":** Calls `commission.dismissFeedShare({ id })`. Sets `artistFeedShareOffered = true`. Card disappears. Work is still in the Commissions tab gallery (because `displayAsExample` remains true).

---

## 4. Profile Commissions Tab Gallery

Currently the gallery shows `commissionCardImages` (manually uploaded by the artist via settings).

After this change, the gallery combines two sources:

1. **Manual uploads:** `commissionCardImages` from the artist's user record (existing).
2. **Approved commissions:** Commissions where `displayAsExample = true`, using the `fileUrl` from the delivered message.

The `commission.getProfile` query already returns `commissionCardImages`. A new query `commission.getApprovedWork({ username })` fetches approved commission images and returns them as `{ fileUrl, commissionId }[]`.

The profile page combines both lists into a single display grid: approved commission images first (sorted by `deliveredAt` descending), then manual uploads appended at the end. Tapping any image opens it full screen.

---

## 5. New tRPC Procedures

| Procedure | Who | What it does |
|-----------|-----|-------------|
| `commission.submitRating({ id, rating })` | Buyer | Sets `buyerRating` (1–5). Only callable once (errors if already rated). |
| `commission.setDisplayPermission({ id, allow })` | Buyer | Sets `displayAsExample` and `displayPermissionAnswered`. Only callable once. |
| `commission.shareToFeed({ id })` | Artist | Creates a Post from the delivered fileUrl. Sets `artistFeedShareOffered = true`. |
| `commission.dismissFeedShare({ id })` | Artist | Sets `artistFeedShareOffered = true` without creating a post. |
| `commission.getApprovedWork({ username })` | Public | Returns `{ fileUrl, commissionId }[]` for all approved commissions by this artist. |

---

## 6. What Is NOT in This Spec

- Displaying the average rating publicly (covered in Trust Score spec).
- The Trust Score calculation (separate spec).
- Artist being able to remove an approved work from their gallery (future).
- Buyer being able to change their rating after submission (not supported).
