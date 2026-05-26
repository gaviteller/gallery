# Account Enforcement System — Design Spec

**Date:** 2026-05-25
**Repos affected:** `gallery`, `gallery-admin`
**Status:** Design

---

## Overview

This spec covers four enforcement subsystems: chargeback handling, commission feature control, ban evasion detection, and admin dashboard enforcement stats. All subsystems operate on the shared Prisma database accessed by both the `gallery` Next.js app and the `gallery-admin` panel.

---

## Subsystem A: Chargeback Enforcement

### Purpose

Handle Stripe chargeback events (manual flow for now, webhook-ready later) per ToS §6.5. A chargeback triggers immediate suspension pending investigation. Outcome is either a permanent ban (fraudulent) or suspension lift with an account note (legitimate).

### Schema Additions

Add to `User` model in `prisma/schema.prisma`:

```prisma
chargebackCount  Int     @default(0)
accountNotes     String? @db.Text
```

`chargebackCount` is a lifetime total. `accountNotes` is internal-only admin text, never surfaced to the user.

### tRPC Procedures

Both procedures live in the `adminRouter` in `gallery-admin`.

**`updateAccountNotes`**

- Auth: `adminProcedure`
- Input: `{ userId: string, notes: string }`
- Action: `prisma.user.update({ where: { id: userId }, data: { accountNotes: notes } })`

**`logChargeback`**

- Auth: `adminProcedure`
- Input: `{ userId: string, suspend: boolean }`
- Action:
  1. `prisma.user.update({ where: { id: userId }, data: { chargebackCount: { increment: 1 } } })`
  2. If `suspend === true`: call the existing `issueBan` logic with `duration: "30d"` and `reason: "Chargeback under investigation"`

### gallery-admin UI (user detail page)

- **Account Notes section:** textarea bound to `accountNotes`. "Save Notes" button calls `updateAccountNotes`. Not shown to the user anywhere in the gallery app.
- **Log Chargeback button:** opens a confirmation dialog with a "Suspend immediately" checkbox. Confirms before calling `logChargeback`.
- **Chargeback count badge:** if `chargebackCount > 0`, render a prominent warning line: `⚠ {chargebackCount} chargeback(s) on record`.

### Investigation Outcome

After logging and investigating outside the system:

- **Fraudulent confirmed:** admin uses the existing `issueBan` UI with `permanent` duration and a reason such as `"Chargeback fraud confirmed"`.
- **Legitimate (stolen card/genuine fraud):** admin uses the existing lift-suspension flow, then manually adds an account note explaining the outcome.

No new procedures are required for these outcomes; they use existing ban/unban infrastructure.

---

## Subsystem B: Commission Feature Override

### Purpose

Give moderators and admins direct control over `commissionFeatureDisabled` per ToS §4.5. The gallery app already checks this flag; the admin panel currently has no UI for it.

### Schema

No additions. The `commissionFeatureDisabled Boolean @default(false)` field already exists on `User`.

### tRPC Procedure

Lives in the `adminRouter` in `gallery-admin`.

**`setCommissionFeature`**

- Auth: `modProcedure`
- Input: `{ userId: string, disabled: boolean, reason?: string }`
- Action:
  1. `prisma.user.update({ where: { id: userId }, data: { commissionFeatureDisabled: disabled } })`
  2. If `disabled === true`: create a notification for the user — `"Your commission feature has been disabled: {reason}"`. If `reason` is omitted, use `"Admin override"`.
  3. If `disabled === false`: create a notification for the user — `"Your commission feature has been re-enabled."`
- Notification delivery uses the existing notification creation path in the gallery app.

### gallery-admin UI (user detail page)

- **Commission status line:**
  - Enabled: `Commission feature: ✅ Enabled` + "Disable Commissions" button
  - Disabled: `Commission feature: ❌ Disabled` + "Re-enable Commissions" button
- **Disable flow:** clicking "Disable Commissions" opens an inline form with a reason text input (placeholder: e.g. `"Exceeded cancellation threshold"`, `"Fraud investigation"`, `"Admin override"`). Confirming calls `setCommissionFeature({ userId, disabled: true, reason })`.
- **Re-enable flow:** clicking "Re-enable Commissions" shows a confirmation prompt, then calls `setCommissionFeature({ userId, disabled: false })`.

---

## Subsystem C: Ban Evasion Detection

### Purpose

Enforce ToS §2.3 and §2.6. Strike history is permanently tied to a normalized email. New accounts sharing a normalized email with a previously banned account are flagged automatically for admin review.

### Email Normalization

```typescript
// gallery/src/lib/normalizeEmail.ts
export function normalizeEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split("@");
  const normalizedLocal = local.split("+")[0].replace(/\./g, "");
  return `${normalizedLocal}@${domain}`;
}
```

This collapses `+` aliases and dots in the local part (e.g. `user+alt@gmail.com` and `u.s.e.r@gmail.com` both normalize to `user@gmail.com`).

### Schema Additions

Add to `User` model in `prisma/schema.prisma`:

```prisma
normalizedEmail  String?  @index
banEvasionFlag   Boolean  @default(false)
```

`normalizedEmail` is indexed for fast lookups. It is populated at account creation and on any email change.

### Detection Logic at Account Creation

In `gallery`, inside the account creation flow (auth callback or `server/routers/user.ts`):

1. Compute `normalizedEmail` for the new user.
2. Store it on the new `User` record.
3. Query: `prisma.user.findMany({ where: { normalizedEmail, bannedUntil: { not: null } } })`
   - Also check for `banReason` containing `"permanent"` or a dedicated `isPermanentlyBanned` flag if one exists.
4. If any matching banned accounts are found: `prisma.user.update({ where: { id: newUserId }, data: { banEvasionFlag: true } })`

### Strike Carry-Over

When a new account is flagged (`banEvasionFlag: true`), the strikes from the prior banned account are not automatically copied. The admin confirms or dismisses the flag; confirmed evasion issues a fresh permanent ban on the new account. The prior account's history remains on that account and is visible to admins via the user search.

### tRPC Procedures

Both procedures live in the `adminRouter` in `gallery-admin`.

**`confirmBanEvasion`**

- Auth: `adminProcedure`
- Input: `{ userId: string }`
- Action:
  1. Look up the user's `normalizedEmail`.
  2. Find all accounts with the same `normalizedEmail`: `prisma.user.findMany({ where: { normalizedEmail } })`.
  3. For each account (including the target): issue a permanent ban using the existing `issueBan` logic with reason `"Ban evasion confirmed (ToS §2.3)"`.
  4. `prisma.user.update({ where: { id: userId }, data: { banEvasionFlag: false } })` (flag cleared after banning).

**`dismissBanEvasionFlag`**

- Auth: `modProcedure`
- Input: `{ userId: string }`
- Action: `prisma.user.update({ where: { id: userId }, data: { banEvasionFlag: false } })`

### gallery-admin UI

- **Users list:** any user with `banEvasionFlag: true` shows a `⚠` badge in the name/username column.
- **User detail page:**
  - If `banEvasionFlag === true`: render a full-width banner at the top of the page: `⚠ Possible ban evasion detected — review this account before taking other actions.`
  - Banner includes two action buttons:
    - **Confirm Evasion** — calls `confirmBanEvasion`. Requires admin role.
    - **Dismiss** — calls `dismissBanEvasionFlag`. Requires moderator or admin role.

---

## Subsystem D: Admin Dashboard Enforcement Stats

### Purpose

Surface enforcement health at a glance on the gallery-admin dashboard (`app/dashboard/page.tsx`).

### Data Queries

Add the following `prisma.user.count()` calls to the dashboard page's data fetching:

```typescript
const banEvasionCount = await prisma.user.count({
  where: { banEvasionFlag: true },
});

const commissionDisabledCount = await prisma.user.count({
  where: { commissionFeatureDisabled: true },
});

const chargebackUsersCount = await prisma.user.count({
  where: { chargebackCount: { gt: 0 } },
});
```

No new tRPC procedures are required. These queries run server-side on the dashboard page.

### Dashboard UI

Add a new "Enforcement" stats row to the dashboard alongside existing stats:

| Stat | Value | Behavior |
|---|---|---|
| Ban evasion flags | `{banEvasionCount}` | Links to `/users?filter=banEvasionFlag` |
| Commission disabled | `{commissionDisabledCount}` | Links to `/users?filter=commissionDisabled` |
| Chargebacks on record | `{chargebackUsersCount}` | Links to `/users?filter=hasChargeback` |

Clicking each stat navigates to the users list with the corresponding filter pre-applied. The users list must support `banEvasionFlag`, `commissionDisabled`, and `hasChargeback` as filter query params (added alongside this feature).

---

## Migration Summary

One Prisma migration covers all schema additions:

```sql
ALTER TABLE "User" ADD COLUMN "chargebackCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "accountNotes" TEXT;
ALTER TABLE "User" ADD COLUMN "normalizedEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "banEvasionFlag" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "User_normalizedEmail_idx" ON "User"("normalizedEmail");
```

After migration, a one-time backfill script should populate `normalizedEmail` for all existing users:

```typescript
// scripts/backfill-normalized-email.ts
import { prisma } from "../src/server/db";
import { normalizeEmail } from "../src/lib/normalizeEmail";

const users = await prisma.user.findMany({ select: { id: true, email: true } });
for (const user of users) {
  await prisma.user.update({
    where: { id: user.id },
    data: { normalizedEmail: normalizeEmail(user.email) },
  });
}
await prisma.$disconnect();
```

---

## File Paths

| File | Repo | Change |
|---|---|---|
| `prisma/schema.prisma` | gallery | Add `chargebackCount`, `accountNotes`, `normalizedEmail`, `banEvasionFlag` |
| `src/lib/normalizeEmail.ts` | gallery | New file — email normalization utility |
| `src/server/routers/user.ts` | gallery | Add ban evasion check at account creation |
| `src/server/routers/admin.ts` | gallery-admin | Add `updateAccountNotes`, `logChargeback`, `setCommissionFeature`, `confirmBanEvasion`, `dismissBanEvasionFlag` |
| `app/dashboard/page.tsx` | gallery-admin | Add enforcement stats queries and UI row |
| `app/users/page.tsx` | gallery-admin | Add filter params: `banEvasionFlag`, `commissionDisabled`, `hasChargeback` |
| `app/users/[id]/page.tsx` | gallery-admin | Add Account Notes, Log Chargeback, Commission Override, Ban Evasion banner |
| `scripts/backfill-normalized-email.ts` | gallery | One-time backfill script |

---

## ToS Cross-Reference

| Subsystem | ToS Section |
|---|---|
| Chargeback Enforcement | §6.5 |
| Commission Feature Override | §4.5 |
| Ban Evasion Detection | §2.3, §2.6 |
