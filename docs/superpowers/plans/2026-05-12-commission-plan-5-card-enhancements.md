# Commission Plan 5 — Card Enhancements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give artists a dedicated commission card gallery (up to 5 images, separate from their portfolio), an art-styles tag list shown on discovery cards, and a "Completed Work" section on their public profile that surfaces delivery images from finished commissions.

**Architecture:** Two new `String[]` columns on `User` (`commissionCardImages`, `artStyles`) handle the gallery and styles. The `updateProfile` tRPC mutation is extended to accept both. Discovery cards swap the current post-photo grid for the new card images. Completed work is queried via the existing `Commission` model (status = COMPLETE, messages with fileUrl).

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 5 / PostgreSQL, Tailwind v4.

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `commissionCardImages String[] @default([])` and `artStyles String[] @default([])` to `User` |
| `server/routers/commission.ts` | `updateProfile` accepts new fields; `getProfile` and `getDiscovery` return them; add `getCompletedWork` query |
| `app/professional-profile/page.tsx` | Upload UI for card images (up to 5, processImage helper); art style chip input |
| `app/commissions/page.tsx` | Commission cards show `commissionCardImages` as swipeable carousel instead of post grid |
| `app/[username]/page.tsx` | Add "Completed Work" tab (or section within profile) showing delivery images |

---

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add two fields to `User` in `prisma/schema.prisma`**

After `commissionTurnaround String?`, add:
```prisma
commissionCardImages String[] @default([])
artStyles            String[] @default([])
```

Full updated User commission block:
```prisma
commissionDescription    String?   @db.Text
commissionTurnaround     String?
priceRanges              Json?
commissionCardImages     String[]  @default([])
artStyles                String[]  @default([])
```

- [ ] **Step 2: Run migration**
```bash
npx prisma migrate dev --name add-commission-card-images-and-art-styles
```
Expected: "Your database is now in sync with your schema."

- [ ] **Step 3: Commit**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add commissionCardImages and artStyles to User schema"
```

---

### Task 2: Backend — updateProfile, getProfile, getDiscovery

**Files:**
- Modify: `server/routers/commission.ts`

- [ ] **Step 1: Extend `updateProfile` input schema**

Find the `updateProfile` input zod object and add:
```ts
commissionCardImages: z.array(z.string()).max(5).optional(),
artStyles: z.array(z.string().min(1).max(50)).max(20).optional(),
```

Full updated input:
```ts
updateProfile: protectedProcedure
  .input(z.object({
    commissionStatus: z.enum(["OPEN", "LIMITED", "CLOSED"]),
    commissionDescription: z.string().max(2000).optional(),
    commissionTurnaround: z.string().max(100).optional(),
    priceRanges: priceRangeSchema.optional(),
    commissionCardImages: z.array(z.string()).max(5).optional(),
    artStyles: z.array(z.string().min(1).max(50)).max(20).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    return ctx.prisma.user.update({
      where: { id: ctx.session.user.id },
      data: {
        commissionStatus: input.commissionStatus,
        commissionDescription: input.commissionDescription ?? null,
        commissionTurnaround: input.commissionTurnaround ?? null,
        priceRanges: input.priceRanges ?? [],
        ...(input.commissionCardImages !== undefined && { commissionCardImages: input.commissionCardImages }),
        ...(input.artStyles !== undefined && { artStyles: input.artStyles }),
      },
    })
  }),
```

- [ ] **Step 2: Add `commissionCardImages` and `artStyles` to `getProfile` select**

Find the `getProfile` select block and add:
```ts
commissionCardImages: true,
artStyles: true,
```

- [ ] **Step 3: Add `commissionCardImages` and `artStyles` to `getDiscovery` select**

Find the `getDiscovery` select block and add:
```ts
commissionCardImages: true,
artStyles: true,
```

- [ ] **Step 4: Add `getCompletedWork` query**

After the `getDiscovery` procedure, add:
```ts
getCompletedWork: publicProcedure
  .input(z.object({ username: z.string() }))
  .query(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findFirst({
      where: { username: { equals: input.username, mode: "insensitive" } },
      select: { id: true },
    })
    if (!user) return []

    // Find complete commissions for this artist that have a delivery image
    const commissions = await ctx.prisma.commission.findMany({
      where: { artistId: user.id, status: "COMPLETE" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        messages: {
          where: { fileUrl: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { fileUrl: true },
        },
        buyer: { select: { username: true, name: true, image: true } },
      },
    })

    return commissions
      .filter(c => c.messages.length > 0)
      .map(c => ({
        id: c.id,
        fileUrl: c.messages[0].fileUrl!,
        buyer: c.buyer,
        completedAt: c.updatedAt,
      }))
  }),
```

- [ ] **Step 5: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 6: Commit**
```bash
git add server/routers/commission.ts
git commit -m "feat: updateProfile accepts card images and art styles; add getCompletedWork"
```

---

### Task 3: Artist Dashboard — card image upload UI

**Files:**
- Modify: `app/professional-profile/page.tsx`

The page already has a `processImage` helper… actually it doesn't — that helper lives in the DM thread page. We need to add it here.

- [ ] **Step 1: Add `processImage` helper at the top of `app/professional-profile/page.tsx`** (after imports)

```ts
function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.onload = (e) => {
      const img = new window.Image()
      img.onerror = () => reject(new Error("Failed to load image"))
      img.onload = () => {
        let { width, height } = img
        const maxSize = 1200
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
          else { width = Math.round((width * maxSize) / height); height = maxSize }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("Canvas not available")); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.85))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}
```

- [ ] **Step 2: Add state for card images in `ProfessionalProfileInner`**

Add these state variables alongside the existing ones:
```ts
const [cardImages, setCardImages] = useState<string[]>([])
const [uploadingCard, setUploadingCard] = useState(false)
const [cardUploadError, setCardUploadError] = useState("")
```

- [ ] **Step 3: Initialize card images from profile in the `useEffect`**

Inside the existing `useEffect(() => { if (profile && !initialized) { ... } }, [profile, initialized])`, add:
```ts
setCardImages((profile.commissionCardImages as string[]) ?? [])
```

- [ ] **Step 4: Add art styles state**

```ts
const [artStyles, setArtStyles] = useState<string[]>([])
const [artStyleInput, setArtStyleInput] = useState("")
```

And in the same `useEffect`:
```ts
setArtStyles((profile.artStyles as string[]) ?? [])
```

- [ ] **Step 5: Update `saveSettings` to send new fields**

```ts
function saveSettings() {
  updateProfile.mutate({
    commissionStatus: status,
    commissionDescription: description,
    commissionTurnaround: turnaround,
    priceRanges,
    commissionCardImages: cardImages,
    artStyles,
  })
}
```

- [ ] **Step 6: Add card image upload handler**

```ts
async function handleCardImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const files = Array.from(e.target.files ?? [])
  if (files.length === 0) return
  if (cardImages.length + files.length > 5) {
    setCardUploadError("Maximum 5 commission card images")
    return
  }
  setCardUploadError("")
  setUploadingCard(true)
  try {
    const processed = await Promise.all(files.map(processImage))
    setCardImages(prev => [...prev, ...processed].slice(0, 5))
  } catch {
    setCardUploadError("Failed to process image. Please try a different file.")
  } finally {
    setUploadingCard(false)
  }
}
```

- [ ] **Step 7: Add Commission Card Images section to the JSX — insert before the "Commission Form Options" section**

```tsx
{/* ── Commission Card Images ── */}
<section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">Commission Card Images</h2>
  <p className="text-xs text-gray-400 mb-4">Up to 5 images shown on your commission card in the discovery feed. Separate from your portfolio.</p>

  {cardImages.length > 0 && (
    <div className="flex gap-2 flex-wrap mb-4">
      {cardImages.map((img, i) => (
        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
          <img src={img} alt="" className="w-full h-full object-cover" />
          <button
            onClick={() => setCardImages(prev => prev.filter((_, idx) => idx !== i))}
            className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )}

  {cardUploadError && <p className="text-xs text-red-500 mb-2">{cardUploadError}</p>}

  {cardImages.length < 5 && (
    <label className="flex items-center gap-2 cursor-pointer px-4 py-3 border border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      <span className="text-sm text-gray-500">{uploadingCard ? "Processing…" : `Add image (${cardImages.length}/5)`}</span>
      <input type="file" accept="image/*" multiple className="hidden" onChange={handleCardImageUpload} disabled={uploadingCard} />
    </label>
  )}

  <p className="text-xs text-gray-400 mt-3">Changes are saved when you click "Save settings" above.</p>
</section>
```

- [ ] **Step 8: Add Art Styles section — insert after Commission Card Images, before Commission Form Options**

```tsx
{/* ── Art Styles ── */}
<section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">Art Styles</h2>
  <p className="text-xs text-gray-400 mb-3">Tags shown on your commission card to help clients find you.</p>

  {artStyles.length > 0 && (
    <div className="flex flex-wrap gap-2 mb-3">
      {artStyles.map(s => (
        <span key={s} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
          {s}
          <button type="button" onClick={() => setArtStyles(prev => prev.filter(x => x !== s))} className="text-blue-400 hover:text-blue-700 ml-0.5">×</button>
        </span>
      ))}
    </div>
  )}

  <div className="flex gap-2">
    <input
      type="text"
      value={artStyleInput}
      onChange={e => setArtStyleInput(e.target.value)}
      onKeyDown={e => {
        if ((e.key === "Enter" || e.key === ",") && artStyleInput.trim()) {
          e.preventDefault()
          const trimmed = artStyleInput.trim().replace(/,$/, "")
          if (trimmed && !artStyles.includes(trimmed) && artStyles.length < 20) {
            setArtStyles(prev => [...prev, trimmed])
          }
          setArtStyleInput("")
        }
      }}
      placeholder="Add style, press Enter (e.g. Anime, Realistic)"
      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <button
      type="button"
      onClick={() => {
        const trimmed = artStyleInput.trim()
        if (trimmed && !artStyles.includes(trimmed) && artStyles.length < 20) {
          setArtStyles(prev => [...prev, trimmed])
          setArtStyleInput("")
        }
      }}
      className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors"
    >
      Add
    </button>
  </div>
  <p className="text-xs text-gray-400 mt-3">Changes are saved when you click "Save settings" above.</p>
</section>
```

- [ ] **Step 9: TypeScript check**
```bash
npx tsc --noEmit
```

- [ ] **Step 10: Commit**
```bash
git add app/professional-profile/page.tsx
git commit -m "feat: commission card image upload and art style tags in Artist Dashboard"
```

---

### Task 4: Commission discovery cards — swipeable card image carousel

**Files:**
- Modify: `app/commissions/page.tsx`

The `DiscoveryUser` type needs updating and the card's image area needs to become a swipeable carousel over `commissionCardImages`. Fall back to portfolio posts if no card images uploaded.

- [ ] **Step 1: Update `DiscoveryUser` type**

Add:
```ts
commissionCardImages: string[]
artStyles: string[]
```

Full updated type:
```ts
type DiscoveryUser = {
  id: string
  username: string | null
  name: string | null
  image: string | null
  commissionStatus: "OPEN" | "LIMITED" | "CLOSED"
  commissionDescription: string | null
  commissionTurnaround: string | null
  commissionCardImages: string[]
  artStyles: string[]
  priceRanges: { label: string; price: number }[] | null
  posts: { id: string; image: string }[]
  commissionCategories: { name: string; options: string[] }[]
}
```

- [ ] **Step 2: Add swipe state to `ArtistCard`**

```ts
const [imgIndex, setImgIndex] = useState(0)
```

- [ ] **Step 3: Replace the photo grid with a swipeable carousel**

The `photos` variable should now prefer `commissionCardImages` over portfolio posts:
```ts
const images: string[] =
  artist.commissionCardImages.length > 0
    ? artist.commissionCardImages
    : artist.posts.map(p => p.image)
```

Replace the entire photo grid JSX:
```tsx
{/* Swipeable image carousel */}
<div className="aspect-square bg-gray-100 overflow-hidden relative">
  {images.length === 0 ? (
    <div className="w-full h-full flex items-center justify-center">
      <p className="text-xs text-gray-400">No examples</p>
    </div>
  ) : (
    <>
      <img
        src={images[imgIndex]}
        alt=""
        className="w-full h-full object-cover"
      />
      {images.length > 1 && (
        <>
          {/* Prev / next tap zones */}
          <button
            onClick={e => { e.stopPropagation(); setImgIndex(i => (i - 1 + images.length) % images.length) }}
            className="absolute left-0 top-0 h-full w-1/3"
            aria-label="Previous"
          />
          <button
            onClick={e => { e.stopPropagation(); setImgIndex(i => (i + 1) % images.length) }}
            className="absolute right-0 top-0 h-full w-1/3"
            aria-label="Next"
          />
          {/* Dot indicators */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {images.map((_, i) => (
              <span
                key={i}
                className={`block w-1.5 h-1.5 rounded-full transition-colors ${i === imgIndex ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </>
  )}
</div>
```

- [ ] **Step 4: Show art styles as chips below the price row**

In the info section, after the price/turnaround row, add:
```tsx
{artist.artStyles.length > 0 && (
  <div className="flex flex-wrap gap-1 mb-2">
    {artist.artStyles.slice(0, 3).map(s => (
      <span key={s} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{s}</span>
    ))}
    {artist.artStyles.length > 3 && (
      <span className="text-[9px] text-gray-400">+{artist.artStyles.length - 3}</span>
    )}
  </div>
)}
```

- [ ] **Step 5: TypeScript check**
```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**
```bash
git add app/commissions/page.tsx
git commit -m "feat: swipeable card image carousel and art style chips on discovery cards"
```

---

### Task 5: Completed Work on artist profile

**Files:**
- Modify: `app/[username]/page.tsx`

Add a "Work" tab (or rename "Commissions" to something appropriate) that shows a grid of delivery images from completed commissions. The tab only shows for non-owners (visitors) since it's a portfolio of completed work.

- [ ] **Step 1: Add `getCompletedWork` query call in the profile page**

In the data-fetching block at the top of the profile component, add:
```ts
const { data: completedWork } = trpc.commission.getCompletedWork.useQuery({ username })
```

- [ ] **Step 2: Add "Completed Work" to the tabs array — only show if there is any**

```ts
const tabs = ["Posts", "Shop", "Commissions", "About"]
// Completed Work tab shows if there's data (even for owner, so they can preview)
```

Change the tabs definition in JSX:
```tsx
{["Posts", "Shop", "Commissions", ...(completedWork && completedWork.length > 0 ? ["Completed Work"] : []), "About"].map((t) => (
  <button key={t} onClick={() => setTab(t)}
    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
    {t}
  </button>
))}
```

- [ ] **Step 3: Add Completed Work tab content after the About tab block**

```tsx
{tab === "Completed Work" && (
  <div>
    {!completedWork || completedWork.length === 0 ? (
      <div className="text-center py-16 text-gray-400">No completed commissions yet</div>
    ) : (
      <div className="grid grid-cols-3 gap-0.5">
        {completedWork.map(item => (
          <div key={item.id} className="aspect-square overflow-hidden bg-gray-100">
            <img src={item.fileUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: TypeScript check**
```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**
```bash
git add app/[username]/page.tsx
git commit -m "feat: Completed Work tab on artist profile showing delivery images"
```

---

### Task 6: Deploy

- [ ] **Step 1: Final build check**
```bash
npx tsc --noEmit
```

- [ ] **Step 2: Deploy**
```bash
npx vercel --prod
```
Expected: "Production: https://..."
