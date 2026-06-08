# Gallery Shop — Design Spec

*Date: 2026-06-08*

---

## Goal

Build a functional digital marketplace where artists sell finished digital files and buyers can purchase them with real Stripe payments. This is Phase 1 of the shop — digital-only. Physical goods and other media come in later phases.

---

## Scope (Beta)

- Digital downloads only (PNG, JPG, PDF, ZIP, PSD, Procreate, etc.)
- Real Stripe checkout — 8% Gallery fee (5% for Pro) on total order value
- Download delivered by email immediately after purchase
- No refunds once download link is sent
- Artists need Stripe Connect to receive payouts

**Out of scope for beta:** physical shipping, cart persistence across devices, wishlists, licensing system.

---

## Surfaces

### 1. `/shop` — Global Feed
The main shop discovery page. Works like the art feed — infinite scroll, item cards in a grid, ordered by recency with a small boost for items that have more purchases. No complex algorithm for beta.

Each card shows:
- Preview image
- Title
- Artist name + avatar (links to `/@username`)
- Price
- "Buy Now" button — opens purchase modal inline
- "Add to Cart" button — adds to cart, buyer keeps browsing

Items from blocked artists do not appear. Paused and deleted items do not appear.

Accessible from bottom nav and main navbar.

### 2. `/@username/shop` — Artist Storefront
Each artist has their own shop page. Replaces the current Shop tab on the profile. Shows all of the artist's active listings in a grid with the same card format as the global feed.

Owner view adds: Add listing button, edit/pause/delete quick actions on each card.

### 3. Item Page — `/@username/shop/[itemId]`
Full dedicated page for a single listing:
- Large preview image
- Title, description, tags
- Artist name + avatar
- Price
- "Buy Now" and "Add to Cart" buttons
- No refund notice shown clearly before purchase

Reachable from any item card in the feed or artist storefront.

---

## Listing

An artist creates a listing with the following fields:

| Field | Notes |
|---|---|
| Preview image | Uploaded to Cloudinary (public) — what buyers see |
| Title | Max 100 characters |
| Description | What's included, formats, resolution, usage rights — max 1000 chars |
| Price | Minimum $0.99 |
| Digital file | The actual file uploaded to Cloudinary (private/signed URL, never publicly accessible) |
| Tags | Free-form tags for discoverability (e.g. "brush pack", "reference sheet") |
| Status | `ACTIVE` or `PAUSED` |

Artists can **edit** any field after creation and **pause** a listing to hide it from the feed without deleting it.

---

## Purchase Flow

### Single item ("Buy Now")
1. Buyer clicks "Buy Now" — modal opens with item details + Stripe payment form
2. Server creates a Stripe Payment Intent for the item price
3. Gallery fee (8% or 5% Pro) calculated on the total and deducted
4. On payment success:
   - `Order` record created in DB (`status: PURCHASED`)
   - Secure Cloudinary signed URL generated (expires 24 hours)
   - Email sent to buyer with download link
   - Buyer sees confirmation screen with download button
5. Artist's payout queued via Stripe Connect transfer (amount after Gallery fee)

### Cart checkout
1. Buyer adds items from multiple artists to cart
2. Cart is stored client-side (localStorage) for beta
3. Buyer opens cart → sees all items, total price, Gallery fee shown
4. Single Stripe payment for total order value
5. Gallery takes 8% of the **total order value** (not per artist)
6. Remaining amount split out to each artist via separate Stripe Connect transfers
7. One `Order` record created per artist (grouped under one `CartOrder`)
8. Single email to buyer listing all purchased items with individual download links

### No refunds
Once the download link is sent the sale is final. This is shown clearly as a disclaimer before the buyer confirms payment.

---

## Data Model

### New models

**`ShopOrder`**
```
id           String   — cuid
buyerId      String   — User
sellerId     String   — User (artist)
itemId       String   — ShopItem
cartOrderId  String?  — CartOrder (null for single-item purchases)
amountTotal  Float    — price buyer paid for this item
galleryFee   Float    — fee taken by Gallery
sellerPayout Float    — amount transferred to artist
stripePaymentIntentId String
downloadToken String  — unique token for download
downloadTokenExpiresAt DateTime
downloadedAt DateTime?
status       String   — PURCHASED | DOWNLOADED | REFUNDED
createdAt    DateTime
```

**`CartOrder`**
```
id                    String   — cuid
buyerId               String   — User
amountTotal           Float    — total cart value
galleryFee            Float    — 8% of total
stripePaymentIntentId String
status                String   — PENDING | PAID | FAILED
createdAt             DateTime
orders                ShopOrder[]
```

### Updated `ShopItem` model
Add fields:
- `fileUrl String` — Cloudinary URL of the digital file (private)
- `tags String[]` — array of tag strings
- `status String @default("ACTIVE")` — ACTIVE | PAUSED
- `purchaseCount Int @default(0)` — for feed boost ranking

---

## Artist Management

### From `/@username/shop` (profile)
- Grid of their listings with status badges (Active / Paused)
- "Add listing" button
- Each card: edit, pause/unpause, delete quick actions

### From `/professional-profile` (Professional Dashboard)
New **Shop** tab with:
- All listings table — title, price, status, purchase count
- Edit / pause / delete from table
- **Orders tab** — each sale: buyer username, item title, amount earned (after fee), date, download status
- **Earnings summary** — total earned, pending payout balance, total Gallery fees paid

### Stripe Connect
- Artist must complete Stripe Connect onboarding to receive payouts
- If not onboarded: banner shown in dashboard — "Complete your payout setup to receive earnings from shop sales"
- Sales still go through — earnings queue until onboarding is complete
- Same Stripe Connect account used for commission payouts and shop payouts

---

## Fee Structure

| User type | Fee |
|---|---|
| Standard | 8% of total order value |
| Gallery Pro | 5% of total order value |

Fee is calculated on the full cart total, not per artist or per item. Gallery deducts its fee and distributes the remainder to each artist proportionally.

---

## Email Notifications

| Trigger | Recipient | Content |
|---|---|---|
| Purchase complete | Buyer | Download link(s) for all purchased items |
| Sale made | Artist | Item sold, amount earned after fee |

---

## Download Security

- Digital files stored in Cloudinary with restricted access (not publicly accessible via URL)
- After purchase, server generates a signed Cloudinary URL valid for 24 hours
- Download token stored in `ShopOrder` — can be re-requested by the buyer from their purchase history (generates a fresh 24h link)
- No limit on re-requests for beta (buyer can always get a fresh link from their order history)

---

## Navigation

- `/shop` added to bottom nav and main navbar
- `/@username/shop` linked from profile (replaces current shop tab)
- Cart icon in navbar showing item count badge

---

## What's Already Built (carry forward)

- `ShopItem` model (needs new fields added)
- `shop.getByUsername`, `shop.create`, `shop.delete` tRPC procedures (kept)
- `shop.sendInquiry` — remove this (replaced by real purchasing)
- Profile shop tab UI — refactored into `/@username/shop` page

---

## Future Phases (out of scope for beta)

- Physical goods — shipping address collection, tracking number flow, 30-day confirmation window
- Cart persistence across devices (move from localStorage to DB)
- Wishlists
- Commercial licence requests
- Cosplay, music, crafts (Phase 5 expansion)
