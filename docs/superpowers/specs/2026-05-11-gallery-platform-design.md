# Gallery Platform — Full Design Spec
**Date:** 2026-05-11
**Status:** Complete — all core features designed

---

## 1. Overall Architecture

**Single Next.js monolith** deployed on Vercel. Clean internal boundaries so individual pieces can be extracted into separate services later.

### Folder Structure
- `/app` — all pages and UI (Next.js App Router)
- `/server` — tRPC routers, one per feature domain (auth, users, commissions, shop, feed, messages, moderation, ratings)
- `/db` — Prisma schema and client
- `/lib` — shared utilities (Stripe, Cloudflare R2, watermarking, Resend email, Pusher)
- `/jobs` — Vercel cron jobs for scheduled/automatic tasks

### External Services
| Service | Purpose |
|---|---|
| PostgreSQL (Neon/Supabase) | Main database |
| Cloudflare R2 | Image and file storage |
| Stripe Connect | Payments and escrow |
| Pusher | Realtime DMs |
| Resend | Email notifications |
| NextAuth.js | Auth (email, Google, Apple) |

---

## 2. Auth & Onboarding

- Sign up via **email, Google, or Apple**
- During onboarding, user is asked: *"Do you want to sell or take commissions?"*
- Selling features can be toggled on/off anytime from **Settings**
- No separate artist/buyer account types — everyone is a user

---

## 3. Commission System

### 3.1 Discovery

**Two entry points:**

1. **Artist profile** — commissions visible on their profile if they have it activated. Shows their commission status (Open / Limited / Closed) and examples.
2. **Commission tab** — dedicated browse page with:
   - Search bar (by name, style, medium, price)
   - Personalised feed based on who you follow + fast-rising accounts
   - **Rising Stars** section — highlights smaller/emerging creators
   - Multiple curated sections

### 3.2 Commission Screens

**Buyer screens:**
- Commission tab (browse/search)
- Artist profile (view commission info, request button)
- Request form (brief, budget, desired completion date — optional)
- Commission detail page (track status, pay, confirm delivery)

**Artist screens:**
- Incoming requests page
- Request detail (read brief, accept/decline, set price, set estimated timeline)
- Active commissions page
- Deliver button (mark as delivered)

**Shared:**
- Professional DM (attached to every commission)

### 3.3 Commission Data

Each commission stores:
- Buyer (user reference)
- Artist (user reference)
- Brief (description of request)
- Buyer's requested completion date (optional)
- Artist's estimated completion time (optional)
- Agreed price
- Status (see below)
- Stripe payment reference
- Delivered at timestamp
- Completed at timestamp

### 3.4 Commission Statuses

| Status | Meaning |
|---|---|
| `PENDING` | Request sent, waiting for artist to respond |
| `ACCEPTED` | Artist accepted, price set, waiting for buyer to pay |
| `PAID` | Buyer paid, money in escrow, work in progress |
| `DELIVERED` | Artist marked done, waiting for buyer to confirm |
| `COMPLETED` | Buyer confirmed or auto-released, money paid out |
| `CANCELLED` | Either side cancelled |
| `DISPUTED` | ToS violation raised, commission frozen |

### 3.5 Commission Flow

1. **Buyer submits request** — fills out brief, optionally sets a "done by" date → status: `PENDING` → artist notified
2. **Artist responds** — accepts (sets price, optionally sets estimated timeline) → status: `ACCEPTED` | declines → status: `CANCELLED`
   - If no response within **3 days** → auto-cancelled, buyer notified
   - Artist can adjust price at any point while `ACCEPTED` — buyer is notified and can cancel for free
3. **Buyer pays** — agrees to price → pays via Stripe → money held in escrow → status: `PAID`
4. **Work in progress** — artist works, both sides communicate via Professional DM
5. **Artist delivers** — marks as delivered → status: `DELIVERED` → buyer notified: *"Your commission is ready — confirm within 5 days"*
6. **Completion:**
   - Buyer confirms → escrow releases → status: `COMPLETED`
   - No response for 5 days → escrow auto-releases → status: `COMPLETED`
   - Buyer raises ToS violation → status: `DISPUTED`, commission frozen pending moderation
7. **Rating** — once `COMPLETED`, buyer is prompted to rate the artist

### 3.6 Cancellation Rules

**Before payment (`PENDING` or `ACCEPTED`):**
- Either side can cancel freely, no consequences
- If artist changes price → buyer can always cancel for free

**After payment (`PAID`):**
- Either side can *request* cancellation — both must agree for refund to be issued
- Artist cancels unilaterally → full refund to buyer + strike against artist
- Buyer cancels unilaterally → full refund to buyer + counts against trust score
- Buyer with 3+ total cancellations → visible on their profile so artists can decide accordingly

**After delivery (`DELIVERED` / `COMPLETED`):**
- No cancellations — only a ToS dispute if applicable

### 3.7 Artist Notifications (Commission-Specific)

- New commission request received
- Buyer has paid — work can begin
- *"You haven't messaged your client in 3 days — consider sending an update"*
- *"You have X commissions currently in progress"*
- Reminder if a commission has been `PAID` for a long time with no delivery
- Deadline approaching (buyer's requested date or artist's own estimate)
- Buyer confirmed delivery — payment released
- Commission auto-completed — payment released

### 3.8 Automated Jobs (Commission)

| Job | Trigger | Action |
|---|---|---|
| Auto-cancel unanswered requests | Daily check | Cancel `PENDING` commissions older than 3 days, notify buyer |
| Auto-release escrow | Daily check | Complete `DELIVERED` commissions older than 5 days, release funds |
| Deadline reminders | Daily check | Notify artist if deadline is approaching |

---

## 4. Premade Art Shop

### 4.1 Listing Types

- **Digital files** — downloadable art, any quantity, released immediately on purchase, no refunds after download
- **Physical pieces** — original art or prints, artist-shipped

### 4.2 Listing Fields

| Field | All Listings | Physical Only |
|---|---|---|
| Title | ✓ | |
| Description | ✓ | |
| Price | ✓ | |
| Type (digital/physical) | ✓ | |
| Quantity | ✓ | |
| Images | ✓ | |
| Tags (style, medium) | ✓ | |
| Dimensions | | ✓ |
| Weight | | ✓ |
| Shipping cost | | ✓ |

- Quantity counts down on each purchase and listing auto-closes at zero
- Artists can pause a listing without deleting it

### 4.3 Browse

- Global **Shop tab** on Gallery — browse all listings across the platform
- Personalised feed: based on follows + fast-rising accounts
- **Rising Stars** section surfaces emerging artists
- Search by name, style, medium, price
- Listings also visible on each **artist's profile** under their Shop tab

### 4.4 Buying

- Buyers add items to a **cart** (multiple items from different artists)
- Single checkout — one payment covers all cart items
- Escrow held per-artist, released independently per transaction
- Digital: file released immediately on payment
- Physical: artist ships with tracking number, 30-day confirmation window, then escrow releases

### 4.5 Artist Shop Management

- Create, edit, delete, or pause listings from dashboard
- Notified on each sale
- Notified when 30-day physical confirmation window triggers

### 4.6 Physical Delivery

- Artist must upload proof of shipping with tracking number
- After 30 days, Gallery asks buyer to confirm receipt
- Confirmed → escrow releases to artist
- Not received, artist has proof of shipping → shipping carrier's responsibility, Gallery mediates
- Not received, no proof → artist responsible, must offer replacement or refund

---

## 5. Artist Profiles

### 5.1 Header

- Avatar, name, username
- Short bio
- Follower count, following count, post count
- Commission status badge: **Open / Limited / Closed**
- Buttons: Follow, Message, Request Commission

### 5.2 Tabs

| Tab | Content |
|---|---|
| Posts | Instagram-style art grid, newest first. Artists can pin up to 3 posts to the top. |
| Shop | Their active shop listings |
| Commissions | Commission info, examples, pricing range, request button |
| About | Full bio, social links, mediums/styles, starting price, Trust Score and stats |

---

## 6. Feed & Stories

### 6.1 Stories
- Instagram-style stories bar at the top of the feed
- 24-hour disappearing stories
- Artists can post artwork, WIPs, updates
- Stories can link directly to a shop listing or commission request

### 6.2 Feed

- **Two tabs:** Following (posts from people you follow) and For You (personalised recommendations)
- For You tab powers Rising Stars discovery — surfaces fast-growing and emerging artists
- Posts are **images or videos only** — no text-only posts

---

## 7. Direct Messages

### 7.1 Basic DM
- Any user can message any other user by default
- Artists can restrict incoming DMs via Settings:
  - Everyone (default)
  - Followers only
  - Only people I follow
- Blocking available

### 7.2 Professional DM
- Automatically created and attached to every commission and shop order
- Always goes through regardless of the recipient's DM settings
- Auto-archives when the transaction completes

---

## 8. Social Features

- Follows, likes, comments, shares, tags
- Stories (see Section 6)
- Posts: images and videos only

---

## 9. Search

- Search bar searches across: **Artists, Posts, Shop Listings, Commissions**
- Results displayed on a **single page**, grouped by type (Artists → Posts → Shop → Commissions)
- Filter by: name, style, medium, price

---

## 10. Notifications

- Single unified notifications feed — all activity in one place
- Commission events (see Section 3.7)
- New messages
- Likes — batched (*"5 people liked your post"*)
- Follows — batched (*"3 new people followed you"*)
- Comments, shares, tags
- Sales and payment events

---

## 11. Work Protection

- **Screenshot blocking** across the platform
- **Auto-watermark** on all artwork: format `Gallery | @username`
- Watermark position: TBD during implementation

---

## 12. Content Moderation

**3-layer system:**
1. **AI scan on upload** — flags content automatically
2. **Community reports** — users can report posts
3. **Strike system** — see ToS Section 7 for full strike table

**Moderation flow:**
- AI flags content → status: **Pending** (only poster can see it, email notification sent)
- **2-week window** — poster can challenge or self-remove
- After 2 weeks → content auto-removed
- After removal — poster can still challenge, Gallery can restore if upheld

---

## 13. Ratings & Trust Score

- **Buyers rate artists** after a completed commission (one-directional)
- **Trust Score** is a composite of:
  - Average buyer rating
  - Cancellation rate
  - Selling-related strikes
- Displayed publicly on artist profile after 10 completed commissions
- Before 10 completions: shows "New Artist"

---

## 14. Physical Delivery (Shop)

- Artist must upload proof of shipping with tracking number
- After 30 days, Gallery asks buyer to confirm receipt
- Escrow releases or is reviewed based on response (see Section 4.6)

---

## Build Order

1. **Auth & accounts** — foundation everything else builds on
2. Commission system — core feature
3. Premade shop
4. Artist profiles
5. Feed & stories
6. DMs
7. Search & discovery
8. Notifications
9. Work protection
10. Content moderation
11. Ratings & trust score
