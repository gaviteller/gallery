# Cloudinary Image Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all new user-uploaded images from base64 strings stored in the Postgres DB to Cloudinary URLs, so the DB stays lean and images survive a DB reset.

**Architecture:** A single protected API route (`POST /api/upload`) receives a base64 data URL and a folder name, uploads to Cloudinary using the `cloudinary` npm package, and returns `{ url: string }`. A tiny client helper `lib/upload.ts` wraps the fetch call. All six upload points in the app call `uploadImage()` before their tRPC mutations — the mutation receives a Cloudinary HTTPS URL instead of a base64 string. No DB schema changes required.

**Tech Stack:** Next.js 16 App Router, TypeScript, `cloudinary` npm package, next-auth (`getServerSession`), existing tRPC mutations unchanged

---

### Task 1: Install cloudinary + create `app/api/upload/route.ts`

**Files:**
- Modify: `package.json` (via npm install)
- Create: `app/api/upload/route.ts`

- [ ] **Step 1: Install the cloudinary package**

Run from `C:\Users\gavri\OneDrive\Documents\Projects\gallery`:

```
npm install cloudinary
```

Expected: `cloudinary` added to `package.json` dependencies, `node_modules/cloudinary` present.

- [ ] **Step 2: Create the upload API route**

Create `app/api/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const ALLOWED_FOLDERS = ["posts", "avatars", "banners", "stories", "commissions"] as const
type AllowedFolder = typeof ALLOWED_FOLDERS[number]

function isAllowedFolder(f: unknown): f is AllowedFolder {
  return ALLOWED_FOLDERS.includes(f as AllowedFolder)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { image?: unknown; folder?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { image, folder } = body

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "image must be a base64 data URL" }, { status: 400 })
  }

  if (!isAllowedFolder(folder)) {
    return NextResponse.json({ error: `folder must be one of: ${ALLOWED_FOLDERS.join(", ")}` }, { status: 400 })
  }

  try {
    const result = await cloudinary.uploader.upload(image, { folder })
    return NextResponse.json({ url: result.secure_url })
  } catch (err) {
    console.error("[upload] cloudinary error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Add env vars to `.env.local`**

Open `.env.local` and add (replace with real values from your Cloudinary dashboard):

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Also add these to your Vercel project environment variables (Settings → Environment Variables).

- [ ] **Step 4: Smoke test the route manually**

Start the dev server (`npm run dev`) then in a separate terminal (or Postman), confirm a 401 is returned when not signed in:

```
curl -s -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/jpeg;base64,/9j/test","folder":"posts"}' | cat
```

Expected output contains `"Unauthorized"`. (Full auth test is done in Task 3 when the UI is wired up.)

- [ ] **Step 5: Commit**

```
git add app/api/upload/route.ts package.json package-lock.json
git commit -m "feat: add Cloudinary upload API route"
```

---

### Task 2: Create `lib/upload.ts` client helper

**Files:**
- Create: `lib/upload.ts`

- [ ] **Step 1: Create the helper**

Create `lib/upload.ts`:

```typescript
/**
 * Uploads a base64 data URL to Cloudinary via the /api/upload route.
 * Returns the Cloudinary HTTPS URL.
 */
export async function uploadImage(base64: string, folder: "posts" | "avatars" | "banners" | "stories" | "commissions"): Promise<string> {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, folder }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? "Image upload failed")
  }

  const data = await res.json() as { url: string }
  return data.url
}
```

- [ ] **Step 2: Commit**

```
git add lib/upload.ts
git commit -m "feat: add uploadImage client helper"
```

---

### Task 3: Update post upload in `app/[username]/page.tsx`

**Files:**
- Modify: `app/[username]/page.tsx`

The post upload button (around line 901) currently calls `createPost.mutate({ image: watermarked })` directly with a base64 string. We intercept before the mutate call, upload to Cloudinary, then pass the URL.

The shop item button (around line 980) calls `createShopItem.mutate({ image: shopImage })` with a base64 string. Same pattern.

- [ ] **Step 1: Add the import**

At the top of `app/[username]/page.tsx`, add the import after the existing imports:

```typescript
import { uploadImage } from "@/lib/upload"
```

- [ ] **Step 2: Update the post upload button handler**

Find the `onClick` handler for the post Share button (the one that calls `applyWatermark` and then `createPost.mutate`). The current code is:

```typescript
onClick={async () => {
  if (!uploadImage) return
  const imageToPost = uploadImage
  setIsWatermarking(true)
  try {
    const watermarked = await applyWatermark(imageToPost, session?.user?.username ?? "gallery")
    createPost.mutate({
      image: watermarked,
      description: uploadDesc.trim() || undefined,
      isAiGenerated: uploadIsAi,
      isCommission: uploadIsCommission,
    })
  } catch {
    console.warn("[watermark] applyWatermark failed, posting without watermark")
    createPost.mutate({
      image: imageToPost,
      description: uploadDesc.trim() || undefined,
      isAiGenerated: uploadIsAi,
      isCommission: uploadIsCommission,
    })
  } finally {
    setIsWatermarking(false)
  }
}}
```

Note: the local variable `uploadImage` shadows the imported `uploadImage` function. The local state variable is called `uploadImage` — rename the import to avoid collision. Update the import to:

```typescript
import { uploadImage as uploadToCloudinary } from "@/lib/upload"
```

Replace the entire `onClick` handler with:

```typescript
onClick={async () => {
  if (!uploadImage) return
  const imageToPost = uploadImage
  setIsWatermarking(true)
  try {
    const watermarked = await applyWatermark(imageToPost, session?.user?.username ?? "gallery")
    const url = await uploadToCloudinary(watermarked, "posts")
    createPost.mutate({
      image: url,
      description: uploadDesc.trim() || undefined,
      isAiGenerated: uploadIsAi,
      isCommission: uploadIsCommission,
    })
  } catch {
    console.warn("[watermark] applyWatermark failed, posting without watermark")
    try {
      const url = await uploadToCloudinary(imageToPost, "posts")
      createPost.mutate({
        image: url,
        description: uploadDesc.trim() || undefined,
        isAiGenerated: uploadIsAi,
        isCommission: uploadIsCommission,
      })
    } catch (uploadErr) {
      console.error("[post] cloudinary upload failed:", uploadErr)
    } finally {
      setIsWatermarking(false)
    }
    return
  } finally {
    setIsWatermarking(false)
  }
}}
```

- [ ] **Step 3: Update the shop item button handler**

Find the `onClick` on the "Add to shop" button:

```typescript
onClick={() => {
  const price = parseFloat(shopPrice)
  if (shopImage && shopTitle.trim() && !isNaN(price) && price > 0) {
    createShopItem.mutate({ image: shopImage, title: shopTitle.trim(), description: shopDesc.trim() || undefined, price })
  }
}}
```

Replace with an async handler that uploads first:

```typescript
onClick={async () => {
  const price = parseFloat(shopPrice)
  if (!shopImage || !shopTitle.trim() || isNaN(price) || price <= 0) return
  try {
    const url = await uploadToCloudinary(shopImage, "posts")
    createShopItem.mutate({ image: url, title: shopTitle.trim(), description: shopDesc.trim() || undefined, price })
  } catch (err) {
    console.error("[shop] cloudinary upload failed:", err)
  }
}}
```

- [ ] **Step 4: Verify the page still renders**

Run `npm run dev`, navigate to a profile page as the logged-in user, open the post upload modal, select an image. Confirm it still shows the crop editor and preview. Post — check that the created post's image URL is a `https://res.cloudinary.com/...` URL (visible in the Network tab or by inspecting the post in the DB).

- [ ] **Step 5: Commit**

```
git add app/[username]/page.tsx
git commit -m "feat: upload post + shop images to Cloudinary before saving"
```

---

### Task 4: Update avatar + banner in `app/settings/page.tsx`

**Files:**
- Modify: `app/settings/page.tsx`

The `handleSave` function (around line 162) calls `updateProfile.mutate({ image: image, bannerImage: bannerImage, ... })` where `image` and `bannerImage` are base64 state values set by canvas pipeline.

- [ ] **Step 1: Add the import**

At the top of `app/settings/page.tsx`, add:

```typescript
import { uploadImage } from "@/lib/upload"
```

- [ ] **Step 2: Update `handleSave` to upload before mutate**

The current `handleSave`:

```typescript
function handleSave() {
  updateProfile.mutate({
    name: name.trim() || (user?.name ?? "Artist"),
    bio: bio.trim() || null,
    image: image || null,
    bannerImage: bannerImage || null,
    websiteUrl: websiteUrl.trim() || null,
    twitterHandle: twitterHandle.trim() || null,
    instagramHandle: instagramHandle.trim() || null,
    artstationHandle: artstationHandle.trim() || null,
  })
}
```

Replace with an async version that uploads changed images first:

```typescript
async function handleSave() {
  try {
    let imageUrl = image
    let bannerUrl = bannerImage

    // Only upload if the value is a base64 data URL (i.e. user picked a new image)
    if (image && image.startsWith("data:")) {
      imageUrl = await uploadImage(image, "avatars")
    }
    if (bannerImage && bannerImage.startsWith("data:")) {
      bannerUrl = await uploadImage(bannerImage, "banners")
    }

    updateProfile.mutate({
      name: name.trim() || (user?.name ?? "Artist"),
      bio: bio.trim() || null,
      image: imageUrl || null,
      bannerImage: bannerUrl || null,
      websiteUrl: websiteUrl.trim() || null,
      twitterHandle: twitterHandle.trim() || null,
      instagramHandle: instagramHandle.trim() || null,
      artstationHandle: artstationHandle.trim() || null,
    })
  } catch (err) {
    console.error("[settings] image upload failed:", err)
    // TODO: show error to user
  }
}
```

- [ ] **Step 3: Verify in browser**

Navigate to `/settings`, change avatar and/or banner, click Save. Confirm the profile updates and the stored URL is a Cloudinary URL.

- [ ] **Step 4: Commit**

```
git add app/settings/page.tsx
git commit -m "feat: upload avatar + banner to Cloudinary in settings"
```

---

### Task 5: Update commission reference photos in `components/CommissionRequestModal.tsx`

**Files:**
- Modify: `components/CommissionRequestModal.tsx`

Currently `handleRefPhotoUpload` processes files to base64 and stores them in `refPhotos` state. Then `handleSubmit` passes `referencePhotos: refPhotos` (an array of base64 strings) to `submitRequest.mutate`.

The cleanest approach: upload each photo to Cloudinary as soon as it's processed (inside `handleRefPhotoUpload`), store the resulting URLs in `refPhotos` state, and the submit stays unchanged.

- [ ] **Step 1: Add the import**

At the top of `components/CommissionRequestModal.tsx`, add:

```typescript
import { uploadImage } from "@/lib/upload"
```

- [ ] **Step 2: Update `handleRefPhotoUpload` to upload before storing**

Current code:

```typescript
async function handleRefPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const files = Array.from(e.target.files ?? [])
  if (files.length === 0) return
  if (refPhotos.length + files.length > 5) {
    setError("Maximum 5 reference photos")
    return
  }
  setUploading(true)
  try {
    const processed = await Promise.all(files.map(f => processImage(f)))
    setRefPhotos(prev => [...prev, ...processed])
  } catch (err) {
    setError("Failed to process image. Please try a different file.")
  } finally {
    setUploading(false)
  }
}
```

Replace with:

```typescript
async function handleRefPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const files = Array.from(e.target.files ?? [])
  if (files.length === 0) return
  if (refPhotos.length + files.length > 5) {
    setError("Maximum 5 reference photos")
    return
  }
  setUploading(true)
  try {
    const processed = await Promise.all(files.map(f => processImage(f)))
    const urls = await Promise.all(processed.map(b64 => uploadImage(b64, "commissions")))
    setRefPhotos(prev => [...prev, ...urls])
  } catch (err) {
    setError("Failed to upload image. Please try a different file.")
  } finally {
    setUploading(false)
  }
}
```

- [ ] **Step 3: Verify in browser**

Open a commission request modal (navigate to any artist profile with commissions open), attach 1–2 reference photos. Confirm they still appear as previews. Submit the form. Check the created `CommissionRequest` record's `referencePhotos` field in the DB — values should be Cloudinary URLs.

- [ ] **Step 4: Commit**

```
git add components/CommissionRequestModal.tsx
git commit -m "feat: upload commission reference photos to Cloudinary"
```

---

### Task 6: Update story upload in `components/StoryUpload.tsx`

**Files:**
- Modify: `components/StoryUpload.tsx`

Currently `handleFile` processes the image to a base64 string and stores it in `preview` state. The share button then calls `createStory.mutate({ image: preview })`. We need to find and update the share button's click handler.

- [ ] **Step 1: Read the share button handler**

The share button is below line 62 in the component. Read lines 90–130 to find the exact handler:

```
Read: components/StoryUpload.tsx lines 90-130
```

- [ ] **Step 2: Add the import**

At the top of `components/StoryUpload.tsx`, add:

```typescript
import { uploadImage } from "@/lib/upload"
```

- [ ] **Step 3: Update the share button onClick**

Find the share button that calls `createStory.mutate({ image: preview })`. Replace the onClick so it uploads first:

```typescript
onClick={async () => {
  if (!preview) return
  try {
    const url = await uploadImage(preview, "stories")
    createStory.mutate({ image: url })
  } catch (err) {
    setError("Failed to upload story image. Please try again.")
  }
}}
```

- [ ] **Step 4: Verify in browser**

Add a story from a profile page. Confirm it appears in the stories row and the story image loads from a Cloudinary URL.

- [ ] **Step 5: Commit**

```
git add components/StoryUpload.tsx
git commit -m "feat: upload story image to Cloudinary before posting"
```

---

### Task 7: Update commission card images in `app/professional-profile/page.tsx`

**Files:**
- Modify: `app/professional-profile/page.tsx`

The `doSaveCardImages` function (around line 126) calls `saveCardImages.mutate({ commissionStatus: status, commissionCardImages: images })` where `images` is an array of base64 strings.

We find where `doSaveCardImages` is called, upload the images first, then pass URLs.

- [ ] **Step 1: Find where card images are passed to `doSaveCardImages`**

Search the file for `doSaveCardImages` calls — there will be a click handler or effect that builds the `images` array and calls it. Read around line 200–280 to find the exact call site.

- [ ] **Step 2: Add the import**

At the top of `app/professional-profile/page.tsx`, add:

```typescript
import { uploadImage } from "@/lib/upload"
```

- [ ] **Step 3: Update `doSaveCardImages` to upload before mutating**

Replace the current `doSaveCardImages`:

```typescript
function doSaveCardImages(images: string[]) {
  saveCardImages.mutate({
    commissionStatus: status,
    commissionCardImages: images,
  })
}
```

With an async version:

```typescript
async function doSaveCardImages(images: string[]) {
  try {
    const urls = await Promise.all(
      images.map(img =>
        img.startsWith("data:") ? uploadImage(img, "commissions") : Promise.resolve(img)
      )
    )
    saveCardImages.mutate({
      commissionStatus: status,
      commissionCardImages: urls,
    })
  } catch (err) {
    setCardUploadError("Failed to upload images. Please try again.")
  }
}
```

The `img.startsWith("data:")` guard means existing Cloudinary URLs (already uploaded) are passed through unchanged — safe for future edits.

- [ ] **Step 4: Verify in browser**

Navigate to `/professional-profile`, upload 1–2 commission card images and save. Confirm they display correctly and the stored values are Cloudinary URLs.

- [ ] **Step 5: Commit**

```
git add app/professional-profile/page.tsx
git commit -m "feat: upload commission card images to Cloudinary"
```

---

### Task 8: Update delivery upload in `app/professional-dms/[id]/page.tsx`

**Files:**
- Modify: `app/professional-dms/[id]/page.tsx`

The `handleDeliveryFileUpload` function (line 220) processes an image to base64 and stores it in `deliveryFile` state. The "Submit Delivery" button (around line 738) then calls `markDeliveredMutation.mutate({ id, fileUrl: deliveryFile })`.

Upload to Cloudinary when the file is processed (inside `handleDeliveryFileUpload`), so `deliveryFile` stores a URL by the time the artist clicks Submit Delivery.

- [ ] **Step 1: Add the import**

At the top of `app/professional-dms/[id]/page.tsx`, add:

```typescript
import { uploadImage } from "@/lib/upload"
```

- [ ] **Step 2: Update `handleDeliveryFileUpload`**

Current code:

```typescript
async function handleDeliveryFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  setDeliveryUploadError("")
  setUploadingDelivery(true)
  try {
    const processed = await processImage(file)
    setDeliveryFile(processed)
  } catch {
    setDeliveryUploadError("Failed to process image. Please try a different file.")
  } finally {
    setUploadingDelivery(false)
  }
}
```

Replace with:

```typescript
async function handleDeliveryFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  setDeliveryUploadError("")
  setUploadingDelivery(true)
  try {
    const processed = await processImage(file)
    const url = await uploadImage(processed, "commissions")
    setDeliveryFile(url)
  } catch {
    setDeliveryUploadError("Failed to upload image. Please try a different file.")
  } finally {
    setUploadingDelivery(false)
  }
}
```

- [ ] **Step 3: Verify in browser**

Open an IN_PROGRESS commission thread as the artist. Upload a delivery file — confirm the preview thumbnail appears. Click Submit Delivery. Confirm the delivery message renders the image and the `fileUrl` in the DB is a Cloudinary URL.

- [ ] **Step 4: Commit**

```
git add app/professional-dms/[id]/page.tsx
git commit -m "feat: upload commission delivery file to Cloudinary"
```

---

### Task 9: Roadmap update + deploy

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Mark the infrastructure item done**

In `docs/roadmap.md`, find:

```
- [ ] Move post/avatar/banner image storage out of the database — store files on disk or a cloud bucket (S3/Cloudinary/R2) and save only the URL in the DB, so images survive a DB reset
```

Change to:

```
- [x] Move post/avatar/banner image storage out of the database — store files on disk or a cloud bucket (S3/Cloudinary/R2) and save only the URL in the DB, so images survive a DB reset
```

- [ ] **Step 2: Commit**

```
git add docs/roadmap.md
git commit -m "docs: mark Cloudinary image storage as done"
```

- [ ] **Step 3: Deploy and verify env vars**

Before pushing, confirm `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are set in your Vercel project (Settings → Environment Variables). Then push:

```
git push origin main
```

After deploy, test a post upload on production to confirm images are stored as Cloudinary URLs.
