# Gallery Roadmap

Last updated: 2026-05-19

---

## 🟢 Tier 1 — Almost done (finish what's in progress)

### Stories
- [x] Schema — Story + StoryView models in prisma/schema.prisma
- [ ] DB migration (need DATABASE_URL locally)
- [ ] Backend story router (create, getFeed, getByUsername, markViewed)
- [ ] StoryUpload component
- [ ] StoryViewer component
- [ ] StoriesRow on feed page
- [ ] Story ring + Add Story button on profile page

### Commission Polish
- [ ] Dispute flow (freeze commission, moderation review)
- [ ] Cancellation rules post-payment (both-sides-agree refund, strike on unilateral cancel)

### Trust Score
- [ ] Cancellation count visible on buyer profiles
- [ ] Trust Score calculation (avg rating + cancellation rate + strikes)
- [ ] Trust Score displayed on profile (shows "New Artist" until 10 completions)

---

## 🟡 Tier 2 — Must have to launch prototype

### Payments
- [ ] Stripe Connect onboarding for artists
- [ ] Stripe payment intent on commission accept
- [ ] Escrow hold on buyer payment
- [ ] Escrow release on completion / auto-release
- [ ] Refund flow on cancellation
- [ ] Payout dashboard for artists

### Auth
- [ ] Google OAuth
- [ ] Apple OAuth
- [ ] Forgot password flow

### Safety & Moderation
- [ ] Strikes system
- [ ] Community report button on posts
- [ ] Auto-watermark on artwork (Gallery | @username)
- [ ] 2-week moderation window + email notification

### Performance
- [ ] Optimistic like button (avoid full feed refetch)
- [ ] Skeleton loading states (replace "Loading…" with shimmer)
- [ ] Lazy load images on feed + profile

---

## 🔵 Tier 3 — Final form

### Shop
- [ ] Create / edit / delete / pause listings
- [ ] Shop browse page (global)
- [ ] Cart (multi-artist checkout)
- [ ] Digital file delivery on purchase
- [ ] Physical shipping flow (tracking number, 30-day confirmation)
- [ ] Sale notifications to artist
- [ ] Shop checkout (cart → payment → per-artist escrow)

### Discovery
- [ ] Search (artists, posts, shop, commissions — grouped results)
- [ ] Commission browse page (filter by style / medium / price)
- [ ] For You feed (personalised recommendations)
- [ ] Rising Stars section

### Safety (advanced)
- [ ] AI content scan on upload
- [ ] Screenshot blocking

### Mobile
- [ ] Swipe down to dismiss modals
- [ ] Escape key closes all modals

---

## ⚪ Tier 4 — Extra / nice to have

- [ ] Apple OAuth
- [ ] Notification preferences (per-type on/off)
- [ ] Post editing (title + description after publish)
- [ ] Commission templates (artist saves preset tiers)
- [ ] Verified artist badge
- [ ] Portfolio export (download your own gallery as PDF)
- [ ] Referral system
- [ ] Analytics dashboard for artists (views, likes, commission conversion)
