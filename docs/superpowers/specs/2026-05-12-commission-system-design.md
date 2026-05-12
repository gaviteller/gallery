# Commission System Design

**Date:** 2026-05-12  
**Status:** Approved

---

## Overview

A commission system for Gallery that lets buyers discover artists, submit requests, negotiate over a professional chat thread, and complete transactions. Payments are simulated for this phase — Stripe integration comes later.

---

## 1. Commission Discovery Feed

**Location:** Commissions tab in the bottom navigation bar.

**What it shows:** A scrollable feed of all artists whose commission status is OPEN or LIMITED. Initial sort order is newest-first (no preference algorithm yet — that comes later when real user data exists).

**Artist card layout:**
- Top area: grid/collage of the artist's example commission photos (posts where `isCommission: true`, up to 4–6 images)
- Bottom bar:
  - Left: artist name + Follow button
  - Right: average price + Request Commission button

**Interactions:**
- Tapping the card body → navigates to the artist's profile with the Commissions tab pre-selected (`/username?tab=commissions`)
- Tapping "Follow" → follows the artist without leaving the feed
- Tapping "Request Commission" → opens the request form modal for that artist

**Search:**
A search bar at the top of the feed. Users can search/filter by:
- Artist name / username
- Art style (matched against the artist's configured dropdown options)
- Price range (min/max filter against the artist's average price)

---

## 2. Commission Request Form

**Trigger:** "Request Commission" button on the discovery card or at the top of an artist's Commissions profile tab.

**Presentation:** A modal that slides up over the current screen.

**Fields (all mandatory except reference photos):**

1. **Description** — free text, mandatory. Prompt: "Describe what you want."
2. **Artist-defined dropdowns** — one or more dropdown menus configured by the artist in their Professional Profile (e.g. Art Style, Commission Type, Size). All dropdowns are mandatory.
3. **Reference photos** — optional image upload, multiple photos allowed.

**On submit:**
- Validates all mandatory fields are filled.
- Creates a `Commission` record in the database with status `PENDING`.
- Opens a Professional DM thread for this commission.
- Sends a notification to the artist.
- Closes the modal and shows a confirmation message to the buyer.

---

## 3. Professional DM Thread

**Access:** Hamburger menu → "Professional DMs" — shows a list of all the user's active commission threads (both as buyer and as artist).

**Thread structure:**
- A pinned header at the top showing the original commission request: description, dropdown selections, and reference photos.
- Below: a real-time chat between buyer and artist.
- Action buttons that change based on the current commission status.

**Commission lifecycle and thread states:**

| Status | Who acts | Available actions |
|---|---|---|
| PENDING | Artist | Accept (+ set price) or Decline |
| ACCEPTED | Buyer | Pay (simulated — one click confirms payment) |
| IN_PROGRESS | Artist | Upload final file to mark as Delivered |
| DELIVERED | Buyer | Confirm receipt (releases escrow) |
| COMPLETE | — | Thread is closed, read-only |
| DECLINED | — | Thread closed |
| CANCELLED | — | Thread closed |

**Auto-release:** If the buyer does not confirm within 5 days of the artist marking delivery, escrow is automatically released and the thread closes. (Implemented via a timestamp check — a background job or on-request check compares `deliveredAt` against current time.)

**Price negotiation:** After the artist accepts, they set a price in the thread. The buyer must confirm the price before "paying." If the buyer disagrees, they can message back to negotiate — the artist can update the price as many times as needed before the buyer confirms.

**Thread closure:** Once status reaches COMPLETE, DECLINED, or CANCELLED, the thread becomes read-only. No new messages can be sent.

---

## 4. Professional Profile (Artist Dashboard)

**Access:** Hamburger menu → "Professional Profile". Visible to all users but edit controls only shown to the profile owner.

**Two sections:**

### Commission Settings
- **Status** — OPEN / LIMITED / CLOSED (dropdown). Displayed on the artist's profile and discovery card.
- **Description** — free text. What the artist offers, their terms, any notes for buyers.
- **Turnaround time** — free text or structured (e.g. "1–2 weeks").
- **Price ranges** — a list of entries: commission type label + price (e.g. "Bust — $30", "Full body — $80"). Artist can add/remove entries. The average of these prices is used as the displayed average price on the discovery card.
- **Custom dropdown options** — artist defines one or more dropdown categories, each with a name and a list of options. Example: category "Art Style" with options ["Anime", "Realistic", "Chibi"]. These appear as mandatory dropdowns on the buyer's request form.

### Business Overview (read-only, owner only)
- Money currently held in escrow (sum of IN_PROGRESS commission amounts)
- Total earned (sum of all COMPLETE commission amounts)
- Artist rating (average of all buyer ratings received — shown once 10+ commissions complete)
- Active commissions count (commissions in PENDING, ACCEPTED, IN_PROGRESS, or DELIVERED state)

*Note: Additional fields will be added here when the Shop system is built.*

---

## 5. Data Models

### Commission
```
id                String   (cuid)
buyerId           String   → User
artistId          String   → User
status            CommissionRequestStatus (PENDING | ACCEPTED | IN_PROGRESS | DELIVERED | COMPLETE | DECLINED | CANCELLED)
description       String   (buyer's brief)
dropdownSelections Json    (map of category name → selected option)
referencePhotos   String[] (array of base64 or URLs)
agreedPrice       Float?   (set when artist accepts)
deliveredAt       DateTime? (when artist marks delivered)
createdAt         DateTime
updatedAt         DateTime
```

### CommissionDropdownCategory
```
id        String   (cuid)
userId    String   → User (the artist)
name      String   (e.g. "Art Style")
options   String[] (e.g. ["Anime", "Realistic", "Chibi"])
order     Int      (display order on the request form)
```

### ProfessionalMessage
```
id           String   (cuid)
commissionId String   → Commission
senderId     String   → User
text         String?
fileUrl      String?  (for delivered work file or reference photo)
createdAt    DateTime
```

### CommissionRequestStatus enum (new — separate from existing CommissionStatus on User)
```
PENDING | ACCEPTED | IN_PROGRESS | DELIVERED | COMPLETE | DECLINED | CANCELLED
```
The existing `CommissionStatus` enum (OPEN / LIMITED / CLOSED) remains on the `User` model unchanged — it controls whether an artist is accepting new requests. `CommissionRequestStatus` is a new enum that tracks the lifecycle of an individual commission request.

---

## 6. What Is NOT in This Phase

- Real Stripe payments (simulated only)
- Preference-based discovery feed algorithm
- Buyer ratings of artists (data model ready, UI deferred)
- Regular (social) DMs
- Shop integration in Professional Profile
