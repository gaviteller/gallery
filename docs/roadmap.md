# Gallery Roadmap

Last updated: 2026-06-11

---

## 🚀 Pre-Launch

### Appearance & Design
- [ ] Full visual redesign — make the platform feel distinctive, handcrafted, and artist-native

### Auth
- [x] Email/password auth, email verification
- [x] Forgot password / password reset (email with 1h expiring token)
- [x] Google OAuth
- [ ] Apple ID sign in

### Profile & Social
- [x] Full profile — banner, avatar, bio, links, tabs, follow system, mutual followers
- [x] Block / unblock — mutual invisibility, deletes follow relationships; enforced in feed, search, DMs, commissions

### Posts & Feed
- [x] Post upload — crop editor, hashtags, AI flag, pin/unpin, delete, comments
- [x] Ranked home feed — infinite scroll, square crop, single column
- [x] Optimistic like button
- [x] Hashtag pages
- [x] Featured Artists strip on feed

### Stories
- [x] Stories — full stack (24h, StoriesRow, StoryViewer, StoryUpload, story ring on profile)

### Commissions
- [x] Full commission lifecycle — request → accept → pay (simulated) → deliver → approve → complete
- [x] Auto-cancel 3 days PENDING, auto-release 5 days DELIVERED (blocked on DISPUTED)
- [x] Commission thread UI — pinned brief, reference photos, deadline badges, all action buttons
- [x] Rating after completion, display permission grant, share-to-feed card
- [x] Commission dispute flow — DISPUTED status, buyer raises dispute on DELIVERED, escrow frozen
- [x] Post-payment cancellation rules — artist cancel = monthly strike count, buyer cancel = cancellation count
- [x] Trust Score — avg rating + cancel rate, "New Artist" badge until 10 completions
- [x] Commission browse filters — style, medium, price range
- [x] Artist Dashboard — commission settings, custom categories, business overview

### Shop
- [x] Global /shop feed page (infinite scroll, add-to-cart)
- [x] /@username/shop artist storefront
- [x] /@username/shop/[itemId] item detail page
- [x] New listing form — preview image, title, price, tags
- [x] Pause/unpause + delete listings
- [x] localStorage cart — drawer UI, count badge in both navs
- [x] Stripe Connect onboarding for artists
- [x] Stripe payment intent (single item + cart checkout)
- [x] Download delivery by email
- [x] Artist orders + earnings in professional dashboard

### Messaging
- [x] Social DMs and Professional DMs (commission threads)
- [x] DM unread count — lastReadAt written on open + send, accurate unread count badge

### Notifications
- [x] In-app notifications (15+ types)
- [x] Push notifications (WebPush + service worker)
- [x] Welcome email on signup
- [x] All commission lifecycle emails (request, accept, decline, payment, delivery, complete, cancel, dispute)
- [x] DMCA counter-notice filed → email to claimant
- [x] Post restored after successful counter-notice
- [x] Shop inquiry email

### Discovery & Search
- [x] Full search — artists, posts, shop in one grouped results page
- [x] Rising Stars / Spotlight / You Might Like discovery screen on /search
- [x] Personalised You Might Like feed (recency + engagement + interest graph)

### Safety & Compliance
- [x] Email notification on content flagged/removed
- [x] Age gate — 13+ at signup (EU under-16 parental consent deferred)
- [x] Opt out of location-based ad targeting toggle in Settings
- [x] Cookie consent banner for EU users
- [x] DMCA takedown form + 14-day response + counter-notice flow (3 violations = permanent ban)
- [x] Strikes system — 4 levels: Minor / Moderate / Severe / Zero Tolerance, accumulation logic, temp ban triggers
- [x] Community report button (3 reports from distinct accounts = hiding + flag), 14-day content pending state
- [x] Moderation review queue + appeals flow (human reviewer, 5 business day SLA)
- [x] Removal transparency — 15-day grace window, reason shown on profile + appeal page
- [ ] NCMEC / PhotoDNA hash matching on upload *(back burner — waiting on program approval)*

### Work Protection
- [x] Auto-watermark on artwork: `Gallery | @username`

### Payments — Real Money (currently simulated)
- [ ] Stripe Connect onboarding for artists
- [ ] Stripe payment intent on commission accept
- [ ] Real escrow hold on buyer payment
- [ ] Escrow release on completion / auto-release (replace simulation)
- [ ] Refund flow per cancellation rules
- [ ] Chargeback handling — suspend account, fraud = permanent ban
- [ ] Payout dashboard for artists (replace simulated totals)
- [ ] 8% standard / 5% Pro fees applied to real payments

### AI Features
- [x] Image scan on upload — OpenRouter LLM vision, auto-remove high confidence, route low confidence to mod queue (posts, shop, avatar/banner)
- [x] Auto-action on high-confidence violations — skip mod queue, go straight to REMOVED + notify user
- [x] Automated strikes — issue appropriate strike based on violation type and severity
- [x] Mod dashboard audit log — every AI action logged with scores + reason, mod can override
- [x] AI text moderation — scan comments for harassment, hate speech, spam
- [x] Report triage — reported posts with no prior scan get scanned immediately on report submission
- [x] AI discovery — Rising Stars / Spotlight boosted by content quality score; For You ranked by engagement velocity, EXPLICIT posts filtered

### Performance
- [x] Skeleton loading states (replace all "Loading…" with shimmer)
- [x] Lazy load images on feed + profile

### Infrastructure & Data Safety
- [x] Automated daily DB backup with restore runbook in docs/
- [x] Prisma seed script — skipped (DB is never reset in practice)

### Legal
- [x] Terms of Service page

---

## 🟡 Pre-Full Launch

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

### Trend Reports
- [ ] Quarterly anonymised trend report generation
- [ ] Reports purchasable by businesses and brands
- [ ] No PII included — fully anonymised

### Commercial Licence
- [ ] In-platform commercial licence request — buyer formally requests commercial use from artist
- [ ] Artist accepts/declines with agreed terms stored on record

### Shop
- [ ] Listing preview before publish — artist sees buyer view before going live
- [ ] Edit / pause shop listings
- [ ] Full cart + Stripe checkout for shop purchases
- [ ] Digital file delivery on purchase — locked until confirmed, no refund once downloaded
- [ ] Physical shipping flow — tracking number required, 30-day confirmation window
- [ ] Sale notifications to artist

### Onboarding
- [ ] Profile completion nudge — new users with no avatar/bio/posts see a checklist, improves discovery quality

### Collections & Wishlists
- [ ] Save posts to named private boards
- [ ] Wishlist items from shop

### Notifications
- [ ] Push — like on your post
- [ ] Push — comment on your post
- [ ] Push — someone follows you
- [ ] Push — commission status changes (currently DM only)

### Commissions
- [ ] WIP progress image updates within commission thread
- [ ] Commission queue management view for artists

### Work Protection
- [ ] Canvas-based screenshot blocking on artwork
- [ ] Removing/altering watermark = Moderate strike enforcement

### Platform
- [ ] Public status page — platform health, active incidents, maintenance windows

### Mobile Polish
- [ ] Swipe down to dismiss modals
- [ ] Escape key closes all modals

---

## ⚪ Extra

### Artist Tools
- [ ] Artist analytics dashboard — views, profile visits, likes, commission conversion rate
- [ ] Commission templates — artist saves preset tiers with price + turnaround
- [ ] Verified artist badge
- [ ] Portfolio export — download gallery as PDF
- [ ] Tax assistance tools for artists

### Commissions
- [ ] Co-commission — two artists collaborate on one commission

### Social
- [ ] Tip jar — one-off payments to artists outside commissions
- [ ] Referral system

### Settings
- [ ] Notification preferences — per-type on/off in Settings
- [ ] Post editing — change title/caption after publish

### Gallery Pro
- [ ] Gallery Pro team/family plans

### Platform
- [ ] Phase 5 expansion — music, cosplay, crafts, other creative mediums
