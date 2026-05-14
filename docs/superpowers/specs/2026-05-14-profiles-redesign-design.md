# Profile Redesign — Design Spec
**Date:** 2026-05-14
**Status:** Approved

---

## 1. Overview

Redesign artist profile pages to add a Commissions tab, an About tab, pinned posts, mutual follower counts, and move the commission status badge out of the header into the About tab.

---

## 2. Tab Structure

Four tabs: **Posts, Shop, Commissions, About.**

**Your own profile:** All four tabs are always visible regardless of status or listings.

**Someone else's profile:**
- Commissions tab is hidden if their commission status is CLOSED
- Shop tab is hidden if they have no active listings
- Posts and About tabs are always visible

---

## 3. Profile Header

**Current:** Avatar, name, username, commission status badge, follow/message/request buttons.

**New:** Avatar, name, username, follower count, following count, follow/message/request buttons. Commission status badge moves to the About tab.

**Mutual followers (on other people's profiles only):**
- Shows a tappable count: e.g. "4 mutual followers"
- Tapping opens a modal listing each mutual follower's avatar and username
- Not shown on your own profile

---

## 4. Posts Tab

Same grid layout as today. Artists can pin up to 3 posts — pinned posts float to the top of the grid.

**Pin indicator:** A small pin icon overlaid on the image, visible **only to the post owner**. Visitors see no indicator — pinned posts just appear at the top silently.

**Pin controls:** Owner sees a pin/unpin option when viewing their own post (e.g. via the existing post options menu).

---

## 5. Commissions Tab

Hidden on other profiles when the artist's commission status is CLOSED.

**Top card:**
- Trust Score (shown after 10 completed commissions, otherwise shows "New Artist")
- Commission description
- Turnaround time
- Price ranges
- Request Commission button

**Below the card — completed work gallery:**
A photo gallery of real completed commission examples. Two sources:
1. **Automatic:** Commissions that have reached COMPLETE status where the buyer checked "allow artist to display this work"
2. **Manual:** Photos the artist uploads themselves from their Artist Dashboard

Photos display in a grid. Tapping one opens it full screen.

---

## 6. About Tab

**Commission status badge:** Open / Limited / Closed — moved here from the profile header.

**Bio:** Full bio text (same field as today, just displayed here).

**Social links:** Twitter, Instagram, ArtStation, website — displayed as tappable links. Only links the user has filled in are shown.

---

## 7. Shop Tab

Unchanged from current implementation.

---

## 8. Data Requirements

### New fields needed
- `Post.pinned Boolean @default(false)` — whether the post is pinned
- `Commission.displayAsExample Boolean @default(false)` — buyer's permission to show this work publicly
- `User.exampleCommissionPhotos String[] @default([])` — manually uploaded example photos by the artist

### New queries needed
- Mutual followers count + list for a given profile
- Completed commissions where `displayAsExample: true` for a given artist
- Pinned posts (sorted to top of grid)

---

## 9. What Is NOT in This Spec

- Shop tab redesign (deferred)
- Trust Score calculation (covered in Trust & Reputation spec)
- Editing bio / social links (already exists in Settings)
- Artist Dashboard changes for uploading example commission photos (covered in implementation plan)
