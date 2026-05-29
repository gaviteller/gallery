# Gallery Roadmap

Last updated: 2026-05-29

---

## 🟢 Tier 1 — Almost done

### Performance
- [ ] Skeleton loading states (replace all "Loading…" with shimmer)
- [ ] Lazy load images on feed + profile

### Safety & Compliance
- [x] Email notification on content flagged/removed
- [ ] Cookie consent banner for EU users
- [x] Age gate — 13+ at signup (EU under-16 parental consent deferred)
- [x] "Opt out of location-based ad targeting" toggle in Settings

### Discovery & Search
- [ ] Commission browse filters — style, medium, price range
- [ ] Full search — artists, posts, shop, commissions in one grouped results page
- [ ] Rising Stars / Artist Spotlight rotating feature slot

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

### Legal & Compliance
- [ ] NCMEC / PhotoDNA hash matching on upload (mandatory)
- [ ] DMCA takedown form + 14-day response + counter-notice flow (3 confirmed violations = permanent ban)

### Discovery
- [ ] Hidden Gems vs Recommended two-tier AI discovery feed

---

## 🤖 AI Moderation — Automate the mod queue

> **Goal:** Replace or assist human moderators with an AI pipeline so the queue runs itself.

- [ ] AI image scan on upload — flag NSFW, gore, stolen art (reverse image search), CSAM (PhotoDNA)
- [ ] Auto-action on high-confidence violations — skip PENDING_REVIEW, go straight to REMOVED + notify user
- [ ] Low-confidence flags routed to human review queue as normal
- [ ] AI-generated text moderation — scan post descriptions and comments for harassment, hate speech, spam
- [ ] Report triage — AI pre-scores incoming reports so the most severe float to the top of the queue
- [ ] Strike suggestion — AI recommends strike level (Minor/Moderate/Severe/Zero Tolerance) for mod to confirm
- [ ] False positive tracking — if appealed and approved, feed that back to improve the model
- [ ] Mod dashboard audit log — every AI action logged with confidence score so mods can review

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

### Collections and Wishlists
- [ ] Save posts to named private boards
- [ ] Wishlist items from shop

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
- Auto-cancel 3 days PENDING, auto-release 5 days DELIVERED (blocked on DISPUTED)
- Commission thread UI — pinned brief, reference photos, deadline badges, all action buttons
- Rating after completion, display permission grant, share-to-feed card
- Commission dispute flow — DISPUTED status, buyer raises dispute on DELIVERED, escrow frozen
- Post-payment cancellation rules — artist cancel = monthly strike count (disable at 5/month), buyer cancel = cancellation count
- Trust Score — avg rating + cancel rate, "New Artist" badge until 10 completions, tap for breakdown, flag retaliatory ratings
- DM unread count — lastReadAt written on open + send, accurate unread count badge
- Artist Dashboard — commission settings, custom categories, business overview
- Social DMs and Professional DMs (commission threads)
- In-app notifications (15+ types), push notifications (WebPush + service worker)
- Shop — add/delete items on profile (inquiry only, no checkout)
- Hashtag pages
- Featured Artists strip on feed
- Terms of Service page
- Strikes system — 4 levels: Minor / Moderate / Severe / Zero Tolerance, accumulation logic, temp ban triggers
- Community report button (3 reports from distinct accounts = hiding + flag), 14-day content pending state
- Auto-watermark on artwork: `Gallery | @username`
- Moderation review queue + appeals flow (human reviewer, 5 business day SLA)
- Forgot password / password reset flow (email with 1h expiring token)
- Block / unblock — mutual invisibility, deletes follow relationships; enforced in feed, search, DMs, commissions
- Optimistic like button (onMutate/onError/onSettled, no full feed refetch)
