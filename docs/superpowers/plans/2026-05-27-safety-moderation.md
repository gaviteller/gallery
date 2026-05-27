# Safety & Moderation — Remaining Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Burn a diagonal watermark into post images at upload time, and allow users to appeal removed posts alongside the existing strike appeal flow.

**Architecture:** Watermark is applied client-side via Canvas API in `lib/watermark.ts` before the base64 is sent to the tRPC `post.create` mutation. Post appeals extend the existing `Appeal` schema with an optional `postId` field, add a `getMyRemovedPosts` query, update `submitAppeal`, update the gallery-admin `approveAppeal` mutation to restore posts, and add a "Your removed posts" section to `/appeal`.

**Tech Stack:** Next.js App Router, tRPC, Prisma (PostgreSQL), Vitest (node + jsdom per-file), React (no Tailwind — inline styles only on new UI).

---

## File Map

**Create:**
- `lib/watermark.ts` — `applyWatermark(dataUrl, username)` utility
- `tests/watermark.test.ts` — jsdom-env tests for the watermark utility
- `tests/post-appeal.test.ts` — DB-level tests for post appeal tRPC logic

**Modify (gallery — `C:\Users\gavri\OneDrive\Documents\Projects\gallery`):**
- `prisma/schema.prisma` — add `postId`/`post` to `Appeal`, add `appeals` to `Post`
- `server/routers/user.ts` — add `getMyRemovedPosts`, update `submitAppeal` + `getMyAppeals`
- `app/[username]/page.tsx` — call `applyWatermark` before `createPost.mutate`
- `app/appeal/page.tsx` — add removed posts section + `selectedPostId` state
- `docs/roadmap.md` — tick off completed items

**Modify (gallery-admin — `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin`):**
- `server/routers/admin.ts` — update `approveAppeal` (post restore) + `getAppeal` (include post)
- `app/appeals/page.tsx` — show "Post Removal" vs "Strike" badge
- `app/appeals/[id]/page.tsx` — show post thumbnail card when appeal is a post removal

---

## Task 1: Watermark Utility + Tests

**Files:**
- Create: `lib/watermark.ts`
- Create: `tests/watermark.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/watermark.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { applyWatermark } from "@/lib/watermark"

// 1×1 transparent PNG as base64
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

describe("applyWatermark", () => {
  it("returns a jpeg data URL", async () => {
    const result = await applyWatermark(TINY_PNG, "artlover")
    expect(result).toMatch(/^data:image\/jpeg/)
  })

  it("returns a different string than the input", async () => {
    const result = await applyWatermark(TINY_PNG, "artlover")
    expect(result).not.toBe(TINY_PNG)
  })

  it("uses fallback username when empty string provided", async () => {
    const result = await applyWatermark(TINY_PNG, "")
    expect(result).toMatch(/^data:image\/jpeg/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\gavri\OneDrive\Documents\Projects\gallery"
npx vitest run tests/watermark.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/watermark'`

- [ ] **Step 3: Implement `lib/watermark.ts`**

```ts
/**
 * Burns "Gallery | @username" diagonally across the center of an image.
 * Returns a new JPEG base64 data URL.
 */
export function applyWatermark(dataUrl: string, username: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const W = img.naturalWidth || 1
      const H = img.naturalHeight || 1

      const canvas = document.createElement("canvas")
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext("2d")!

      // Draw original image
      ctx.drawImage(img, 0, 0, W, H)

      // Watermark text
      const handle = username.trim() || "gallery"
      const text = `Gallery | @${handle}`
      const fontSize = Math.max(12, Math.floor(W * 0.072))

      ctx.save()
      ctx.translate(W / 2, H / 2)
      ctx.rotate(-Math.PI / 4)
      ctx.font = `bold ${fontSize}px Arial, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.shadowColor = "rgba(0,0,0,0.7)"
      ctx.shadowBlur = 8
      ctx.globalAlpha = 0.28
      ctx.fillStyle = "#ffffff"
      ctx.fillText(text, 0, 0)
      ctx.restore()

      resolve(canvas.toDataURL("image/jpeg", 0.9))
    }
    img.onerror = () => reject(new Error("Watermark: failed to load image"))
    img.src = dataUrl
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/watermark.test.ts
```

Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/watermark.ts tests/watermark.test.ts
git commit -m "feat: add applyWatermark utility with jsdom tests"
```

---

## Task 2: Integrate Watermark into Upload Flow

**Files:**
- Modify: `app/[username]/page.tsx` (around line 109: the `imgProcessing` state + Share button onClick at line 814)

- [ ] **Step 1: Add `isWatermarking` state**

After the existing `const [imgProcessing, setImgProcessing] = useState(false)` line (~line 109), add:

```ts
const [isWatermarking, setIsWatermarking] = useState(false)
```

- [ ] **Step 2: Import `applyWatermark`**

At the top of `app/[username]/page.tsx`, add to the existing imports:

```ts
import { applyWatermark } from "@/lib/watermark"
```

- [ ] **Step 3: Replace the Share button onClick**

Find the Share button onClick (currently at line ~814):
```ts
onClick={() => { if (uploadImage) createPost.mutate({ image: uploadImage, description: uploadDesc.trim() || undefined, isAiGenerated: uploadIsAi, isCommission: uploadIsCommission }) }}
```

Replace with:
```ts
onClick={async () => {
  if (!uploadImage) return
  setIsWatermarking(true)
  try {
    const watermarked = await applyWatermark(uploadImage, session?.user?.username ?? "gallery")
    createPost.mutate({
      image: watermarked,
      description: uploadDesc.trim() || undefined,
      isAiGenerated: uploadIsAi,
      isCommission: uploadIsCommission,
    })
  } catch {
    // applyWatermark failed — fall back to posting without watermark
    createPost.mutate({
      image: uploadImage,
      description: uploadDesc.trim() || undefined,
      isAiGenerated: uploadIsAi,
      isCommission: uploadIsCommission,
    })
  } finally {
    setIsWatermarking(false)
  }
}}
```

- [ ] **Step 4: Update the disabled + label to include `isWatermarking`**

Find the current `disabled` prop:
```ts
disabled={createPost.isPending || !uploadImage || imgProcessing}
```

Replace with:
```ts
disabled={createPost.isPending || !uploadImage || imgProcessing || isWatermarking}
```

Find the button label:
```ts
{createPost.isPending ? "Posting…" : "Share"}
```

Replace with:
```ts
{createPost.isPending || isWatermarking ? "Posting…" : "Share"}
```

- [ ] **Step 5: Verify manually**

Start dev server (`npm run dev`), go to a profile page, upload an image. After posting, the stored image should have the diagonal watermark. Check by opening the post in the feed — the watermark will be visible burned into the image.

- [ ] **Step 6: Commit**

```bash
git add app/[username]/page.tsx
git commit -m "feat: burn watermark into post images at upload"
```

---

## Task 3: Schema Migration — Add postId to Appeal

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `postId` + `post` relation to `Appeal` model**

In `prisma/schema.prisma`, find the `Appeal` model. After the `dmcaRequestId`/`dmcaRequest` lines, add:

```prisma
  postId  String?
  post    Post?   @relation(fields: [postId], references: [id], onDelete: SetNull)
```

The full model should now have these optional relation fields together:
```prisma
  strikeId      String?
  strike        Strike?      @relation(fields: [strikeId], references: [id])
  dmcaRequestId String?
  dmcaRequest   DmcaRequest? @relation(fields: [dmcaRequestId], references: [id])
  postId        String?
  post          Post?        @relation(fields: [postId], references: [id], onDelete: SetNull)
```

- [ ] **Step 2: Add `appeals` relation to `Post` model**

In the `Post` model, after `reports Report[]`, add:

```prisma
  appeals Appeal[]
```

- [ ] **Step 3: Run migration**

```bash
cd "C:\Users\gavri\OneDrive\Documents\Projects\gallery"
npx prisma migrate dev --name add-post-id-to-appeal
```

Expected output: Migration created and applied. No errors.

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add postId to Appeal model for post removal appeals"
```

---

## Task 4: tRPC — getMyRemovedPosts + Update submitAppeal + getMyAppeals

**Files:**
- Modify: `server/routers/user.ts`
- Create: `tests/post-appeal.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/post-appeal.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

describe("post removal appeals", () => {
  let ownerId: string
  let otherId: string
  let removedPostId: string
  let publishedPostId: string

  beforeAll(async () => {
    ownerId = (await prisma.user.create({
      data: { email: `owner-${Date.now()}@t.com`, username: `owner${Date.now()}` },
    })).id
    otherId = (await prisma.user.create({
      data: { email: `other-${Date.now()}@t.com`, username: `other${Date.now()}` },
    })).id
    removedPostId = (await prisma.post.create({
      data: { userId: ownerId, image: "data:image/png;base64,x", status: "REMOVED" },
    })).id
    publishedPostId = (await prisma.post.create({
      data: { userId: ownerId, image: "data:image/png;base64,x", status: "PUBLISHED" },
    })).id
  })

  afterAll(async () => {
    await prisma.appeal.deleteMany({ where: { userId: ownerId } })
    await prisma.post.deleteMany({ where: { userId: ownerId } })
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } })
    await prisma.$disconnect()
  })

  it("can create an appeal referencing a removed post", async () => {
    const appeal = await prisma.appeal.create({
      data: { userId: ownerId, postId: removedPostId, text: "This was wrongly removed." },
    })
    expect(appeal.postId).toBe(removedPostId)
    expect(appeal.status).toBe("PENDING")
    await prisma.appeal.delete({ where: { id: appeal.id } })
  })

  it("appeal with postId has null strikeId", async () => {
    const appeal = await prisma.appeal.create({
      data: { userId: ownerId, postId: removedPostId, text: "Post appeal test." },
    })
    expect(appeal.strikeId).toBeNull()
    await prisma.appeal.delete({ where: { id: appeal.id } })
  })

  it("getMyRemovedPosts logic: finds REMOVED posts for owner", async () => {
    const posts = await prisma.post.findMany({
      where: { userId: ownerId, status: "REMOVED" },
      select: { id: true, status: true },
    })
    expect(posts.some(p => p.id === removedPostId)).toBe(true)
    expect(posts.every(p => p.status === "REMOVED")).toBe(true)
  })

  it("getMyRemovedPosts logic: does not return PUBLISHED posts", async () => {
    const posts = await prisma.post.findMany({
      where: { userId: ownerId, status: "REMOVED" },
      select: { id: true },
    })
    expect(posts.some(p => p.id === publishedPostId)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/post-appeal.test.ts
```

Expected: FAIL — Prisma `Appeal` model does not have `postId` field yet (should pass after Task 3)

> Note: Run this after completing Task 3 migration. If Task 3 is done, tests should pass at this point since they test DB operations directly.

- [ ] **Step 3: Add `getMyRemovedPosts` to `server/routers/user.ts`**

After the closing of `getMyAppeals` (after line 127), add:

```ts
  getMyRemovedPosts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.post.findMany({
      where: { userId: ctx.session.user.id, status: "REMOVED" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, image: true, updatedAt: true, flagReason: true },
    })
  }),
```

- [ ] **Step 4: Update `getMyAppeals` to include `postId` and `strikeId`**

Find the `getMyAppeals` query (line 121–127). Replace its select:

```ts
  getMyAppeals: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.appeal.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        text: true,
        createdAt: true,
        reviewedAt: true,
        strikeId: true,
        postId: true,
      },
    })
  }),
```

- [ ] **Step 5: Update `submitAppeal` to accept `postId`**

Find `submitAppeal` (line 129). Replace the entire procedure:

```ts
  submitAppeal: protectedProcedure
    .input(
      z.object({
        text:     z.string().min(20).max(2000),
        strikeId: z.string().optional(),
        postId:   z.string().optional(),
      }).refine(d => d.strikeId || d.postId, {
        message: "Must specify a strike or a removed post to appeal.",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callerId = ctx.session.user.id

      // Only one pending appeal at a time
      const existing = await ctx.prisma.appeal.findFirst({
        where: { userId: callerId, status: "PENDING" },
      })
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a pending appeal." })

      if (input.strikeId) {
        const strike = await ctx.prisma.strike.findUnique({
          where: { id: input.strikeId },
          select: { userId: true },
        })
        if (!strike || strike.userId !== callerId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Strike not found or does not belong to you." })
        }
      }

      if (input.postId) {
        const post = await ctx.prisma.post.findUnique({
          where: { id: input.postId },
          select: { userId: true, status: true },
        })
        if (!post || post.userId !== callerId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Post not found or does not belong to you." })
        }
        if (post.status !== "REMOVED") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This post is not removed." })
        }
        // No duplicate post appeal
        const dupPostAppeal = await ctx.prisma.appeal.findFirst({
          where: { userId: callerId, postId: input.postId, status: "PENDING" },
        })
        if (dupPostAppeal) {
          throw new TRPCError({ code: "CONFLICT", message: "You already have a pending appeal for this post." })
        }
      }

      return ctx.prisma.appeal.create({
        data: {
          userId:   callerId,
          text:     input.text,
          strikeId: input.strikeId ?? null,
          postId:   input.postId ?? null,
        },
      })
    }),
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run tests/post-appeal.test.ts
```

Expected: PASS — 4 tests passing

- [ ] **Step 7: Run full test suite to confirm nothing broken**

```bash
npx vitest run
```

Expected: All existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add server/routers/user.ts tests/post-appeal.test.ts
git commit -m "feat: add getMyRemovedPosts, extend submitAppeal and getMyAppeals for post removal appeals"
```

---

## Task 5: Appeal Page — Removed Posts Section

**Files:**
- Modify: `app/appeal/page.tsx`

- [ ] **Step 1: Update the tRPC hooks and state**

At the top of `AppealPage`, the existing state is:
```ts
const [text, setText] = useState("")
const [selectedStrikeId, setSelectedStrikeId] = useState<string | undefined>()
```

Replace with:
```ts
const [text, setText] = useState("")
const [selectedStrikeId, setSelectedStrikeId] = useState<string | undefined>()
const [selectedPostId, setSelectedPostId] = useState<string | undefined>()
```

After the existing `const { data: appeals }` line, add:
```ts
const { data: removedPosts } = trpc.user.getMyRemovedPosts.useQuery(undefined, { enabled: !!session })
```

- [ ] **Step 2: Update `onSuccess` to clear `selectedPostId`**

Find:
```ts
  const submitAppeal = trpc.user.submitAppeal.useMutation({
    onSuccess: () => {
      setText("")
      setSelectedStrikeId(undefined)
    },
  })
```

Replace with:
```ts
  const submitAppeal = trpc.user.submitAppeal.useMutation({
    onSuccess: () => {
      setText("")
      setSelectedStrikeId(undefined)
      setSelectedPostId(undefined)
    },
  })
```

- [ ] **Step 3: Add removed posts section after the strikes section**

Find the closing of the strikes section (`</div>` after `{selectedStrikeId && ...}`). After that closing `</div>`, add:

```tsx
{/* Removed posts */}
{removedPosts && removedPosts.length > 0 && (
  <div style={{ marginBottom: 24 }}>
    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
      Your removed posts
    </p>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {removedPosts.map(p => {
        const alreadyAppealed = appeals?.some(a => a.postId === p.id && a.status === "PENDING")
        const isSelected = selectedPostId === p.id
        return (
          <div
            key={p.id}
            onClick={() => {
              if (alreadyAppealed) return
              setSelectedPostId(prev => prev === p.id ? undefined : p.id)
              setSelectedStrikeId(undefined)
            }}
            style={{
              position: "relative",
              width: 72, height: 72,
              borderRadius: 8,
              overflow: "hidden",
              cursor: alreadyAppealed ? "default" : "pointer",
              border: `2px solid ${isSelected ? "rgba(176,68,248,0.8)" : "rgba(255,255,255,0.1)"}`,
              opacity: alreadyAppealed ? 0.5 : 1,
            }}
          >
            <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {alreadyAppealed && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, textAlign: "center", padding: "0 4px" }}>
                  Appealed
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
    {selectedPostId && (
      <p style={{ color: "rgba(176,68,248,0.8)", fontSize: 12, marginTop: 8 }}>
        Post selected — your appeal will reference this removed post.
      </p>
    )}
  </div>
)}
```

- [ ] **Step 4: Update the `pendingAppeal` check to cover both types**

Find:
```ts
const pendingAppeal = appeals?.find(a => a.status === "PENDING")
```

This is already correct — any PENDING appeal (strike or post) blocks new submissions. No change needed.

- [ ] **Step 5: Update the Submit button `onClick`**

Find:
```ts
onClick={() => submitAppeal.mutate({ text, strikeId: selectedStrikeId })}
```

Replace with:
```ts
onClick={() => submitAppeal.mutate({ text, strikeId: selectedStrikeId, postId: selectedPostId })}
```

- [ ] **Step 6: Update the Submit button `disabled` to require a selection**

Find:
```ts
disabled={submitAppeal.isPending || text.length < 20}
```

Replace with:
```ts
disabled={submitAppeal.isPending || text.length < 20 || (!selectedStrikeId && !selectedPostId)}
```

- [ ] **Step 7: Verify manually**

Go to `/appeal` as a user who has a removed post. Confirm:
- Post thumbnails appear in "Your removed posts" section
- Clicking a post selects it (purple border)
- Clicking a strike deselects the post (mutually exclusive)
- Submitting an appeal works

- [ ] **Step 8: Commit**

```bash
git add app/appeal/page.tsx
git commit -m "feat: add removed posts section to appeal page"
```

---

## Task 6: gallery-admin — Update approveAppeal + getAppeal

**Files:**
- Modify: `server/routers/admin.ts` in `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin`

- [ ] **Step 1: Update `getAppeal` to include the post relation**

In `gallery-admin/server/routers/admin.ts`, find the `getAppeal` procedure's `include` block (around line 369):

```ts
        include: {
          user: {
            select: {
              id: true, username: true, bannedUntil: true, banReason: true,
```

Add `post` to the include, after `strike: true,`:

```ts
        include: {
          user: {
            select: {
              id: true, username: true, bannedUntil: true, banReason: true,
              receivedStrikes: { select: { id: true, level: true, violation: true, createdAt: true, reversed: true } },
            },
          },
          strike: true,
          post: {
            select: { id: true, image: true, status: true, flagReason: true },
          },
        },
```

- [ ] **Step 2: Update `approveAppeal` to restore post when `appeal.postId` is set**

In `approveAppeal`, find the block after the strike reversal (around line 398):

```ts
        if (appeal.strikeId) {
          await tx.strike.update({ where: { id: appeal.strikeId }, data: { reversed: true } })
        }
```

Add after it:

```ts
        if (appeal.postId) {
          await tx.post.update({
            where: { id: appeal.postId },
            data: {
              status: "PUBLISHED",
              pendingAt: null,
              flagReason: null,
              reportCount: 0,
            },
          })
        }
```

- [ ] **Step 3: Update `approveAppeal` notification message to cover post appeals**

Find the notification creation in `approveAppeal`:
```ts
        await tx.notification.create({
          data: {
            userId: appeal.userId,
            fromUserId: null,
            type: "appeal_approved",
            message: "Your appeal has been approved. The action has been reversed.",
          },
        })
```

Replace the `message` to be contextual:
```ts
        await tx.notification.create({
          data: {
            userId: appeal.userId,
            fromUserId: null,
            type: "appeal_approved",
            message: appeal.postId
              ? "Your appeal has been approved. Your post has been restored."
              : "Your appeal has been approved. The action has been reversed.",
          },
        })
```

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin"
git add server/routers/admin.ts
git commit -m "feat: approveAppeal restores post on post removal appeals; getAppeal includes post"
```

---

## Task 7: gallery-admin — Update Appeals UI

**Files:**
- Modify: `app/appeals/page.tsx` in gallery-admin
- Modify: `app/appeals/[id]/page.tsx` in gallery-admin

- [ ] **Step 1: Add type badge to appeals list**

In `gallery-admin/app/appeals/page.tsx`, find the section inside the appeal button that shows the strike info:

```tsx
                {a.strike && (
                  <span className="hud-td-mono" style={{ marginLeft: 8 }}>
                    {a.strike.level} · {a.strike.violation.replace(/_/g, " ")}
                  </span>
                )}
```

Replace with:

```tsx
                {a.postId ? (
                  <span className="badge badge-warn" style={{ marginLeft: 8, fontSize: 9 }}>
                    Post Removal
                  </span>
                ) : a.strike ? (
                  <span className="hud-td-mono" style={{ marginLeft: 8 }}>
                    {a.strike.level} · {a.strike.violation.replace(/_/g, " ")}
                  </span>
                ) : null}
```

- [ ] **Step 2: Add post thumbnail to appeals list row**

In the same `page.tsx`, the appeal button currently has two children: a top row (username + info) and the text preview `<p>`. Add a post thumbnail as a third element after the `<p>`:

```tsx
              {a.postId && (
                <div style={{ marginTop: 8 }}>
                  <img
                    src={(a as typeof a & { post?: { image: string } | null }).post?.image ?? ""}
                    alt=""
                    style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, border: "1px solid var(--purple-border)" }}
                  />
                </div>
              )}
```

Wait — the `listAppeals` query currently only includes `user` and `strike` in its include. Update `listAppeals` in `gallery-admin/server/routers/admin.ts` to also include `post`:

Find `listAppeals` (around line 354):
```ts
        include: {
          user: { select: { id: true, username: true } },
```

Replace with:
```ts
        include: {
          user: { select: { id: true, username: true } },
          post: { select: { image: true } },
```

Then update the `page.tsx` to use the image properly (no cast needed):

```tsx
              {a.postId && a.post && (
                <div style={{ marginTop: 8 }}>
                  <img
                    src={a.post.image}
                    alt=""
                    style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, border: "1px solid var(--purple-border)" }}
                  />
                </div>
              )}
```

- [ ] **Step 3: Add post card to appeal detail page**

In `gallery-admin/app/appeals/[id]/page.tsx`, after the existing `{appeal.strike && (...)}` block (around line 57), add:

```tsx
        {/* Referenced post */}
        {appeal.post && (
          <div className="hud-card" style={{ marginBottom: 16 }}>
            <p className="hud-stat-label" style={{ marginBottom: 8 }}>Removed Post</p>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <img
                src={appeal.post.image}
                alt=""
                style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 4, border: "1px solid var(--purple-border)", flexShrink: 0 }}
              />
              <div>
                <div className="hud-td-mono" style={{ marginBottom: 4 }}>
                  Status: <span style={{ color: appeal.post.status === "REMOVED" ? "var(--pink)" : "var(--green)" }}>
                    {appeal.post.status}
                  </span>
                </div>
                {appeal.post.flagReason && (
                  <div className="hud-td-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>
                    Flag reason: {appeal.post.flagReason}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
```

- [ ] **Step 4: Update Approve button label to be context-aware**

Find:
```tsx
              {approveAppeal.isPending ? "Approving…" : "✓ Approve — Reverse strike & lift ban"}
```

Replace with:
```tsx
              {approveAppeal.isPending ? "Approving…" : appeal.postId ? "✓ Approve — Restore post" : "✓ Approve — Reverse strike & lift ban"}
```

- [ ] **Step 5: Verify manually**

In gallery-admin, create a test post appeal (via the gallery app), then go to `/appeals` — verify "Post Removal" badge and thumbnail appear. Click through to the detail — verify post card renders. Click Approve — verify post status changes to PUBLISHED in the DB.

- [ ] **Step 6: Commit**

```bash
git add server/routers/admin.ts app/appeals/page.tsx app/appeals/[id]/page.tsx
git commit -m "feat: show post thumbnail and Post Removal badge in appeals UI"
```

---

## Task 8: Update Roadmap + Run All Tests

**Files:**
- Modify: `docs/roadmap.md` in gallery project
- Cleanup: `watermark-preview.html` (delete the temp file)

- [ ] **Step 1: Tick off completed roadmap items**

In `docs/roadmap.md`, find the Safety & Moderation section and update:

```markdown
- [x] Community report button on posts (3 reports from distinct accounts = hiding + flag)
- [x] Content Pending state — 14-day challenge window before auto-removal
- [x] Auto-watermark on artwork: format `Gallery | @username`
- [x] Moderation review queue + appeals flow (human reviewer, 5 business day SLA)
- [ ] Email notification on content flagged/removed
```

- [ ] **Step 2: Delete the watermark preview HTML**

```bash
cd "C:\Users\gavri\OneDrive\Documents\Projects\gallery"
del watermark-preview.html
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass (watermark tests + post appeal tests + all pre-existing tests).

- [ ] **Step 4: Commit**

```bash
git add docs/roadmap.md
git rm watermark-preview.html
git commit -m "docs: mark safety & moderation items complete in roadmap"
```
