# Edit Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/settings/profile` page where users can edit their display name, bio, profile photo (upload from device), and social links (website, Twitter, Instagram, ArtStation).

**Architecture:** Client-side form at `app/settings/profile/page.tsx` backed by a `user.updateProfile` tRPC mutation. Profile photos upload through Uploadthing (returns a CDN URL stored in the existing `image` field). Social links are four new nullable string columns on the User model. The profile page at `app/[username]/page.tsx` is updated to show the photo and links.

**Tech Stack:** Next.js 16.2.6 App Router, tRPC v11, Prisma 5.22.0, Zod v4, Uploadthing (new install), Tailwind CSS v4, React 19

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `websiteUrl`, `twitterHandle`, `instagramHandle`, `artstationHandle` to User |
| `server/routers/user.ts` | Modify | Add `updateProfile` mutation |
| `lib/uploadthing.ts` | Create | Generate Uploadthing React helpers typed to our router |
| `app/api/uploadthing/core.ts` | Create | Uploadthing file router — auth middleware + profileImage endpoint |
| `app/api/uploadthing/route.ts` | Create | Next.js App Router GET/POST handler for Uploadthing |
| `app/settings/profile/page.tsx` | Create | Edit Profile form — photo, name, bio, links |
| `app/[username]/page.tsx` | Modify | Show uploaded photo, show social links, fix "Edit profile" href |

---

### Task 1: Add link fields to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**IMPORTANT:** This project uses Next.js 16 with breaking changes. Before any code, read:
`node_modules/next/dist/docs/` for relevant guides.

The `.env.local` file is NOT loaded by Prisma CLI automatically on Windows. Prefix commands with the DATABASE_URL inline or ensure it is set in your shell environment. Check `.env.local` for the value.

- [ ] **Step 1: Add four nullable fields to the User model in `prisma/schema.prisma`**

Add after the `commissionStatus` line:

```prisma
  websiteUrl         String?
  twitterHandle      String?
  instagramHandle    String?
  artstationHandle   String?
```

The complete User model should look like this:

```prisma
model User {
  id                 String           @id @default(cuid())
  name               String?
  email              String?          @unique
  emailVerified      DateTime?
  image              String?
  password           String?
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  username           String?          @unique
  bio                String?
  sellingEnabled     Boolean          @default(false)
  onboardingComplete Boolean          @default(false)
  commissionStatus   CommissionStatus @default(CLOSED)

  websiteUrl         String?
  twitterHandle      String?
  instagramHandle    String?
  artstationHandle   String?

  accounts           Account[]
  sessions           Session[]
}
```

- [ ] **Step 2: Push schema to database**

On Windows, Prisma CLI doesn't read `.env.local`. Run with the DATABASE_URL inline (get the value from `.env.local`):

```bash
DATABASE_URL="<your-db-url>" npx prisma db push
```

Expected output includes: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected output includes: `Generated Prisma Client`

- [ ] **Step 4: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add social link fields to User schema"
```

---

### Task 2: Install Uploadthing and create API route

**Files:**
- Create: `app/api/uploadthing/core.ts`
- Create: `app/api/uploadthing/route.ts`
- Create: `lib/uploadthing.ts`

**Before writing any code**, check the installed Uploadthing version and its exports:

```bash
cat node_modules/uploadthing/package.json | grep '"version"'
cat node_modules/@uploadthing/react/package.json | grep '"version"'
```

Then read `node_modules/uploadthing/README.md` and `node_modules/@uploadthing/react/README.md` to confirm the correct import paths for your installed version — they differ between v6 and v7.

- [ ] **Step 1: Install packages**

```bash
npm install uploadthing @uploadthing/react
```

- [ ] **Step 2: Add Uploadthing token to `.env.local`**

Sign up at https://uploadthing.com, create an app, copy the token. Add to `.env.local`:

```
UPLOADTHING_TOKEN=your_token_here
```

- [ ] **Step 3: Create `app/api/uploadthing/core.ts`**

```typescript
import { createUploadthing, type FileRouter } from "uploadthing/next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const f = createUploadthing()

export const ourFileRouter = {
  profileImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) throw new Error("Unauthorized")
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.url }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
```

**If `createUploadthing` is not exported from `"uploadthing/next"`**, check the package exports map in `node_modules/uploadthing/package.json`. It may be at `"uploadthing/server"` or just `"uploadthing"`.

- [ ] **Step 4: Create `app/api/uploadthing/route.ts`**

```typescript
import { createRouteHandler } from "uploadthing/next"
import { ourFileRouter } from "./core"

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
})
```

**If `createRouteHandler` is not exported from `"uploadthing/next"`**, it may be `createNextRouteHandler` or at a different path. Read the README.

- [ ] **Step 5: Create `lib/uploadthing.ts`** (generates typed React helpers)

```typescript
import { generateReactHelpers } from "@uploadthing/react"
import type { OurFileRouter } from "@/app/api/uploadthing/core"

export const { useUploadThing } = generateReactHelpers<OurFileRouter>()
```

**If `generateReactHelpers` is not exported**, the hook may be a direct named export instead:
```typescript
// Alternative — direct import, no wrapper needed
export { useUploadThing } from "@uploadthing/react"
```
Check `node_modules/@uploadthing/react/dist/` exports to confirm.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add app/api/uploadthing/ lib/uploadthing.ts
git commit -m "feat: add uploadthing API route for profile photo uploads"
```

---

### Task 3: Add updateProfile tRPC mutation

**Files:**
- Modify: `server/routers/user.ts`

- [ ] **Step 1: Replace the full contents of `server/routers/user.ts` with this**

```typescript
import { z } from "zod"
import { router, publicProcedure, protectedProcedure } from "@/lib/trpc"

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
    })
  }),

  checkUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({
        where: { username: input.username },
      })
      return { available: !existing }
    }),

  completeOnboarding: protectedProcedure
    .input(z.object({ sellingEnabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          sellingEnabled: input.sellingEnabled,
          onboardingComplete: true,
        },
      })
    }),

  updateSellingEnabled: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { sellingEnabled: input.enabled },
      })
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        bio: z.string().max(160).nullable(),
        image: z.string().nullable(),
        websiteUrl: z.string().nullable(),
        twitterHandle: z.string().max(50).nullable(),
        instagramHandle: z.string().max(50).nullable(),
        artstationHandle: z.string().max(50).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          name: input.name,
          bio: input.bio,
          image: input.image,
          websiteUrl: input.websiteUrl,
          twitterHandle: input.twitterHandle,
          instagramHandle: input.instagramHandle,
          artstationHandle: input.artstationHandle,
        },
      })
    }),
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/routers/user.ts
git commit -m "feat: add updateProfile tRPC mutation"
```

---

### Task 4: Build the Edit Profile page

**Files:**
- Create: `app/settings/profile/page.tsx`

- [ ] **Step 1: Create `app/settings/profile/page.tsx`**

```typescript
"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useUploadThing } from "@/lib/uploadthing"
import { trpc } from "@/components/providers"

export default function EditProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const { data: user, isLoading } = trpc.user.me.useQuery()

  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [twitterHandle, setTwitterHandle] = useState("")
  const [instagramHandle, setInstagramHandle] = useState("")
  const [artstationHandle, setArtstationHandle] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name ?? "")
      setBio(user.bio ?? "")
      setImage(user.image ?? null)
      setWebsiteUrl(user.websiteUrl ?? "")
      setTwitterHandle(user.twitterHandle ?? "")
      setInstagramHandle(user.instagramHandle ?? "")
      setArtstationHandle(user.artstationHandle ?? "")
    }
  }, [user])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
  }, [status, router])

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: async () => {
      await update()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const { startUpload, isUploading } = useUploadThing("profileImage", {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) setImage(res[0].url)
    },
  })

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) startUpload([file])
  }

  function handleSave() {
    updateProfile.mutate({
      name: name.trim() || (user?.name ?? "Artist"),
      bio: bio.trim() || null,
      image: image || null,
      websiteUrl: websiteUrl.trim() || null,
      twitterHandle: twitterHandle.trim() || null,
      instagramHandle: instagramHandle.trim() || null,
      artstationHandle: artstationHandle.trim() || null,
    })
  }

  const initials = (name || user?.username || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Edit Profile</h1>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-6">

        {/* Photo */}
        <div className="flex items-center gap-4">
          {image ? (
            <img
              src={image}
              alt="Profile"
              className="rounded-full object-cover flex-shrink-0"
              style={{ width: 72, height: 72 }}
            />
          ) : (
            <div
              className="rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold flex-shrink-0"
              style={{ width: 72, height: 72 }}
            >
              {initials}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">Profile photo</p>
            <div className="flex gap-2 mt-2">
              <label className="cursor-pointer text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
                {isUploading ? "Uploading…" : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  disabled={isUploading}
                />
              </label>
              {image && (
                <button
                  onClick={() => setImage(null)}
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Display name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            placeholder="Tell people about your work…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">{bio.length}/160</p>
        </div>

        {/* Links */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Links</p>
          <div className="flex flex-col gap-2">
            {(
              [
                { icon: "🌐", placeholder: "Website  https://yoursite.com", value: websiteUrl, set: setWebsiteUrl },
                { icon: "𝕏",  placeholder: "Twitter / X  @handle",          value: twitterHandle, set: setTwitterHandle },
                { icon: "📸", placeholder: "Instagram  @handle",             value: instagramHandle, set: setInstagramHandle },
                { icon: "🎨", placeholder: "ArtStation  username",           value: artstationHandle, set: setArtstationHandle },
              ] as const
            ).map(({ icon, placeholder, value, set }) => (
              <div key={placeholder} className="flex items-center gap-2">
                <span className="w-6 text-center text-base select-none">{icon}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => (set as (v: string) => void)(e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        {updateProfile.error && (
          <p className="text-sm text-red-500">{updateProfile.error.message}</p>
        )}

        <button
          onClick={handleSave}
          disabled={updateProfile.isPending || isUploading}
          className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saved ? "✓ Saved" : updateProfile.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Start dev server and manually test**

```bash
npm run dev
```

Visit `http://localhost:3000/settings/profile`. Check:
- Form loads with current user data pre-filled
- Typing in name, bio, and link fields works
- "Upload photo" opens the file picker, photo uploads and previews
- "Save changes" shows "✓ Saved"
- After saving, navigate to `http://localhost:3000/<your-username>` and confirm the updated name/bio/photo appear

- [ ] **Step 3: Commit**

```bash
git add app/settings/profile/
git commit -m "feat: add edit profile page with photo upload and social links"
```

---

### Task 5: Update profile page to show photo, links, and fix Edit button

**Files:**
- Modify: `app/[username]/page.tsx`

- [ ] **Step 1: Replace the full contents of `app/[username]/page.tsx` with this**

```typescript
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

const statusColors = {
  OPEN: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
}

const statusLabels = {
  OPEN: "Open for commissions",
  CLOSED: "Closed for commissions",
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username: rawUsername } = await params
  const username = rawUsername.startsWith("@") ? rawUsername.slice(1) : rawUsername

  const profileUser = await prisma.user.findUnique({
    where: { username },
  })

  if (!profileUser) notFound()

  const session = await getServerSession(authOptions)
  const isOwn = session?.user?.id === profileUser.id

  const initials = (profileUser.name ?? profileUser.username ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        {/* Avatar — show uploaded photo if available */}
        {profileUser.image ? (
          <img
            src={profileUser.image}
            alt={profileUser.name ?? profileUser.username ?? "Profile"}
            className="w-20 h-20 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold flex-shrink-0">
            {initials}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">
              {profileUser.name ?? profileUser.username}
            </h1>
            {isOwn && (
              <Link
                href="/settings/profile"
                className="text-sm px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Edit profile
              </Link>
            )}
          </div>

          <p className="text-gray-500 text-sm mt-0.5">@{profileUser.username}</p>

          {profileUser.bio && (
            <p className="text-gray-700 text-sm mt-3">{profileUser.bio}</p>
          )}

          {/* Social links */}
          {(profileUser.websiteUrl ||
            profileUser.twitterHandle ||
            profileUser.instagramHandle ||
            profileUser.artstationHandle) && (
            <div className="flex flex-wrap gap-3 mt-3">
              {profileUser.websiteUrl && (
                <a
                  href={profileUser.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  🌐 Website
                </a>
              )}
              {profileUser.twitterHandle && (
                <a
                  href={`https://x.com/${profileUser.twitterHandle.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  𝕏 {profileUser.twitterHandle}
                </a>
              )}
              {profileUser.instagramHandle && (
                <a
                  href={`https://instagram.com/${profileUser.instagramHandle.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  📸 {profileUser.instagramHandle}
                </a>
              )}
              {profileUser.artstationHandle && (
                <a
                  href={`https://artstation.com/${profileUser.artstationHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  🎨 {profileUser.artstationHandle}
                </a>
              )}
            </div>
          )}

          <div className="mt-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                statusColors[profileUser.commissionStatus as keyof typeof statusColors] ??
                "bg-gray-100 text-gray-500"
              }`}
            >
              {statusLabels[profileUser.commissionStatus as keyof typeof statusLabels] ??
                "Closed for commissions"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {["Posts", "Shop", "Commissions", "About"].map((tab) => (
            <button
              key={tab}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === "Posts"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Posts tab — empty state */}
      <div className="text-center py-16 text-gray-400">
        <div className="text-4xl mb-3">🖼️</div>
        <p className="font-medium text-gray-500">No posts yet</p>
        {isOwn && (
          <p className="text-sm mt-1">Share your first piece of art</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Test end-to-end**

1. Visit `http://localhost:3000/<your-username>`
2. Click "Edit profile" — should go to `/settings/profile`
3. Upload a photo, save — profile page should show the photo
4. Add links, save — profile page should show the links below the bio

- [ ] **Step 4: Commit**

```bash
git add app/[username]/page.tsx
git commit -m "feat: show profile photo and social links on profile page"
```
