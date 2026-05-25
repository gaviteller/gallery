# Username Primary Display + Real Name Privacy Toggle — Design Spec

*Date: 2026-05-24*
*Status: Approved*

---

## Overview

Username (`@handle`) becomes the primary public identity. Real name is optional and off by default — users must explicitly opt in to show it on their profile.

---

## Data Model

One new field on `User` (migration runs from gallery repo):

```prisma
showRealName  Boolean  @default(false)
```

- `false` for all existing users after migration (real name hidden by default)
- New accounts default to `false`
- The `name String?` field is unchanged — users can still store a real name, but it won't be shown unless `showRealName` is true

---

## Profile Page (`app/[username]/page.tsx`)

**Before:**
- h1: `{profileUser.name ?? profileUser.username}` (real name primary, handle as fallback)
- subtitle: `@{profileUser.username}`

**After:**
- h1: `@{profileUser.username}` (always the handle)
- subtitle: `{profileUser.name}` — shown only when `profileUser.showRealName === true` AND `profileUser.name` is non-empty
- The `@username` subtitle that previously appeared below the h1 is removed (now redundant)

The profile query adds `showRealName` to its `select`.

---

## Settings Page

An existing `name` field ("Display name") already lets users store their real name. A new toggle is added directly below it:

> **Show my real name on my profile**
> *When on, your real name appears on your public profile page.*

The toggle is only rendered when `user.name` is set and non-empty — there is no point offering the option when there is no name to display.

The toggle calls the existing user update mutation with `showRealName: boolean`. No new mutation is needed if the existing one already handles partial updates.

---

## tRPC

- `trpc.user.me` and the profile query: add `showRealName` to the `select` block
- User update mutation: accept `showRealName?: boolean` in its input schema

---

## Scope Boundary

Only the profile page headline area changes. Comments, notifications, messages, and search results already use `@username` as the primary identifier — no changes there.

---

## Migration

```prisma
// In gallery prisma/schema.prisma — User model
showRealName  Boolean  @default(false)
```

Run from gallery repo only. gallery-admin copies the schema via `prisma generate` and picks up the new field automatically.

---

## What This Does NOT Include

- Changing how names appear in comments or messages
- Removing the `name` field or the "Display name" settings input
- Any admin-side visibility of real names beyond what already exists
