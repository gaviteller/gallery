# Commission Completion Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a commission completes, show the buyer a rating card then a display-permission card in the thread; if the buyer approves, show the artist a "share to feed?" card; approved commission images appear in the artist's Commissions tab gallery.

**Architecture:** Four new schema fields on `Commission`. Five new tRPC mutations in `commission.ts`. Three inline action cards added to the commission thread page (`app/professional-dms/[id]/page.tsx`) rendered in the scrollable messages area after the existing "Commission complete ✓" banner. The profile page Commissions tab gallery combines manual uploads with approved commission images via a new `getApprovedWork` query.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 5 / PostgreSQL, Tailwind v4, NextAuth v4.

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add 4 fields to `Commission` model |
| `server/routers/commission.ts` | Add 5 new procedures: `submitRating`, `setDisplayPermission`, `shareToFeed`, `dismissFeedShare`, `getApprovedWork` |
| `app/professional-dms/[id]/page.tsx` | Add 3 action cards in the scrollable area after the COMPLETE banner |
| `app/[username]/page.tsx` | Merge `getApprovedWork` results into the Commissions tab gallery |

---

### Task 1: Schema — add 4 fields to Commission

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the four new fields to the Commission model**

In `prisma/schema.prisma`, find the `Commission` model. After `deadlineNotificationSent  Boolean   @default(false)`, add:

```prisma
buyerRating               Int?
displayAsExample          Boolean   @default(false)
displayPermissionAnswered Boolean   @default(false)
artistFeedShareOffered    Boolean   @default(false)
```

The full updated Commission model (showing only changed section):
```prisma
model Commission {
  id                 String                  @id @default(cuid())
  buyerId            String
  artistId           String
  buyer              User                    @relation("BuyerCommissions", fields: [buyerId], references: [id], onDelete: Cascade)
  artist             User                    @relation("ArtistCommissions", fields: [artistId], references: [id], onDelete: Cascade)
  status             CommissionRequestStatus @default(PENDING)
  description        String                  @db.Text
  dropdownSelections Json @default("{}")
  referencePhotos    Json                    @default("[]")
  agreedPrice        Float?
  deliveredAt        DateTime?
  deadline                  DateTime?
  deadlineNotificationSent  Boolean   @default(false)
  buyerRating               Int?
  displayAsExample          Boolean   @default(false)
  displayPermissionAnswered Boolean   @default(false)
  artistFeedShareOffered    Boolean   @default(false)
  createdAt          DateTime                @default(now())
  updatedAt          DateTime                @updatedAt
  messages           ProfessionalMessage[]
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-commission-completion-fields
```

Expected: "Your database is now in sync with your schema."

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add rating and display permission fields to Commission"
```

---

### Task 2: Backend — submitRating and setDisplayPermission mutations

**Files:**
- Modify: `server/routers/commission.ts`

- [ ] **Step 1: Add `submitRating` mutation**

Add after the `checkAutoRelease` mutation (around line 476), before the `toggleFavorite` procedure:

```ts
submitRating: protectedProcedure
  .input(z.object({
    id: z.string(),
    rating: z.number().int().min(1).max(5),
  }))
  .mutation(async ({ ctx, input }) => {
    const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
    if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
    if (commission.buyerId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
    if (commission.status !== "COMPLETE") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not complete" })
    if (commission.buyerRating !== null) throw new TRPCError({ code: "BAD_REQUEST", message: "Already rated" })
    return ctx.prisma.commission.update({
      where: { id: input.id },
      data: { buyerRating: input.rating },
    })
  }),
```

- [ ] **Step 2: Add `setDisplayPermission` mutation**

Add immediately after `submitRating`:

```ts
setDisplayPermission: protectedProcedure
  .input(z.object({
    id: z.string(),
    allow: z.boolean(),
  }))
  .mutation(async ({ ctx, input }) => {
    const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
    if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
    if (commission.buyerId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
    if (commission.status !== "COMPLETE") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not complete" })
    if (commission.displayPermissionAnswered) throw new TRPCError({ code: "BAD_REQUEST", message: "Already answered" })
    return ctx.prisma.commission.update({
      where: { id: input.id },
      data: {
        displayAsExample: input.allow,
        displayPermissionAnswered: true,
      },
    })
  }),
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/routers/commission.ts
git commit -m "feat: submitRating and setDisplayPermission mutations"
```

---

### Task 3: Backend — shareToFeed, dismissFeedShare, and getApprovedWork

**Files:**
- Modify: `server/routers/commission.ts`

- [ ] **Step 1: Add `shareToFeed` mutation**

Add after `setDisplayPermission`:

```ts
shareToFeed: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const commission = await ctx.prisma.commission.findUnique({
      where: { id: input.id },
      include: {
        messages: {
          where: { fileUrl: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { fileUrl: true },
        },
      },
    })
    if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
    if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
    if (!commission.displayAsExample) throw new TRPCError({ code: "BAD_REQUEST", message: "Buyer has not approved display" })
    if (commission.artistFeedShareOffered) throw new TRPCError({ code: "BAD_REQUEST", message: "Already responded" })
    const fileUrl = commission.messages[0]?.fileUrl
    if (!fileUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "No delivered image found" })
    await ctx.prisma.$transaction([
      ctx.prisma.post.create({
        data: {
          userId: ctx.session.user.id,
          image: fileUrl,
          isCommission: true,
        },
      }),
      ctx.prisma.commission.update({
        where: { id: input.id },
        data: { artistFeedShareOffered: true },
      }),
    ])
    return { posted: true }
  }),
```

- [ ] **Step 2: Add `dismissFeedShare` mutation**

Add after `shareToFeed`:

```ts
dismissFeedShare: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
    if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
    if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
    if (commission.artistFeedShareOffered) throw new TRPCError({ code: "BAD_REQUEST", message: "Already responded" })
    return ctx.prisma.commission.update({
      where: { id: input.id },
      data: { artistFeedShareOffered: true },
    })
  }),
```

- [ ] **Step 3: Add `getApprovedWork` query**

Add after `dismissFeedShare`:

```ts
getApprovedWork: publicProcedure
  .input(z.object({ username: z.string() }))
  .query(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findFirst({
      where: { username: { equals: input.username, mode: "insensitive" } },
      select: { id: true },
    })
    if (!user) return []

    const commissions = await ctx.prisma.commission.findMany({
      where: { artistId: user.id, displayAsExample: true, status: "COMPLETE" },
      orderBy: { deliveredAt: "desc" },
      include: {
        messages: {
          where: { fileUrl: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { fileUrl: true },
        },
      },
    })

    return commissions
      .filter(c => c.messages.length > 0)
      .map(c => ({
        commissionId: c.id,
        fileUrl: c.messages[0].fileUrl!,
        deliveredAt: c.deliveredAt,
      }))
  }),
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/routers/commission.ts
git commit -m "feat: shareToFeed, dismissFeedShare, and getApprovedWork procedures"
```

---

### Task 4: Commission thread — Rating card (Card 1)

**Files:**
- Modify: `app/professional-dms/[id]/page.tsx`

- [ ] **Step 1: Add rating state and mutation**

In `CommissionThread`, after the `confirmDeliveryMutation` declaration (around line 172), add:

```ts
const [selectedRating, setSelectedRating] = useState(0)
const submitRatingMutation = trpc.commission.submitRating.useMutation({
  onSuccess: () => utils.commission.getById.invalidate({ id }),
})
```

- [ ] **Step 2: Add the Rating card in the scrollable messages area**

Find the `{/* Closed banners */}` section (around line 299). The COMPLETE banner currently is:
```tsx
{commission.status === "COMPLETE" && (
  <div className="mb-4 bg-green-500/20 rounded-2xl p-4 text-center" style={{ border: "1px solid #ffffff10" }}>
    <p className="text-sm font-semibold text-green-400">Commission complete ✓</p>
    <p className="text-xs text-green-400/70 mt-1">Payment has been released to the artist.</p>
  </div>
)}
```

After that closing `)}`, add the rating card:

```tsx
{/* Card 1: Rating (buyer only, shown while buyerRating is null) */}
{commission.status === "COMPLETE" && isBuyer && commission.buyerRating === null && (
  <div className="mb-4 rounded-2xl p-4" style={{ background: "#1e0d3f", border: "1px solid #ffffff15" }}>
    <p className="text-sm font-semibold text-white mb-1">How was your experience?</p>
    <p className="text-xs text-white/40 mb-3">Rate your commission with @{commission.artist.username}</p>
    <div className="flex gap-2 mb-4">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => setSelectedRating(star)}
          className="text-2xl transition-transform hover:scale-110"
        >
          {star <= selectedRating ? "★" : "☆"}
        </button>
      ))}
    </div>
    <button
      onClick={() => { if (selectedRating > 0) submitRatingMutation.mutate({ id, rating: selectedRating }) }}
      disabled={selectedRating === 0 || submitRatingMutation.isPending}
      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
    >
      {submitRatingMutation.isPending ? "Submitting…" : "Submit rating"}
    </button>
  </div>
)}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/professional-dms/[id]/page.tsx
git commit -m "feat: rating card in commission thread"
```

---

### Task 5: Commission thread — Display permission card (Card 2)

**Files:**
- Modify: `app/professional-dms/[id]/page.tsx`

- [ ] **Step 1: Add the setDisplayPermission mutation**

After `submitRatingMutation`, add:

```ts
const setDisplayPermissionMutation = trpc.commission.setDisplayPermission.useMutation({
  onSuccess: () => utils.commission.getById.invalidate({ id }),
})
```

- [ ] **Step 2: Add Card 2 in the scrollable area**

Directly after the Card 1 block, add:

```tsx
{/* Card 2: Display permission (buyer only, shown after rating, before permission answered) */}
{commission.status === "COMPLETE" && isBuyer && commission.buyerRating !== null && !commission.displayPermissionAnswered && (
  <div className="mb-4 rounded-2xl p-4" style={{ background: "#1e0d3f", border: "1px solid #ffffff15" }}>
    <p className="text-sm font-semibold text-white mb-1">Portfolio permission</p>
    <p className="text-xs text-white/50 mb-4">
      Can <span className="text-white">@{commission.artist.username}</span> display this work in their public portfolio?
    </p>
    <div className="flex gap-3">
      <button
        onClick={() => setDisplayPermissionMutation.mutate({ id, allow: true })}
        disabled={setDisplayPermissionMutation.isPending}
        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
      >
        Yes
      </button>
      <button
        onClick={() => setDisplayPermissionMutation.mutate({ id, allow: false })}
        disabled={setDisplayPermissionMutation.isPending}
        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors disabled:opacity-50"
        style={{ border: "1px solid #ffffff20" }}
      >
        No
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/professional-dms/[id]/page.tsx
git commit -m "feat: display permission card in commission thread"
```

---

### Task 6: Commission thread — Share to feed card (Card 3)

**Files:**
- Modify: `app/professional-dms/[id]/page.tsx`

- [ ] **Step 1: Add shareToFeed and dismissFeedShare mutations**

After `setDisplayPermissionMutation`, add:

```ts
const shareToFeedMutation = trpc.commission.shareToFeed.useMutation({
  onSuccess: () => utils.commission.getById.invalidate({ id }),
})
const dismissFeedShareMutation = trpc.commission.dismissFeedShare.useMutation({
  onSuccess: () => utils.commission.getById.invalidate({ id }),
})
```

- [ ] **Step 2: Derive the delivered image URL**

After the `otherParty` line (around line 217), add:

```ts
const deliveredFileUrl = commission.messages
  .filter(m => m.fileUrl)
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.fileUrl ?? null
```

- [ ] **Step 3: Add Card 3 in the scrollable area**

Directly after the Card 2 block, add:

```tsx
{/* Card 3: Share to feed (artist only, shown when buyer approved and artist hasn't responded) */}
{commission.status === "COMPLETE" && isArtist && commission.displayAsExample && !commission.artistFeedShareOffered && (
  <div className="mb-4 rounded-2xl p-4" style={{ background: "#1e0d3f", border: "1px solid #ffffff15" }}>
    {deliveredFileUrl && (
      <img
        src={deliveredFileUrl}
        alt="Completed commission"
        className="w-full rounded-xl object-cover max-h-48 mb-3"
        style={{ border: "1px solid #ffffff10" }}
      />
    )}
    <p className="text-sm font-semibold text-white mb-1">Your buyer approved this work!</p>
    <p className="text-xs text-white/50 mb-4">It will appear in your portfolio. Want to also post it to your feed?</p>
    <div className="flex gap-3">
      <button
        onClick={() => shareToFeedMutation.mutate({ id })}
        disabled={shareToFeedMutation.isPending || dismissFeedShareMutation.isPending}
        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
      >
        {shareToFeedMutation.isPending ? "Posting…" : "Post to feed"}
      </button>
      <button
        onClick={() => dismissFeedShareMutation.mutate({ id })}
        disabled={shareToFeedMutation.isPending || dismissFeedShareMutation.isPending}
        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors disabled:opacity-50"
        style={{ border: "1px solid #ffffff20" }}
      >
        Not now
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/professional-dms/[id]/page.tsx
git commit -m "feat: share-to-feed card in commission thread"
```

---

### Task 7: Profile page — merge approved work into Commissions tab gallery

**Files:**
- Modify: `app/[username]/page.tsx`

- [ ] **Step 1: Add the getApprovedWork query**

In `ProfilePage`, after the `commissionProfile` query line:
```ts
const { data: commissionProfile } = trpc.commission.getProfile.useQuery({ username })
```

Add:
```ts
const { data: approvedWork } = trpc.commission.getApprovedWork.useQuery({ username })
```

- [ ] **Step 2: Build a merged gallery list**

After the `isOwn` computation (around line 160), add:

```ts
const galleryImages: { src: string; key: string }[] = [
  ...(approvedWork ?? []).map(w => ({ src: w.fileUrl, key: `approved-${w.commissionId}` })),
  ...(commissionProfile?.commissionCardImages ?? []).map(img => ({ src: img, key: `manual-${img}` })),
]
```

- [ ] **Step 3: Replace the gallery rendering in the Commissions tab**

Find the example work gallery block (the `{commissionProfile.commissionCardImages && ...}` section). Replace it with:

```tsx
{/* Example work gallery */}
{galleryImages.length > 0 ? (
  <>
    <p className="text-xs text-white/40 mb-3 uppercase tracking-wide font-semibold">Example work</p>
    <div className="grid grid-cols-3 gap-0.5">
      {galleryImages.map(({ src, key }) => (
        <div key={key} className="relative aspect-square overflow-hidden" style={{ background: "#ffffff08" }}>
          <img src={src} alt="Example work" className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  </>
) : (
  <div className="text-center py-12">
    <div className="text-4xl mb-3">🎨</div>
    <p className="font-medium text-white/50">No example work yet</p>
    {isOwn && (
      <p className="text-sm mt-1 text-white/30">Add images in your Artist Dashboard</p>
    )}
  </div>
)}
```

Note: the `galleryImages` variable is computed outside the `{!commissionProfile ? ... : ...}` block, so move it above the `return` but after `isOwn`. The gallery rendering replaces the block inside the `commissionProfile` truthy branch.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/[username]/page.tsx
git commit -m "feat: merge approved commission work into profile gallery"
```

---

### Task 8: Deploy and smoke test

- [ ] **Step 1: Deploy**

```bash
npx vercel deploy --prod
```

Expected: deployment URL printed, aliased to `https://gallery-ebon-xi.vercel.app`.

- [ ] **Step 2: Test rating card**

Log in as a buyer on a COMPLETE commission thread. Verify the rating card appears below the "Commission complete ✓" banner. Tap 4 stars, hit Submit. Card should disappear and the display permission card should appear.

- [ ] **Step 3: Test display permission card**

From the same buyer view, click Yes on the permission card. Card should disappear. Log in as the artist on the same thread — the "Your buyer approved this work!" card should appear with the delivered image thumbnail.

- [ ] **Step 4: Test share to feed**

As the artist, click "Post to feed". Card disappears. Visit the artist's profile Posts tab — the commission image should appear in the grid with a "Comm" badge.

- [ ] **Step 5: Test "Not now"**

On a second test commission (or after resetting state), as the artist click "Not now". Card disappears. Image should NOT appear in the Posts tab but SHOULD appear in the Commissions tab gallery.

- [ ] **Step 6: Test Commissions tab gallery**

Visit the artist's profile Commissions tab. The approved commission image should appear first in the gallery grid, before any manually uploaded images.

- [ ] **Step 7: Test No permission**

On a third test or reset: as buyer, click No on the display permission card. Card disappears. The artist should NOT see Card 3 at all. The image should NOT appear in the Commissions tab gallery.
