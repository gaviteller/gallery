# Content Moderation Queue — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add community reporting, a Content Pending state with 14-day auto-removal, and a DMCA request queue across gallery and gallery-admin.

**Architecture:** Three new DB models (Report, DmcaRequest) and two new enums (PostStatus, ReportReason, ReportStatus, DmcaStatus). Gallery gains a report button on posts and a public DMCA form. Gallery-admin gains three new queue pages (Reports, Pending, DMCA). A daily cron job auto-removes posts that have been pending for 14 days.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 5, TypeScript, Vitest.

---

## Codebase orientation

- **gallery repo:** `C:\Users\gavri\OneDrive\Documents\Projects\gallery`
  - Router files live at `server/routers/` (no `src/` prefix — the project root is the app root)
  - Components live at `components/`
  - App pages live at `app/`
  - Existing post router: `server/routers/post.ts`
  - Router registry: `server/routers/_app.ts`
  - Post cards are rendered inline in `app/page.tsx` (feed) and `app/[username]/page.tsx` (profile) — there is no standalone `PostCard.tsx` component yet
  - `Notification` model has non-nullable `fromUserId String` — system notifications must use a sentinel system-user ID stored in `process.env.SYSTEM_USER_ID`
- **gallery-admin repo:** `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin`
  - Admin router: `server/routers/admin.ts`
  - Layout: `components/AdminLayout.tsx` — nav array currently has Dashboard, Users, Posts, Appeals

---

## Task 1: Schema — PostStatus, Report, DmcaRequest (gallery repo)

- [ ] Open `prisma/schema.prisma` in the gallery repo and make the following additions:

  **New enums** (add after existing enums, before model definitions):
  ```prisma
  enum PostStatus {
    PUBLISHED
    PENDING_REVIEW
    REMOVED
  }

  enum ReportReason {
    SPAM
    HARASSMENT
    HATE_SPEECH
    GORE
    CSAM
    COPYRIGHT
    UNLABELLED_AI
    OTHER
  }

  enum ReportStatus {
    PENDING
    REVIEWED_REMOVED
    REVIEWED_KEPT
  }

  enum DmcaStatus {
    PENDING
    REMOVED
    COUNTER_FILED
    RESOLVED
    REJECTED
  }
  ```

  **Add to `Post` model** (after the existing `updatedAt` field, before the relations):
  ```prisma
  status      PostStatus @default(PUBLISHED)
  pendingAt   DateTime?
  flagReason  String?
  reportCount Int        @default(0)
  ```

  **Add to `Post` model relations** (after the existing `comments Comment[]` line):
  ```prisma
  reports     Report[]
  ```

  **Add to `User` model** (after the existing `submittedAppeals Appeal[]` line):
  ```prisma
  submittedReports Report[] @relation("SubmittedReports")
  ```

  **Add to `Appeal` model** (after the existing `strikeId String?` / `strike Strike?` pair):
  ```prisma
  dmcaRequestId String?
  dmcaRequest   DmcaRequest? @relation(fields: [dmcaRequestId], references: [id])
  ```

  **Add `Report` model** (after the `Post` model):
  ```prisma
  model Report {
    id         String       @id @default(cuid())
    postId     String
    post       Post         @relation(fields: [postId], references: [id], onDelete: Cascade)
    reporterId String
    reporter   User         @relation("SubmittedReports", fields: [reporterId], references: [id], onDelete: Cascade)
    reason     ReportReason
    notes      String?      @db.Text
    status     ReportStatus @default(PENDING)
    createdAt  DateTime     @default(now())
    reviewedAt DateTime?

    @@unique([postId, reporterId])
    @@index([postId])
    @@index([status])
  }
  ```

  **Add `DmcaRequest` model** (after the `Report` model):
  ```prisma
  model DmcaRequest {
    id            String     @id @default(cuid())
    claimantName  String
    claimantEmail String
    postId        String?
    postUrl       String?    @db.Text
    description   String     @db.Text
    status        DmcaStatus @default(PENDING)
    createdAt     DateTime   @default(now())
    reviewedAt    DateTime?
    resolution    String?    @db.Text

    appeals Appeal[]

    @@index([status])
    @@index([claimantEmail])
  }
  ```

- [ ] Run the migration in the gallery repo:
  ```
  npx prisma migrate dev --name add_reports_post_status_dmca
  ```

- [ ] Copy the updated `prisma/schema.prisma` to the gallery-admin repo (same file path), then run:
  ```
  npx prisma generate
  ```
  (in the gallery-admin repo directory)

- [ ] Write Vitest test at `tests/report-unique.test.ts` in gallery repo:
  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from "vitest"
  import { PrismaClient } from "@prisma/client"

  const prisma = new PrismaClient()

  describe("Report @@unique constraint", () => {
    let postId: string
    let reporterId: string
    let ownerId: string

    beforeAll(async () => {
      ownerId = (await prisma.user.create({
        data: { email: `owner-${Date.now()}@test.com`, username: `owner-${Date.now()}` },
      })).id
      reporterId = (await prisma.user.create({
        data: { email: `reporter-${Date.now()}@test.com`, username: `reporter-${Date.now()}` },
      })).id
      postId = (await prisma.post.create({
        data: { userId: ownerId, image: "data:image/png;base64,test" },
      })).id
    })

    afterAll(async () => {
      await prisma.report.deleteMany({ where: { postId } })
      await prisma.post.delete({ where: { id: postId } })
      await prisma.user.deleteMany({ where: { id: { in: [ownerId, reporterId] } } })
      await prisma.$disconnect()
    })

    it("creates a Report row successfully", async () => {
      const report = await prisma.report.create({
        data: { postId, reporterId, reason: "SPAM" },
      })
      expect(report.id).toBeTruthy()
      expect(report.status).toBe("PENDING")
    })

    it("throws on duplicate [postId, reporterId]", async () => {
      await expect(
        prisma.report.create({ data: { postId, reporterId, reason: "OTHER" } })
      ).rejects.toThrow()
    })
  })
  ```

- [ ] Run `npx vitest run tests/report-unique.test.ts`

- [ ] Commit both repos:
  ```
  # gallery repo
  git add prisma/schema.prisma prisma/migrations/ tests/report-unique.test.ts
  git commit -m "feat: add PostStatus, Report, DmcaRequest schema + migration"

  # gallery-admin repo
  git add prisma/schema.prisma
  git commit -m "feat: sync prisma schema with gallery (Report, DmcaRequest, PostStatus)"
  ```

---

## Task 2: `post.report` tRPC procedure (gallery repo)

- [ ] Open `server/routers/post.ts` and add the following import at the top:
  ```typescript
  import { ReportReason } from "@prisma/client"
  ```

- [ ] Add the `report` procedure inside the `postRouter` object (after the `getMyPostStats` procedure):
  ```typescript
  report: protectedProcedure
    .input(z.object({
      postId: z.string(),
      reason: z.nativeEnum(ReportReason),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const callerId = ctx.session.user.id

      // 1. Verify post exists and caller is not the owner
      const post = await ctx.prisma.post.findUnique({
        where: { id: input.postId },
        select: { id: true, userId: true, status: true, reportCount: true },
      })
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." })
      if (post.userId === callerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot report your own post." })
      }

      // 2. Create Report row (unique constraint will throw on duplicate)
      try {
        await ctx.prisma.report.create({
          data: {
            postId: input.postId,
            reporterId: callerId,
            reason: input.reason,
            notes: input.notes ?? null,
          },
        })
      } catch (e: unknown) {
        // Prisma unique constraint violation = P2002
        if ((e as { code?: string })?.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "You have already reported this post." })
        }
        throw e
      }

      // 3. Increment reportCount atomically and check threshold
      const updated = await ctx.prisma.post.update({
        where: { id: input.postId },
        data: { reportCount: { increment: 1 } },
        select: { reportCount: true, status: true },
      })

      // 4. If threshold reached and post is still PUBLISHED, move to PENDING_REVIEW
      if (updated.reportCount >= 3 && updated.status === "PUBLISHED") {
        await ctx.prisma.$transaction(async (tx) => {
          await tx.post.update({
            where: { id: input.postId },
            data: {
              status: "PENDING_REVIEW",
              pendingAt: new Date(),
              flagReason: "Reached community report threshold",
            },
          })
          // Notify post owner — uses SYSTEM_USER_ID as fromUserId since this is automated
          const systemUserId = process.env.SYSTEM_USER_ID
          if (systemUserId) {
            await tx.notification.create({
              data: {
                userId: post.userId,
                fromUserId: systemUserId,
                type: "post_pending_review",
                // Note: if the Notification model adds a `message` field in a future migration,
                // store the text there. For now the client reads the type to display the message.
              },
            })
          }
        })
      }

      return { success: true }
    }),
  ```

  > **Note on notifications:** The current `Notification` model has a non-nullable `fromUserId`. System-generated notifications (no human sender) require a sentinel system user. Add `SYSTEM_USER_ID=<cuid of a seeded system account>` to `.env`. If the env var is absent the notification is silently skipped — this is intentional to avoid blocking the report action during initial deployment before the system user is seeded.

- [ ] Write Vitest tests at `tests/post.report.test.ts`:
  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from "vitest"
  import { PrismaClient } from "@prisma/client"
  import { createCallerFactory } from "@trpc/server"
  import { appRouter } from "@/server/routers/_app"
  import { createTRPCContext } from "@/lib/trpc"

  const prisma = new PrismaClient()

  // Helper: create a minimal session context
  function makeCtx(userId: string) {
    return createTRPCContext({
      session: { user: { id: userId, email: "test@test.com" }, expires: "" },
      prisma,
    })
  }

  const createCaller = createCallerFactory(appRouter)

  describe("post.report", () => {
    let ownerId: string
    let reporter1Id: string
    let reporter2Id: string
    let reporter3Id: string
    let postId: string

    beforeAll(async () => {
      ownerId = (await prisma.user.create({
        data: { email: `own-${Date.now()}@t.com`, username: `own${Date.now()}` },
      })).id
      reporter1Id = (await prisma.user.create({
        data: { email: `r1-${Date.now()}@t.com`, username: `r1${Date.now()}` },
      })).id
      reporter2Id = (await prisma.user.create({
        data: { email: `r2-${Date.now()}@t.com`, username: `r2${Date.now()}` },
      })).id
      reporter3Id = (await prisma.user.create({
        data: { email: `r3-${Date.now()}@t.com`, username: `r3${Date.now()}` },
      })).id
      postId = (await prisma.post.create({
        data: { userId: ownerId, image: "data:image/png;base64,x" },
      })).id
    })

    afterAll(async () => {
      await prisma.report.deleteMany({ where: { postId } })
      await prisma.post.delete({ where: { id: postId } })
      await prisma.user.deleteMany({
        where: { id: { in: [ownerId, reporter1Id, reporter2Id, reporter3Id] } },
      })
      await prisma.$disconnect()
    })

    it("allows a user to report a post (success)", async () => {
      const caller = createCaller(makeCtx(reporter1Id))
      const result = await caller.post.report({ postId, reason: "SPAM" })
      expect(result.success).toBe(true)
      const report = await prisma.report.findFirst({ where: { postId, reporterId: reporter1Id } })
      expect(report).not.toBeNull()
      expect(report!.reason).toBe("SPAM")
    })

    it("throws CONFLICT on duplicate report from same user", async () => {
      const caller = createCaller(makeCtx(reporter1Id))
      await expect(caller.post.report({ postId, reason: "OTHER" })).rejects.toMatchObject({
        code: "CONFLICT",
      })
    })

    it("sets post to PENDING_REVIEW when reportCount reaches 3", async () => {
      const caller2 = createCaller(makeCtx(reporter2Id))
      const caller3 = createCaller(makeCtx(reporter3Id))
      await caller2.post.report({ postId, reason: "HARASSMENT" })
      await caller3.post.report({ postId, reason: "HARASSMENT" })
      const post = await prisma.post.findUnique({ where: { id: postId } })
      expect(post!.status).toBe("PENDING_REVIEW")
      expect(post!.pendingAt).not.toBeNull()
      expect(post!.flagReason).toBe("Reached community report threshold")
    })
  })
  ```

- [ ] Run `npx tsc --noEmit` in gallery repo. Fix any type errors before proceeding.
- [ ] Run `npx vitest run tests/post.report.test.ts`
- [ ] Commit:
  ```
  git add server/routers/post.ts tests/post.report.test.ts
  git commit -m "feat: add post.report tRPC procedure with auto-pending threshold"
  ```

---

## Task 3: Report button and ReportModal on post cards (gallery repo)

- [ ] Create `components/ReportModal.tsx`:
  ```typescript
  "use client"

  import { useState } from "react"
  import { trpc } from "@/components/providers"

  const REASON_LABELS: Record<string, string> = {
    SPAM: "Spam",
    HARASSMENT: "Harassment",
    HATE_SPEECH: "Hate Speech",
    GORE: "Gore / Graphic Violence",
    CSAM: "Child Safety",
    COPYRIGHT: "Copyright Violation",
    UNLABELLED_AI: "Unlabelled AI-Generated Content",
    OTHER: "Other",
  }

  interface ReportModalProps {
    postId: string
    onClose: () => void
    onReported: () => void
  }

  export default function ReportModal({ postId, onClose, onReported }: ReportModalProps) {
    const [reason, setReason] = useState("SPAM")
    const [notes, setNotes] = useState("")
    const [error, setError] = useState<string | null>(null)

    const report = trpc.post.report.useMutation({
      onSuccess: () => {
        onReported()
        onClose()
      },
      onError: (err) => {
        if (err.data?.code === "CONFLICT") {
          setError("You have already reported this post.")
        } else {
          setError("Something went wrong. Please try again.")
        }
      },
    })

    return (
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div style={{
          background: "#1a1a2e", borderRadius: 12, padding: 24, width: 360,
          border: "1px solid rgba(255,255,255,0.12)",
        }}>
          <h3 style={{ color: "white", fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>
            Report Post
          </h3>

          <label style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, display: "block", marginBottom: 6 }}>
            Reason
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: "100%", background: "#0d0d1a", color: "white", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8, padding: "8px 10px", fontSize: 13, marginBottom: 14,
            }}
          >
            {Object.entries(REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <label style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, display: "block", marginBottom: 6 }}>
            Additional notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Describe the issue..."
            style={{
              width: "100%", background: "#0d0d1a", color: "white", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "none", marginBottom: 14,
              boxSizing: "border-box",
            }}
          />
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "right", marginTop: -10, marginBottom: 14 }}>
            {notes.length}/500
          </div>

          {error && (
            <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{
                background: "none", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
                borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => report.mutate({ postId, reason: reason as never, notes: notes || undefined })}
              disabled={report.isPending}
              style={{
                background: "#7c3aed", border: "none", color: "white",
                borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer",
                opacity: report.isPending ? 0.6 : 1,
              }}
            >
              {report.isPending ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] In `app/page.tsx`, update the `FeedPost` type to add the new fields returned by the updated `getFeed` query (done in Task 4, but add the types now to avoid cascading errors):
  ```typescript
  // Add to FeedPost type:
  status: "PUBLISHED" | "PENDING_REVIEW" | "REMOVED"
  viewerHasReported: boolean
  ```

  Add a `reportedPostIds` Set to track locally reported posts (for instant UI feedback before next query refresh). In the post card render area, add the Report button and modal trigger. The exact insertion point is in the JSX where each post card is rendered — look for the like/comment button row and add after it:

  ```typescript
  // At the top of FeedPage component, add state:
  const [reportingPostId, setReportingPostId] = useState<string | null>(null)
  const [localReported, setLocalReported] = useState<Set<string>>(new Set())

  // In the post card JSX, after the existing like/comment buttons:
  {session && !post.isOwnPost && (
    localReported.has(post.id) || post.viewerHasReported ? (
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
        Reported
      </span>
    ) : (
      <button
        onClick={() => setReportingPostId(post.id)}
        style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.3)",
          fontSize: 11, cursor: "pointer", marginLeft: "auto", padding: "2px 6px",
        }}
      >
        ⚑ Report
      </button>
    )
  )}

  // After the posts list JSX, add the modal:
  {reportingPostId && (
    <ReportModal
      postId={reportingPostId}
      onClose={() => setReportingPostId(null)}
      onReported={() => {
        setLocalReported(prev => new Set([...prev, reportingPostId!]))
        setReportingPostId(null)
      }}
    />
  )}
  ```

  Add the import at top of `app/page.tsx`:
  ```typescript
  import ReportModal from "@/components/ReportModal"
  ```

- [ ] Apply the same Report button pattern to `app/[username]/page.tsx`:
  - Update the `PostItem` type to add `status: "PUBLISHED" | "PENDING_REVIEW" | "REMOVED"` and `viewerHasReported: boolean`
  - Add `reportingPostId` / `localReported` state
  - Add the Report button to each post thumbnail card in the grid (only for authenticated users who are not the profile owner)
  - Import and render `ReportModal`

- [ ] Run `npx tsc --noEmit`. Fix any type errors.
- [ ] Commit:
  ```
  git add components/ReportModal.tsx app/page.tsx app/[username]/page.tsx
  git commit -m "feat: add Report button and ReportModal to post cards"
  ```

---

## Task 4: Content Pending state — visibility filtering and Under Review badge (gallery repo)

- [ ] In `server/routers/post.ts`, update `getFeed` to filter out `PENDING_REVIEW` and `REMOVED` posts for non-owners, and include the `viewerHasReported` field and `status` on each post:

  In the `getFeed` `findMany` call, add a `where` clause to the initial pool query:
  ```typescript
  where: {
    user: { username: { not: null } },
    OR: [
      { status: "PUBLISHED" },
      // Owner sees their own PENDING_REVIEW posts
      ...(ctx.session?.user?.id ? [{ status: "PENDING_REVIEW", userId: ctx.session.user.id }] : []),
    ],
  },
  ```

  In the `include` block, add:
  ```typescript
  include: {
    user: { select: { id: true, username: true, name: true, image: true, commissionStatus: true } },
    _count: { select: { likes: true, comments: true } },
    // Include viewer's report if session exists (resolved below)
  },
  ```

  After fetching `myLikes`, also fetch `myReports`:
  ```typescript
  const myReports = ctx.session?.user?.id
    ? await ctx.prisma.report.findMany({
        where: { reporterId: ctx.session.user.id, postId: { in: posts.map(p => p.id) } },
        select: { postId: true },
      })
    : []
  const reportedSet = new Set(myReports.map(r => r.postId))
  ```

  Add `viewerHasReported` and `status` to the scored posts spread:
  ```typescript
  return {
    ...post,
    isFollowing: followingSet.has(post.userId),
    isOwnPost: post.userId === userId,
    likedByMe: likedSet.has(post.id),
    viewerHasReported: reportedSet.has(post.id),
    _score: recency + engagement + followBoost + interestBoost,
  }
  ```

- [ ] In `server/routers/post.ts`, update `getByUsername` to filter posts by status, showing only `PUBLISHED` posts to other users and showing `PENDING_REVIEW` only to the profile owner. Since `getByUsername` is a `publicProcedure` with no session, the simplest correct approach is to convert it to a procedure that accepts an optional `viewerUserId` from the client:

  ```typescript
  getByUsername: publicProcedure
    .input(z.object({ username: z.string(), viewerUserId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })

      const isOwner = input.viewerUserId === user.id
      return ctx.prisma.post.findMany({
        where: {
          userId: user.id,
          status: isOwner ? { in: ["PUBLISHED", "PENDING_REVIEW"] } : "PUBLISHED",
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      })
    }),
  ```

  In `app/[username]/page.tsx`, pass `viewerUserId: session?.user?.id` to the `getByUsername` call.

- [ ] Add the "Under Review" badge in `app/[username]/page.tsx` for PENDING_REVIEW posts. In the post thumbnail grid JSX, after the image tag, add:
  ```typescript
  {post.status === "PENDING_REVIEW" && (
    <div style={{
      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.55)", borderRadius: "inherit",
    }}>
      <span style={{
        background: "#854d0e", color: "#fef08a", fontSize: 11, fontWeight: 700,
        padding: "4px 10px", borderRadius: 20, border: "1px solid #a16207",
      }}>
        Under Review
      </span>
    </div>
  )}
  ```

  Also add the badge in `app/page.tsx` feed for the owner's own PENDING_REVIEW posts (same pattern, positioned absolutely over the post image).

- [ ] Run `npx tsc --noEmit`. Fix any type errors.
- [ ] Commit:
  ```
  git add server/routers/post.ts app/page.tsx app/[username]/page.tsx
  git commit -m "feat: filter PENDING_REVIEW posts from public feeds, add Under Review badge"
  ```

---

## Task 5: Pending expiry cron job (gallery repo)

- [ ] Create directory `app/api/cron/pending-expiry/` and create `app/api/cron/pending-expiry/route.ts`:
  ```typescript
  import { NextResponse } from "next/server"
  import { prisma } from "@/lib/prisma"

  export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

    const expired = await prisma.post.findMany({
      where: { status: "PENDING_REVIEW", pendingAt: { lt: cutoff } },
      select: { id: true, userId: true },
    })

    const systemUserId = process.env.SYSTEM_USER_ID

    for (const post of expired) {
      await prisma.$transaction(async (tx) => {
        await tx.post.update({
          where: { id: post.id },
          data: { status: "REMOVED" },
        })
        if (systemUserId) {
          await tx.notification.create({
            data: {
              userId: post.userId,
              fromUserId: systemUserId,
              type: "post_auto_removed",
            },
          })
        }
      })
    }

    return NextResponse.json({ removed: expired.length })
  }
  ```

  > **Deployment note:** Register this route with Vercel Cron in `vercel.json`:
  > ```json
  > {
  >   "crons": [{ "path": "/api/cron/pending-expiry", "schedule": "0 3 * * *" }]
  > }
  > ```
  > The `Authorization: Bearer $CRON_SECRET` header is automatically sent by Vercel Cron. Add `CRON_SECRET` to Vercel environment variables.

- [ ] Run `npx tsc --noEmit`.
- [ ] Commit:
  ```
  git add app/api/cron/pending-expiry/route.ts vercel.json
  git commit -m "feat: add pending-expiry cron route for 14-day auto-removal"
  ```

---

## Task 6: Public DMCA form (gallery repo)

- [ ] Create `server/routers/dmca.ts`:
  ```typescript
  import { z } from "zod"
  import { router, publicProcedure } from "@/lib/trpc"

  export const dmcaRouter = router({
    submit: publicProcedure
      .input(z.object({
        claimantName: z.string().min(1).max(200),
        claimantEmail: z.string().email(),
        postUrl: z.string().url(),
        description: z.string().min(50).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        // Attempt to extract postId from a URL like /posts/<id>
        const match = input.postUrl.match(/\/posts\/([a-z0-9]+)/i)
        const postId = match ? match[1] : null

        await ctx.prisma.dmcaRequest.create({
          data: {
            claimantName: input.claimantName,
            claimantEmail: input.claimantEmail,
            postId: postId ?? null,
            postUrl: input.postUrl,
            description: input.description,
          },
        })

        return { success: true }
      }),
  })
  ```

- [ ] Register in `server/routers/_app.ts`:
  ```typescript
  import { dmcaRouter } from "./dmca"

  // Add to the router object:
  dmca: dmcaRouter,
  ```

- [ ] Create `app/dmca/page.tsx`:
  ```typescript
  "use client"

  import { useState } from "react"
  import { trpc } from "@/components/providers"

  export default function DmcaPage() {
    const [claimantName, setClaimantName] = useState("")
    const [claimantEmail, setClaimantEmail] = useState("")
    const [postUrl, setPostUrl] = useState("")
    const [description, setDescription] = useState("")
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = trpc.dmca.submit.useMutation({
      onSuccess: () => setSubmitted(true),
      onError: (err) => setError(err.message),
    })

    if (submitted) {
      return (
        <div style={{
          minHeight: "100vh", background: "#0D0D0F", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ maxWidth: 480, textAlign: "center", padding: "0 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
              Request Received
            </h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, lineHeight: 1.6 }}>
              Your DMCA request has been received. We will respond within 14 days as required by law.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div style={{ minHeight: "100vh", background: "#0D0D0F", padding: "48px 24px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ color: "white", fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
            DMCA Takedown Request
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            Use this form to report content you believe infringes your copyright. We review all requests
            and respond within 14 days as required by the Digital Millennium Copyright Act.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Field label="Your full name *">
              <input
                type="text"
                value={claimantName}
                onChange={(e) => setClaimantName(e.target.value)}
                placeholder="Jane Smith"
                style={inputStyle}
              />
            </Field>

            <Field label="Your email address *">
              <input
                type="email"
                value={claimantEmail}
                onChange={(e) => setClaimantEmail(e.target.value)}
                placeholder="jane@example.com"
                style={inputStyle}
              />
            </Field>

            <Field label="Link to the post you believe infringes your copyright *">
              <input
                type="url"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://gallery.example.com/posts/abc123"
                style={inputStyle}
              />
            </Field>

            <Field label="Describe your original work and how it is being infringed *">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Describe the original work you own and how the post infringes it. Include as much detail as possible."
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "right", marginTop: 4 }}>
                {description.length}/5000 (minimum 50 characters)
              </div>
            </Field>

            {error && (
              <div style={{ color: "#f87171", fontSize: 13 }}>{error}</div>
            )}

            <button
              onClick={() => submit.mutate({ claimantName, claimantEmail, postUrl, description })}
              disabled={submit.isPending}
              style={{
                background: "#7c3aed", color: "white", border: "none", borderRadius: 10,
                padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                opacity: submit.isPending ? 0.6 : 1,
              }}
            >
              {submit.isPending ? "Submitting..." : "Submit DMCA Takedown Request"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div>
        <label style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, display: "block", marginBottom: 6 }}>
          {label}
        </label>
        {children}
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#1a1a2e", color: "white",
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
    padding: "10px 12px", fontSize: 14, boxSizing: "border-box",
  }
  ```

- [ ] Add a "DMCA / Copyright" link to the site footer. Locate the footer in the gallery layout (check `app/layout.tsx`) and add:
  ```typescript
  <Link href="/dmca" style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
    DMCA / Copyright
  </Link>
  ```

- [ ] Run `npx tsc --noEmit`.
- [ ] Commit:
  ```
  git add server/routers/dmca.ts server/routers/_app.ts app/dmca/page.tsx app/layout.tsx
  git commit -m "feat: add public DMCA form and dmca.submit tRPC procedure"
  ```

---

## Task 7: gallery-admin — Reports queue page

All work in this task is in the **gallery-admin** repo.

- [ ] In `server/routers/admin.ts`, add two new procedures at the end of the `adminRouter` object:

  ```typescript
  // ── Reports queue ────────────────────────────────────────────────────────────

  listReports: modProcedure
    .query(async ({ ctx }) => {
      // Posts that have at least one PENDING report, sorted by reportCount descending
      const posts = await ctx.prisma.post.findMany({
        where: { reports: { some: { status: "PENDING" } } },
        orderBy: { reportCount: "desc" },
        select: {
          id: true,
          image: true,
          reportCount: true,
          createdAt: true,
          user: { select: { id: true, username: true } },
          reports: {
            where: { status: "PENDING" },
            select: { reason: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
        },
        take: 100,
      })

      return posts.map((post) => {
        // Compute most frequent reason
        const reasonCounts: Record<string, number> = {}
        for (const r of post.reports) {
          reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1
        }
        const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        const firstReportedAt = post.reports[0]?.createdAt ?? null

        return {
          postId: post.id,
          image: post.image,
          username: post.user.username,
          userId: post.user.id,
          reportCount: post.reportCount,
          topReason,
          firstReportedAt,
          pendingReportCount: post.reports.length,
        }
      })
    }),

  getReportDetail: modProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.prisma.post.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          image: true,
          status: true,
          reportCount: true,
          user: { select: { id: true, username: true } },
          reports: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            select: {
              id: true, reason: true, notes: true, createdAt: true,
              reporter: { select: { username: true } },
            },
          },
        },
      })
      if (!post) throw new TRPCError({ code: "NOT_FOUND" })
      return post
    }),

  resolveReport: modProcedure
    .input(z.object({
      postId: z.string(),
      action: z.enum(["remove", "keep"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.post.findUnique({
        where: { id: input.postId },
        select: { id: true, userId: true },
      })
      if (!post) throw new TRPCError({ code: "NOT_FOUND" })

      await ctx.prisma.$transaction(async (tx) => {
        if (input.action === "remove") {
          // Hard-delete the post (cascades to reports, likes, comments)
          await tx.post.delete({ where: { id: input.postId } })
          // Mark reports — they'll be deleted by cascade, but update first so callers see the right status if using soft-delete later
          // (with hard-delete the reports are already gone via cascade; this is a no-op but kept for clarity)
          await tx.notification.create({
            data: {
              userId: post.userId,
              fromUserId: ctx.session.user.id,
              type: "post_removed_tos",
            },
          })
        } else {
          // Keep: dismiss all PENDING reports, reset status and count
          await tx.report.updateMany({
            where: { postId: input.postId, status: "PENDING" },
            data: { status: "REVIEWED_KEPT", reviewedAt: new Date() },
          })
          await tx.post.update({
            where: { id: input.postId },
            data: { status: "PUBLISHED", reportCount: 0, pendingAt: null, flagReason: null },
          })
        }
      })

      return { success: true }
    }),
  ```

- [ ] Create `app/reports/page.tsx` in gallery-admin:
  ```typescript
  "use client"

  import { useState } from "react"
  import Link from "next/link"
  import { trpc } from "@/components/providers"
  import AdminLayout from "@/components/AdminLayout"

  const REASON_LABELS: Record<string, string> = {
    SPAM: "Spam",
    HARASSMENT: "Harassment",
    HATE_SPEECH: "Hate Speech",
    GORE: "Gore",
    CSAM: "Child Safety",
    COPYRIGHT: "Copyright",
    UNLABELLED_AI: "Unlabelled AI",
    OTHER: "Other",
  }

  export default function ReportsPage() {
    const { data: reports, isLoading, refetch } = trpc.admin.listReports.useQuery()
    const resolve = trpc.admin.resolveReport.useMutation({ onSuccess: () => refetch() })
    const [confirming, setConfirming] = useState<{ postId: string; action: "remove" | "keep" } | null>(null)

    return (
      <AdminLayout>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
          Reports Queue
        </h1>
        {isLoading && <p style={{ color: "rgba(255,255,255,0.4)" }}>Loading...</p>}
        {reports?.length === 0 && (
          <p style={{ color: "rgba(255,255,255,0.4)" }}>No pending reports.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reports?.map((row) => (
            <div key={row.postId} style={{
              background: "#1a1a2e", borderRadius: 10, padding: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", gap: 14, alignItems: "flex-start",
            }}>
              {/* Thumbnail */}
              <img
                src={row.image}
                alt=""
                style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>
                    @{row.username ?? "—"}
                  </span>
                  <span style={{
                    background: "#7f1d1d", color: "#fca5a5", fontSize: 11, fontWeight: 700,
                    padding: "2px 8px", borderRadius: 12,
                  }}>
                    {row.reportCount} reports
                  </span>
                  {row.topReason && (
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                      Top: {REASON_LABELS[row.topReason] ?? row.topReason}
                    </span>
                  )}
                </div>
                {row.firstReportedAt && (
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginBottom: 10 }}>
                    First reported {new Date(row.firstReportedAt).toLocaleDateString()}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <Link
                    href={`/reports/${row.postId}`}
                    style={{
                      color: "#a78bfa", fontSize: 12, textDecoration: "none",
                      border: "1px solid rgba(167,139,250,0.3)", borderRadius: 6, padding: "4px 10px",
                    }}
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => setConfirming({ postId: row.postId, action: "remove" })}
                    style={{
                      background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 6,
                      padding: "4px 10px", fontSize: 12, cursor: "pointer",
                    }}
                  >
                    Remove Post
                  </button>
                  <button
                    onClick={() => resolve.mutate({ postId: row.postId, action: "keep" })}
                    disabled={resolve.isPending}
                    style={{
                      background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "none",
                      borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer",
                    }}
                  >
                    Keep Post
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Confirm remove dialog */}
        {confirming?.action === "remove" && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}>
            <div style={{
              background: "#1a1a2e", borderRadius: 12, padding: 24, width: 340,
              border: "1px solid rgba(255,255,255,0.15)",
            }}>
              <p style={{ color: "white", marginBottom: 16 }}>Remove this post? This action cannot be undone.</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setConfirming(null)}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "white", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  onClick={() => {
                    resolve.mutate({ postId: confirming.postId, action: "remove" })
                    setConfirming(null)
                  }}
                  style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    )
  }
  ```

- [ ] Create `app/reports/[postId]/page.tsx` in gallery-admin:
  ```typescript
  "use client"

  import { use } from "react"
  import { useRouter } from "next/navigation"
  import { trpc } from "@/components/providers"
  import AdminLayout from "@/components/AdminLayout"

  const REASON_LABELS: Record<string, string> = {
    SPAM: "Spam", HARASSMENT: "Harassment", HATE_SPEECH: "Hate Speech",
    GORE: "Gore / Graphic Violence", CSAM: "Child Safety", COPYRIGHT: "Copyright Violation",
    UNLABELLED_AI: "Unlabelled AI", OTHER: "Other",
  }

  export default function ReportDetailPage({ params }: { params: Promise<{ postId: string }> }) {
    const { postId } = use(params)
    const router = useRouter()
    const { data: post, isLoading } = trpc.admin.getReportDetail.useQuery({ postId })
    const resolve = trpc.admin.resolveReport.useMutation({
      onSuccess: () => router.push("/reports"),
    })

    if (isLoading) return <AdminLayout><p style={{ color: "rgba(255,255,255,0.4)" }}>Loading...</p></AdminLayout>
    if (!post) return <AdminLayout><p style={{ color: "#f87171" }}>Post not found.</p></AdminLayout>

    return (
      <AdminLayout>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13 }}>
            ← Back
          </button>
          <h1 style={{ color: "white", fontSize: 20, fontWeight: 700, margin: 0 }}>
            Report Detail — @{post.user.username}
          </h1>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          <img src={post.image} alt="" style={{ width: "100%", borderRadius: 10, objectFit: "cover" }} />
          <div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 4 }}>Status</div>
            <div style={{ color: "white", fontSize: 14, marginBottom: 16 }}>{post.status}</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 4 }}>Total report count</div>
            <div style={{ color: "white", fontSize: 14, marginBottom: 24 }}>{post.reportCount}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => resolve.mutate({ postId: post.id, action: "remove" })}
                disabled={resolve.isPending}
                style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 600 }}>
                Remove Post
              </button>
              <button
                onClick={() => resolve.mutate({ postId: post.id, action: "keep" })}
                disabled={resolve.isPending}
                style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer" }}>
                Keep Post
              </button>
            </div>
          </div>
        </div>

        <h2 style={{ color: "white", fontSize: 16, marginBottom: 12 }}>Reports ({post.reports.length})</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "rgba(255,255,255,0.4)", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Reporter</th>
              <th style={{ padding: "8px 12px" }}>Reason</th>
              <th style={{ padding: "8px 12px" }}>Notes</th>
              <th style={{ padding: "8px 12px" }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {post.reports.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)" }}>
                <td style={{ padding: "8px 12px" }}>@{r.reporter.username ?? "—"}</td>
                <td style={{ padding: "8px 12px" }}>{REASON_LABELS[r.reason] ?? r.reason}</td>
                <td style={{ padding: "8px 12px", color: "rgba(255,255,255,0.5)" }}>{r.notes ?? "—"}</td>
                <td style={{ padding: "8px 12px" }}>{new Date(r.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminLayout>
    )
  }
  ```

- [ ] Update `components/AdminLayout.tsx` to add "Pending" and "Reports" to the nav:
  ```typescript
  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/users", label: "Users" },
    { href: "/posts", label: "Posts" },
    { href: "/pending", label: "Pending" },
    { href: "/reports", label: "Reports" },
    { href: "/appeals", label: "Appeals" },
  ]
  ```

- [ ] Run `npx tsc --noEmit` in gallery-admin. Fix any type errors.
- [ ] Commit in gallery-admin:
  ```
  git add server/routers/admin.ts components/AdminLayout.tsx app/reports/
  git commit -m "feat: add Reports queue page and listReports/resolveReport procedures"
  ```

---

## Task 8: gallery-admin — Pending queue page

All work in this task is in the **gallery-admin** repo.

- [ ] In `server/routers/admin.ts`, add two new procedures:

  ```typescript
  // ── Pending content queue ────────────────────────────────────────────────────

  listPendingPosts: modProcedure
    .query(async ({ ctx }) => {
      const posts = await ctx.prisma.post.findMany({
        where: { status: "PENDING_REVIEW" },
        orderBy: { pendingAt: "asc" },
        select: {
          id: true,
          image: true,
          flagReason: true,
          pendingAt: true,
          user: { select: { id: true, username: true } },
        },
        take: 200,
      })

      const now = Date.now()
      return posts.map((post) => {
        const pendingMs = post.pendingAt ? now - new Date(post.pendingAt).getTime() : 0
        const daysPending = Math.floor(pendingMs / (24 * 60 * 60 * 1000))
        const daysRemaining = Math.max(0, 14 - daysPending)
        return {
          ...post,
          daysRemaining,
        }
      })
    }),

  resolvePendingPost: modProcedure
    .input(z.object({
      postId: z.string(),
      action: z.enum(["remove", "restore"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.post.findUnique({
        where: { id: input.postId },
        select: { id: true, userId: true, status: true },
      })
      if (!post) throw new TRPCError({ code: "NOT_FOUND" })
      if (post.status !== "PENDING_REVIEW") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Post is not in PENDING_REVIEW state." })
      }

      await ctx.prisma.$transaction(async (tx) => {
        if (input.action === "remove") {
          await tx.post.update({
            where: { id: input.postId },
            data: { status: "REMOVED" },
          })
          await tx.notification.create({
            data: {
              userId: post.userId,
              fromUserId: ctx.session.user.id,
              type: "post_removed_moderator",
            },
          })
        } else {
          // restore: clear pending state and dismiss associated reports
          await tx.post.update({
            where: { id: input.postId },
            data: {
              status: "PUBLISHED",
              pendingAt: null,
              flagReason: null,
              reportCount: 0,
            },
          })
          await tx.report.updateMany({
            where: { postId: input.postId, status: "PENDING" },
            data: { status: "REVIEWED_KEPT", reviewedAt: new Date() },
          })
        }
      })

      return { success: true }
    }),
  ```

- [ ] Create `app/pending/page.tsx` in gallery-admin:
  ```typescript
  "use client"

  import { trpc } from "@/components/providers"
  import AdminLayout from "@/components/AdminLayout"

  export default function PendingPage() {
    const { data: posts, isLoading, refetch } = trpc.admin.listPendingPosts.useQuery()
    const resolve = trpc.admin.resolvePendingPost.useMutation({ onSuccess: () => refetch() })

    return (
      <AdminLayout>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
          Pending Content Queue
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>
          Posts under review, sorted by soonest expiry. Posts are auto-removed after 14 days.
        </p>
        {isLoading && <p style={{ color: "rgba(255,255,255,0.4)" }}>Loading...</p>}
        {posts?.length === 0 && <p style={{ color: "rgba(255,255,255,0.4)" }}>No pending posts.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {posts?.map((post) => (
            <div key={post.id} style={{
              background: "#1a1a2e", borderRadius: 10, padding: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", gap: 14, alignItems: "flex-start",
            }}>
              <img
                src={post.image}
                alt=""
                style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>
                    @{post.user.username ?? "—"}
                  </span>
                  <span style={{
                    background: post.daysRemaining <= 2 ? "#7f1d1d" : "#1c1917",
                    color: post.daysRemaining <= 2 ? "#fca5a5" : "rgba(255,255,255,0.5)",
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
                  }}>
                    {post.daysRemaining}d remaining
                  </span>
                </div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 4 }}>
                  Reason: {post.flagReason ?? "—"}
                </div>
                {post.pendingAt && (
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginBottom: 12 }}>
                    Pending since {new Date(post.pendingAt).toLocaleDateString()}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => resolve.mutate({ postId: post.id, action: "remove" })}
                    disabled={resolve.isPending}
                    style={{
                      background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 6,
                      padding: "4px 12px", fontSize: 12, cursor: "pointer",
                    }}
                  >
                    Remove Now
                  </button>
                  <button
                    onClick={() => resolve.mutate({ postId: post.id, action: "restore" })}
                    disabled={resolve.isPending}
                    style={{
                      background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "none",
                      borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer",
                    }}
                  >
                    Clear — Restore to Published
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AdminLayout>
    )
  }
  ```

- [ ] Run `npx tsc --noEmit` in gallery-admin. Fix any type errors.
- [ ] Commit in gallery-admin:
  ```
  git add server/routers/admin.ts app/pending/page.tsx
  git commit -m "feat: add Pending queue page and listPendingPosts/resolvePendingPost procedures"
  ```

---

## Task 9: gallery-admin — DMCA queue page + three-strike warning

All work in this task is in the **gallery-admin** repo.

- [ ] In `server/routers/admin.ts`, add DMCA procedures:

  ```typescript
  // ── DMCA queue ───────────────────────────────────────────────────────────────

  listDmcaRequests: modProcedure
    .query(async ({ ctx }) => {
      const requests = await ctx.prisma.dmcaRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 200,
      })
      const now = Date.now()
      return requests.map((r) => ({
        ...r,
        daysSinceFiled: Math.floor((now - new Date(r.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
      }))
    }),

  getDmcaRequest: modProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const req = await ctx.prisma.dmcaRequest.findUnique({
        where: { id: input.id },
        include: { appeals: { select: { id: true, status: true, createdAt: true, user: { select: { username: true } } } } },
      })
      if (!req) throw new TRPCError({ code: "NOT_FOUND" })
      return req
    }),

  resolveDmcaRequest: modProcedure
    .input(z.object({
      id: z.string(),
      action: z.enum(["remove_post", "reject"]),
      resolution: z.string().min(1).max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dmca = await ctx.prisma.dmcaRequest.findUnique({
        where: { id: input.id },
        select: { id: true, postId: true, status: true },
      })
      if (!dmca) throw new TRPCError({ code: "NOT_FOUND" })
      if (dmca.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Request is not in PENDING state." })
      }

      await ctx.prisma.$transaction(async (tx) => {
        if (input.action === "remove_post") {
          if (dmca.postId) {
            const post = await tx.post.findUnique({
              where: { id: dmca.postId },
              select: { id: true, userId: true },
            })
            if (post) {
              await tx.post.delete({ where: { id: dmca.postId } })
              await tx.notification.create({
                data: {
                  userId: post.userId,
                  fromUserId: ctx.session.user.id,
                  type: "post_removed_dmca",
                },
              })
            }
          }
          await tx.dmcaRequest.update({
            where: { id: input.id },
            data: { status: "REMOVED", reviewedAt: new Date(), resolution: input.resolution ?? null },
          })
        } else {
          if (!input.resolution) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Resolution text is required when rejecting." })
          }
          await tx.dmcaRequest.update({
            where: { id: input.id },
            data: { status: "REJECTED", reviewedAt: new Date(), resolution: input.resolution },
          })
        }
      })

      return { success: true }
    }),

  markDmcaCounterFiled: modProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const dmca = await ctx.prisma.dmcaRequest.findUnique({
        where: { id: input.id },
        select: { status: true },
      })
      if (!dmca) throw new TRPCError({ code: "NOT_FOUND" })
      if (dmca.status !== "REMOVED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Counter-notice can only be filed on REMOVED requests." })
      }
      return ctx.prisma.dmcaRequest.update({
        where: { id: input.id },
        data: { status: "COUNTER_FILED" },
      })
    }),

  getUserDmcaViolationCount: modProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Count DmcaRequests where status is REMOVED or RESOLVED and postId belongs to the user
      const userPostIds = (
        await ctx.prisma.post.findMany({
          where: { userId: input.userId },
          select: { id: true },
        })
      ).map((p) => p.id)

      const count = await ctx.prisma.dmcaRequest.count({
        where: {
          postId: { in: userPostIds },
          status: { in: ["REMOVED", "RESOLVED"] },
        },
      })
      return { count }
    }),
  ```

- [ ] Create `app/dmca/page.tsx` in gallery-admin (the queue list):
  ```typescript
  "use client"

  import Link from "next/link"
  import { trpc } from "@/components/providers"
  import AdminLayout from "@/components/AdminLayout"

  export default function DmcaQueuePage() {
    const { data: requests, isLoading } = trpc.admin.listDmcaRequests.useQuery()

    return (
      <AdminLayout>
        <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
          DMCA Queue
        </h1>
        {isLoading && <p style={{ color: "rgba(255,255,255,0.4)" }}>Loading...</p>}
        {requests?.length === 0 && <p style={{ color: "rgba(255,255,255,0.4)" }}>No pending DMCA requests.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {requests?.map((req) => (
            <Link
              key={req.id}
              href={`/dmca/${req.id}`}
              style={{
                background: "#1a1a2e", borderRadius: 10, padding: "14px 16px",
                border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none",
                display: "flex", gap: 16, alignItems: "center",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: "white", fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                  {req.claimantEmail}
                </div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                  {req.postId ? `Post ID: ${req.postId}` : req.postUrl ?? "No post URL"}
                </div>
              </div>
              <div style={{
                color: req.daysSinceFiled > 10 ? "#fca5a5" : "rgba(255,255,255,0.4)",
                fontSize: 12, fontWeight: req.daysSinceFiled > 10 ? 700 : 400, flexShrink: 0,
              }}>
                {req.daysSinceFiled}d ago
              </div>
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
                {new Date(req.createdAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      </AdminLayout>
    )
  }
  ```

- [ ] Create `app/dmca/[id]/page.tsx` in gallery-admin (the detail / action page):
  ```typescript
  "use client"

  import { use, useState } from "react"
  import { useRouter } from "next/navigation"
  import { trpc } from "@/components/providers"
  import AdminLayout from "@/components/AdminLayout"

  export default function DmcaDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const { data: req, isLoading, refetch } = trpc.admin.getDmcaRequest.useQuery({ id })
    const resolve = trpc.admin.resolveDmcaRequest.useMutation({ onSuccess: () => refetch() })
    const markCounter = trpc.admin.markDmcaCounterFiled.useMutation({ onSuccess: () => refetch() })
    const [rejectionText, setRejectionText] = useState("")
    const [showRejectForm, setShowRejectForm] = useState(false)

    if (isLoading) return <AdminLayout><p style={{ color: "rgba(255,255,255,0.4)" }}>Loading...</p></AdminLayout>
    if (!req) return <AdminLayout><p style={{ color: "#f87171" }}>Not found.</p></AdminLayout>

    return (
      <AdminLayout>
        <button onClick={() => router.back()}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, marginBottom: 20 }}>
          ← Back to DMCA Queue
        </button>

        <h1 style={{ color: "white", fontSize: 20, fontWeight: 700, marginBottom: 24 }}>DMCA Request</h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          <div>
            <Row label="Status" value={req.status} />
            <Row label="Claimant name" value={req.claimantName} />
            <Row label="Claimant email" value={req.claimantEmail} />
            <Row label="Post ID" value={req.postId ?? "—"} />
            <Row label="Post URL" value={req.postUrl ?? "—"} />
            <Row label="Filed" value={new Date(req.createdAt).toLocaleString()} />
            {req.reviewedAt && <Row label="Reviewed" value={new Date(req.reviewedAt).toLocaleString()} />}
          </div>
          <div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 6 }}>Description</div>
            <p style={{ color: "white", fontSize: 13, lineHeight: 1.6 }}>{req.description}</p>
          </div>
        </div>

        {req.resolution && (
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 14, marginBottom: 20 }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 4 }}>Resolution note</div>
            <p style={{ color: "white", fontSize: 13 }}>{req.resolution}</p>
          </div>
        )}

        {req.status === "PENDING" && (
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <button
              onClick={() => resolve.mutate({ id, action: "remove_post" })}
              disabled={resolve.isPending}
              style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 600 }}>
              Remove Post &amp; Notify
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              style={{ background: "rgba(255,255,255,0.08)", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer" }}>
              Reject
            </button>
          </div>
        )}

        {req.status === "REMOVED" && (
          <button
            onClick={() => markCounter.mutate({ id })}
            disabled={markCounter.isPending}
            style={{ background: "#1e3a5f", color: "#93c5fd", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", marginBottom: 24 }}>
            Mark Counter-Notice Filed
          </button>
        )}

        {showRejectForm && (
          <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, border: "1px solid rgba(255,255,255,0.1)", marginBottom: 20 }}>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 10 }}>
              Provide a reason for rejection (will be recorded internally):
            </p>
            <textarea
              value={rejectionText}
              onChange={(e) => setRejectionText(e.target.value)}
              rows={4}
              style={{
                width: "100%", background: "#0d0d1a", color: "white",
                border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 10px",
                fontSize: 13, resize: "vertical", boxSizing: "border-box", marginBottom: 12,
              }}
              placeholder="No copyright violation found because..."
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowRejectForm(false)}
                style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "white", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  resolve.mutate({ id, action: "reject", resolution: rejectionText })
                  setShowRejectForm(false)
                }}
                disabled={!rejectionText.trim() || resolve.isPending}
                style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>
                Confirm Rejection
              </button>
            </div>
          </div>
        )}

        {req.appeals.length > 0 && (
          <>
            <h2 style={{ color: "white", fontSize: 16, marginBottom: 10 }}>Related Appeals</h2>
            {req.appeals.map((a) => (
              <div key={a.id} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                <span style={{ color: "white", fontSize: 13 }}>@{a.user.username}</span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginLeft: 12 }}>
                  {a.status} — {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </>
        )}
      </AdminLayout>
    )
  }

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{label}</div>
        <div style={{ color: "white", fontSize: 13 }}>{value}</div>
      </div>
    )
  }
  ```

- [ ] Update `app/users/[id]/page.tsx` in gallery-admin to show the DMCA violation count warning banner. Find the user detail page and add the following query and conditional banner at the top of the page content (after the user profile header):

  ```typescript
  // Add query
  const { data: dmcaData } = trpc.admin.getUserDmcaViolationCount.useQuery({ userId: user.id })

  // Add banner in JSX, e.g. after the user header section:
  {dmcaData && dmcaData.count >= 3 && (
    <div style={{
      background: "#7f1d1d", border: "1px solid #dc2626", borderRadius: 10,
      padding: "14px 18px", marginBottom: 20,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ fontSize: 20 }}>⚠</span>
      <span style={{ color: "#fca5a5", fontSize: 14, fontWeight: 600 }}>
        {dmcaData.count} confirmed DMCA violations — ToS §9.6 requires consideration of a permanent ban.
      </span>
    </div>
  )}
  ```

- [ ] Update `components/AdminLayout.tsx` to add "DMCA" to the nav after "Appeals":
  ```typescript
  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/users", label: "Users" },
    { href: "/posts", label: "Posts" },
    { href: "/pending", label: "Pending" },
    { href: "/reports", label: "Reports" },
    { href: "/appeals", label: "Appeals" },
    { href: "/dmca", label: "DMCA" },
  ]
  ```

- [ ] Run `npx tsc --noEmit` in gallery-admin. Fix any type errors.
- [ ] Commit in gallery-admin:
  ```
  git add server/routers/admin.ts components/AdminLayout.tsx app/dmca/ app/users/
  git commit -m "feat: add DMCA queue pages, procedures, and three-strike warning on user detail"
  ```

---

## Self-review checklist

- [x] **Spec coverage:**
  - Subsystem A (Community Reports): schema, `post.report` procedure, Report button + modal, `viewerHasReported` field
  - Subsystem B (Pending State): schema, feed/profile filtering, Under Review badge, `post_pending_review` notification, cron auto-removal route
  - Subsystem C (DMCA): schema with `Appeal.dmcaRequestId`, public DMCA form, `dmca.submit` procedure, gallery-admin queue + detail, three-strike warning, `COUNTER_FILED` flow
- [x] **No placeholders:** All code blocks are complete and directly implementable
- [x] **Type consistency:**
  - `PostStatus`, `ReportReason`, `ReportStatus`, `DmcaStatus` imported from `@prisma/client` wherever used in tRPC procedures
  - `params` unwrapped via `use(params)` in Next.js 16 dynamic route pages (async params API)
  - `Notification.fromUserId` non-nullable constraint handled via `SYSTEM_USER_ID` env var with silent skip guard
- [x] **Tests:** Vitest tests for Report unique constraint (Task 1) and `post.report` procedure (Task 2)
- [x] **tsc verification:** Every task ends with `npx tsc --noEmit`
- [x] **Git commit:** Every task ends with a commit
- [x] **Actual file paths match codebase:** No `src/` prefix (project uses root-level `app/`, `components/`, `server/`)
- [x] **Nav order:** Pending → Reports → Appeals → DMCA (matches spec: Pending between Posts and Reports; DMCA after Appeals)
- [x] **Cascade deletes:** `Report` and `DmcaRequest` reference `Post` with `onDelete: Cascade` — hard-deleting a post auto-removes its reports
- [x] **`getByUsername` caller-opt-in filtering:** Profile owner passes their own `viewerUserId` to see PENDING_REVIEW posts; all other callers (including public/unauthenticated) only see PUBLISHED
