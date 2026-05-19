# Gallery Roadmap

Last updated: 2026-05-19

---

## 🟢 Tier 1 — Almost done (finish what's in progress)

### Stories
- [x] Schema — Story + StoryView models in prisma/schema.prisma
- [x] Backend router — create, getFeed, getByUsername, markViewed
- [x] StoryUpload component
- [x] StoryViewer component
- [x] StoriesRow on feed page
- [x] Story ring + Add Story button on profile page
- [ ] Confirm DB migration applied to production database

### Commission Polish
- [ ] Dispute flow — freeze commission, notify both parties, moderation review, resolution path
- [ ] Cancellation rules post-payment — both-sides-agree refund, strike on unilateral cancel

### Trust Score
- [ ] Aggregate buyer ratings (buyerRating stored but never averaged or displayed)
- [ ] Cancellation count visible on buyer profiles
- [ ] Trust Score calculation (avg rating + cancellation rate + strikes)
- [ ] Trust Score displayed on profile (currently static "New Artist" placeholder)

### DM Unread Count (partial fix)
- [ ] Write lastReadAtA/lastReadAtB on message read (fields exist, never used)
- [ ] Fix unread count logic to use lastReadAt instead of naive last-message check

---

## 🟡 Tier 2 — Must have to launch prototype

### Payments (currently simulated — no real money)
- [ ] Stripe Connect onboarding for artists
- [ ] Stripe payment intent on commission accept
- [ ] Real escrow hold on buyer payment
- [ ] Escrow release on completion / auto-release (replace simulation)
- [ ] Refund flow on cancellation
- [ ] Payout dashboard for artists (replace simulated totals)

### Auth
- [ ] Google OAuth
- [ ] Forgot password / password reset flow

### Safety & Moderation
- [ ] Strikes system — model, logic, admin UI
- [ ] Community report button on posts
- [ ] Auto-watermark on artwork (Gallery | @username)
- [ ] Moderation review queue + 2-week window + email notification

### Blocking
- [ ] Block / unblock endpoints (schema already has Block model)
- [ ] Filter blocked users from feed, search, DMs, commissions

### Performance
- [ ] Optimistic like button (currently does full feed refetch on every like)
- [ ] Skeleton loading states (replace all "Loading…" text with shimmer)
- [ ] Lazy load images on feed + profile

---

## 🔵 Tier 3 — Final form

### Shop (currently inquiry-only)
- [ ] Edit / pause shop listings (only create + delete exist)
- [ ] Global shop browse page
- [ ] Cart (multi-artist checkout)
- [ ] Stripe checkout for shop purchases
- [ ] Digital file delivery on purchase
- [ ] Physical shipping flow (tracking number upload, 30-day confirmation window)
- [ ] Sale notifications to artist
- [ ] Per-artist escrow on shop purchases

### Discovery & Search
- [ ] Full search — artists, posts, shop items, commissions in one grouped results page (user.search exists but name/username only)
- [ ] Commission browse filters — style, medium, price range (Explore tab has sort but no filter chips)
- [ ] Rising Stars dedicated section on discovery page

### Push Notifications (expand coverage)
- [ ] Like on your post
- [ ] Comment on your post
- [ ] Someone follows you
- [ ] Commission status changes (currently only DM has push)

### Safety (advanced)
- [ ] AI content scan on upload
- [ ] Screenshot blocking

### Mobile Polish
- [ ] Swipe down to dismiss modals
- [ ] Escape key closes all modals (PostModal, StoryViewer, StoryUpload, etc.)

### Apple OAuth
- [ ] Apple sign in

---

## ⚪ Tier 4 — Extra / nice to have

- [ ] Notification preferences (per-type on/off toggles in settings)
- [ ] Post editing — change title/caption after publish
- [ ] Commission templates — artist saves preset tiers with price + turnaround
- [ ] Verified artist badge (manual grant by admin)
- [ ] Portfolio export — download your own gallery as a PDF
- [ ] Referral system
- [ ] Artist analytics dashboard — views, likes, profile visits, commission conversion rate
- [ ] Tip jar — one-off payments to artists outside commissions
- [ ] Collections — save posts to named private boards
- [ ] Co-commission — two artists collaborate on one commission

---

## ✅ Already shipped

### Auth & Onboarding
- Email signup, sign-in, email verification
- Onboarding flow (username, selling toggle)

### Feed
- Ranked home feed (recency + engagement + follow boost + interest graph)
- Infinite scroll
- Square 1:1 image crop, single column layout
- Like button, comment button
- Commission open badge on feed cards
- Featured Artists strip

### Posts
- Upload with Instagram-style crop/reposition tool
- Caption, AI-generated flag, isCommission flag
- Hashtag extraction + linking
- Delete, pin/unpin (max 3)
- Post modal (full view, like, comment, reply, like comments)

### Profiles
- Banner + avatar (overlap layout), bio, social links
- Follow/unfollow, follower/following counts
- Mutual followers chip + modal
- Posts tab (3-column grid), Shop tab, Commissions tab, About tab
- Commission example work gallery merged from approved commissions
- Smart tab visibility (hides empty tabs)
- Story ring on avatar

### Stories
- 24h disappearing images, StoriesRow on feed, StoryViewer, StoryUpload

### Commission System
- Discovery page — For You feed (scored ranking) + Explore grid (search + sort)
- Full request → accept → payment (simulated) → deliver → approve → complete lifecycle
- Rating after completion, display permission grant, share-to-feed card
- Auto-cancel after 3 days PENDING, auto-release after 5 days DELIVERED
- Deadline tracking with overdue/due-soon badges
- Commission thread UI with pinned brief, reference photos, all action buttons

### Artist Dashboard (/professional-profile)
- Commission settings (status, description, turnaround, price ranges, card images, styles)
- Custom dropdown category manager
- Business overview (simulated)
- Active commissions list

### Messaging
- Social DMs (text, 8s polling, push notification)
- Professional DMs (commission threads)
- Unread count

### Notifications
- In-app notifications (15+ types)
- Push notifications (WebPush, service worker)

### Shop
- Add/delete shop items on profile (inquiry only, no checkout)

### Other
- Hashtag pages
- Block model (schema only)
- Terms of Service page
