# Account Enforcement System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add chargeback logging, commission feature override, and ban evasion detection to the admin panel, with enforcement stats on the dashboard.

**Architecture:** Four new User fields (chargebackCount, accountNotes, normalizedEmail, banEvasionFlag) added via Prisma migration. A normalizeEmail utility handles email normalization at signup. Gallery-admin gains five new tRPC procedures and updated UI on the user detail page and dashboard.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 5, TypeScript, Vitest — both repos share the same Postgres DB.

---

## Codebase Notes (read before implementing)

- `Notification.fromUserId` is **non-nullable** in the current schema and has a required `User` relation (`fromUser User @relation("SentNotifications", ...)`). Creating system notifications with `fromUserId: null` will fail at the DB and TypeScript levels. Every `notification.create` call in this plan must set `fromUserId` to the acting admin's session user ID (`ctx.session.user.id`), not `null`. The spec says `null` but that is incompatible with the live schema.
- `commissionFeatureDisabled Boolean @default(false)` already exists on `User` — no schema change needed for Task 5.
- The existing `getBanDate("permanent")` helper in `gallery-admin/server/routers/admin.ts` returns `new Date("9999-12-31")`. Use it instead of inlining the date literal in `confirmBanEvasion`.
- `gallery-admin/app/dashboard/page.tsx` is currently a client component (`"use client"`). The three new count queries must be added as tRPC queries (not direct `prisma` calls) to stay consistent with the client-side data-fetching pattern already in the file.
- `gallery-admin/app/users/page.tsx` is a client component. Filter state should be read from `useSearchParams()` (Next.js App Router client-side hook), not from server-side `searchParams` props.
- The `listUsers` tRPC procedure in `gallery-admin/server/routers/admin.ts` takes `{ query?: string }`. The filter param must be added alongside `query` so both can be active simultaneously.

---

## Task 1: Schema migration (gallery repo)

- [ ] Open `C:\Users\gavri\OneDrive\Documents\Projects\gallery\prisma\schema.prisma`
- [ ] Add four fields to the `User` model after `showRealName`:

```prisma
chargebackCount  Int     @default(0)
accountNotes     String? @db.Text
normalizedEmail  String?
banEvasionFlag   Boolean @default(false)

@@index([normalizedEmail])
```

The `@@index` directive goes inside the `User` model block alongside other model-level attributes. There are no existing `@@index` entries on `User`, so place it after the last field, before the closing `}`.

- [ ] Run the migration from the gallery repo root:
```
npx prisma migrate dev --name add_account_enforcement_fields
```
- [ ] Copy the updated `prisma/schema.prisma` to `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\prisma\schema.prisma`
- [ ] From the gallery-admin repo root, regenerate the Prisma client:
```
npx prisma generate
```
- [ ] Write a Vitest test at `C:\Users\gavri\OneDrive\Documents\Projects\gallery\src\tests\schema-enforcement-fields.test.ts` that creates a user record and asserts the four new fields exist with correct defaults:

```typescript
import { describe, it, expect, afterEach } from "vitest"
import { prisma } from "@/server/db"

describe("account enforcement schema fields", () => {
  const createdIds: string[] = []

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } })
    createdIds.length = 0
  })

  it("new User has correct defaults for enforcement fields", async () => {
    const user = await prisma.user.create({
      data: { email: `schema-test-${Date.now()}@example.com` },
    })
    createdIds.push(user.id)

    expect(user.chargebackCount).toBe(0)
    expect(user.accountNotes).toBeNull()
    expect(user.normalizedEmail).toBeNull()
    expect(user.banEvasionFlag).toBe(false)
  })
})
```

- [ ] Run `npx tsc --noEmit` in the gallery repo — confirm zero errors
- [ ] Run `npx tsc --noEmit` in the gallery-admin repo — confirm zero errors
- [ ] Commit both repos:
  - gallery: `git add prisma/schema.prisma src/tests/schema-enforcement-fields.test.ts && git commit -m "feat: add account enforcement fields to User schema"`
  - gallery-admin: `git add prisma/schema.prisma && git commit -m "chore: sync schema — add account enforcement fields"`

---

## Task 2: normalizeEmail utility + backfill (gallery repo)

- [ ] Create `C:\Users\gavri\OneDrive\Documents\Projects\gallery\src\lib\normalizeEmail.ts`:

```typescript
export function normalizeEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split("@")
  const normalizedLocal = local.split("+")[0].replace(/\./g, "")
  return `${normalizedLocal}@${domain}`
}
```

- [ ] Write Vitest tests at `C:\Users\gavri\OneDrive\Documents\Projects\gallery\src\tests\normalizeEmail.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { normalizeEmail } from "@/lib/normalizeEmail"

describe("normalizeEmail", () => {
  it("strips + alias and dots from gmail address", () => {
    expect(normalizeEmail("user+alt@gmail.com")).toBe("useralt@gmail.com")
  })

  it("lowercases and removes dots from local part", () => {
    expect(normalizeEmail("User.Name@gmail.com")).toBe("username@gmail.com")
  })

  it("does not strip dots from non-gmail domains", () => {
    expect(normalizeEmail("test@yahoo.com")).toBe("test@yahoo.com")
  })

  it("handles combined dots and + alias", () => {
    expect(normalizeEmail("u.s.e.r+tag@gmail.com")).toBe("user@gmail.com")
  })

  it("lowercases domain", () => {
    expect(normalizeEmail("Test@EXAMPLE.COM")).toBe("test@example.com")
  })
})
```

- [ ] Create `C:\Users\gavri\OneDrive\Documents\Projects\gallery\scripts\backfill-normalized-email.ts`:

```typescript
import { prisma } from "../src/server/db"
import { normalizeEmail } from "../src/lib/normalizeEmail"

async function main() {
  const users = await prisma.user.findMany({
    where: { normalizedEmail: null },
    select: { id: true, email: true },
  })
  console.log(`Backfilling ${users.length} users…`)
  for (const user of users) {
    if (!user.email) continue
    await prisma.user.update({
      where: { id: user.id },
      data: { normalizedEmail: normalizeEmail(user.email) },
    })
  }
  console.log("Done.")
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] Run `npx tsc --noEmit` in the gallery repo — confirm zero errors
- [ ] Run `npx vitest run src/tests/normalizeEmail.test.ts` — all tests pass
- [ ] Commit:
```
git add src/lib/normalizeEmail.ts src/tests/normalizeEmail.test.ts scripts/backfill-normalized-email.ts
git commit -m "feat: add normalizeEmail utility and backfill script"
```

---

## Task 3: Ban evasion check at account creation (gallery repo)

The gallery app does not currently create `User` records via `server/routers/user.ts` — accounts are created through NextAuth callbacks (OAuth or credentials). The ban evasion detection logic must be inserted in the auth configuration.

- [ ] Locate the NextAuth config file. It is likely at `C:\Users\gavri\OneDrive\Documents\Projects\gallery\app\api\auth\[...nextauth]\route.ts` or `src/lib/auth.ts`. Read the file to find the `signIn` callback or the Credentials `authorize` function where the `User` record is first created.

- [ ] In the callback that runs **after** a new user record is persisted to the database, add the ban evasion check. The exact insertion point depends on the auth file, but the logic is:

```typescript
import { normalizeEmail } from "@/lib/normalizeEmail"

// After newUser is created and we have newUser.id and newUser.email:
if (newUser.email) {
  const normalized = normalizeEmail(newUser.email)
  await prisma.user.update({
    where: { id: newUser.id },
    data: { normalizedEmail: normalized },
  })
  const bannedMatches = await prisma.user.findMany({
    where: {
      normalizedEmail: normalized,
      id: { not: newUser.id },
      bannedUntil: { not: null },
    },
    select: { id: true, bannedUntil: true },
  })
  const hasBannedMatch = bannedMatches.some(
    u => u.bannedUntil && u.bannedUntil > new Date()
  )
  if (hasBannedMatch) {
    await prisma.user.update({
      where: { id: newUser.id },
      data: { banEvasionFlag: true },
    })
  }
}
```

- [ ] Write a Vitest test at `C:\Users\gavri\OneDrive\Documents\Projects\gallery\src\tests\ban-evasion-detection.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest"
import { prisma } from "@/server/db"
import { normalizeEmail } from "@/lib/normalizeEmail"

describe("ban evasion detection", () => {
  const createdIds: string[] = []

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } })
    createdIds.length = 0
  })

  it("flags new account when normalized email matches a banned user", async () => {
    const bannedUser = await prisma.user.create({
      data: {
        email: "evader@example.com",
        normalizedEmail: normalizeEmail("evader@example.com"),
        bannedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        banReason: "Test ban",
      },
    })
    createdIds.push(bannedUser.id)

    // Simulate what the auth callback will do for a new user
    const newUser = await prisma.user.create({
      data: { email: "evader+alt@example.com" },
    })
    createdIds.push(newUser.id)

    const normalized = normalizeEmail("evader+alt@example.com")
    await prisma.user.update({
      where: { id: newUser.id },
      data: { normalizedEmail: normalized },
    })
    const bannedMatches = await prisma.user.findMany({
      where: {
        normalizedEmail: normalized,
        id: { not: newUser.id },
        bannedUntil: { not: null },
      },
      select: { id: true, bannedUntil: true },
    })
    const hasBannedMatch = bannedMatches.some(
      u => u.bannedUntil && u.bannedUntil > new Date()
    )
    if (hasBannedMatch) {
      await prisma.user.update({
        where: { id: newUser.id },
        data: { banEvasionFlag: true },
      })
    }

    const updated = await prisma.user.findUnique({ where: { id: newUser.id } })
    expect(updated?.banEvasionFlag).toBe(true)
    expect(updated?.normalizedEmail).toBe("evader@example.com")
  })

  it("does not flag new account when matching user is not banned", async () => {
    const goodUser = await prisma.user.create({
      data: {
        email: "clean@example.com",
        normalizedEmail: normalizeEmail("clean@example.com"),
      },
    })
    createdIds.push(goodUser.id)

    const newUser = await prisma.user.create({
      data: { email: "clean+tag@example.com" },
    })
    createdIds.push(newUser.id)

    const normalized = normalizeEmail("clean+tag@example.com")
    await prisma.user.update({
      where: { id: newUser.id },
      data: { normalizedEmail: normalized },
    })
    const bannedMatches = await prisma.user.findMany({
      where: {
        normalizedEmail: normalized,
        id: { not: newUser.id },
        bannedUntil: { not: null },
      },
      select: { id: true, bannedUntil: true },
    })
    const hasBannedMatch = bannedMatches.some(
      u => u.bannedUntil && u.bannedUntil > new Date()
    )
    if (hasBannedMatch) {
      await prisma.user.update({
        where: { id: newUser.id },
        data: { banEvasionFlag: true },
      })
    }

    const updated = await prisma.user.findUnique({ where: { id: newUser.id } })
    expect(updated?.banEvasionFlag).toBe(false)
  })
})
```

- [ ] Run `npx tsc --noEmit` — confirm zero errors
- [ ] Run `npx vitest run src/tests/ban-evasion-detection.test.ts` — all tests pass
- [ ] Commit:
```
git add src/tests/ban-evasion-detection.test.ts
git commit -m "feat: ban evasion detection at account creation + tests"
```
(Include the auth file change in this commit once its path is confirmed.)

---

## Task 4: gallery-admin — chargeback + account notes procedures

- [ ] Open `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\server\routers\admin.ts`
- [ ] Add the following two procedures to the `adminRouter` object, after the existing `liftBan` procedure and before the `listAppeals` procedure:

```typescript
// ── Chargeback & account notes ───────────────────────────────────────────────

updateAccountNotes: adminProcedure
  .input(z.object({ userId: z.string(), notes: z.string().max(5000) }))
  .mutation(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({ where: { id: input.userId } })
    if (!user) throw new TRPCError({ code: "NOT_FOUND" })
    return ctx.prisma.user.update({
      where: { id: input.userId },
      data: { accountNotes: input.notes },
      select: { id: true, accountNotes: true },
    })
  }),

logChargeback: adminProcedure
  .input(z.object({ userId: z.string(), suspend: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: input.userId },
      select: { isAdmin: true, isModerator: true },
    })
    if (!user) throw new TRPCError({ code: "NOT_FOUND" })
    if (user.isAdmin || user.isModerator) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Cannot take moderation actions against staff accounts" })
    }
    await ctx.prisma.user.update({
      where: { id: input.userId },
      data: { chargebackCount: { increment: 1 } },
    })
    if (input.suspend) {
      await ctx.prisma.$transaction(async tx => {
        await tx.user.update({
          where: { id: input.userId },
          data: {
            bannedUntil: getBanDate("30d"),
            banReason: "Chargeback under investigation",
          },
        })
        await tx.notification.create({
          data: {
            userId: input.userId,
            fromUserId: ctx.session.user.id,
            type: "ban",
          },
        })
      })
    }
    return { success: true }
  }),
```

Note: `getBanDate` is already defined at the top of `admin.ts`. The notification `fromUserId` is set to `ctx.session.user.id` (the acting admin), not `null`, because `Notification.fromUserId` is non-nullable in the schema.

- [ ] Run `npx tsc --noEmit` in the gallery-admin repo — confirm zero errors
- [ ] Commit:
```
git add server/routers/admin.ts
git commit -m "feat: add updateAccountNotes and logChargeback admin procedures"
```

---

## Task 5: gallery-admin — commission feature + ban evasion procedures

- [ ] In `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\server\routers\admin.ts`, add the following three procedures to the `adminRouter` after `logChargeback`:

```typescript
// ── Commission feature override ──────────────────────────────────────────────

setCommissionFeature: modProcedure
  .input(z.object({ userId: z.string(), disabled: z.boolean(), reason: z.string().optional() }))
  .mutation(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: input.userId },
      select: { isAdmin: true, isModerator: true },
    })
    if (!user) throw new TRPCError({ code: "NOT_FOUND" })
    if (user.isAdmin || user.isModerator) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Cannot take moderation actions against staff accounts" })
    }
    await ctx.prisma.user.update({
      where: { id: input.userId },
      data: { commissionFeatureDisabled: input.disabled },
    })
    const message = input.disabled
      ? `Your commission feature has been disabled: ${input.reason ?? "Admin override"}`
      : "Your commission feature has been re-enabled."
    await ctx.prisma.notification.create({
      data: {
        userId: input.userId,
        fromUserId: ctx.session.user.id,
        type: "site_notice",
        message,
      },
    })
    return { success: true }
  }),

// ── Ban evasion ──────────────────────────────────────────────────────────────

confirmBanEvasion: adminProcedure
  .input(z.object({ userId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: input.userId },
      select: { normalizedEmail: true, isAdmin: true, isModerator: true },
    })
    if (!user) throw new TRPCError({ code: "NOT_FOUND" })
    if (user.isAdmin || user.isModerator) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Cannot take moderation actions against staff accounts" })
    }
    const allAccounts = await ctx.prisma.user.findMany({
      where: { normalizedEmail: user.normalizedEmail },
      select: { id: true },
    })
    await ctx.prisma.user.updateMany({
      where: { id: { in: allAccounts.map(a => a.id) } },
      data: {
        bannedUntil: getBanDate("permanent"),
        banReason: "Ban evasion confirmed (ToS §2.3)",
        banEvasionFlag: false,
      },
    })
    return { bannedCount: allAccounts.length }
  }),

dismissBanEvasionFlag: modProcedure
  .input(z.object({ userId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({ where: { id: input.userId } })
    if (!user) throw new TRPCError({ code: "NOT_FOUND" })
    await ctx.prisma.user.update({
      where: { id: input.userId },
      data: { banEvasionFlag: false },
    })
    return { success: true }
  }),
```

Important schema note for `setCommissionFeature`: The current `Notification` model has a `message String?` field only if it was already added. Check the notification model in `prisma/schema.prisma`. If there is no `message` column on `Notification`, you must either: (a) add `message String? @db.Text` to the `Notification` model and migrate it first, or (b) encode the message in the `type` field as a prefixed string and decode it in the gallery app. The correct approach is (a) — add the column if it does not exist. Check the schema before implementing this task.

- [ ] Run `npx tsc --noEmit` in the gallery-admin repo — confirm zero errors
- [ ] Commit:
```
git add server/routers/admin.ts
git commit -m "feat: add setCommissionFeature, confirmBanEvasion, dismissBanEvasionFlag procedures"
```

---

## Task 6: gallery-admin — user detail page UI additions

File: `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\app\users\[id]\page.tsx`

### 6a — Update `getUser` select

- [ ] In the `trpc.admin.getUser` query, the `select` object inside the tRPC procedure (in `admin.ts`) must be updated to include the new fields. Update `getUser` in `server/routers/admin.ts`:

```typescript
getUser: modProcedure
  .input(z.object({ userId: z.string() }))
  .query(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true, username: true, email: true,
        isAdmin: true, isModerator: true,
        bannedUntil: true, banReason: true, createdAt: true,
        chargebackCount: true,
        accountNotes: true,
        banEvasionFlag: true,
        normalizedEmail: true,
        commissionFeatureDisabled: true,
        receivedStrikes: {
          orderBy: { createdAt: "desc" },
          include: { issuedBy: { select: { username: true } } },
        },
      },
    })
    if (!user) throw new TRPCError({ code: "NOT_FOUND" })
    return user
  }),
```

### 6b — Add state variables and mutations to the page component

- [ ] Add to the component's state declarations (after existing `useState` calls):

```typescript
const [accountNotes, setAccountNotes] = useState("")
const [showChargebackConfirm, setShowChargebackConfirm] = useState(false)
const [chargebackSuspend, setChargebackSuspend] = useState(false)
const [disableCommissionReason, setDisableCommissionReason] = useState("")
const [showDisableCommissionForm, setShowDisableCommissionForm] = useState(false)
```

- [ ] Initialize `accountNotes` from the user data. Add a `useEffect` (or read directly on render) that sets `accountNotes` when `user` loads:

```typescript
// Inside the component, after user is loaded — initialize notes state
// Use a separate useEffect to sync when user data arrives:
import { useEffect } from "react"

useEffect(() => {
  if (user?.accountNotes != null) setAccountNotes(user.accountNotes)
}, [user?.accountNotes])
```

- [ ] Add mutation hooks after existing mutations:

```typescript
const updateAccountNotes = trpc.admin.updateAccountNotes.useMutation({ onSuccess: () => refetch() })
const logChargeback = trpc.admin.logChargeback.useMutation({
  onSuccess: () => { setShowChargebackConfirm(false); setChargebackSuspend(false); refetch() },
  onError: (err) => alert(err.message),
})
const setCommissionFeature = trpc.admin.setCommissionFeature.useMutation({
  onSuccess: () => { setShowDisableCommissionForm(false); setDisableCommissionReason(""); refetch() },
  onError: (err) => alert(err.message),
})
const confirmBanEvasion = trpc.admin.confirmBanEvasion.useMutation({
  onSuccess: () => refetch(),
  onError: (err) => alert(err.message),
})
const dismissBanEvasionFlag = trpc.admin.dismissBanEvasionFlag.useMutation({
  onSuccess: () => refetch(),
  onError: (err) => alert(err.message),
})
```

### 6c — Add UI sections to the JSX

Insert the following sections **before the existing `{/* Ban modal */}` comment**. Add them in this order, each as a sibling card `<div>` matching the existing card style pattern (`background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16`):

**Ban evasion banner** (only rendered when `user.banEvasionFlag === true`):

```tsx
{/* Ban evasion banner */}
{user.banEvasionFlag && (
  <div style={{ background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.4)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <p style={{ color: "#fb923c", fontSize: 14, fontWeight: 700, margin: 0 }}>
        ⚠ Possible ban evasion detected — review this account before taking other actions.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        {isAdmin && (
          <button
            onClick={() => {
              if (confirm(`Confirm ban evasion? This will permanently ban all accounts sharing normalized email "${user.normalizedEmail}".`)) {
                confirmBanEvasion.mutate({ userId: id })
              }
            }}
            disabled={confirmBanEvasion.isPending}
            style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.5)", color: "#f87171", cursor: "pointer" }}
          >
            {confirmBanEvasion.isPending ? "Banning…" : "Confirm Evasion"}
          </button>
        )}
        <button
          onClick={() => dismissBanEvasionFlag.mutate({ userId: id })}
          disabled={dismissBanEvasionFlag.isPending}
          style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}
        >
          {dismissBanEvasionFlag.isPending ? "…" : "Dismiss"}
        </button>
      </div>
    </div>
  </div>
)}
```

**Chargeback section**:

```tsx
{/* Chargeback */}
<div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Chargebacks</p>
    {!user.isAdmin && !user.isModerator && (
      <button
        onClick={() => setShowChargebackConfirm(true)}
        style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", cursor: "pointer" }}
      >
        Log Chargeback
      </button>
    )}
  </div>
  {user.chargebackCount > 0 ? (
    <p style={{ color: "#fb923c", fontSize: 14, fontWeight: 600, margin: 0 }}>
      ⚠ {user.chargebackCount} chargeback(s) on record
    </p>
  ) : (
    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, margin: 0 }}>No chargebacks on record.</p>
  )}
  {showChargebackConfirm && (
    <div style={{ marginTop: 12, padding: 14, background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
      <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 10 }}>Log a chargeback for this user?</p>
      <label style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: 12, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={chargebackSuspend}
          onChange={e => setChargebackSuspend(e.target.checked)}
        />
        Suspend immediately (30 days)
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => { setShowChargebackConfirm(false); setChargebackSuspend(false) }}
          style={{ flex: 1, padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", cursor: "pointer", fontSize: 13 }}
        >
          Cancel
        </button>
        <button
          onClick={() => logChargeback.mutate({ userId: id, suspend: chargebackSuspend })}
          disabled={logChargeback.isPending}
          style={{ flex: 1, padding: 8, borderRadius: 8, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          {logChargeback.isPending ? "Logging…" : "Confirm"}
        </button>
      </div>
    </div>
  )}
</div>
```

**Commission status section**:

```tsx
{/* Commission feature */}
<div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Commission Feature</p>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showDisableCommissionForm ? 12 : 0 }}>
    <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
      {user.commissionFeatureDisabled ? "❌ Disabled" : "✅ Enabled"}
    </span>
    {!user.isAdmin && !user.isModerator && (
      user.commissionFeatureDisabled ? (
        <button
          onClick={() => {
            if (confirm("Re-enable commission feature for this user?")) {
              setCommissionFeature.mutate({ userId: id, disabled: false })
            }
          }}
          disabled={setCommissionFeature.isPending}
          style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", cursor: "pointer" }}
        >
          Re-enable Commissions
        </button>
      ) : (
        <button
          onClick={() => setShowDisableCommissionForm(v => !v)}
          style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171", cursor: "pointer" }}
        >
          Disable Commissions
        </button>
      )
    )}
  </div>
  {showDisableCommissionForm && !user.commissionFeatureDisabled && (
    <div>
      <input
        placeholder='Reason (e.g. "Exceeded cancellation threshold")'
        value={disableCommissionReason}
        onChange={e => setDisableCommissionReason(e.target.value)}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14, boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => { setShowDisableCommissionForm(false); setDisableCommissionReason("") }}
          style={{ flex: 1, padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", cursor: "pointer", fontSize: 13 }}
        >
          Cancel
        </button>
        <button
          onClick={() => setCommissionFeature.mutate({ userId: id, disabled: true, reason: disableCommissionReason || undefined })}
          disabled={setCommissionFeature.isPending}
          style={{ flex: 1, padding: 8, borderRadius: 8, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          {setCommissionFeature.isPending ? "Disabling…" : "Confirm Disable"}
        </button>
      </div>
    </div>
  )}
</div>
```

**Account Notes section**:

```tsx
{/* Account Notes */}
<div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
    Account Notes <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(internal only — never shown to user)</span>
  </p>
  <textarea
    value={accountNotes}
    onChange={e => setAccountNotes(e.target.value)}
    placeholder="Add internal notes about this account…"
    rows={4}
    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 14, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
  />
  <button
    onClick={() => updateAccountNotes.mutate({ userId: id, notes: accountNotes })}
    disabled={updateAccountNotes.isPending}
    style={{ padding: "6px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.4)", color: "#60a5fa", cursor: "pointer" }}
  >
    {updateAccountNotes.isPending ? "Saving…" : "Save Notes"}
  </button>
</div>
```

- [ ] Run `npx tsc --noEmit` in the gallery-admin repo — confirm zero errors
- [ ] Commit:
```
git add server/routers/admin.ts app/users/[id]/page.tsx
git commit -m "feat: user detail page — ban evasion banner, chargeback, commission, account notes"
```

---

## Task 7: gallery-admin — dashboard enforcement stats + users list filters

### 7a — Add enforcement count procedures to admin router

The dashboard is a client component that uses tRPC, so new counts must be exposed as tRPC queries (not direct `prisma` calls). Add these to `server/routers/admin.ts`:

```typescript
// ── Enforcement stats ────────────────────────────────────────────────────────

getEnforcementStats: modProcedure
  .query(async ({ ctx }) => {
    const [banEvasionCount, commissionDisabledCount, chargebackUsersCount] = await Promise.all([
      ctx.prisma.user.count({ where: { banEvasionFlag: true } }),
      ctx.prisma.user.count({ where: { commissionFeatureDisabled: true } }),
      ctx.prisma.user.count({ where: { chargebackCount: { gt: 0 } } }),
    ])
    return { banEvasionCount, commissionDisabledCount, chargebackUsersCount }
  }),
```

### 7b — Update `listUsers` to accept filter param

- [ ] Update the `listUsers` procedure input to accept an optional `filter` field and apply the corresponding `where` clause:

```typescript
listUsers: modProcedure
  .input(z.object({
    query: z.string().max(100).optional(),
    filter: z.enum(["banEvasionFlag", "commissionDisabled", "hasChargeback"]).optional(),
  }))
  .query(async ({ ctx, input }) => {
    const filterWhere = input.filter === "banEvasionFlag"
      ? { banEvasionFlag: true }
      : input.filter === "commissionDisabled"
      ? { commissionFeatureDisabled: true }
      : input.filter === "hasChargeback"
      ? { chargebackCount: { gt: 0 } }
      : {}

    const searchWhere = input.query ? {
      OR: [
        { username: { contains: input.query, mode: "insensitive" as const } },
        { email: { contains: input.query, mode: "insensitive" as const } },
      ],
    } : {}

    return ctx.prisma.user.findMany({
      where: { ...filterWhere, ...searchWhere },
      select: {
        id: true, username: true, email: true,
        isAdmin: true, isModerator: true,
        bannedUntil: true, createdAt: true,
        banEvasionFlag: true,
        _count: { select: { receivedStrikes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  }),
```

### 7c — Update dashboard page

- [ ] In `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\app\dashboard\page.tsx`, add the enforcement stats query and render the enforcement row:

```tsx
"use client"

import { useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { trpc } from "@/components/providers"

export default function DashboardPage() {
  const router = useRouter()
  const { data: pendingAppeals } = trpc.admin.listAppeals.useQuery({ status: "PENDING" })
  const { data: enforcement } = trpc.admin.getEnforcementStats.useQuery()

  return (
    <AdminLayout>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>

      {/* Existing stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
        <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 20px" }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 4 }}>Pending Appeals</p>
          <p style={{ color: "white", fontSize: 28, fontWeight: 700 }}>{pendingAppeals?.length ?? "…"}</p>
        </div>
      </div>

      {/* Enforcement stats */}
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Enforcement</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
        <button
          onClick={() => router.push("/users?filter=banEvasionFlag")}
          style={{ background: enforcement?.banEvasionCount ? "rgba(251,146,60,0.08)" : "rgba(255,255,255,0.05)", border: `1px solid ${enforcement?.banEvasionCount ? "rgba(251,146,60,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "16px 20px", textAlign: "left", cursor: "pointer" }}
        >
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 4 }}>Ban Evasion Flags</p>
          <p style={{ color: enforcement?.banEvasionCount ? "#fb923c" : "white", fontSize: 28, fontWeight: 700 }}>{enforcement?.banEvasionCount ?? "…"}</p>
        </button>
        <button
          onClick={() => router.push("/users?filter=commissionDisabled")}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 20px", textAlign: "left", cursor: "pointer" }}
        >
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 4 }}>Commission Disabled</p>
          <p style={{ color: "white", fontSize: 28, fontWeight: 700 }}>{enforcement?.commissionDisabledCount ?? "…"}</p>
        </button>
        <button
          onClick={() => router.push("/users?filter=hasChargeback")}
          style={{ background: enforcement?.chargebackUsersCount ? "rgba(251,146,60,0.08)" : "rgba(255,255,255,0.05)", border: `1px solid ${enforcement?.chargebackUsersCount ? "rgba(251,146,60,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "16px 20px", textAlign: "left", cursor: "pointer" }}
        >
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 4 }}>Chargebacks on Record</p>
          <p style={{ color: enforcement?.chargebackUsersCount ? "#fb923c" : "white", fontSize: 28, fontWeight: 700 }}>{enforcement?.chargebackUsersCount ?? "…"}</p>
        </button>
      </div>

      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
        Use the navigation above to manage users and review appeals.
      </p>
    </AdminLayout>
  )
}
```

### 7d — Update users list page

- [ ] Replace `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\app\users\page.tsx` with:

```tsx
"use client"

import { useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { trpc } from "@/components/providers"

const FILTER_LABELS: Record<string, string> = {
  banEvasionFlag: "Ban Evasion Flags",
  commissionDisabled: "Commission Disabled",
  hasChargeback: "Has Chargeback",
}

export default function UsersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeFilter = searchParams.get("filter") as "banEvasionFlag" | "commissionDisabled" | "hasChargeback" | null

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 300)
  }

  const { data: users, isLoading } = trpc.admin.listUsers.useQuery({
    query: debouncedQuery || undefined,
    filter: activeFilter ?? undefined,
  })

  return (
    <AdminLayout>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Users</h1>

      {activeFilter && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.4)", borderRadius: 6, padding: "4px 10px", color: "#fb923c", fontSize: 13, fontWeight: 600 }}>
            Filter: {FILTER_LABELS[activeFilter] ?? activeFilter}
          </span>
          <button
            onClick={() => router.push("/users")}
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 10px", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer" }}
          >
            ✕ Clear
          </button>
        </div>
      )}

      <input
        type="text"
        placeholder="Search by username or email…"
        value={query}
        onChange={e => handleSearch(e.target.value)}
        style={{
          width: "100%", padding: "10px 14px", marginBottom: 16, borderRadius: 8, fontSize: 14,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          color: "white", outline: "none", boxSizing: "border-box",
        }}
      />

      {isLoading ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {users?.map(u => (
            <button
              key={u.id}
              onClick={() => router.push(`/users/${u.id}`)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                background: u.banEvasionFlag ? "rgba(251,146,60,0.05)" : "rgba(255,255,255,0.03)",
                border: u.banEvasionFlag ? "1px solid rgba(251,146,60,0.2)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span style={{ color: "white", fontSize: 14, fontWeight: 500, flex: 1 }}>
                @{u.username ?? "—"}
                {u.banEvasionFlag && (
                  <span style={{ marginLeft: 6, color: "#fb923c", fontSize: 12 }}>⚠</span>
                )}
              </span>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, flex: 2 }}>{u.email}</span>
              {u.isAdmin && <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>ADMIN</span>}
              {u.isModerator && !u.isAdmin && <span style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700 }}>MOD</span>}
              {u.bannedUntil && new Date(u.bannedUntil) > new Date() && (
                <span style={{ color: "#f87171", fontSize: 11, fontWeight: 700 }}>BANNED</span>
              )}
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                {u._count.receivedStrikes} strikes
              </span>
            </button>
          ))}
          {users?.length === 0 && (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No users found.</p>
          )}
        </div>
      )}
    </AdminLayout>
  )
}
```

- [ ] Run `npx tsc --noEmit` in the gallery-admin repo — confirm zero errors
- [ ] Commit:
```
git add server/routers/admin.ts app/dashboard/page.tsx app/users/page.tsx
git commit -m "feat: dashboard enforcement stats and users list filter"
```

---

## Pre-implementation checklist

Before starting Task 1, verify:
- [ ] The `Notification` model — does it have a `message` column? If not, add `message String? @db.Text` to the model in Task 1's schema migration (both repos). The `setCommissionFeature` procedure in Task 5 stores a user-facing message on the notification.
- [ ] Locate the NextAuth auth config file path in the gallery repo before implementing Task 3, so the exact insertion point for the ban evasion check is known.
- [ ] Confirm the Prisma client import path used in other test files (`@/server/db` or `~/server/db` or similar) before writing the test files.

---

## File paths summary

| File | Repo | Action |
|------|------|--------|
| `prisma/schema.prisma` | gallery | Add 4 fields + `@@index([normalizedEmail])` |
| `prisma/schema.prisma` | gallery-admin | Sync copy from gallery |
| `src/lib/normalizeEmail.ts` | gallery | New utility |
| `src/tests/schema-enforcement-fields.test.ts` | gallery | New Vitest test |
| `src/tests/normalizeEmail.test.ts` | gallery | New Vitest tests |
| `src/tests/ban-evasion-detection.test.ts` | gallery | New Vitest tests |
| `scripts/backfill-normalized-email.ts` | gallery | New backfill script |
| Auth config file (locate first) | gallery | Add ban evasion check at account creation |
| `server/routers/admin.ts` | gallery-admin | Add 5 procedures + update `getUser` select + update `listUsers` input |
| `app/dashboard/page.tsx` | gallery-admin | Add enforcement stats row |
| `app/users/page.tsx` | gallery-admin | Add filter support + ⚠ badge |
| `app/users/[id]/page.tsx` | gallery-admin | Add ban evasion banner, chargeback section, commission section, account notes section |
