# Strikes, Bans & Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a role-based moderation system — Strike/Appeal/Ban data models, tRPC admin procedures, soft-ban enforcement, user-facing appeal page, and an `/admin` panel for moderators to issue strikes, manage bans, and review appeals.

**Architecture:** Strikes and bans are stored in new Prisma models. Two new tRPC middleware tiers (`modProcedure`, `adminProcedure`) protect a new `admin` router. Ban status flows through the NextAuth JWT so the frontend can show a ban banner without an extra DB call. All bans are manually issued by moderators — no auto-ban logic.

**Tech Stack:** TypeScript, Next.js App Router, tRPC v11, Prisma, PostgreSQL, NextAuth JWT sessions, Vitest

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `prisma/migrations/20260524000000_strikes_admin/migration.sql` | DB schema changes |
| Modify | `prisma/schema.prisma` | User fields, Strike/Appeal models, enums |
| Create | `server/lib/strikes.ts` | `SELLING_VIOLATIONS` set + `isSellingViolation()` |
| Modify | `lib/trpc.ts` | Add `modProcedure` + `adminProcedure` |
| Create | `server/routers/admin.ts` | All admin + user-facing moderation procedures |
| Modify | `server/routers/_app.ts` | Register admin router |
| Modify | `lib/auth.ts` | Add `bannedUntil` to JWT + session callbacks |
| Modify | `types/next-auth.d.ts` | Extend session/JWT types |
| Create | `server/lib/ban.ts` | `checkNotBanned()` utility |
| Modify | `server/routers/post.ts` | Call `checkNotBanned` in create/delete |
| Modify | `server/routers/commission.ts` | Call `checkNotBanned` in submit/accept/cancel; update `getTrustScore` |
| Modify | `server/routers/dm.ts` | Call `checkNotBanned` in send |
| Modify | `server/routers/shop.ts` | Call `checkNotBanned` in create/delete |
| Create | `components/BanBanner.tsx` | Sticky banner shown to banned users |
| Modify | `app/layout.tsx` | Render `<BanBanner />` |
| Create | `app/appeal/page.tsx` | User-facing appeal submission page |
| Create | `app/(admin)/admin/layout.tsx` | Admin layout — auth check + nav |
| Create | `app/(admin)/admin/page.tsx` | Dashboard — counts + recent activity |
| Create | `app/(admin)/admin/users/page.tsx` | User list with search |
| Create | `app/(admin)/admin/users/[id]/page.tsx` | User detail — strikes, bans, issue actions |
| Create | `app/(admin)/admin/appeals/page.tsx` | Appeal queue (PENDING only) |
| Create | `app/(admin)/admin/appeals/[id]/page.tsx` | Appeal detail — approve/deny |
| Modify | `docs/roadmap.md` | Mark strikes + admin items complete |
| Modify | `C:\Users\gavri\OneDrive\Documents\art socail\Gallery\Product\Roadmap.md` | Sync Obsidian |
| Create | `tests/server/admin.test.ts` | Unit tests for admin procedures |
| Create | `tests/server/ban.test.ts` | Unit tests for `checkNotBanned` |

---

## Task 1: Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260524000000_strikes_admin/migration.sql`

- [ ] **Step 1: Update `prisma/schema.prisma`**

Add these fields to the `User` model (after `commissionFeatureDisabled`):

```prisma
  isAdmin        Boolean   @default(false)
  isModerator    Boolean   @default(false)
  bannedUntil    DateTime?
  banReason      String?

  receivedStrikes  Strike[]  @relation("ReceivedStrikes")
  issuedStrikes    Strike[]  @relation("IssuedStrikes")
  submittedAppeals Appeal[]  @relation("SubmittedAppeals")
  reviewedAppeals  Appeal[]  @relation("ReviewedAppeals")
```

Add the new enums and models after the existing `CommissionRequestStatus` enum:

```prisma
enum StrikeLevel {
  MINOR
  MODERATE
  SEVERE
  ZERO_TOLERANCE
}

enum StrikeViolation {
  ARTIST_CANCEL
  FAKE_DELIVERY
  FALSE_ADVERTISING
  BAIT_AND_SWITCH
  OFF_PLATFORM_PAYMENT
  COMMISSION_FARMING
  SHOP_FALSE_ADVERTISING
  UNLABELLED_AI
  GORE
  HARASSMENT
  HATE_SPEECH
  SPAM
  DMCA_VIOLATION
  FTC_DISCLOSURE
  NCMEC_VIOLATION
  CHARGEBACK_FRAUD
  ZERO_TOLERANCE_CONDUCT
}

enum AppealStatus {
  PENDING
  APPROVED
  DENIED
}

model Strike {
  id          String          @id @default(cuid())
  userId      String
  user        User            @relation("ReceivedStrikes", fields: [userId], references: [id], onDelete: Cascade)
  issuedById  String
  issuedBy    User            @relation("IssuedStrikes", fields: [issuedById], references: [id])
  level       StrikeLevel
  violation   StrikeViolation
  isSelling   Boolean         @default(false)
  contentId   String?
  contentType String?
  notes       String?         @db.Text
  reversed    Boolean         @default(false)
  createdAt   DateTime        @default(now())

  appeals     Appeal[]

  @@index([userId])
  @@index([issuedById])
}

model Appeal {
  id           String       @id @default(cuid())
  userId       String
  user         User         @relation("SubmittedAppeals", fields: [userId], references: [id], onDelete: Cascade)
  strikeId     String?
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
```

- [ ] **Step 2: Create the migration SQL**

Create file `prisma/migrations/20260524000000_strikes_admin/migration.sql`:

```sql
-- User: admin/moderator/ban fields
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "isModerator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "bannedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "banReason" TEXT;

-- New enums
CREATE TYPE "StrikeLevel" AS ENUM ('MINOR', 'MODERATE', 'SEVERE', 'ZERO_TOLERANCE');
CREATE TYPE "StrikeViolation" AS ENUM (
  'ARTIST_CANCEL', 'FAKE_DELIVERY', 'FALSE_ADVERTISING', 'BAIT_AND_SWITCH',
  'OFF_PLATFORM_PAYMENT', 'COMMISSION_FARMING', 'SHOP_FALSE_ADVERTISING',
  'UNLABELLED_AI', 'GORE', 'HARASSMENT', 'HATE_SPEECH', 'SPAM',
  'DMCA_VIOLATION', 'FTC_DISCLOSURE', 'NCMEC_VIOLATION',
  'CHARGEBACK_FRAUD', 'ZERO_TOLERANCE_CONDUCT'
);
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- Strike table
CREATE TABLE "Strike" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "issuedById" TEXT NOT NULL,
  "level" "StrikeLevel" NOT NULL,
  "violation" "StrikeViolation" NOT NULL,
  "isSelling" BOOLEAN NOT NULL DEFAULT false,
  "contentId" TEXT,
  "contentType" TEXT,
  "notes" TEXT,
  "reversed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Strike_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Strike" ADD CONSTRAINT "Strike_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Strike" ADD CONSTRAINT "Strike_issuedById_fkey"
  FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Strike_userId_idx" ON "Strike"("userId");
CREATE INDEX "Strike_issuedById_idx" ON "Strike"("issuedById");

-- Appeal table
CREATE TABLE "Appeal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "strikeId" TEXT,
  "text" TEXT NOT NULL,
  "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_strikeId_fkey"
  FOREIGN KEY ("strikeId") REFERENCES "Strike"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Appeal_userId_idx" ON "Appeal"("userId");
CREATE INDEX "Appeal_status_idx" ON "Appeal"("status");
```

- [ ] **Step 3: Validate schema parses**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 4: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: Run tests — confirm no regressions**

```bash
npx vitest run
```

Expected: all existing tests pass

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260524000000_strikes_admin/migration.sql
git commit -m "feat: add Strike, Appeal models and admin/ban fields to User"
```

---

## Task 2: Strike Utility + tRPC Middleware

**Files:**
- Create: `server/lib/strikes.ts`
- Modify: `lib/trpc.ts`
- Create: `tests/server/strikes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/server/strikes.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { isSellingViolation, SELLING_VIOLATIONS } from "@/server/lib/strikes"

describe("isSellingViolation", () => {
  it("returns true for all selling violations", () => {
    const selling = [
      "ARTIST_CANCEL", "FAKE_DELIVERY", "FALSE_ADVERTISING",
      "BAIT_AND_SWITCH", "OFF_PLATFORM_PAYMENT", "COMMISSION_FARMING",
      "SHOP_FALSE_ADVERTISING",
    ]
    selling.forEach(v => expect(isSellingViolation(v as any)).toBe(true))
  })

  it("returns false for non-selling violations", () => {
    const nonSelling = [
      "UNLABELLED_AI", "GORE", "HARASSMENT", "HATE_SPEECH", "SPAM",
      "DMCA_VIOLATION", "FTC_DISCLOSURE", "NCMEC_VIOLATION",
      "CHARGEBACK_FRAUD", "ZERO_TOLERANCE_CONDUCT",
    ]
    nonSelling.forEach(v => expect(isSellingViolation(v as any)).toBe(false))
  })

  it("SELLING_VIOLATIONS set has 7 entries", () => {
    expect(SELLING_VIOLATIONS.size).toBe(7)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run tests/server/strikes.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `server/lib/strikes.ts`**

```typescript
import type { StrikeViolation } from "@prisma/client"

export const SELLING_VIOLATIONS = new Set<StrikeViolation>([
  "ARTIST_CANCEL",
  "FAKE_DELIVERY",
  "FALSE_ADVERTISING",
  "BAIT_AND_SWITCH",
  "OFF_PLATFORM_PAYMENT",
  "COMMISSION_FARMING",
  "SHOP_FALSE_ADVERTISING",
])

export function isSellingViolation(violation: StrikeViolation): boolean {
  return SELLING_VIOLATIONS.has(violation)
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run tests/server/strikes.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 5: Add `modProcedure` and `adminProcedure` to `lib/trpc.ts`**

Current file ends at line 23. Add after `protectedProcedure`:

```typescript
export const modProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { isAdmin: true, isModerator: true },
  })
  if (!user?.isAdmin && !user?.isModerator) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
  return next()
})

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
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

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add server/lib/strikes.ts tests/server/strikes.test.ts lib/trpc.ts
git commit -m "feat: add strike utility and mod/admin tRPC middleware"
```

---

## Task 3: Admin Router — User Management + Strikes + Bans

**Files:**
- Create: `server/routers/admin.ts`
- Modify: `server/routers/_app.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/server/admin.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { createCallerFactory } from "@/lib/trpc"
import { appRouter } from "@/server/routers/_app"

const createCaller = createCallerFactory(appRouter)

const mockMod = { id: "mod-1", isAdmin: false, isModerator: true }
const mockAdmin = { id: "admin-1", isAdmin: true, isModerator: false }
const mockUser = { id: "user-1", isAdmin: false, isModerator: false }

const mockPrisma = {
  user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  strike: { create: vi.fn(), findMany: vi.fn() },
  appeal: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  notification: { create: vi.fn() },
}

function modSession() {
  return {
    user: { id: "mod-1", username: "mod", sellingEnabled: false, onboardingComplete: true },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

function adminSession() {
  return {
    user: { id: "admin-1", username: "admin", sellingEnabled: false, onboardingComplete: true },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

function userSession() {
  return {
    user: { id: "user-1", username: "user", sellingEnabled: false, onboardingComplete: true },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

function getCaller(session: any) {
  return createCaller({ session, prisma: mockPrisma as any })
}

beforeEach(() => vi.clearAllMocks())

describe("admin.issueStrike", () => {
  it("throws FORBIDDEN for non-moderators", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser)
    const caller = getCaller(userSession())
    await expect(
      caller.admin.issueStrike({ userId: "target-1", level: "MINOR", violation: "SPAM" })
    ).rejects.toThrow("FORBIDDEN")
  })

  it("allows moderators to issue strikes", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockMod)
    mockPrisma.strike.create.mockResolvedValue({ id: "strike-1" })
    mockPrisma.notification.create.mockResolvedValue({})
    const caller = getCaller(modSession())
    const result = await caller.admin.issueStrike({
      userId: "target-1",
      level: "MINOR",
      violation: "SPAM",
    })
    expect(result.id).toBe("strike-1")
    expect(mockPrisma.strike.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "target-1",
          issuedById: "mod-1",
          level: "MINOR",
          violation: "SPAM",
          isSelling: false,
        }),
      })
    )
  })

  it("sets isSelling true for selling violations", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockMod)
    mockPrisma.strike.create.mockResolvedValue({ id: "strike-2" })
    mockPrisma.notification.create.mockResolvedValue({})
    const caller = getCaller(modSession())
    await caller.admin.issueStrike({
      userId: "target-1",
      level: "MODERATE",
      violation: "FAKE_DELIVERY",
    })
    expect(mockPrisma.strike.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isSelling: true }),
      })
    )
  })
})

describe("admin.setModerator", () => {
  it("throws FORBIDDEN for moderators (admin-only)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockMod)
    const caller = getCaller(modSession())
    await expect(
      caller.admin.setModerator({ userId: "user-1", isModerator: true })
    ).rejects.toThrow("FORBIDDEN")
  })

  it("allows admin to set moderator", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockAdmin)
    mockPrisma.user.update.mockResolvedValue({ id: "user-1", isModerator: true })
    const caller = getCaller(adminSession())
    const result = await caller.admin.setModerator({ userId: "user-1", isModerator: true })
    expect(result.isModerator).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL (router not found)**

```bash
npx vitest run tests/server/admin.test.ts
```

Expected: FAIL — `admin` router not found on appRouter

- [ ] **Step 3: Create `server/routers/admin.ts`**

```typescript
import { z } from "zod"
import { router, modProcedure, adminProcedure, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { isSellingViolation } from "@/server/lib/strikes"

export const adminRouter = router({

  // ── User management ─────────────────────────────────────────────────────────

  listUsers: modProcedure
    .input(z.object({ query: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findMany({
        where: input.query ? {
          OR: [
            { username: { contains: input.query, mode: "insensitive" } },
            { email: { contains: input.query, mode: "insensitive" } },
          ],
        } : undefined,
        select: {
          id: true, username: true, email: true,
          isAdmin: true, isModerator: true,
          bannedUntil: true, createdAt: true,
          _count: { select: { receivedStrikes: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    }),

  getUser: modProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true, username: true, email: true,
          isAdmin: true, isModerator: true,
          bannedUntil: true, banReason: true, createdAt: true,
          receivedStrikes: {
            orderBy: { createdAt: "desc" },
            include: { issuedBy: { select: { username: true } } },
          },
        },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      return user
    }),

  setModerator: adminProcedure
    .input(z.object({ userId: z.string(), isModerator: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { isModerator: input.isModerator },
        select: { id: true, username: true, isModerator: true },
      })
    }),

  // ── Strikes ─────────────────────────────────────────────────────────────────

  issueStrike: modProcedure
    .input(z.object({
      userId: z.string(),
      level: z.enum(["MINOR", "MODERATE", "SEVERE", "ZERO_TOLERANCE"]),
      violation: z.enum([
        "ARTIST_CANCEL", "FAKE_DELIVERY", "FALSE_ADVERTISING", "BAIT_AND_SWITCH",
        "OFF_PLATFORM_PAYMENT", "COMMISSION_FARMING", "SHOP_FALSE_ADVERTISING",
        "UNLABELLED_AI", "GORE", "HARASSMENT", "HATE_SPEECH", "SPAM",
        "DMCA_VIOLATION", "FTC_DISCLOSURE", "NCMEC_VIOLATION",
        "CHARGEBACK_FRAUD", "ZERO_TOLERANCE_CONDUCT",
      ]),
      contentId: z.string().optional(),
      contentType: z.enum(["post", "commission", "shop_item"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const strike = await ctx.prisma.strike.create({
        data: {
          userId: input.userId,
          issuedById: ctx.session.user.id,
          level: input.level,
          violation: input.violation,
          isSelling: isSellingViolation(input.violation),
          contentId: input.contentId,
          contentType: input.contentType,
          notes: input.notes,
        },
      })
      await ctx.prisma.notification.create({
        data: {
          userId: input.userId,
          fromUserId: ctx.session.user.id,
          type: "strike",
        },
      })
      return strike
    }),

  // ── Bans ────────────────────────────────────────────────────────────────────

  issueBan: modProcedure
    .input(z.object({
      userId: z.string(),
      duration: z.enum(["3d", "14d", "30d", "permanent"]),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const DURATIONS: Record<string, Date> = {
        "3d": new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        "14d": new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        "30d": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        "permanent": new Date("9999-12-31"),
      }
      const user = await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { bannedUntil: DURATIONS[input.duration], banReason: input.reason },
        select: { id: true, bannedUntil: true },
      })
      await ctx.prisma.notification.create({
        data: {
          userId: input.userId,
          fromUserId: ctx.session.user.id,
          type: "ban",
        },
      })
      return user
    }),

  liftBan: modProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { bannedUntil: null, banReason: null },
        select: { id: true, bannedUntil: true },
      })
    }),

  // ── Appeals (mod side) ───────────────────────────────────────────────────────

  listAppeals: modProcedure
    .input(z.object({ status: z.enum(["PENDING", "APPROVED", "DENIED"]).default("PENDING") }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.appeal.findMany({
        where: { status: input.status },
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, username: true } },
          strike: { select: { level: true, violation: true, createdAt: true } },
        },
      })
    }),

  getAppeal: modProcedure
    .input(z.object({ appealId: z.string() }))
    .query(async ({ ctx, input }) => {
      const appeal = await ctx.prisma.appeal.findUnique({
        where: { id: input.appealId },
        include: {
          user: {
            select: {
              id: true, username: true, bannedUntil: true, banReason: true,
              receivedStrikes: { orderBy: { createdAt: "desc" } },
            },
          },
          strike: true,
        },
      })
      if (!appeal) throw new TRPCError({ code: "NOT_FOUND" })
      return appeal
    }),

  approveAppeal: modProcedure
    .input(z.object({ appealId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const appeal = await ctx.prisma.appeal.findUnique({
        where: { id: input.appealId },
        include: { user: true },
      })
      if (!appeal) throw new TRPCError({ code: "NOT_FOUND" })
      if (appeal.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Appeal already reviewed" })

      await ctx.prisma.$transaction(async tx => {
        // Mark appeal approved
        await tx.appeal.update({
          where: { id: input.appealId },
          data: { status: "APPROVED", reviewedById: ctx.session.user.id, reviewedAt: new Date() },
        })
        // Reverse the strike (if referenced)
        if (appeal.strikeId) {
          await tx.strike.update({
            where: { id: appeal.strikeId },
            data: { reversed: true },
          })
        }
        // Lift the ban
        await tx.user.update({
          where: { id: appeal.userId },
          data: { bannedUntil: null, banReason: null },
        })
        // Notify user
        await tx.notification.create({
          data: {
            userId: appeal.userId,
            fromUserId: ctx.session.user.id,
            type: "appeal_approved",
          },
        })
      })
      return { success: true }
    }),

  denyAppeal: modProcedure
    .input(z.object({ appealId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const appeal = await ctx.prisma.appeal.findUnique({
        where: { id: input.appealId },
        select: { id: true, userId: true, status: true },
      })
      if (!appeal) throw new TRPCError({ code: "NOT_FOUND" })
      if (appeal.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Appeal already reviewed" })

      await ctx.prisma.appeal.update({
        where: { id: input.appealId },
        data: { status: "DENIED", reviewedById: ctx.session.user.id, reviewedAt: new Date() },
      })
      await ctx.prisma.notification.create({
        data: {
          userId: appeal.userId,
          fromUserId: ctx.session.user.id,
          type: "appeal_denied",
        },
      })
      return { success: true }
    }),

  // ── User-facing moderation ───────────────────────────────────────────────────

  getMyStrikes: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.strike.findMany({
      where: { userId: ctx.session.user.id, reversed: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, level: true, violation: true, createdAt: true },
    })
  }),

  submitAppeal: protectedProcedure
    .input(z.object({
      text: z.string().min(20).max(2000),
      strikeId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.appeal.findFirst({
        where: { userId: ctx.session.user.id, status: "PENDING" },
      })
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a pending appeal" })

      return ctx.prisma.appeal.create({
        data: {
          userId: ctx.session.user.id,
          text: input.text,
          strikeId: input.strikeId,
        },
      })
    }),

  getMyAppeals: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.appeal.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, text: true, createdAt: true, reviewedAt: true },
    })
  }),
})
```

- [ ] **Step 4: Register admin router in `server/routers/_app.ts`**

Add import at top:
```typescript
import { adminRouter } from "./admin"
```

Add to the router object:
```typescript
  admin: adminRouter,
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx vitest run tests/server/admin.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add server/routers/admin.ts server/routers/_app.ts tests/server/admin.test.ts
git commit -m "feat: add admin router with strike, ban, appeal, and user management procedures"
```

---

## Task 4: Auth Session Update

**Files:**
- Modify: `lib/auth.ts`
- Modify: `types/next-auth.d.ts`
- Create: `tests/server/ban.test.ts`
- Create: `server/lib/ban.ts`

- [ ] **Step 1: Write failing ban test**

Create `tests/server/ban.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { checkNotBanned } from "@/server/lib/ban"
import { TRPCError } from "@trpc/server"

const mockPrisma = {
  user: { findUnique: vi.fn() },
}

describe("checkNotBanned", () => {
  it("does nothing when user is not banned (null bannedUntil)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ bannedUntil: null })
    await expect(checkNotBanned(mockPrisma as any, "user-1")).resolves.toBeUndefined()
  })

  it("does nothing when ban has expired", async () => {
    const pastDate = new Date(Date.now() - 1000)
    mockPrisma.user.findUnique.mockResolvedValue({ bannedUntil: pastDate })
    await expect(checkNotBanned(mockPrisma as any, "user-1")).resolves.toBeUndefined()
  })

  it("throws FORBIDDEN when ban is active", async () => {
    const futureDate = new Date(Date.now() + 86400000)
    mockPrisma.user.findUnique.mockResolvedValue({ bannedUntil: futureDate })
    await expect(checkNotBanned(mockPrisma as any, "user-1")).rejects.toThrow("FORBIDDEN")
  })

  it("throws FORBIDDEN for permanent ban (year 9999)", async () => {
    const permanentDate = new Date("9999-12-31")
    mockPrisma.user.findUnique.mockResolvedValue({ bannedUntil: permanentDate })
    await expect(checkNotBanned(mockPrisma as any, "user-1")).rejects.toThrow("FORBIDDEN")
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run tests/server/ban.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `server/lib/ban.ts`**

```typescript
import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "@prisma/client"

export async function checkNotBanned(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
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

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run tests/server/ban.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Update `types/next-auth.d.ts`**

Replace entire file:

```typescript
import { type DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string | null
      sellingEnabled: boolean
      onboardingComplete: boolean
      bannedUntil: string | null  // ISO string or null
    } & DefaultSession["user"]
  }

  interface User {
    username: string | null
    sellingEnabled: boolean
    onboardingComplete: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username: string | null
    sellingEnabled: boolean
    onboardingComplete: boolean
    bannedUntil: string | null  // ISO string or null
  }
}
```

- [ ] **Step 6: Update `lib/auth.ts` JWT + session callbacks**

In the `jwt` callback, in the `if (trigger === "update" && token.id)` block, add after the existing fields:

```typescript
        token.bannedUntil = fresh.bannedUntil?.toISOString() ?? null
```

In the `if (user)` block, add:

```typescript
        token.bannedUntil = null  // freshly signed-in users aren't banned yet
```

In the `session` callback, add:

```typescript
        session.user.bannedUntil = (token.bannedUntil as string | null) ?? null
```

The full updated callbacks section of `lib/auth.ts`:

```typescript
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({ where: { id: token.id as string } })
        if (fresh) {
          token.username = fresh.username
          token.sellingEnabled = fresh.sellingEnabled
          token.onboardingComplete = fresh.onboardingComplete
          token.bannedUntil = fresh.bannedUntil?.toISOString() ?? null
        }
      }
      if (user) {
        token.id = user.id
        token.username = (user as any).username ?? null
        token.sellingEnabled = (user as any).sellingEnabled ?? false
        token.onboardingComplete = (user as any).onboardingComplete ?? false
        token.bannedUntil = null
      }
      delete token.name
      delete token.email
      delete token.picture
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string | null
        session.user.sellingEnabled = token.sellingEnabled as boolean
        session.user.onboardingComplete = token.onboardingComplete as boolean
        session.user.bannedUntil = (token.bannedUntil as string | null) ?? null
      }
      return session
    },
  },
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add server/lib/ban.ts tests/server/ban.test.ts types/next-auth.d.ts lib/auth.ts
git commit -m "feat: add checkNotBanned utility and bannedUntil to session"
```

---

## Task 5: Enforce Ban in Existing Procedures

**Files:**
- Modify: `server/routers/post.ts`
- Modify: `server/routers/commission.ts`
- Modify: `server/routers/dm.ts`
- Modify: `server/routers/shop.ts`

For each file, add this import at the top:

```typescript
import { checkNotBanned } from "@/server/lib/ban"
```

Then add `await checkNotBanned(ctx.prisma, ctx.session.user.id)` as the **first line** of the mutation handler body in these procedures:

**`server/routers/post.ts`:** `create` mutation, `delete` mutation, `comment` (if it exists as a mutation in this router)

**`server/routers/commission.ts`:** `submitRequest` mutation, `accept` mutation, `cancel` mutation, `dispute` mutation, `rate` mutation (if exists)

**`server/routers/dm.ts`:** `send` mutation

**`server/routers/shop.ts`:** `create` mutation, `delete` mutation

- [ ] **Step 1: Add to `server/routers/post.ts`**

Find the `create` mutation handler. It begins something like:
```typescript
  create: protectedProcedure
    .input(...)
    .mutation(async ({ ctx, input }) => {
```

Add `await checkNotBanned(ctx.prisma, ctx.session.user.id)` as the first line of the async body. Repeat for any `delete` mutation in the same file.

Also add the import at the top: `import { checkNotBanned } from "@/server/lib/ban"`

- [ ] **Step 2: Add to `server/routers/dm.ts`**

Find the `send` mutation (around line 79). Add import and `await checkNotBanned(ctx.prisma, ctx.session.user.id)` as first line of mutation body.

- [ ] **Step 3: Add to `server/routers/shop.ts`**

Find the `create` and `delete` mutations. Add import and `checkNotBanned` call to each.

- [ ] **Step 4: Add to `server/routers/commission.ts`**

Find `submitRequest`, `accept`, `cancel`, `dispute` mutations. Add import and `checkNotBanned` call to each.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/routers/post.ts server/routers/commission.ts server/routers/dm.ts server/routers/shop.ts
git commit -m "feat: enforce ban check in post, commission, dm, shop mutations"
```

---

## Task 6: BanBanner Component + Root Layout

**Files:**
- Create: `components/BanBanner.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create `components/BanBanner.tsx`**

```tsx
"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"

export default function BanBanner() {
  const { data: session } = useSession()
  if (!session?.user?.bannedUntil) return null

  const bannedUntil = new Date(session.user.bannedUntil)
  const isPermanent = bannedUntil.getFullYear() >= 9999
  const isActive = bannedUntil > new Date()
  if (!isActive) return null

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: "#7f1d1d", borderBottom: "1px solid #991b1b",
      padding: "10px 16px", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 8,
    }}>
      <span style={{ color: "white", fontSize: 13, fontWeight: 500 }}>
        {isPermanent
          ? "Your account has been permanently suspended."
          : `Your account is suspended until ${bannedUntil.toLocaleDateString()}.`}
      </span>
      <Link
        href="/appeal"
        style={{
          color: "white", fontSize: 13, fontWeight: 700,
          textDecoration: "underline", whiteSpace: "nowrap",
        }}
      >
        Appeal
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Update `app/layout.tsx`**

Add the import after existing imports:

```typescript
import BanBanner from "@/components/BanBanner"
```

Add `<BanBanner />` as the first child inside `<Providers>`, before `<PushInit />`:

```tsx
        <Providers>
          <BanBanner />
          <PushInit />
          {/* Navbar: visible on mobile only */}
          <div className="md:hidden">
            <Navbar />
          </div>
          <div className="pb-20 md:pb-0 md:pl-16 min-h-screen">
            {children}
          </div>
          <BottomNav />
        </Providers>
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add components/BanBanner.tsx app/layout.tsx
git commit -m "feat: add BanBanner component shown to suspended users"
```

---

## Task 7: Appeal Page (User Side)

**Files:**
- Create: `app/appeal/page.tsx`

- [ ] **Step 1: Create `app/appeal/page.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

export default function AppealPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [text, setText] = useState("")
  const [selectedStrikeId, setSelectedStrikeId] = useState<string | undefined>()

  const { data: strikes } = trpc.admin.getMyStrikes.useQuery(undefined, { enabled: !!session })
  const { data: appeals } = trpc.admin.getMyAppeals.useQuery(undefined, { enabled: !!session })

  const submitAppeal = trpc.admin.submitAppeal.useMutation({
    onSuccess: () => {
      setText("")
      setSelectedStrikeId(undefined)
    },
  })

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Please sign in to submit an appeal.</p>
      </div>
    )
  }

  const pendingAppeal = appeals?.find(a => a.status === "PENDING")

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Appeal</h1>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 24 }}>
        If you believe a moderation action was incorrect, submit an appeal below.
      </p>

      {/* Strike history */}
      {strikes && strikes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Your strikes</p>
          {strikes.map(s => (
            <div
              key={s.id}
              onClick={() => setSelectedStrikeId(prev => prev === s.id ? undefined : s.id)}
              style={{
                padding: "10px 12px", borderRadius: 10, marginBottom: 6, cursor: "pointer",
                background: selectedStrikeId === s.id ? "rgba(176,68,248,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${selectedStrikeId === s.id ? "rgba(176,68,248,0.4)" : "rgba(255,255,255,0.08)"}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <span style={{ color: "white", fontSize: 13, fontWeight: 600 }}>{s.level}</span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginLeft: 8 }}>{s.violation.replace(/_/g, " ")}</span>
              </div>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                {new Date(s.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {selectedStrikeId && (
            <p style={{ color: "rgba(176,68,248,0.8)", fontSize: 12, marginTop: 4 }}>Strike selected — your appeal will reference this strike.</p>
          )}
        </div>
      )}

      {/* Appeal form or pending state */}
      {pendingAppeal ? (
        <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>Your appeal is under review. You'll be notified of the decision.</p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 6 }}>
            Submitted {new Date(pendingAppeal.createdAt).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Explain why you believe this action was incorrect… (minimum 20 characters)"
            minLength={20}
            maxLength={2000}
            rows={5}
            style={{
              width: "100%", borderRadius: 12, padding: "12px 14px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
              color: "white", fontSize: 14, resize: "vertical",
              outline: "none", boxSizing: "border-box",
            }}
          />
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "right", marginTop: 4 }}>
            {text.length} / 2000
          </p>
          {submitAppeal.error && (
            <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{submitAppeal.error.message}</p>
          )}
          <button
            onClick={() => submitAppeal.mutate({ text, strikeId: selectedStrikeId })}
            disabled={submitAppeal.isPending || text.length < 20}
            style={{
              marginTop: 12, width: "100%", padding: "12px", borderRadius: 12,
              background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
              color: "white", fontSize: 14, fontWeight: 600,
              opacity: submitAppeal.isPending || text.length < 20 ? 0.5 : 1,
              cursor: submitAppeal.isPending || text.length < 20 ? "not-allowed" : "pointer",
              border: "none",
            }}
          >
            {submitAppeal.isPending ? "Submitting…" : "Submit Appeal"}
          </button>
        </>
      )}

      {/* Past appeals */}
      {appeals && appeals.filter(a => a.status !== "PENDING").length > 0 && (
        <div style={{ marginTop: 32 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Past appeals</p>
          {appeals.filter(a => a.status !== "PENDING").map(a => (
            <div key={a.id} style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: a.status === "APPROVED" ? "#4ade80" : "#f87171", fontSize: 13, fontWeight: 600 }}>
                  {a.status === "APPROVED" ? "Approved" : "Denied"}
                </span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                  {a.reviewedAt ? new Date(a.reviewedAt).toLocaleDateString() : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add app/appeal/page.tsx
git commit -m "feat: add user-facing appeal submission page"
```

---

## Task 8: Admin Panel — Layout + Dashboard

**Files:**
- Create: `app/(admin)/admin/layout.tsx`
- Create: `app/(admin)/admin/page.tsx`

- [ ] **Step 1: Create `app/(admin)/admin/layout.tsx`**

```tsx
"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { trpc } from "@/components/providers"
import Link from "next/link"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  // Check mod/admin status via a lightweight query
  const { data: me } = trpc.user.me.useQuery(undefined, { enabled: !!session })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/")
    if (me && !me.isAdmin && !(me as any).isModerator) router.push("/")
  }, [status, me, router])

  if (status === "loading" || !me) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</p></div>
  }

  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/appeals", label: "Appeals" },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0F" }}>
      {/* Admin top bar */}
      <div style={{ background: "#1a0535", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 24 }}>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>Gallery Admin</span>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} style={{
            color: pathname === item.href ? "white" : "rgba(255,255,255,0.5)",
            fontSize: 13, fontWeight: pathname === item.href ? 600 : 400,
            textDecoration: "none",
          }}>
            {item.label}
          </Link>
        ))}
        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
          {(me as any).isAdmin ? "Admin" : "Moderator"} · @{me.username}
        </span>
      </div>
      <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
        {children}
      </div>
    </div>
  )
}
```

Note: `user.me` needs to return `isAdmin` and `isModerator`. Check `server/routers/user.ts` — if `me` procedure doesn't select these fields, add them to the select. Look for the `me` procedure and add `isAdmin: true, isModerator: true` to the select object, or if it returns the full user already, it will work.

- [ ] **Step 2: Update `server/routers/user.ts` — ensure `me` returns admin flags**

Find the `me` procedure in `server/routers/user.ts`. If it uses `prisma.user.findUnique` with a specific `select`, add `isAdmin: true` and `isModerator: true` to the select. If it returns the full user (`select` not specified), it already works.

- [ ] **Step 3: Create `app/(admin)/admin/page.tsx`**

```tsx
"use client"

import { trpc } from "@/components/providers"

export default function AdminDashboard() {
  const { data: pendingAppeals } = trpc.admin.listAppeals.useQuery({ status: "PENDING" })

  return (
    <div>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
        <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 20px" }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 4 }}>Pending Appeals</p>
          <p style={{ color: "white", fontSize: 28, fontWeight: 700 }}>{pendingAppeals?.length ?? "…"}</p>
        </div>
      </div>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
        Use the navigation above to manage users and review appeals.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/(admin)/admin/layout.tsx app/(admin)/admin/page.tsx
git commit -m "feat: add admin panel layout and dashboard"
```

---

## Task 9: Admin Panel — Users Pages

**Files:**
- Create: `app/(admin)/admin/users/page.tsx`
- Create: `app/(admin)/admin/users/[id]/page.tsx`

- [ ] **Step 1: Create `app/(admin)/admin/users/page.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

export default function AdminUsersPage() {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const router = useRouter()

  const { data: users, isLoading } = trpc.admin.listUsers.useQuery({ query: debouncedQuery || undefined })

  return (
    <div>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Users</h1>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setTimeout(() => setDebouncedQuery(e.target.value), 300) }}
        placeholder="Search by username or email…"
        style={{
          width: "100%", padding: "10px 14px", borderRadius: 10, marginBottom: 16,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
          color: "white", fontSize: 14, outline: "none", boxSizing: "border-box",
        }}
      />
      {isLoading ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {users?.map(u => (
            <button
              key={u.id}
              onClick={() => router.push(`/admin/users/${u.id}`)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 10, textAlign: "left",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
              }}
            >
              <div>
                <span style={{ color: "white", fontSize: 14, fontWeight: 600 }}>@{u.username ?? "—"}</span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginLeft: 8 }}>{u.email}</span>
                {u.isAdmin && <span style={{ color: "#facc15", fontSize: 11, marginLeft: 8, fontWeight: 700 }}>ADMIN</span>}
                {u.isModerator && <span style={{ color: "#60a5fa", fontSize: 11, marginLeft: 8, fontWeight: 700 }}>MOD</span>}
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {u.bannedUntil && new Date(u.bannedUntil) > new Date() && (
                  <span style={{ color: "#f87171", fontSize: 11, fontWeight: 700 }}>BANNED</span>
                )}
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{u._count.receivedStrikes} strikes</span>
              </div>
            </button>
          ))}
          {users?.length === 0 && (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No users found.</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(admin)/admin/users/[id]/page.tsx`**

```tsx
"use client"

import { use, useState } from "react"
import { trpc } from "@/components/providers"
import { useSession } from "next-auth/react"

const LEVEL_COLORS: Record<string, string> = {
  MINOR: "#facc15",
  MODERATE: "#fb923c",
  SEVERE: "#f87171",
  ZERO_TOLERANCE: "#dc2626",
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const { data: user, refetch } = trpc.admin.getUser.useQuery({ userId: id })

  const [showBanModal, setShowBanModal] = useState(false)
  const [banDuration, setBanDuration] = useState<"3d" | "14d" | "30d" | "permanent">("3d")
  const [banReason, setBanReason] = useState("")

  const [showStrikeModal, setShowStrikeModal] = useState(false)
  const [strikeLevel, setStrikeLevel] = useState<"MINOR" | "MODERATE" | "SEVERE" | "ZERO_TOLERANCE">("MINOR")
  const [strikeViolation, setStrikeViolation] = useState("SPAM")
  const [strikeContentId, setStrikeContentId] = useState("")
  const [strikeContentType, setStrikeContentType] = useState("")
  const [strikeNotes, setStrikeNotes] = useState("")

  const issueBan = trpc.admin.issueBan.useMutation({ onSuccess: () => { refetch(); setShowBanModal(false); setBanReason("") } })
  const liftBan = trpc.admin.liftBan.useMutation({ onSuccess: () => refetch() })
  const issueStrike = trpc.admin.issueStrike.useMutation({ onSuccess: () => { refetch(); setShowStrikeModal(false) } })
  const setModerator = trpc.admin.setModerator.useMutation({ onSuccess: () => refetch() })

  const me = session?.user

  if (!user) return <div style={{ color: "rgba(255,255,255,0.4)", padding: 24 }}>Loading…</div>

  const isBanned = user.bannedUntil && new Date(user.bannedUntil) > new Date()
  const isPermanent = user.bannedUntil && new Date(user.bannedUntil).getFullYear() >= 9999

  const MINOR_COUNT = user.receivedStrikes.filter(s => s.level === "MINOR" && !s.reversed).length
  const MODERATE_COUNT = user.receivedStrikes.filter(s => s.level === "MODERATE" && !s.reversed).length
  const SEVERE_COUNT = user.receivedStrikes.filter(s => s.level === "SEVERE" && !s.reversed).length

  const ALL_VIOLATIONS = [
    "ARTIST_CANCEL", "FAKE_DELIVERY", "FALSE_ADVERTISING", "BAIT_AND_SWITCH",
    "OFF_PLATFORM_PAYMENT", "COMMISSION_FARMING", "SHOP_FALSE_ADVERTISING",
    "UNLABELLED_AI", "GORE", "HARASSMENT", "HATE_SPEECH", "SPAM",
    "DMCA_VIOLATION", "FTC_DISCLOSURE", "NCMEC_VIOLATION",
    "CHARGEBACK_FRAUD", "ZERO_TOLERANCE_CONDUCT",
  ]

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: 700 }}>@{user.username ?? "—"}</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{user.email}</p>
        </div>
        {/* Admin only: mod toggle */}
        {(me as any)?.isAdmin && !user.isAdmin && (
          <button
            onClick={() => setModerator.mutate({ userId: user.id, isModerator: !user.isModerator })}
            disabled={setModerator.isPending}
            style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: user.isModerator ? "rgba(255,255,255,0.1)" : "rgba(96,165,250,0.2)",
              border: `1px solid ${user.isModerator ? "rgba(255,255,255,0.2)" : "rgba(96,165,250,0.4)"}`,
              color: user.isModerator ? "rgba(255,255,255,0.6)" : "#60a5fa", cursor: "pointer",
            }}
          >
            {user.isModerator ? "Remove Moderator" : "Make Moderator"}
          </button>
        )}
      </div>

      {/* Strike summary */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Strike Summary</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[["Minor", MINOR_COUNT, "#facc15", "6 = 3d ban"], ["Moderate", MODERATE_COUNT, "#fb923c", "4 = 14d ban"], ["Severe", SEVERE_COUNT, "#f87171", "1 = 30d ban / 2 = permanent"]].map(([label, count, color, threshold]) => (
            <div key={label as string}>
              <span style={{ color: color as string, fontSize: 20, fontWeight: 700 }}>{count as number}</span>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginLeft: 4 }}>{label as string}</span>
              {(count as number) >= (label === "Minor" ? 6 : label === "Moderate" ? 4 : 1) && (
                <span style={{ color: "#f87171", fontSize: 11, marginLeft: 6 }}>⚠ {threshold as string}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Ban status */}
      <div style={{ background: isBanned ? "rgba(127,29,29,0.3)" : "rgba(255,255,255,0.04)", border: `1px solid ${isBanned ? "rgba(153,27,27,0.5)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Ban Status</p>
          {isBanned ? (
            <p style={{ color: "#f87171", fontSize: 14, fontWeight: 600 }}>
              {isPermanent ? "Permanently banned" : `Banned until ${new Date(user.bannedUntil!).toLocaleDateString()}`}
            </p>
          ) : (
            <p style={{ color: "#4ade80", fontSize: 14 }}>Not banned</p>
          )}
          {user.banReason && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>{user.banReason}</p>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isBanned ? (
            <button onClick={() => liftBan.mutate({ userId: user.id })} disabled={liftBan.isPending}
              style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", cursor: "pointer" }}>
              Lift Ban
            </button>
          ) : (
            <button onClick={() => setShowBanModal(true)}
              style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", cursor: "pointer" }}>
              Issue Ban
            </button>
          )}
          <button onClick={() => setShowStrikeModal(true)}
            style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", color: "#facc15", cursor: "pointer" }}>
            Issue Strike
          </button>
        </div>
      </div>

      {/* Strike history */}
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Strike History</p>
      {user.receivedStrikes.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No strikes.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {user.receivedStrikes.map(s => (
            <div key={s.id} style={{ padding: "10px 12px", borderRadius: 10, background: s.reversed ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", opacity: s.reversed ? 0.5 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ color: LEVEL_COLORS[s.level] ?? "white", fontSize: 12, fontWeight: 700 }}>{s.level}</span>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginLeft: 8 }}>{s.violation.replace(/_/g, " ")}</span>
                  {s.reversed && <span style={{ color: "rgba(74,222,128,0.7)", fontSize: 11, marginLeft: 8 }}>REVERSED</span>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>by @{s.issuedBy.username}</p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              {s.notes && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>{s.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Ban modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowBanModal(false)}>
          <div style={{ background: "#1e0d3f", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "white", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Issue Ban</h3>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 12 }}>Duration</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {(["3d", "14d", "30d", "permanent"] as const).map(d => (
                <button key={d} onClick={() => setBanDuration(d)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: banDuration === d ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${banDuration === d ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)"}`, color: banDuration === d ? "#f87171" : "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                  {d === "permanent" ? "Permanent" : d}
                </button>
              ))}
            </div>
            <textarea value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Reason (shown to user)…" rows={3} style={{ width: "100%", borderRadius: 10, padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowBanModal(false)} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => issueBan.mutate({ userId: user.id, duration: banDuration, reason: banReason })} disabled={issueBan.isPending || !banReason.trim()} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#dc2626", color: "white", border: "none", cursor: "pointer", opacity: !banReason.trim() ? 0.5 : 1 }}>
                {issueBan.isPending ? "Issuing…" : "Issue Ban"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strike modal */}
      {showStrikeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowStrikeModal(false)}>
          <div style={{ background: "#1e0d3f", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "white", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Issue Strike</h3>
            <div style={{ marginBottom: 12 }}>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 6 }}>Level</p>
              <select value={strikeLevel} onChange={e => setStrikeLevel(e.target.value as any)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, outline: "none" }}>
                {["MINOR", "MODERATE", "SEVERE", "ZERO_TOLERANCE"].map(l => <option key={l} value={l} style={{ background: "#1e0d3f" }}>{l}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 6 }}>Violation</p>
              <select value={strikeViolation} onChange={e => setStrikeViolation(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, outline: "none" }}>
                {ALL_VIOLATIONS.map(v => <option key={v} value={v} style={{ background: "#1e0d3f" }}>{v.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <input value={strikeContentId} onChange={e => setStrikeContentId(e.target.value)} placeholder="Content ID (optional)" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
            <select value={strikeContentType} onChange={e => setStrikeContentType(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, outline: "none", marginBottom: 8 }}>
              <option value="" style={{ background: "#1e0d3f" }}>Content type (optional)</option>
              <option value="post" style={{ background: "#1e0d3f" }}>Post</option>
              <option value="commission" style={{ background: "#1e0d3f" }}>Commission</option>
              <option value="shop_item" style={{ background: "#1e0d3f" }}>Shop item</option>
            </select>
            <textarea value={strikeNotes} onChange={e => setStrikeNotes(e.target.value)} placeholder="Internal notes (optional)…" rows={2} style={{ width: "100%", borderRadius: 8, padding: "8px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowStrikeModal(false)} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => issueStrike.mutate({ userId: user.id, level: strikeLevel, violation: strikeViolation as any, contentId: strikeContentId || undefined, contentType: strikeContentType as any || undefined, notes: strikeNotes || undefined })} disabled={issueStrike.isPending} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#facc15", color: "#0D0D0F", border: "none", cursor: "pointer" }}>
                {issueStrike.isPending ? "Issuing…" : "Issue Strike"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/users/page.tsx" "app/(admin)/admin/users/[id]/page.tsx"
git commit -m "feat: add admin users list and user detail pages"
```

---

## Task 10: Admin Panel — Appeals Pages

**Files:**
- Create: `app/(admin)/admin/appeals/page.tsx`
- Create: `app/(admin)/admin/appeals/[id]/page.tsx`

- [ ] **Step 1: Create `app/(admin)/admin/appeals/page.tsx`**

```tsx
"use client"

import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

export default function AdminAppealsPage() {
  const router = useRouter()
  const { data: appeals, isLoading } = trpc.admin.listAppeals.useQuery({ status: "PENDING" })

  return (
    <div>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Appeals</h1>
      {isLoading ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Loading…</p>
      ) : appeals?.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No pending appeals.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {appeals?.map(a => (
            <button
              key={a.id}
              onClick={() => router.push(`/admin/appeals/${a.id}`)}
              style={{
                padding: "14px 16px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ color: "white", fontSize: 14, fontWeight: 600 }}>@{a.user.username ?? "—"}</span>
                  {a.strike && (
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginLeft: 8 }}>
                      {a.strike.level} · {a.strike.violation.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.text}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(admin)/admin/appeals/[id]/page.tsx`**

```tsx
"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

const LEVEL_COLORS: Record<string, string> = {
  MINOR: "#facc15", MODERATE: "#fb923c", SEVERE: "#f87171", ZERO_TOLERANCE: "#dc2626",
}

export default function AdminAppealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: appeal, refetch } = trpc.admin.getAppeal.useQuery({ appealId: id })

  const approveAppeal = trpc.admin.approveAppeal.useMutation({
    onSuccess: () => router.push("/admin/appeals"),
  })
  const denyAppeal = trpc.admin.denyAppeal.useMutation({
    onSuccess: () => router.push("/admin/appeals"),
  })

  if (!appeal) return <div style={{ color: "rgba(255,255,255,0.4)", padding: 24 }}>Loading…</div>

  const isPending = appeal.status === "PENDING"

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push("/admin/appeals")} style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>← Back</button>
        <h1 style={{ color: "white", fontSize: 20, fontWeight: 700 }}>Appeal</h1>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>by @{appeal.user.username}</span>
      </div>

      {/* Appeal text */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Appeal</p>
        <p style={{ color: "white", fontSize: 14, lineHeight: 1.6 }}>{appeal.text}</p>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 8 }}>Submitted {new Date(appeal.createdAt).toLocaleDateString()}</p>
      </div>

      {/* Referenced strike */}
      {appeal.strike && (
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Referenced Strike</p>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ color: LEVEL_COLORS[appeal.strike.level] ?? "white", fontWeight: 700, fontSize: 13 }}>{appeal.strike.level}</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{appeal.strike.violation.replace(/_/g, " ")}</span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{new Date(appeal.strike.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* User's strike history */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>User's Full Strike History</p>
        {appeal.user.receivedStrikes.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No strikes.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {appeal.user.receivedStrikes.map(s => (
              <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", opacity: s.reversed ? 0.5 : 1 }}>
                <span style={{ color: LEVEL_COLORS[s.level] ?? "white", fontSize: 12, fontWeight: 700, minWidth: 80 }}>{s.level}</span>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{s.violation.replace(/_/g, " ")}</span>
                {s.reversed && <span style={{ color: "#4ade80", fontSize: 11 }}>reversed</span>}
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginLeft: "auto" }}>{new Date(s.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {isPending ? (
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => approveAppeal.mutate({ appealId: id })}
            disabled={approveAppeal.isPending}
            style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", cursor: "pointer" }}
          >
            {approveAppeal.isPending ? "Approving…" : "✓ Approve — Reverse strike & lift ban"}
          </button>
          <button
            onClick={() => denyAppeal.mutate({ appealId: id })}
            disabled={denyAppeal.isPending}
            style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171", cursor: "pointer" }}
          >
            {denyAppeal.isPending ? "Denying…" : "✕ Deny"}
          </button>
        </div>
      ) : (
        <div style={{ padding: 16, borderRadius: 12, background: appeal.status === "APPROVED" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${appeal.status === "APPROVED" ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}` }}>
          <p style={{ color: appeal.status === "APPROVED" ? "#4ade80" : "#f87171", fontSize: 14, fontWeight: 600 }}>
            {appeal.status === "APPROVED" ? "Appeal approved" : "Appeal denied"}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/appeals/page.tsx" "app/(admin)/admin/appeals/[id]/page.tsx"
git commit -m "feat: add admin appeals queue and appeal detail pages"
```

---

## Task 11: Trust Score Integration + Roadmap Update

**Files:**
- Modify: `server/routers/commission.ts` (the `getTrustScore` procedure)
- Modify: `docs/roadmap.md`
- Modify: `C:\Users\gavri\OneDrive\Documents\art socail\Gallery\Product\Roadmap.md`

- [ ] **Step 1: Update `getTrustScore` to use real Strike data**

Find the `getTrustScore` procedure in `server/routers/commission.ts`. Find these lines:

```typescript
      // Strike deductions are 0 until the Strike model ships in Tier 2
      const strikeDeduction = 0
      const sellingStrikeCount = 0
```

Replace with:

```typescript
      // Pull selling-related strikes (non-reversed only)
      const sellingStrikes = await ctx.prisma.strike.findMany({
        where: { userId: artist.id, isSelling: true, reversed: false },
        select: { level: true },
      })
      const sellingStrikeCount = sellingStrikes.length
      const strikeDeduction =
        sellingStrikes.filter(s => s.level === "MINOR").length * 0.1 +
        sellingStrikes.filter(s => s.level === "MODERATE").length * 0.3 +
        sellingStrikes.filter(s => s.level === "SEVERE").length * 0.8
```

Also remove the now-incorrect comment `// isSuspended always false until Zero Tolerance ban field ships in Tier 2` and update the `computeTier` call to check `bannedUntil`:

Find:
```typescript
      // isSuspended always false until Zero Tolerance ban field ships in Tier 2
      const tier = computeTier(finalScore, hasScore, false)
```

Replace with:
```typescript
      const isSuspended = !!(artist.bannedUntil && artist.bannedUntil > new Date())
      const tier = computeTier(finalScore, hasScore, isSuspended)
```

Also update the `artist` select at the top of `getTrustScore` to include `bannedUntil`:

Find:
```typescript
      const artist = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true },
      })
```

Replace with:
```typescript
      const artist = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true, bannedUntil: true },
      })
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 3: Update `docs/roadmap.md`**

Under `## 🟡 Tier 2`, mark these items as done:

Find:
```markdown
- [ ] Strikes system — 4 levels: Minor / Moderate / Severe / Zero Tolerance
- [ ] Strike accumulation logic and temp ban triggers
```

Replace with:
```markdown
- [x] Strikes system — 4 levels: Minor / Moderate / Severe / Zero Tolerance
- [x] Strike accumulation logic and temp ban triggers (manual — mods issue bans informed by thresholds)
```

- [ ] **Step 4: Sync Obsidian roadmap**

Apply the same change to `C:\Users\gavri\OneDrive\Documents\art socail\Gallery\Product\Roadmap.md`.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/routers/commission.ts docs/roadmap.md
git commit -m "feat: wire Trust Score to real strikes; update roadmap"
```
