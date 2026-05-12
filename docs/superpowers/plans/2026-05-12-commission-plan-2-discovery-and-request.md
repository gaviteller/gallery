# Commission System — Plan 2: Discovery Feed & Request Form

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the commission discovery feed at `/commissions`, the commission request modal, and wire up the "Request Commission" button on artist profile pages.

**Architecture:** The `/commissions` page is a client component that calls `trpc.commission.getDiscovery`. Each artist card shows their sample commission posts and links to their profile's Commissions tab. A `CommissionRequestModal` component handles form submission and navigates to the new Professional DM thread on success. The artist profile's Commissions tab gets a "Request Commission" button that opens the same modal.

**Tech Stack:** Prisma 5 + PostgreSQL (Neon), tRPC v11, Next.js 16 App Router, Tailwind CSS, React 19.

**Prerequisite:** Plan 1 must be complete (schema, tRPC routers, Professional Profile page all exist).

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `app/commissions/page.tsx` | Create | Discovery feed with search |
| `components/CommissionRequestModal.tsx` | Create | Request form modal (shared) |
| `app/[username]/page.tsx` | Modify | Add Request Commission button to Commissions tab |

---

## Task 1: Commission discovery feed page

**Files:**
- Create: `app/commissions/page.tsx`

The BottomNav already links to `/commissions`. This page shows all OPEN/LIMITED artists with example photos, name, average price, follow and request buttons. A search bar at the top filters by name or art style; price range inputs filter by average price.

- [ ] **Step 1: Create the page**

Create `app/commissions/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { trpc } from "@/components/providers"
import CommissionRequestModal from "@/components/CommissionRequestModal"

type DiscoveryUser = {
  id: string
  username: string | null
  name: string | null
  image: string | null
  commissionStatus: "OPEN" | "LIMITED" | "CLOSED"
  priceRanges: { label: string; price: number }[] | null
  posts: { id: string; image: string }[]
  commissionCategories: { name: string; options: string[] }[]
}

const statusBadge = {
  OPEN: "bg-green-100 text-green-700",
  LIMITED: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-gray-100 text-gray-500",
}

function avgPrice(ranges: { label: string; price: number }[] | null): string {
  if (!ranges || ranges.length === 0) return "Price TBD"
  const avg = ranges.reduce((s, r) => s + r.price, 0) / ranges.length
  return `avg $${Math.round(avg)}`
}

function ArtistCard({
  artist,
  onRequest,
}: {
  artist: DiscoveryUser
  onRequest: (artist: DiscoveryUser) => void
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const utils = trpc.useUtils()

  const { data: followData } = trpc.follow.status.useQuery(
    { username: artist.username! },
    { enabled: !!artist.username }
  )
  const followMutation = trpc.follow.follow.useMutation({
    onSuccess: () => utils.follow.status.invalidate({ username: artist.username! }),
  })
  const unfollowMutation = trpc.follow.unfollow.useMutation({
    onSuccess: () => utils.follow.status.invalidate({ username: artist.username! }),
  })

  function handleCardClick() {
    router.push(`/@${artist.username}?tab=Commissions`)
  }

  function handleFollow(e: React.MouseEvent) {
    e.stopPropagation()
    if (!session) { router.push("/signin"); return }
    if (followData?.following) {
      unfollowMutation.mutate({ username: artist.username! })
    } else {
      followMutation.mutate({ username: artist.username! })
    }
  }

  function handleRequest(e: React.MouseEvent) {
    e.stopPropagation()
    if (!session) { router.push("/signin"); return }
    onRequest(artist)
  }

  const photos = artist.posts.slice(0, 6)

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:border-gray-300 hover:shadow-md transition-all"
    >
      {/* Photo grid */}
      <div className="aspect-square bg-gray-100 overflow-hidden">
        {photos.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-xs text-gray-400">No examples yet</p>
          </div>
        ) : photos.length === 1 ? (
          <img src={photos[0].image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full grid gap-0.5 ${photos.length >= 4 ? "grid-cols-2 grid-rows-2" : "grid-cols-2"}`}>
            {photos.slice(0, 4).map((p, i) => (
              <img key={p.id} src={p.image} alt="" className="w-full h-full object-cover" />
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900 truncate">@{artist.username}</p>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge[artist.commissionStatus]}`}>
              {artist.commissionStatus === "LIMITED" ? "Limited" : "Open"}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-3">{avgPrice(artist.priceRanges)}</p>
        <div className="flex gap-2">
          <button
            onClick={handleFollow}
            disabled={followMutation.isPending || unfollowMutation.isPending}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${
              followData?.following
                ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {followData?.following ? "Following" : "Follow"}
          </button>
          <button
            onClick={handleRequest}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Request
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CommissionsPage() {
  const [search, setSearch] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [requestTarget, setRequestTarget] = useState<DiscoveryUser | null>(null)

  const { data: artists, isLoading } = trpc.commission.getDiscovery.useQuery({
    search: search.trim() || undefined,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
  })

  return (
    <>
      {requestTarget && (
        <CommissionRequestModal
          artistId={requestTarget.id}
          artistUsername={requestTarget.username!}
          categories={requestTarget.commissionCategories}
          onClose={() => setRequestTarget(null)}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Commissions</h1>

        {/* Search + filters */}
        <div className="flex flex-col gap-2 mb-6">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by artist name or art style…"
            className="w-full px-4 py-3 bg-gray-100 rounded-xl text-sm text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
              placeholder="Min price ($)"
              min="0"
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              placeholder="Max price ($)"
              min="0"
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-400 text-sm">Loading artists…</p>
          </div>
        ) : !artists || artists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-gray-500 font-medium">No artists found</p>
            <p className="text-xs text-gray-400">
              {search ? "Try a different search term" : "No artists are currently open for commissions"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {artists.map(artist => (
              <ArtistCard
                key={artist.id}
                artist={artist as DiscoveryUser}
                onRequest={setRequestTarget}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify the page loads**

Navigate to `http://localhost:3000/commissions`. Expected: page renders, "No artists are currently open for commissions" if none exist yet, or artist cards if any user has `commissionStatus: OPEN` and `sellingEnabled: true`.

To test with real data: go to `/professional-profile`, set status to OPEN, save, then reload `/commissions`.

- [ ] **Step 3: Commit**

```bash
git add app/commissions/page.tsx
git commit -m "feat: add commission discovery feed page"
```

---

## Task 2: CommissionRequestModal component

**Files:**
- Create: `components/CommissionRequestModal.tsx`

This modal is used in two places: the discovery feed card and the artist's Commissions tab. It takes `artistId`, `artistUsername`, and `categories` (the artist's configured dropdowns) as props. On successful submission it navigates to `/professional-dms/{commissionId}`.

- [ ] **Step 1: Create the component**

Create `components/CommissionRequestModal.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

type Category = { name: string; options: string[] }

type Props = {
  artistId: string
  artistUsername: string
  categories: Category[]
  onClose: () => void
}

function processImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        const maxSize = 1200
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
          else { width = Math.round((width * maxSize) / height); height = maxSize }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width; canvas.height = height
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.85))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function CommissionRequestModal({ artistId, artistUsername, categories, onClose }: Props) {
  const router = useRouter()
  const [description, setDescription] = useState("")
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [refPhotos, setRefPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const submitRequest = trpc.commission.submitRequest.useMutation({
    onSuccess: (commission) => {
      onClose()
      router.push(`/professional-dms/${commission.id}`)
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  function setSelection(categoryName: string, value: string) {
    setSelections(prev => ({ ...prev, [categoryName]: value }))
  }

  async function handleRefPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    if (refPhotos.length + files.length > 5) {
      setError("Maximum 5 reference photos")
      return
    }
    setUploading(true)
    const processed = await Promise.all(files.map(f => processImage(f)))
    setRefPhotos(prev => [...prev, ...processed])
    setUploading(false)
  }

  function removeRefPhoto(i: number) {
    setRefPhotos(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit() {
    setError("")

    if (!description.trim()) {
      setError("Please describe what you want")
      return
    }

    // All dropdowns are mandatory
    for (const cat of categories) {
      if (!selections[cat.name]) {
        setError(`Please select an option for "${cat.name}"`)
        return
      }
    }

    submitRequest.mutate({
      artistId,
      description: description.trim(),
      dropdownSelections: selections,
      referencePhotos: refPhotos,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl flex flex-col max-h-screen sm:max-h-[90vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Request a commission</h2>
            <p className="text-xs text-gray-400 mt-0.5">@{artistUsername}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              Describe what you want <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Be as detailed as possible — character description, mood, setting, any specific requirements…"
              rows={5}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Artist-defined dropdowns */}
          {categories.map(cat => (
            <div key={cat.name}>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                {cat.name} <span className="text-red-400">*</span>
              </label>
              <select
                value={selections[cat.name] ?? ""}
                onChange={e => setSelection(cat.name, e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>Select {cat.name.toLowerCase()}…</option>
                {cat.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          ))}

          {/* Reference photos (optional) */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              Reference photos <span className="text-gray-400 font-normal">(optional, max 5)</span>
            </label>
            {refPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {refPhotos.map((photo, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeRefPhoto(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {refPhotos.length < 5 && (
              <label className="flex items-center gap-2 cursor-pointer px-4 py-3 border border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm text-gray-500">{uploading ? "Processing…" : "Add reference photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleRefPhotoUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-5 py-4">
          <button
            onClick={handleSubmit}
            disabled={submitRequest.isPending || uploading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitRequest.isPending ? "Sending request…" : "Send commission request"}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the modal works from the discovery feed**

Navigate to `/commissions`, tap "Request" on an artist card. Expected: modal slides up with the description textarea and the artist's configured dropdowns. If the artist has no categories configured, only the description and reference photo fields show.

Submitting with missing mandatory fields should show an error. Submitting a complete form should navigate to `/professional-dms/{id}` (which will 404 until Plan 3 is complete — that's expected).

- [ ] **Step 3: Commit**

```bash
git add components/CommissionRequestModal.tsx
git commit -m "feat: add CommissionRequestModal component"
```

---

## Task 3: Add Request Commission button to the artist profile Commissions tab

**Files:**
- Modify: `app/[username]/page.tsx`

The Commissions tab already exists and shows posts with `isCommission: true`. We need to:
1. Load the artist's commission profile (for status badge and `artistId`)
2. Add a "Request Commission" button at the top of the Commissions tab (only if artist is OPEN/LIMITED and viewer is not the owner)
3. Load the artist's categories to pass to the modal

- [ ] **Step 1: Add commission profile query and modal state to the profile page**

In `app/[username]/page.tsx`, find the existing tRPC queries block (around line 59-64). Add these queries after the existing ones:

```typescript
  const { data: commissionProfile } = trpc.commission.getProfile.useQuery({ username })
  const { data: commissionCategories } = trpc.commission.getCategories.useQuery({ username })
```

Still in the same file, find the `useState` declarations near the top of the component. Add:

```typescript
  const [showCommissionRequest, setShowCommissionRequest] = useState(false)
```

Add the import for CommissionRequestModal at the top of the file with the other imports:

```typescript
import CommissionRequestModal from "@/components/CommissionRequestModal"
```

- [ ] **Step 2: Add the modal render and the button to the Commissions tab**

In `app/[username]/page.tsx`, find the `return (` statement. Just inside it, before the outer `<div>`, add the modal render:

```tsx
      {showCommissionRequest && commissionProfile && commissionCategories && (
        <CommissionRequestModal
          artistId={commissionProfile.id}
          artistUsername={username}
          categories={commissionCategories}
          onClose={() => setShowCommissionRequest(false)}
        />
      )}
```

Now find the Commissions tab content. It currently looks something like:

```tsx
          {tab === "Commissions" && (
```

Inside that block, before the grid of commission posts, add the request button section:

```tsx
          {tab === "Commissions" && (
            <div>
              {/* Request Commission button — show to non-owners when artist is open */}
              {!isOwn && commissionProfile && commissionProfile.commissionStatus !== "CLOSED" && (
                <div className="mb-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        commissionProfile.commissionStatus === "OPEN"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {commissionProfile.commissionStatus === "OPEN" ? "Open for commissions" : "Limited slots"}
                      </span>
                      {commissionProfile.commissionTurnaround && (
                        <p className="text-xs text-gray-400 mt-1">Turnaround: {commissionProfile.commissionTurnaround}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setShowCommissionRequest(true)}
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Request Commission
                    </button>
                  </div>
                  {commissionProfile.commissionDescription && (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
                      {commissionProfile.commissionDescription}
                    </p>
                  )}
                </div>
              )}
```

Make sure to close the wrapping `<div>` you added around the tab content at the end of the Commissions tab section. The end of the Commissions tab block should look like:

```tsx
              {/* existing commission posts grid here */}
            </div>
          )}
```

- [ ] **Step 3: Verify the button appears on an artist's profile**

Navigate to another user's profile (not your own) whose commission status is OPEN. The Commissions tab should show the status badge, turnaround time, description, and "Request Commission" button above the example posts. Clicking the button opens the `CommissionRequestModal`.

For your own profile, the button should not appear.

- [ ] **Step 4: Commit and push**

```bash
git add app/[username]/page.tsx
git commit -m "feat: add Request Commission button to artist profile Commissions tab"
git push
```

---

## What's next

**Plan 3** builds the Professional DMs list (`/professional-dms`) and thread pages (`/professional-dms/[id]`), where the full commission lifecycle (accept, pay, deliver, confirm) plays out.
