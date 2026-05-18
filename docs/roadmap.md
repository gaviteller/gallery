# Gallery Roadmap

Last updated: 2026-05-18

---

## 🟢 Tier 1 — Completes what's already built

### Commission Polish
- [x] Accept requires price + deadline
- [x] Buyer sees price + deadline summary before paying
- [x] Artist notified when deadline approaches (not just buyer)
- [x] Messages / Commissions tab header on both list pages
- [x] Rating card after commission completes (buyer rates artist)
- [x] Display permission card (buyer approves artist portfolio use)
- [x] Share-to-feed card (artist posts completed work)
- [x] Auto-cancel PENDING after 3 days (cron job)
- [x] Auto-release escrow after 5 days DELIVERED (cron job)
- [ ] Dispute flow (freeze commission, moderation review)
- [ ] Cancellation rules post-payment (both-sides-agree refund, strike on unilateral cancel)
- [ ] Stripe escrow (money actually held and released)

### Profiles
- [x] Follow button on other profiles
- [x] Follower / following counts in header
- [x] Mutual followers chip + modal
- [x] Pin up to 3 posts (pin icon in grid)
- [x] Smart tab visibility (hide Shop if empty, hide Commissions if closed)
- [x] Commissions tab redesign (info card + example gallery)
- [x] About tab (bio, social links, commission status badge moved here)
- [x] Approved commission work merged into profile gallery
- [ ] Post count in header
- [ ] Story ring on avatar + full Stories feature (in progress — blocked on DB migration)

### Stories (24h disappearing images)
- [x] Schema — Story + StoryView models added to prisma/schema.prisma
- [ ] DB migration (blocked — need DATABASE_URL locally)
- [ ] Backend story router (create, getFeed, getByUsername, markViewed)
- [ ] StoryUpload component
- [ ] StoryViewer component
- [ ] StoriesRow component on feed page
- [ ] Story ring + Add Story button on profile page

### Trust & Reputation
- [x] Rating card UI (buyer submits 1–5 stars)
- [x] Rating stored on Commission (buyerRating field)
- [ ] Trust Score calculation (avg rating + cancellation rate + strikes)
- [ ] Trust Score displayed on profile (shows "New Artist" until 10 completions)
- [ ] Cancellation count visible on buyer profiles
- [ ] Strikes system

### Feed Polish
- [ ] Fix post avatar fallback — uses light bg-blue-100/text-blue-600, doesn't match dark theme (app/page.tsx ~line 108)
- [ ] Timestamps on feed posts — "X hours ago" under username (reuse timeAgo() from messages/page.tsx)
- [ ] Empty feed CTA — add "Find artists →" button to /commissions when feed is empty (app/page.tsx)

---

## 🟡 Tier 2 — Needed for the app to actually work

### Payments & Money
- [ ] Stripe Connect onboarding for artists
- [ ] Stripe payment intent on commission accept
- [ ] Escrow hold on buyer payment
- [ ] Escrow release on completion / auto-release
- [ ] Refund flow on cancellation
- [ ] Shop checkout (cart → single payment → per-artist escrow)
- [ ] Payout dashboard for artists

### Shop
- [ ] Create / edit / delete / pause listings (artist dashboard)
- [ ] Shop browse page (global)
- [ ] Shop tab on profile (active listings)
- [ ] Cart (multi-artist checkout)
- [ ] Digital file delivery on purchase
- [ ] Physical shipping flow (tracking number upload, 30-day confirmation)
- [ ] Sale notifications to artist

### Performance & Polish
- [ ] Optimistic like button — use setData instead of invalidate to avoid full feed refetch (app/page.tsx)
- [ ] Skeleton loading states — replace "Loading…" text with shimmer placeholders
- [ ] Lazy load images — add loading="lazy" to all feed/profile images

### Safety & Moderation
- [ ] AI content scan on upload
- [ ] Community report button on posts
- [ ] Strike system (see ToS)
- [ ] Dispute flow for commissions
- [ ] Screenshot blocking
- [ ] Auto-watermark on artwork (Gallery | @username)
- [ ] 2-week moderation window + email notification

---

## ⚪ Tier 3 — Growth and polish

### Discovery & Feed
- [ ] For You tab (personalised recommendations)
- [ ] Commission browse page (search by name / style / medium / price)
- [ ] Rising Stars section
- [ ] Search (artists, posts, shop, commissions — grouped results page)

### Auth
- [x] Email signup + signin
- [x] Email verification
- [ ] Google OAuth
- [ ] Apple OAuth
- [ ] "Forgot password" flow

### Mobile Experience
- [ ] Keyboard shortcut — Escape closes all modals (PostModal, StoryViewer, StoryUpload)
- [ ] Touch gesture — swipe down to dismiss modals on mobile
