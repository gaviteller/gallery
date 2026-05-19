# Gallery Roadmap

Last updated: 2026-05-19

---

## 🟢 Tier 1 — Almost done

### Stories
- [x] Schema, router, components all built
- [ ] Confirm DB migration applied to production

### Commission Polish
- [ ] Dispute flow — freeze commission, notify both parties, moderation review, resolution path
- [ ] Cancellation rules post-payment — artist cancel = strike, buyer cancel = cancellation record
- [ ] 5+ artist cancellations in one calendar month = commission feature disabled (appealable)

### Trust Score
- [ ] Aggregate buyer ratings (stored but never averaged or displayed)
- [ ] Cancellation count visible to artists before accepting a request
- [ ] Trust Score = avg rating + cancellation rate + selling-related strikes
- [ ] Displayed after 10 completions — "New Artist" before that
- [ ] Tap to view full score breakdown
- [ ] Rating dispute flow — artist submits evidence, human review; retaliatory rating = Minor strike

### DM Unread Count
- [ ] Write lastReadAt on message read (fields exist, never used)
- [ ] Fix unread count logic

---

## 🟡 Tier 2 — Must have to launch prototype

### Payments — Real Money (currently simulated)
- [ ] Stripe Connect onboarding for artists
- [ ] Stripe payment intent on commission accept
- [ ] Real escrow hold on buyer payment
- [ ] Escrow release on completion / auto-release (replace simulation)
- [ ] Refund flow per cancellation rules
- [ ] Chargeback handling — suspend account, fraud = permanent ban
- [ ] Payout dashboard for artists (replace simulated totals)
- [ ] 8% standard / 5% Pro fees applied to real payments

### Auth
- [ ] Google OAuth
- [ ] Apple ID sign in
- [ ] Forgot password / password reset flow

### Safety & Moderation
- [ ] Strikes system — 4 levels: Minor / Moderate / Severe / Zero Tolerance
- [ ] Strike accumulation logic and temp ban triggers (6 Minor = 3d ban, 4 Moderate = 14d ban, 1 Severe = 30d ban, 2 Severe ever = permanent)
- [ ] Community report button on posts (3 reports from distinct accounts = hiding + flag)
- [ ] Content Pending state — 14-day challenge window before auto-removal
- [ ] Auto-watermark on artwork: format `Gallery | @username`
- [ ] Moderation review queue + appeals flow (human reviewer, 5 business day SLA)
- [ ] Email notification on content flagged/removed

### Blocking
- [ ] Block / unblock endpoints (Block model already in schema)
- [ ] Filter blocked users from feed, search, DMs, commissions

### Legal & Compliance
- [ ] NCMEC / PhotoDNA hash matching on upload (mandatory)
- [ ] DMCA takedown form + 14-day response + counter-notice flow (3 confirmed violations = permanent ban)
- [ ] Cookie consent banner for EU users
- [ ] Age gate — 13+ at signup, EU under-16 requires parental consent
- [ ] "Opt out of location-based ad targeting" toggle in Settings

### Performance
- [ ] Optimistic like button (avoid full feed refetch on every like)
- [ ] Skeleton loading states (replace all "Loading…" with shimmer)
- [ ] Lazy load images on feed + profile

---

## 🔵 Tier 3 — Final form

### Gallery Pro Subscription ($10/month)
- [ ] Stripe subscription billing
- [ ] 5% transaction fee for Pro subscribers
- [ ] Early access feature flag system
- [ ] Failed payment: 1-month grace period at 7% fee → back to 8%
- [ ] Pro paused on temp ban, cancelled on permanent ban (no refund)
- [ ] Launch: all users active at launch get 6 months free
- [ ] Opt-in to be named in trend data reports (Pro setting)

### Advertising System
- [ ] In-platform targeted ads (art style / medium / location only)
- [ ] No sensitive category targeting (religion, politics, health, ethnicity)
- [ ] EU under-16: generic ads. Under-13: no targeted ads.
- [ ] Advertiser approval queue
- [ ] "Sponsored" label on all paid ads
- [ ] Advertisers receive anonymised metrics only
- [ ] FTC disclosure enforcement — undisclosed sponsored content = Minor strike

### Trend Data Reports
- [ ] Quarterly anonymised trend report generation
- [ ] Reports purchasable by businesses and brands
- [ ] No PII included — fully anonymised

### Commercial Licence Feature
- [ ] In-platform commercial licence request — buyer formally requests commercial use from artist
- [ ] Artist accepts/declines with agreed terms stored on record

### Shop — Full E-Commerce
- [ ] Edit / pause shop listings (only create + delete exist)
- [ ] Global shop browse page
- [ ] Cart (multi-artist checkout)
- [ ] Stripe checkout for shop purchases
- [ ] Digital file delivery on purchase — locked until confirmed, no refund once downloaded
- [ ] Physical shipping flow — tracking number required, 30-day confirmation window
- [ ] Sale notifications to artist

### Discovery & Search
- [ ] Full search — artists, posts, shop, commissions in one grouped results page
- [ ] Commission browse filters — style, medium, price range
- [ ] Hidden Gems vs Recommended two-tier AI discovery
- [ ] Rising Stars / Artist Spotlight rotating feature slot
- [ ] Collections and wishlists

### Push Notifications (expand)
- [ ] Like on your post
- [ ] Comment on your post
- [ ] Someone follows you
- [ ] Commission status changes (currently DM only has push)

### Commission Extras
- [ ] WIP progress image updates within commission thread
- [ ] Commission queue management view for artists

### Work Protection
- [ ] Canvas-based screenshot blocking on artwork
- [ ] Removing/altering watermark = Moderate strike enforcement

### Platform Status Page
- [ ] Public status page — platform health, active incidents, maintenance windows

### Mobile Polish
- [ ] Swipe down to dismiss modals
- [ ] Escape key closes all modals

---

## ⚪ Tier 4 — Extra / nice to have

- [ ] Artist analytics dashboard — views, profile visits, likes, commission conversion rate
- [ ] Notification preferences — per-type on/off in Settings
- [ ] Post editing — change title/caption after publish
- [ ] Commission templates — artist saves preset tiers with price + turnaround
- [ ] Verified artist badge
- [ ] Portfolio export — download gallery as PDF
- [ ] Referral system
- [ ] Tip jar — one-off payments to artists outside commissions
- [ ] Co-commission — two artists collaborate on one commission
- [ ] Gallery Pro team/family plans
- [ ] Tax assistance tools for artists
- [ ] Phase 5 expansion — music, cosplay, crafts, other creative mediums

---

## ✅ Already shipped

- Email/password auth, email verification, onboarding
- Full profile (banner, avatar, bio, links, tabs, follow system, mutual followers)
- Stories — full stack (24h, StoriesRow, StoryViewer, StoryUpload, story ring on profile)
- Ranked home feed — infinite scroll, square crop, single column
- Post upload — crop editor, hashtags, AI flag, pin/unpin, delete, comments
- Full commission lifecycle — request → accept → pay (simulated) → deliver → approve → complete
- Auto-cancel 3 days PENDING, auto-release 5 days DELIVERED
- Commission thread UI — pinned brief, reference photos, deadline badges, all action buttons
- Rating after completion, display permission grant, share-to-feed card
- Artist Dashboard — commission settings, custom categories, business overview
- Social DMs and Professional DMs (commission threads)
- In-app notifications (15+ types), push notifications (WebPush + service worker)
- Shop — add/delete items on profile (inquiry only, no checkout)
- Hashtag pages
- Featured Artists strip on feed
- Terms of Service page
