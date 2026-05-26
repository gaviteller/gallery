# Notifications System Overhaul — Design Spec
**Date:** 2026-05-25
**Status:** Draft

---

## Overview

The Gallery notification system currently supports user-to-user notifications (follows, DMs, commissions). Admin-side actions create notification rows but the gallery UI never renders them, and several admin actions create no rows at all. This overhaul:

1. Makes `fromUserId` nullable so system/admin notices require no sender identity.
2. Adds a `message` field to store free-form text for admin notices and system events.
3. Fixes which admin actions trigger notifications and which do not.
4. Adds a rendered UI path in `components/BottomNav.tsx` for system notifications.
5. Adds individual and mass notice-sending capabilities to the admin panel.

No existing notification rows are affected. No data loss occurs. All schema changes are additive or safely nullable.

---

## 1. Schema Changes

**File:** `gallery/prisma/schema.prisma`

```prisma
model Notification {
  id         String    @id @default(cuid())
  userId     String
  fromUserId String?                         // nullable — null for system/admin notices
  type       String
  message    String?                         // stores text for system notices and admin messages
  read       Boolean   @default(false)
  createdAt  DateTime  @default(now())
  user       User      @relation("ReceivedNotifications", fields: [userId], references: [id], onDelete: Cascade)
  fromUser   User?     @relation("SentNotifications", fields: [fromUserId], references: [id], onDelete: Cascade)
}
```

**Changes from current schema:**
- `fromUserId String` → `fromUserId String?` (nullable)
- `fromUser User` → `fromUser User?` (optional relation)
- Added `message String?` (nullable, new column)

**Migration safety:** Making a required field nullable is a non-destructive migration. All existing rows retain their `fromUserId` values. The new `message` column defaults to `null` for all existing rows. No data loss.

---

## 2. Automatic Notifications

These are triggered by admin actions in `gallery-admin`. All system notifications use `fromUserId: null` and display as sent by "Gallery" in the UI.

### Notification event table

| Admin Event | Procedure | Notify? | type string | message |
|---|---|---|---|---|
| Strike issued | `issueStrike` | NO | — | Silent — no row created |
| Ban issued | `issueBan` | YES | `"ban"` | `"Your account has been suspended. [duration/reason]"` |
| Ban lifted | `liftBan` | YES | `"lift_ban"` | `"Your account suspension has been lifted."` |
| Post deleted by admin | `deletePost` | YES | `"post_deleted"` | `"A post on your account was removed for violating Gallery's Terms of Service."` |
| Appeal approved | `approveAppeal` | YES | `"appeal_approved"` | `"Your appeal has been approved. The action has been reversed."` |
| Appeal denied | `denyAppeal` | YES | `"appeal_denied"` | `"Your appeal has been reviewed and denied."` |
| Strike reversed | `reverseStrike` | YES | `"strike_reversed"` | `"A moderation action on your account has been reversed."` |

### Notification row shape for all automatic notifications

```ts
{
  userId:     <target user id>,
  fromUserId: null,
  type:       <type string from table above>,
  message:    <message string from table above>,
  read:       false,
}
```

### Ban message construction (`issueBan`)

The `message` field should be built from the ban's `duration` and `reason` fields:

```ts
const parts = ["Your account has been suspended."];
if (duration) parts.push(`Duration: ${duration}.`);
if (reason)   parts.push(`Reason: ${reason}.`);
const message = parts.join(" ");
```

---

## 3. Gallery UI — Notification Panel

**File:** `gallery/components/BottomNav.tsx`

### System notification detection

A notification is a system/admin notice when `fromUserId` is `null`. The current UI assumes a `fromUser` is always present; this assumption must be relaxed.

### Rendering system notifications

When `notification.fromUserId === null`:

- **Avatar:** Render a "Gallery" avatar — a shield icon or a monogram "G" in a neutral badge style. Do not attempt to load a user avatar.
- **Sender label:** Display `"Gallery"` as the sender name in place of a username.
- **Body text:** Render `notification.message` directly as the notification text.
- **Click behavior:** Mark the notification as read. Do not navigate anywhere (no link). System notices have no associated page to navigate to.

### New type strings to handle

Add rendering support for the following `type` values (alongside existing types):

| type | Display text (fallback if no `message`) |
|---|---|
| `"ban"` | "Your account has been suspended." |
| `"lift_ban"` | "Your account suspension has been lifted." |
| `"post_deleted"` | "A post was removed from your account." |
| `"appeal_approved"` | "Your appeal has been approved." |
| `"appeal_denied"` | "Your appeal has been denied." |
| `"strike_reversed"` | "A moderation action has been reversed." |
| `"site_notice"` | *(always use `message` field — no fallback copy)* |

When `notification.message` is present, always prefer it over the fallback display text. Fallback copy is only used for legacy rows that lack a `message` value.

### Existing types — no changes

The following types are unchanged: `follow`, `dm`, `commission_request`, `commission_accepted`, `commission_declined`, `commission_delivered`, `commission_complete`.

---

## 4. Admin Panel — Individual Notice

**Repo:** `gallery-admin`

### New tRPC procedure

**File:** `gallery-admin/server/routers/adminRouter.ts` (or wherever `adminRouter` is defined)

```ts
sendNotice: modProcedure
  .input(z.object({
    userId:  z.string(),
    message: z.string().min(1).max(1000),
  }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.notification.create({
      data: {
        userId:     input.userId,
        fromUserId: null,
        type:       "site_notice",
        message:    input.message,
      },
    });
    return { success: true };
  }),
```

- Guarded by `modProcedure` (accessible to mods and admins).
- Creates one `Notification` row with `type: "site_notice"`, `fromUserId: null`, and the provided `message`.

### UI — "Send Notice" section on user detail page

**File:** `gallery-admin/app/users/[id]/page.tsx`

Add a "Send Notice" section below the existing moderation actions. It contains:

1. **Template picker (dropdown)** — `<select>` with the following options:

   | Label | Value / message text |
   |---|---|
   | Account Warning | `"Your account has received a warning from Gallery. Please review our Terms of Service."` |
   | Terms Reminder | `"Reminder: Gallery's Terms of Service require all content to meet our community standards."` |
   | Account Review | `"Your account is currently under review. You may continue using Gallery normally while this is in progress."` |
   | Good Standing | `"Your account has been reviewed and is in good standing. Thank you for being part of the Gallery community."` |
   | Custom | *(free-form textarea — user types their own message)* |

2. **Message textarea** — pre-filled with the selected template text; editable when "Custom" is selected (or always editable).

3. **Send button** — calls `api.admin.sendNotice.mutate({ userId, message })`.

4. **Confirmation state** — on success, show `"Notice sent"` inline next to the button (no page reload). On error, show an error message inline.

---

## 5. Admin Panel — Mass Notice

**Repo:** `gallery-admin`

### New tRPC procedure

**File:** `gallery-admin/server/routers/adminRouter.ts`

```ts
sendMassNotice: adminProcedure
  .input(z.object({
    message: z.string().min(1).max(1000),
  }))
  .mutation(async ({ ctx, input }) => {
    const activeUsers = await ctx.db.user.findMany({
      where: { banned: false },
      select: { id: true },
    });
    await ctx.db.notification.createMany({
      data: activeUsers.map((u) => ({
        userId:     u.id,
        fromUserId: null,
        type:       "site_notice",
        message:    input.message,
      })),
    });
    return { count: activeUsers.length };
  }),
```

- Guarded by `adminProcedure` (admin role only — mods cannot send mass notices).
- Targets all users where `banned: false`.
- Uses `createMany` for efficiency.
- Returns `{ count }` so the UI can confirm how many users were notified.

### New page

**File:** `gallery-admin/app/notices/page.tsx`

Contents:

1. **Textarea** — for composing the notice message.
2. **User count display** — shows current count of active (non-banned) users, loaded on mount via a `getActiveUserCount` query or derived from the mutation response.
3. **Send to All button** — triggers a confirmation dialog before submitting.
4. **Confirmation dialog** — displays: `"This will send a notice to N users. Are you sure?"` with Confirm and Cancel actions.
5. **On confirm** — calls `api.admin.sendMassNotice.mutate({ message })`.
6. **Success state** — shows `"Notice sent to N users."` after the mutation resolves.

### Navigation

**File:** `gallery-admin/components/AdminLayout.tsx` (or wherever the admin nav is defined)

Add a "Notices" nav link pointing to `/notices`. Insert it between the existing "Posts" and "Appeals" nav items.

---

## 6. Changes to gallery-admin Admin Router

**File:** `gallery-admin/server/routers/adminRouter.ts`

Summary of changes to existing procedures:

### `issueStrike`
- **Remove** the existing notification creation entirely. Strikes are silent — no notification row is created.

### `issueBan`
- **Change** `fromUserId` from mod's id to `null`.
- **Add** `type: "ban"`.
- **Add** `message` constructed from ban duration and reason (see Section 2).

### `liftBan`
- **Add** notification creation:
  ```ts
  await ctx.db.notification.create({
    data: { userId: targetUserId, fromUserId: null, type: "lift_ban", message: "Your account suspension has been lifted." },
  });
  ```

### `deletePost`
- **Add** notification creation:
  ```ts
  await ctx.db.notification.create({
    data: { userId: post.userId, fromUserId: null, type: "post_deleted", message: "A post on your account was removed for violating Gallery's Terms of Service." },
  });
  ```

### `approveAppeal`
- **Change** `fromUserId` from mod's id to `null`.
- **Add** `message: "Your appeal has been approved. The action has been reversed."`.
- Keep `type: "appeal_approved"` unchanged.

### `denyAppeal`
- **Change** `fromUserId` from mod's id to `null`.
- **Add** `message: "Your appeal has been reviewed and denied."`.
- Keep `type: "appeal_denied"` unchanged.

### `reverseStrike`
- **Add** notification creation:
  ```ts
  await ctx.db.notification.create({
    data: { userId: targetUserId, fromUserId: null, type: "strike_reversed", message: "A moderation action on your account has been reversed." },
  });
  ```

---

## 7. What Does NOT Change

- The existing notification types `follow`, `dm`, `commission_request`, `commission_accepted`, `commission_declined`, `commission_delivered`, `commission_complete` are untouched in schema, backend, and UI.
- The `userId` field remains required — every notification must have a target user.
- The `read` field and read/unread logic are unchanged.
- The notification bell badge count and unread logic in `components/BottomNav.tsx` require no changes — they operate on `read: false` regardless of type.
- User-to-user notifications continue to set `fromUserId` to the acting user's id as before.
- No changes to `gallery-admin` auth, session, or role logic beyond using the existing `modProcedure` and `adminProcedure` guards.
- No changes to the gallery tRPC notification router — new notification rows are created server-side by admin actions, not by the user-facing app.
