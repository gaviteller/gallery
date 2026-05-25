# Visual Identity Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Instagram-clone look with a distinct "artist marketplace" visual identity — floating post cards, rectangular featured-artist strip, profile banners, Space Grotesk headings, and pill-tab navigation — while keeping all functionality identical.

**Architecture:** Pure UI change: new CSS tokens in `globals.css`, rewritten component markup in the feed and profile pages, a renamed `FeaturedArtistsStrip` component, a new `bannerImage` DB column with a runtime-migration entry, and a small backend addition of `commissionStatus` to the feed query. No routing, auth, or business logic is touched.

**Tech Stack:** Next.js 16 App Router, Tailwind v4, tRPC v11, Prisma 5 / PostgreSQL (Neon via OIDC — migrations run at runtime via the `/api/run-migration` endpoint, not at build time), Space Grotesk via Google Fonts.

**Critical constraint:** `DATABASE_URL` is only available at runtime (Vercel OIDC). Schema changes need both a `prisma/migrations/` SQL file AND an entry in `app/api/run-migration/route.ts` so the column can be created by hitting that endpoint after deploy.

---

## File Map

| File | Change |
|---|---|
| `app/globals.css` | Add Space Grotesk `@import`, `.gallery-card` token |
| `server/routers/post.ts` | Add `commissionStatus: true` to getFeed user select |
| `prisma/schema.prisma` | Add `bannerImage String? @db.Text` to User |
| `prisma/migrations/20260518010000_add_banner_image/migration.sql` | CREATE — ALTER TABLE User ADD COLUMN bannerImage |
| `app/api/run-migration/route.ts` | Add bannerImage ALTER TABLE + migration record |
| `server/routers/user.ts` | Add `bannerImage` to updateProfile input + data |
| `components/FeaturedArtistsStrip.tsx` | CREATE — rectangular art-preview cards (replaces StoriesRow) |
| `app/page.tsx` | Import FeaturedArtistsStrip, card-style post markup, commissionStatus in FeedPost type |
| `app/[username]/page.tsx` | Banner, Space Grotesk name, pill tabs, overlapping avatar, commission badge, + Story button |
| `app/settings/page.tsx` | Banner image upload UI + send to updateProfile |

---

## Task 1: Global CSS — Space Grotesk + card token

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add Space Grotesk import and card token**

Replace the entire contents of `app/globals.css` with:

```css
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap");
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
  --brand-pink: #FF1CF7;
  --brand-purple: #B044F8;
  --brand-cyan: #00B4EE;
  --brand-dark: #0D0D0F;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: #0D0D0F;
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

/* Brand gradient utility */
.brand-gradient {
  background: linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%);
}

.brand-gradient-text {
  background: linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Gallery card token — used by feed post cards */
.gallery-card {
  background: #141414;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}
```

- [ ] **Step 2: Verify the import is valid**

Run: `npx next build 2>&1 | head -20` (or just check the file saved correctly — the Google Fonts `@import` must be the very first line before `@import "tailwindcss"` because CSS `@import` rules must precede other rules.)

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: add Space Grotesk font + gallery-card token"
```

---

## Task 2: Backend — commissionStatus in getFeed

**Files:**
- Modify: `server/routers/post.ts` (around line 50)

- [ ] **Step 1: Add commissionStatus to the user select in getFeed**

In `server/routers/post.ts`, find this block inside `getFeed`:

```typescript
        include: {
          user: { select: { id: true, username: true, name: true, image: true } },
          _count: { select: { likes: true, comments: true } },
        },
```

Replace it with:

```typescript
        include: {
          user: { select: { id: true, username: true, name: true, image: true, commissionStatus: true } },
          _count: { select: { likes: true, comments: true } },
        },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors related to `commissionStatus` (it already exists on the User model as `CommissionStatus` enum).

- [ ] **Step 3: Commit**

```bash
git add server/routers/post.ts
git commit -m "feat: include commissionStatus in getFeed user select"
```

---

## Task 3: Schema — bannerImage field + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260518010000_add_banner_image/migration.sql`
- Modify: `app/api/run-migration/route.ts`

- [ ] **Step 1: Add bannerImage to the User model in schema.prisma**

In `prisma/schema.prisma`, find:

```prisma
  commissionStatus   CommissionStatus @default(CLOSED)

  websiteUrl         String?
```

Replace with:

```prisma
  commissionStatus   CommissionStatus @default(CLOSED)
  bannerImage        String?          @db.Text

  websiteUrl         String?
```

- [ ] **Step 2: Create the migration SQL file**

Create directory `prisma/migrations/20260518010000_add_banner_image/` and file `migration.sql`:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannerImage" TEXT;
```

- [ ] **Step 3: Add bannerImage migration to the run-migration endpoint**

In `app/api/run-migration/route.ts`, find:

```typescript
    // Mark migration as applied in _prisma_migrations
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        'manual',
        NOW(),
        '20260518000000_add_stories',
        NULL,
        NULL,
        NOW(),
        1
      )
      ON CONFLICT DO NOTHING
    `
    results.push("Migration record: OK")

    return NextResponse.json({ ok: true, results })
```

Replace with:

```typescript
    // Mark stories migration as applied
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        'manual',
        NOW(),
        '20260518000000_add_stories',
        NULL,
        NULL,
        NOW(),
        1
      )
      ON CONFLICT DO NOTHING
    `
    results.push("Migration record (stories): OK")

    // Add bannerImage column
    await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannerImage" TEXT`
    results.push("bannerImage column: OK")

    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        'manual',
        NOW(),
        '20260518010000_add_banner_image',
        NULL,
        NULL,
        NOW(),
        1
      )
      ON CONFLICT DO NOTHING
    `
    results.push("Migration record (banner): OK")

    return NextResponse.json({ ok: true, results })
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260518010000_add_banner_image/migration.sql app/api/run-migration/route.ts
git commit -m "feat: add bannerImage field to User model with runtime migration"
```

---

## Task 4: Backend — bannerImage in updateProfile

**Files:**
- Modify: `server/routers/user.ts`

- [ ] **Step 1: Add bannerImage to updateProfile input schema**

In `server/routers/user.ts`, find the `updateProfile` input:

```typescript
      z.object({
        name: z.string().min(1).max(100),
        bio: z.string().max(160).nullable(),
        image: z.string().nullable(),
        websiteUrl: z.string().nullable(),
        twitterHandle: z.string().max(50).nullable(),
        instagramHandle: z.string().max(50).nullable(),
        artstationHandle: z.string().max(50).nullable(),
      })
```

Replace with:

```typescript
      z.object({
        name: z.string().min(1).max(100),
        bio: z.string().max(160).nullable(),
        image: z.string().nullable(),
        bannerImage: z.string().nullable().optional(),
        websiteUrl: z.string().nullable(),
        twitterHandle: z.string().max(50).nullable(),
        instagramHandle: z.string().max(50).nullable(),
        artstationHandle: z.string().max(50).nullable(),
      })
```

- [ ] **Step 2: Pass bannerImage to the prisma update**

In `server/routers/user.ts`, find the `updateProfile` mutation data:

```typescript
        data: {
          name: input.name,
          bio: input.bio,
          image: input.image,
          websiteUrl: input.websiteUrl,
          twitterHandle: input.twitterHandle,
          instagramHandle: input.instagramHandle,
          artstationHandle: input.artstationHandle,
        },
```

Replace with:

```typescript
        data: {
          name: input.name,
          bio: input.bio,
          image: input.image,
          ...(input.bannerImage !== undefined && { bannerImage: input.bannerImage }),
          websiteUrl: input.websiteUrl,
          twitterHandle: input.twitterHandle,
          instagramHandle: input.instagramHandle,
          artstationHandle: input.artstationHandle,
        },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors (`bannerImage` is now in the Prisma-generated type because we updated schema.prisma in Task 3).

- [ ] **Step 4: Commit**

```bash
git add server/routers/user.ts
git commit -m "feat: add bannerImage to updateProfile mutation"
```

---

## Task 5: FeaturedArtistsStrip — rectangular art-preview cards

**Files:**
- Create: `components/FeaturedArtistsStrip.tsx`
- Modify: `app/page.tsx` (import swap only)

- [ ] **Step 1: Create FeaturedArtistsStrip.tsx**

Create `components/FeaturedArtistsStrip.tsx`:

```tsx
"use client"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { trpc } from "@/components/providers"
import StoryViewer from "./StoryViewer"
import StoryUpload from "./StoryUpload"

type StoryGroup = {
  userId: string
  username: string | null
  name: string | null
  image: string | null
  stories: { id: string; image: string; createdAt: Date; viewed: boolean }[]
  hasUnviewed: boolean
}

export default function FeaturedArtistsStrip() {
  const { data: session } = useSession()
  const [viewing, setViewing] = useState<StoryGroup | null>(null)
  const [uploading, setUploading] = useState(false)
  const utils = trpc.useUtils()

  const { data: groups = [] } = trpc.story.getFeed.useQuery(undefined, {
    enabled: !!session,
  })

  if (!session) return null

  const me = session.user.id

  function handleCardClick(group: StoryGroup) {
    if (group.userId === me && group.stories.length === 0) {
      setUploading(true)
    } else if (group.stories.length > 0) {
      setViewing(group)
    }
  }

  return (
    <>
      <div
        className="flex gap-3 px-3 py-3 overflow-x-auto"
        style={{ borderBottom: "1px solid #ffffff08", scrollbarWidth: "none" }}
      >
        {groups.map((group) => {
          const isMe = group.userId === me
          const hasStory = group.stories.length > 0
          const hasUnviewed = group.hasUnviewed
          // Preview: first story image if they have a story, otherwise avatar
          const previewSrc = hasStory ? group.stories[0].image : group.image

          // Gradient ring wrapper for active story
          const wrapperStyle: React.CSSProperties = hasUnviewed
            ? {
                padding: 2,
                background:
                  "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                borderRadius: 12,
              }
            : hasStory
            ? {
                padding: 1.5,
                background: "rgba(255,255,255,0.25)",
                borderRadius: 12,
              }
            : {}

          return (
            <button
              key={group.userId}
              onClick={() => handleCardClick(group)}
              className="flex-shrink-0 focus:outline-none"
            >
              <div style={wrapperStyle}>
                {/* Card: 64×80, image top 56px, label bottom 24px */}
                <div
                  className="relative overflow-hidden"
                  style={{
                    width: 64,
                    height: 80,
                    borderRadius: 10,
                    background: "#141414",
                    border:
                      !hasStory
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "none",
                  }}
                >
                  {/* Top 56px: preview image or gradient initial */}
                  <div
                    className="absolute top-0 left-0 w-full overflow-hidden"
                    style={{ height: 56 }}
                  >
                    {previewSrc ? (
                      <img
                        src={previewSrc}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white font-bold text-xl"
                        style={{
                          background:
                            "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                        }}
                      >
                        {(group.name ?? group.username ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                    {/* + overlay for own card with no story */}
                    {isMe && !hasStory && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="rounded-full flex items-center justify-center"
                          style={{
                            width: 22,
                            height: 22,
                            background:
                              "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                          }}
                        >
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom 24px: username label */}
                  <div
                    className="absolute bottom-0 left-0 w-full flex items-center justify-center"
                    style={{ height: 24, background: "rgba(0,0,0,0.55)" }}
                  >
                    <span
                      className="text-[9px] text-white/80 truncate px-1"
                      style={{ maxWidth: 60 }}
                    >
                      {isMe ? "You" : (group.username ?? "")}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {viewing && (
        <StoryViewer
          user={viewing}
          onClose={() => {
            setViewing(null)
            utils.story.getFeed.invalidate()
          }}
        />
      )}

      {uploading && (
        <StoryUpload
          onClose={() => setUploading(false)}
          onSuccess={() => setUploading(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Update app/page.tsx to import FeaturedArtistsStrip**

In `app/page.tsx`, find:

```typescript
import StoriesRow from "@/components/StoriesRow"
```

Replace with:

```typescript
import FeaturedArtistsStrip from "@/components/FeaturedArtistsStrip"
```

Then find the JSX usage:

```tsx
      <StoriesRow />
```

Replace with:

```tsx
      <FeaturedArtistsStrip />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/FeaturedArtistsStrip.tsx app/page.tsx
git commit -m "feat: replace StoriesRow with FeaturedArtistsStrip rectangular cards"
```

---

## Task 6: Feed page — card-style posts with commission badge

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update FeedPost type to include commissionStatus**

In `app/page.tsx`, find:

```typescript
type FeedPost = {
  id: string
  image: string
  title: string | null
  description: string | null
  isAiGenerated: boolean
  createdAt: Date
  isFollowing: boolean
  isOwnPost: boolean
  likedByMe: boolean
  _count: { likes: number; comments: number }
  user: {
    id: string
    username: string | null
    name: string | null
    image: string | null
  }
}
```

Replace with:

```typescript
type FeedPost = {
  id: string
  image: string
  title: string | null
  description: string | null
  isAiGenerated: boolean
  createdAt: Date
  isFollowing: boolean
  isOwnPost: boolean
  likedByMe: boolean
  _count: { likes: number; comments: number }
  user: {
    id: string
    username: string | null
    name: string | null
    image: string | null
    commissionStatus: "OPEN" | "LIMITED" | "CLOSED"
  }
}
```

- [ ] **Step 2: Replace the post article markup with card-style layout**

In `app/page.tsx`, find the entire `<article>` element and its contents:

```tsx
              <article key={post.id} style={{ borderBottom: "1px solid #ffffff08" }}>
                {/* Post header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Link href={`/@${post.user.username}`}>
                    {post.user.image ? (
                      <img src={post.user.image} alt={post.user.username ?? ""} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>
                        {(post.user.name ?? post.user.username ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <Link href={`/@${post.user.username}`} className="text-sm font-semibold text-white">
                        @{post.user.username}
                      </Link>
                      <span className="text-xs text-white/30">{timeAgo(post.createdAt)}</span>
                    </div>
                    {post.user.name && (
                      <p className="text-xs text-white/50 truncate">{post.user.name}</p>
                    )}
                  </div>
                  {post.isAiGenerated && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(176,68,248,0.2)", color: "#B044F8" }}>AI</span>
                  )}
                </div>

                {/* Full-bleed image */}
                <button className="w-full block" onClick={() => setViewPost(post as FeedPost)}>
                  <img
                    src={post.image}
                    alt={post.description ?? ""}
                    className="w-full object-cover"
                  />
                </button>

                {/* Actions */}
                <div className="flex items-center gap-4 px-4 pt-3 pb-1">
                  <button
                    onClick={() => toggleLike.mutate({ postId: post.id })}
                    disabled={toggleLike.isPending}
                    className="flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24"
                      fill={post.likedByMe ? "#ef4444" : "none"}
                      stroke={post.likedByMe ? "#ef4444" : "white"}
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                    </svg>
                    <span className={`text-sm font-semibold ${post.likedByMe ? "text-red-500" : "text-white"}`}>
                      {post._count.likes}
                    </span>
                  </button>
                  <button
                    onClick={() => { setFocusComment(true); setViewPost(post as FeedPost) }}
                    className="flex items-center gap-1.5 text-white transition-colors"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                    <span className="text-sm font-semibold">{post._count.comments}</span>
                  </button>
                </div>

                {/* Caption */}
                {post.description && (
                  <div className="px-4 py-1.5 pb-3">
                    <p className="text-sm text-white/90 leading-snug">
                      <Link href={`/@${post.user.username}`} className="font-semibold mr-1">
                        @{post.user.username}
                      </Link>
                      <MentionText text={post.description} />
                    </p>
                  </div>
                )}
              </article>
```

Replace with:

```tsx
              <article
                key={post.id}
                className="mx-3 my-2 overflow-hidden gallery-card"
              >
                {/* Post header — two lines: display name + commission badge / @username + timestamp */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <Link href={`/@${post.user.username}`} className="flex-shrink-0">
                    {/* Avatar with always-on subtle gradient ring */}
                    <div
                      style={{
                        padding: 1.5,
                        background:
                          "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                        borderRadius: "50%",
                        opacity: 0.9,
                      }}
                    >
                      <div
                        style={{ padding: 2, background: "#141414", borderRadius: "50%" }}
                      >
                        {post.user.image ? (
                          <img
                            src={post.user.image}
                            alt={post.user.username ?? ""}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                            style={{
                              background:
                                "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                            }}
                          >
                            {(post.user.name ?? post.user.username ?? "?")[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    {/* Line 1: display name + commission badge */}
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/@${post.user.username}`}
                        className="text-sm font-semibold text-white truncate"
                        style={{ fontFamily: "Space Grotesk, sans-serif" }}
                      >
                        {post.user.name ?? `@${post.user.username}`}
                      </Link>
                      {(post.user.commissionStatus === "OPEN" ||
                        post.user.commissionStatus === "LIMITED") && (
                        <span className="text-xs font-semibold brand-gradient-text flex-shrink-0">
                          Commission open ↗
                        </span>
                      )}
                    </div>
                    {/* Line 2: @username · timestamp */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-white/40">
                        @{post.user.username}
                      </span>
                      <span className="text-white/20 text-xs">·</span>
                      <span className="text-xs text-white/30">
                        {timeAgo(post.createdAt)}
                      </span>
                    </div>
                  </div>

                  {post.isAiGenerated && (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: "rgba(176,68,248,0.2)",
                        color: "#B044F8",
                      }}
                    >
                      AI
                    </span>
                  )}
                </div>

                {/* Image — rounded inside the card, slight margin */}
                <button
                  className="w-full block px-3"
                  onClick={() => setViewPost(post as FeedPost)}
                >
                  <img
                    src={post.image}
                    alt={post.description ?? ""}
                    className="w-full object-cover"
                    style={{ borderRadius: 12 }}
                  />
                </button>

                {/* Artwork title (Space Grotesk) */}
                {post.title && (
                  <p
                    className="px-4 pt-2.5 text-sm font-semibold text-white/80"
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    {post.title}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 px-4 pt-3 pb-1">
                  <button
                    onClick={() => toggleLike.mutate({ postId: post.id })}
                    disabled={toggleLike.isPending}
                    className="flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill={post.likedByMe ? "#ef4444" : "none"}
                      stroke={post.likedByMe ? "#ef4444" : "white"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                    <span
                      className={`text-sm font-semibold ${
                        post.likedByMe ? "text-red-500" : "text-white"
                      }`}
                    >
                      {post._count.likes}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setFocusComment(true)
                      setViewPost(post as FeedPost)
                    }}
                    className="flex items-center gap-1.5 text-white transition-colors"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    <span className="text-sm font-semibold">
                      {post._count.comments}
                    </span>
                  </button>
                </div>

                {/* Caption */}
                {post.description && (
                  <div className="px-4 py-1.5 pb-4">
                    <p className="text-sm text-white/90 leading-snug">
                      <Link
                        href={`/@${post.user.username}`}
                        className="font-semibold mr-1"
                      >
                        @{post.user.username}
                      </Link>
                      <MentionText text={post.description} />
                    </p>
                  </div>
                )}
              </article>
```

- [ ] **Step 3: Remove the old border wrapper div that surrounded posts**

In `app/page.tsx`, find:

```tsx
          <div style={{ borderTop: "1px solid #ffffff08" }}>
            {posts.map((post) => (
```

Replace with:

```tsx
          <div>
            {posts.map((post) => (
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: card-style feed posts with commission badge and gradient avatar ring"
```

---

## Task 7: Profile page — banner + pill tabs + identity block

**Files:**
- Modify: `app/[username]/page.tsx`

This task restructures the profile page header. The page currently uses `max-w-2xl mx-auto px-4 py-10 pb-24`. The banner needs to break out of `px-4`, so we remove top padding from the outer container and handle spacing internally.

- [ ] **Step 1: Change the outer container to remove top padding**

In `app/[username]/page.tsx`, find:

```tsx
    <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
```

Replace with:

```tsx
    <div className="max-w-2xl mx-auto pb-24">
```

- [ ] **Step 2: Add the banner section at the top of the content (after modals, before header)**

In `app/[username]/page.tsx`, find the comment and div:

```tsx
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
```

Replace everything from that comment through the closing `</div>` of the header (the entire header block, which ends just before the Tabs div) with the new banner + identity block. The old header block is:

```tsx
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        <button
          onClick={() => { if (isOwn) setAddingStory(true); else if (userStories.length > 0) setViewingStory(true) }}
          className="flex-shrink-0 focus:outline-none"
          style={{ cursor: isOwn || userStories.length > 0 ? "pointer" : "default" }}
        >
          <div
            className="rounded-full"
            style={{
              padding: userStories.length > 0 ? 3 : 0,
              background: userStories.length > 0
                ? "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)"
                : "transparent",
            }}
          >
            <div className="rounded-full" style={{ padding: userStories.length > 0 ? 2 : 0, background: "#0D0D0F" }}>
              {profileUser.image ? (
                <img src={profileUser.image} alt={profileUser.name ?? profileUser.username ?? "Profile"} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>
                  {initials}
                </div>
              )}
            </div>
          </div>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white">@{profileUser.username}</h1>
            {isOwn ? (
              <Link href="/settings" className="text-sm px-3 py-1 rounded-lg text-white/60 hover:text-white transition-colors" style={{ border: "1px solid #ffffff20" }}>
                Edit profile
              </Link>
            ) : session && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => followStatus?.following
                    ? unfollowMutation.mutate({ username })
                    : followMutation.mutate({ username })
                  }
                  disabled={followMutation.isPending || unfollowMutation.isPending}
                  className="text-sm px-4 py-1.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                  style={followStatus?.following
                    ? { background: "#ffffff15", border: "1px solid #ffffff30" }
                    : { background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }
                  }
                >
                  {followMutation.isPending || unfollowMutation.isPending
                    ? "…"
                    : followStatus?.following ? "Following" : "Follow"}
                </button>
                <button
                  onClick={() => getOrCreateDM.mutate({ otherUserId: profileUser.id })}
                  disabled={getOrCreateDM.isPending}
                  className="text-sm px-3 py-1.5 rounded-lg text-white/60 hover:text-white transition-colors disabled:opacity-50"
                  style={{ border: "1px solid #ffffff20" }}
                >
                  {getOrCreateDM.isPending ? "Opening…" : "Message"}
                </button>
              </div>
            )}
          </div>

          {profileUser.name && (
            <p className="text-white/60 text-sm font-medium mt-0.5">{profileUser.name}</p>
          )}

          {/* Follower / following / post counts */}
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-white/70">
              <span className="font-bold text-white">{posts?.length ?? 0}</span> posts
            </span>
            <span className="text-sm text-white/70">
              <span className="font-bold text-white">{followStatus?.followerCount ?? 0}</span> followers
            </span>
            <span className="text-sm text-white/70">
              <span className="font-bold text-white">{followStatus?.followingCount ?? 0}</span> following
            </span>
            {!isOwn && mutualData && mutualData.count > 0 && (
              <button onClick={() => setShowMutuals(true)} className="text-sm text-cyan-400 hover:underline">
                {mutualData.count} mutual
              </button>
            )}
          </div>
        </div>
      </div>
```

Replace with:

```tsx
      {/* ── Banner ─────────────────────────────────────────────── */}
      <div
        className="w-full relative overflow-hidden"
        style={{
          height: 120,
          background: (profileUser as { bannerImage?: string | null }).bannerImage
            ? undefined
            : "linear-gradient(135deg, #1a0535 0%, #0d1a35 50%, #0a1a20 100%)",
        }}
      >
        {(profileUser as { bannerImage?: string | null }).bannerImage && (
          <img
            src={(profileUser as { bannerImage?: string | null }).bannerImage!}
            className="w-full h-full object-cover"
            alt=""
          />
        )}
      </div>

      {/* ── Profile identity block ─────────────────────────────── */}
      <div className="px-4">
        {/* Avatar — overlapping banner by 40px */}
        <div style={{ marginTop: -40, marginBottom: 12 }}>
          <button
            onClick={() => {
              if (isOwn) setAddingStory(true)
              else if (userStories.length > 0) setViewingStory(true)
            }}
            className="focus:outline-none"
            style={{ cursor: isOwn || userStories.length > 0 ? "pointer" : "default" }}
          >
            {/* Gradient ring — always on, brighter if has story */}
            <div
              style={{
                padding: userStories.length > 0 ? 2.5 : 1.5,
                background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                borderRadius: "50%",
                opacity: userStories.length > 0 ? 1 : 0.4,
              }}
            >
              <div
                style={{ padding: 2, background: "#0D0D0F", borderRadius: "50%" }}
              >
                {profileUser.image ? (
                  <img
                    src={profileUser.image}
                    alt={profileUser.name ?? profileUser.username ?? "Profile"}
                    className="rounded-full object-cover"
                    style={{ width: 80, height: 80 }}
                  />
                ) : (
                  <div
                    className="rounded-full flex items-center justify-center text-white text-2xl font-bold"
                    style={{
                      width: 80,
                      height: 80,
                      background:
                        "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                    }}
                  >
                    {initials}
                  </div>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Artist name (Space Grotesk) */}
        <h1
          className="text-white font-bold leading-tight"
          style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22 }}
        >
          {profileUser.name ?? profileUser.username}
        </h1>
        <p className="text-white/50 text-sm mt-0.5">@{profileUser.username}</p>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <span className="text-sm text-white/70">
            <span className="font-bold text-white">{posts?.length ?? 0}</span> posts
          </span>
          <span className="text-sm text-white/70">
            <span className="font-bold text-white">
              {followStatus?.followerCount ?? 0}
            </span>{" "}
            followers
          </span>
          <span className="text-sm text-white/70">
            <span className="font-bold text-white">
              {followStatus?.followingCount ?? 0}
            </span>{" "}
            following
          </span>
          {!isOwn && mutualData && mutualData.count > 0 && (
            <button
              onClick={() => setShowMutuals(true)}
              className="text-sm text-cyan-400 hover:underline"
            >
              {mutualData.count} mutual
            </button>
          )}
        </div>

        {/* Commission open badge */}
        {commissionProfile &&
          (commissionProfile.commissionStatus === "OPEN" ||
            commissionProfile.commissionStatus === "LIMITED") && (
            <span className="inline-block text-xs font-semibold brand-gradient-text mt-1.5">
              Commission open ↗
            </span>
          )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3 mb-6">
          {isOwn ? (
            <>
              <Link
                href="/settings"
                className="text-sm px-3 py-1.5 rounded-lg text-white/60 hover:text-white transition-colors"
                style={{ border: "1px solid #ffffff20" }}
              >
                Edit profile
              </Link>
              {/* + Story gradient-border pill */}
              <div
                style={{
                  padding: 1.5,
                  background:
                    "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                  borderRadius: 20,
                }}
              >
                <button
                  onClick={() => setAddingStory(true)}
                  className="text-xs font-semibold text-white px-3 py-1 rounded-full"
                  style={{ background: "#0D0D0F" }}
                >
                  + Story
                </button>
              </div>
            </>
          ) : (
            session && (
              <>
                <button
                  onClick={() =>
                    followStatus?.following
                      ? unfollowMutation.mutate({ username })
                      : followMutation.mutate({ username })
                  }
                  disabled={followMutation.isPending || unfollowMutation.isPending}
                  className="text-sm px-4 py-1.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                  style={
                    followStatus?.following
                      ? { background: "#ffffff15", border: "1px solid #ffffff30" }
                      : {
                          background:
                            "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                        }
                  }
                >
                  {followMutation.isPending || unfollowMutation.isPending
                    ? "…"
                    : followStatus?.following
                    ? "Following"
                    : "Follow"}
                </button>
                <button
                  onClick={() =>
                    getOrCreateDM.mutate({ otherUserId: profileUser.id })
                  }
                  disabled={getOrCreateDM.isPending}
                  className="text-sm px-3 py-1.5 rounded-lg text-white/60 hover:text-white transition-colors disabled:opacity-50"
                  style={{ border: "1px solid #ffffff20" }}
                >
                  {getOrCreateDM.isPending ? "Opening…" : "Message"}
                </button>
              </>
            )
          )}
        </div>
```

- [ ] **Step 3: Replace underline tabs with pill tabs**

In `app/[username]/page.tsx`, find:

```tsx
      {/* Tabs */}
      <div className="mb-6" style={{ borderBottom: "1px solid #ffffff10" }}>
        <nav className="flex gap-6">
          {(["Posts", "Shop", "Commissions", "About"] as const).filter((t) => {
            if (isOwn) return true
            if (t === "Shop" && (!shopItems || shopItems.length === 0)) return false
            if (t === "Commissions" && commissionProfile?.commissionStatus === "CLOSED") return false
            return true
          }).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? "border-white text-white" : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>
```

Replace with:

```tsx
      {/* ── Pill tabs ──────────────────────────────────────────── */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {(["Posts", "Shop", "Commissions", "About"] as const)
          .filter((t) => {
            if (isOwn) return true
            if (t === "Shop" && (!shopItems || shopItems.length === 0))
              return false
            if (
              t === "Commissions" &&
              commissionProfile?.commissionStatus === "CLOSED"
            )
              return false
            return true
          })
          .map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-sm font-medium px-4 py-1.5 rounded-full transition-all"
              style={
                tab === t
                  ? {
                      background:
                        "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                      color: "white",
                    }
                  : {
                      background: "transparent",
                      color: "rgba(255,255,255,0.4)",
                    }
              }
            >
              {t}
            </button>
          ))}
      </div>
```

- [ ] **Step 4: Close the identity block div and add px-4 wrapper around tabs + content**

After the pill tabs replacement, we need to close the `<div className="px-4">` we opened in Step 2. The rest of the page content (tab panels, modals at bottom) must also be wrapped in `px-4`. Find the closing `</div>` at the very end of the return (before the outer `</div>`):

```tsx
    </div>
  )
}
```

And ensure the structure is correct: the closing `</div>` of `<div className="px-4">` goes after all the tab content. In practice, after applying all the replacements above the structure should be:

```
<div className="max-w-2xl mx-auto pb-24">
  {modals...}
  {banner}
  <div className="px-4">
    {avatar}
    {identity block + buttons}
    {pill tabs}
    {tab content — Posts, Shop, Commissions, About}
    {upload modals}
    {StoryViewer, StoryUpload, PostModal}
  </div>
</div>
```

Verify the closing `</div>` count matches: the outer `max-w-2xl` div and the inner `px-4` div must both close properly. The final lines of the return should be:

```tsx
      {viewPost && (
        <PostModal ... />
      )}
    </div>  {/* closes px-4 */}
  </div>   {/* closes max-w-2xl */}
)
```

Locate where to add the closing `</div>` for `px-4`. It should go just before the final `</div>` that closes `max-w-2xl`. Find:

```tsx
    </div>
  )
}
```

And replace with (adding the extra closing div):

```tsx
    </div>
  </div>
  )
}
```

Wait — careful here. After the replacements above, the return statement structure needs exactly one `</div>` closing the `<div className="px-4">`. The easiest approach is to locate the last `</div>` before `)` and confirm the nesting. Count:

- `<div className="max-w-2xl mx-auto pb-24">` — opened, needs to close at the very end
- `<div className="px-4">` — opened in Step 2 identity block, needs to close after PostModal

In `app/[username]/page.tsx`, the very last lines of the `return` are currently:

```tsx
      {viewPost && (
        <PostModal
          post={viewPost}
          profileUser={{ username: profileUser.username, name: profileUser.name, image: profileUser.image }}
          isOwn={isOwn}
          onClose={() => setViewPost(null)}
          onDelete={() => {
            utils.post.getByUsername.invalidate({ username })
            utils.post.getCommissionsByUsername.invalidate({ username })
            setViewPost(null)
          }}
          onPinToggle={isOwn ? () => {
            utils.post.getByUsername.invalidate({ username })
            setViewPost(null)
          } : undefined}
        />
      )}
    </div>
  )
}
```

Replace the last `</div>` with two closing divs:

```tsx
      {viewPost && (
        <PostModal
          post={viewPost}
          profileUser={{ username: profileUser.username, name: profileUser.name, image: profileUser.image }}
          isOwn={isOwn}
          onClose={() => setViewPost(null)}
          onDelete={() => {
            utils.post.getByUsername.invalidate({ username })
            utils.post.getCommissionsByUsername.invalidate({ username })
            setViewPost(null)
          }}
          onPinToggle={isOwn ? () => {
            utils.post.getByUsername.invalidate({ username })
            setViewPost(null)
          } : undefined}
        />
      )}
    </div>
  </div>
  )
}
```

- [ ] **Step 5: Update the grid in Posts tab to match spec (gap-0.5 → gap: 2px, add border-radius 4px)**

In `app/[username]/page.tsx`, find:

```tsx
            <div className="grid grid-cols-3 gap-0.5">
              {posts.map((post) => (
                <button key={post.id} onClick={() => setViewPost(post as PostItem)}
                  className="relative aspect-square overflow-hidden group" style={{ background: "#ffffff08" }}>
```

Replace with:

```tsx
            <div className="grid grid-cols-3" style={{ gap: 2 }}>
              {posts.map((post) => (
                <button key={post.id} onClick={() => setViewPost(post as PostItem)}
                  className="relative aspect-square overflow-hidden group" style={{ background: "#ffffff08", borderRadius: 4 }}>
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: no errors. If you see errors about `bannerImage` not existing on the profileUser type, it's because `prisma generate` hasn't run yet — the TypeScript error will resolve after deploy when `prisma generate` runs. Use the type cast `(profileUser as { bannerImage?: string | null }).bannerImage` already used in Step 2.

- [ ] **Step 7: Commit**

```bash
git add "app/[username]/page.tsx"
git commit -m "feat: profile banner, Space Grotesk heading, pill tabs, gradient avatar ring"
```

---

## Task 8: Settings page — banner image upload

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: Add bannerImage state variables**

In `app/settings/page.tsx`, find:

```typescript
  const [photoProcessing, setPhotoProcessing] = useState(false)
```

Replace with:

```typescript
  const [photoProcessing, setPhotoProcessing] = useState(false)
  const [bannerImage, setBannerImage] = useState<string | null>(null)
  const [bannerProcessing, setBannerProcessing] = useState(false)
```

- [ ] **Step 2: Initialise bannerImage from loaded user data**

In `app/settings/page.tsx`, find the `useEffect` that seeds form state:

```typescript
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
```

Replace with:

```typescript
  useEffect(() => {
    if (user) {
      setName(user.name ?? "")
      setBio(user.bio ?? "")
      setImage(user.image ?? null)
      setBannerImage((user as { bannerImage?: string | null }).bannerImage ?? null)
      setWebsiteUrl(user.websiteUrl ?? "")
      setTwitterHandle(user.twitterHandle ?? "")
      setInstagramHandle(user.instagramHandle ?? "")
      setArtstationHandle(user.artstationHandle ?? "")
    }
  }, [user])
```

- [ ] **Step 3: Add banner image processing function**

In `app/settings/page.tsx`, after the `handlePhotoChange` function, add:

```typescript
  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerProcessing(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new window.Image()
      img.onload = () => {
        const MAX_W = 1200
        const MAX_H = 400
        let { width, height } = img
        if (width > MAX_W) { height = Math.round((height * MAX_W) / width); width = MAX_W }
        if (height > MAX_H) { width = Math.round((width * MAX_H) / height); height = MAX_H }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
        setBannerImage(canvas.toDataURL("image/jpeg", 0.85))
        setBannerProcessing(false)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }
```

- [ ] **Step 4: Pass bannerImage in the handleSave call**

In `app/settings/page.tsx`, find:

```typescript
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
```

Replace with:

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

- [ ] **Step 5: Add banner upload UI in the profile tab**

In `app/settings/page.tsx`, find the end of the photo upload section (after the avatar upload controls):

```tsx
        </div>
        {/* END of photo section */}
```

The photo section ends with:

```tsx
          </div>
        </div>
```

Locate the photo div block (it's the first item inside the profile tab `<div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-6 mb-6">`). After that block add the banner upload section:

Find:

```tsx
        {/* Photo */}
        <div className="flex items-center gap-4">
          {image ? (
            <img src={image} alt="Profile" className="rounded-full object-cover flex-shrink-0" style={{ width: 72, height: 72 }} />
          ) : (
            <div className="rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold flex-shrink-0" style={{ width: 72, height: 72 }}>
              {initials}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">Profile photo</p>
            <div className="flex gap-2 mt-2">
              <label className="cursor-pointer text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
                {photoProcessing ? "Processing…" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={photoProcessing} />
              </label>
              {image && (
                <button onClick={() => setImage(null)} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
```

Replace with:

```tsx
        {/* Profile photo */}
        <div className="flex items-center gap-4">
          {image ? (
            <img src={image} alt="Profile" className="rounded-full object-cover flex-shrink-0" style={{ width: 72, height: 72 }} />
          ) : (
            <div className="rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold flex-shrink-0" style={{ width: 72, height: 72 }}>
              {initials}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">Profile photo</p>
            <div className="flex gap-2 mt-2">
              <label className="cursor-pointer text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
                {photoProcessing ? "Processing…" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={photoProcessing} />
              </label>
              {image && (
                <button onClick={() => setImage(null)} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profile banner */}
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-2">Profile banner</p>
          <p className="text-xs text-gray-400 mb-3">Shown at the top of your profile. Recommended: wide landscape image.</p>
          {bannerImage ? (
            <div className="relative rounded-xl overflow-hidden mb-2" style={{ height: 80 }}>
              <img src={bannerImage} alt="Banner" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="rounded-xl mb-2 flex items-center justify-center text-xs text-gray-400"
              style={{ height: 80, background: "#f3f4f6", border: "2px dashed #d1d5db" }}
            >
              No banner set — a gradient will be used
            </div>
          )}
          <div className="flex gap-2">
            <label className="cursor-pointer text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
              {bannerProcessing ? "Processing…" : "Upload banner"}
              <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} disabled={bannerProcessing} />
            </label>
            {bannerImage && (
              <button onClick={() => setBannerImage(null)} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                Remove
              </button>
            )}
          </div>
        </div>
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat: banner image upload in settings profile tab"
```

---

## Post-Deploy Step: Run the migration endpoint

After pushing to Vercel and the deployment succeeds, hit the migration endpoint to create the `bannerImage` column in production:

```
GET https://gallery-ebon-xi.vercel.app/api/run-migration?secret=gallery-migrate-2026
```

Expected response:
```json
{
  "ok": true,
  "results": [
    "Story table: OK",
    "StoryView table: OK",
    "Indexes: OK",
    "Foreign keys: OK",
    "Migration record (stories): OK",
    "bannerImage column: OK",
    "Migration record (banner): OK"
  ]
}
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in |
|---|---|
| Space Grotesk font (400/600/700) | Task 1 |
| Avatar rings — always-on gradient ring | Task 6 (feed), Task 7 (profile) |
| Card borders: `#141414`, `rgba(255,255,255,0.08)`, `radius 16px` | Task 1 (`.gallery-card`), Task 6 |
| FeaturedArtistsStrip replacing StoriesRow | Task 5 |
| Rectangular cards 64×80, top 56px image, bottom 24px label | Task 5 |
| Feed posts: floating card with mx-3, two-line header | Task 6 |
| Commission open badge in feed post header | Task 6 |
| Artwork title below image in feed | Task 6 |
| commissionStatus in getFeed | Task 2 |
| Profile banner 120px, gradient fallback | Task 7 |
| Avatar overlapping banner by -40px | Task 7 |
| Space Grotesk artist name 22px bold | Task 7 |
| Commission badge on profile | Task 7 |
| Pill tabs (gradient active, transparent inactive) | Task 7 |
| Grid gap 2px, border-radius 4px | Task 7 |
| + Story gradient-border pill button | Task 7 |
| bannerImage in schema | Task 3 |
| Runtime migration (bannerImage) | Task 3 |
| updateProfile with bannerImage | Task 4 |
| Settings banner upload | Task 8 |

All spec requirements are covered. No TBDs or placeholders. Type consistency verified — `commissionStatus` uses `"OPEN" | "LIMITED" | "CLOSED"` string literals matching the Prisma enum throughout.
