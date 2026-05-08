# Gallery Platform — Design Spec
**Date:** 2026-05-08  
**Status:** In Progress — Commission system complete, remaining features TBD

---

## 1. Overall Architecture

**Single Next.js monolith** deployed on Vercel. Clean internal boundaries so individual pieces can be extracted into separate services later as the platform grows.

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

*(To be designed — next session)*

---

## 5. Artist Profiles

*(To be designed — next session)*

---

## 6. Feed & Stories

*(To be designed — next session)*

---

## 7. Direct Messages

**Two types:**
- **Basic DM** — free chat between any users
- **Professional DM** — tied to a commission or sale, closes/archives once the transaction is complete

*(Full design — next session)*

---

## 8. Social Features

- Follows, likes, comments, shares, tags
- Stories (Instagram-style, shown at top of feed)
- Posts can be any content type — moderation handles what's off-topic or inappropriate

*(Full design — next session)*

---

## 9. Search

Search by: **name, style, medium, price**

*(Full design — next session)*

---

## 10. Notifications

- All commission events (see Section 3.7)
- New messages
- Likes — batched (*"5 people liked your post"*)
- Follows — batched (*"3 new people followed you"*)
- Comments, shares, tags

*(Full design — next session)*

---

## 11. Work Protection

- **Screenshot blocking** across the platform
- **Auto-watermark** on all artwork: format `"Gallery | @username"`

*(Full design — next session)*

---

## 12. Content Moderation

**3-layer system:**

1. **AI scan on upload** — flags content automatically
2. **Community reports** — users can report posts
3. **Strike system** — severity-based, categories TBD when ToS is written

**Moderation flow:**
- AI flags content → status: **Pending** (only poster can see it, email notification sent)
- **2-week window** — poster can challenge or self-remove
- After 2 weeks → content auto-removed
- After removal — poster can still challenge, Gallery can restore if upheld

*(Strike categories to be defined when ToS is written)*

---

## 13. Ratings & Trust Score

- **Buyers rate artists** after a completed commission (one-directional)
- **Trust score** is a composite of:
  - Average buyer rating
  - Cancellation rate
  - Selling-related strikes

*(Full design — next session)*

---

## 14. Physical Delivery (Premade Shop)

- Artist must upload **proof of shipping with tracking number**
- After **30 days**, Gallery asks buyer to confirm receipt
- Escrow releases or is reviewed based on response

*(Full design — next session)*

---

## Build Order

1. **Commission system** — core feature, everything else builds around it
2. Premade shop
3. Artist profiles
4. Feed & stories
5. DMs
6. Search & discovery
7. Notifications
8. Work protection
9. Content moderation
10. Ratings & trust score
