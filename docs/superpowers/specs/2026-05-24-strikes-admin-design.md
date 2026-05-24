# Strikes, Bans & Admin Panel — Design Spec

*Date: 2026-05-24*
*Status: Approved*

---

## Overview

A role-based moderation system where admins and moderators can issue strikes, apply bans, and review appeals. All enforcement is **manual** — the system records data and surfaces thresholds as warnings, but a human always makes the final call. The admin panel lives at `/admin` within the same Next.js app (same codebase, same deployment, same DB).

---

## Roles

Two flags on `User`:

| Flag | Who | Can do |
|------|-----|--------|
| `isAdmin` | One person (you) | Everything — issue strikes, bans, manage appeals, promote/demote moderators |
| `isModerator` | Set by admin | Issue strikes, bans, manage appeals — cannot manage roles |

Only admins can set `isModerator = true/false` on other users.

---

## Data Model

### User additions

```prisma
isAdmin        Boolean   @default(false)
isModerator    Boolean   @default(false)
bannedUntil    DateTime? // null = not banned, future date = temp ban, year 9999 = permanent
banReason      String?   // shown to the banned user
```

### Strike model

```prisma
model Strike {
  id          String         @id @default(cuid())
  userId      String
  user        User           @relation("ReceivedStrikes", fields: [userId], references: [id], onDelete: Cascade)
  issuedById  String
  issuedBy    User           @relation("IssuedStrikes", fields: [issuedById], references: [id])
  level       StrikeLevel
  violation   StrikeViolation
  isSelling   Boolean        @default(false)  // true = counts against Trust Score
  contentId   String?        // optional link to the offending content
  contentType String?        // "post" | "commission" | "shop_item"
  notes       String?        @db.Text         // internal mod notes
  reversed    Boolean        @default(false)  // true = appeal approved, strike no longer counts
  createdAt   DateTime       @default(now())

  appeals     Appeal[]

  @@index([userId])
  @@index([issuedById])
}

enum StrikeLevel {
  MINOR
  MODERATE
  SEVERE
  ZERO_TOLERANCE
}

enum StrikeViolation {
  // Selling (isSelling = true)
  ARTIST_CANCEL
  FAKE_DELIVERY
  FALSE_ADVERTISING
  BAIT_AND_SWITCH
  OFF_PLATFORM_PAYMENT
  COMMISSION_FARMING
  SHOP_FALSE_ADVERTISING

  // Content
  UNLABELLED_AI
  GORE
  HARASSMENT
  HATE_SPEECH
  SPAM

  // Legal
  DMCA_VIOLATION
  FTC_DISCLOSURE
  NCMEC_VIOLATION

  // Other
  CHARGEBACK_FRAUD
  ZERO_TOLERANCE_CONDUCT
}
```

`isSelling` is computed from `violation` when the strike is created:

```typescript
const SELLING_VIOLATIONS = new Set([
  "ARTIST_CANCEL", "FAKE_DELIVERY", "FALSE_ADVERTISING",
  "BAIT_AND_SWITCH", "OFF_PLATFORM_PAYMENT", "COMMISSION_FARMING",
  "SHOP_FALSE_ADVERTISING",
])
```

### Appeal model

```prisma
model Appeal {
  id           String       @id @default(cuid())
  userId       String
  user         User         @relation("SubmittedAppeals", fields: [userId], references: [id], onDelete: Cascade)
  strikeId     String?      // optional: the specific strike being appealed
  strike       Strike?      @relation(fields: [strikeId], references: [id])
  text         String       @db.Text
  status       AppealStatus @default(PENDING)
  reviewedById String?
  reviewedBy   User?        @relation("ReviewedAppeals", fields: [reviewedById], references: [id])
  reviewedAt   DateTime?
  createdAt    DateTime     @default(now())

  @@index([userId])
  @@index([status])
}

enum AppealStatus {
  PENDING
  APPROVED
  DENIED
}
```

---

## tRPC Middleware

Two new protected procedures alongside the existing `protectedProcedure`:

```typescript
// modProcedure — requires isAdmin OR isModerator
const modProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { isAdmin: true, isModerator: true },
  })
  if (!user?.isAdmin && !user?.isModerator) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
  return next()
})

// adminProcedure — requires isAdmin only
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { isAdmin: true },
  })
  if (!user?.isAdmin) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
  return next()
})
```

---

## Admin Panel Pages

All under `app/(admin)/admin/` with a shared layout that:
1. Checks session — redirect to `/` if not logged in
2. Checks `isAdmin || isModerator` — redirect to `/` if neither
3. Shows a simple nav: Dashboard · Users · Appeals

### `/admin` — Dashboard

- Count of PENDING appeals
- Last 10 strikes issued (username, level, violation, date)
- Count of currently active bans

### `/admin/users` — User list

- Search box (username or email)
- Table: username, email, Minor/Moderate/Severe strike counts, ban status
- Row links to `/admin/users/[id]`

### `/admin/users/[id]` — User detail

- Profile summary (username, email, join date)
- **Ban status panel:**
  - If not banned: "Issue ban" button → modal with duration picker (3d / 14d / 30d / Permanent) + reason text
  - If temp banned: "Banned until [date]" + reason + "Lift ban" button
  - If permanently banned: "Permanently suspended" + reason + "Lift ban" button
- **Strike summary:** "X Minor · Y Moderate · Z Severe · W Zero Tolerance"
  - ToS threshold warnings shown in amber if thresholds are reached (e.g. "⚠ 6+ Minor — ToS threshold for 3d ban")
- **Strike history table:** level, violation, content link (if any), notes, issued by, date
- **Issue strike button** → modal:
  - Level selector (Minor / Moderate / Severe / Zero Tolerance)
  - Violation category dropdown
  - Optional: content ID + content type
  - Optional: internal notes
  - Submit → creates Strike record, `isSelling` set automatically from violation

### `/admin/appeals` — Appeal queue

- List of PENDING appeals, oldest first
- Columns: username, appeal text preview (truncated), date submitted
- Links to `/admin/appeals/[id]`

### `/admin/appeals/[id]` — Appeal detail

- Full appeal text
- The specific strike being appealed (if referenced) — level, violation, content, date
- User's full strike history below
- **Approve** → sets `strike.reversed = true` (keeps history but strike no longer counts), lifts any resulting ban, notifies user, sets appeal status APPROVED
- **Deny** → sets appeal status DENIED, notifies user

---

## Soft Ban Enforcement

When a user is banned (`bannedUntil` is in the future or year 9999):

**Frontend:**
- `bannedUntil` and `banReason` are added to the NextAuth session via the `session` callback in `auth.ts` (reads from DB on each session refresh)
- The root layout (`app/layout.tsx`) renders a `<BanBanner>` client component that reads the session and shows a sticky top banner when banned: "Your account is suspended [until DATE / permanently]. [View reason] [Appeal]"

**Backend:**
- A `checkNotBanned` utility used in all mutation procedures that should be blocked:
  - `post.create`, `post.delete`, `comment.create`, `like`
  - `commission.submitRequest`, `commission.accept`, all commission actions
  - `dm.send`
  - `shop.create`, `shop.delete`
- Read-only queries are not blocked (they can still view their feed, profile, DMs)

```typescript
async function checkNotBanned(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bannedUntil: true },
  })
  if (user?.bannedUntil && user.bannedUntil > new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account is currently suspended.",
    })
  }
}
```

---

## Appeal Flow (User Side)

**Page: `/appeal`**

- Accessible while logged in, including when banned
- Shows the user's own strike history
- If they have a PENDING appeal: shows "Your appeal is under review" — no new submission
- Otherwise: text area (min 20 chars) + optional strike selector from their history + submit button
- On submit: creates `Appeal` record, status `PENDING`
- Confirmation: "Your appeal has been submitted. You'll be notified of the decision."

---

## Notifications

| Event | Recipient | Message |
|-------|-----------|---------|
| Strike issued | User | "A moderation action has been taken on your account. [View details]" |
| Ban issued | User | "Your account has been suspended. [View reason] [Appeal]" |
| Appeal approved | User | "Your appeal has been approved. The action has been reversed." |
| Appeal denied | User | "Your appeal has been reviewed and denied." |

All use the existing `Notification` model with new type strings: `"strike"`, `"ban"`, `"appeal_approved"`, `"appeal_denied"`.

---

## Trust Score Integration

`getTrustScore` currently returns `strikeDeduction: 0`. Once this Strike model ships, it updates to:

```typescript
const strikes = await ctx.prisma.strike.findMany({
  where: { userId: artist.id, isSelling: true, reversed: false },
  select: { level: true },
})
const strikeDeduction =
  strikes.filter(s => s.level === "MINOR").length * 0.1 +
  strikes.filter(s => s.level === "MODERATE").length * 0.3 +
  strikes.filter(s => s.level === "SEVERE").length * 0.8
```

No schema changes needed at that point.

---

## What This Does NOT Include (out of scope for this spec)

- Auto-ban triggers (all bans are manual)
- Automated strike issuance
- Email notifications (separate Tier 2 item)
- Content Pending state (separate Tier 2 item)
- Community report button (separate Tier 2 item)
