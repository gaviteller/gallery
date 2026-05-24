# Gallery Admin — Standalone Site Design Spec

*Date: 2026-05-24*
*Status: Approved*

---

## Overview

The admin panel currently lives inside the gallery app at `/admin`. This spec covers extracting it into a fully separate Next.js application (`gallery-admin`) with its own deployment, its own credentials-based login, and zero visible connection to the gallery UI.

---

## Architecture

A new standalone Next.js app located at `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin`.

- **Separate repo and deployment** — its own Vercel project, its own URL (e.g. `admin.yourdomain.com`)
- **Shared database** — same `DATABASE_URL` environment variable pointing at the existing Postgres DB
- **No link from gallery** — the gallery UI has no link, button, or route that references the admin site
- **Migrations owned by gallery** — the admin app copies the Prisma schema to generate its client, but never runs `prisma migrate`. All schema changes originate from the gallery repo.

---

## Auth

Credentials-based login only — no OAuth, no magic links.

**Login page** at `/login` (the only public route). Email + password form. On success, redirects to `/dashboard`.

**Password storage:** A nullable `passwordHash String?` field is added to the `User` model in the shared Prisma schema. Regular gallery users are unaffected (field is null). Staff accounts have a bcrypt hash set via a seed script.

**Login flow:**
1. Look up user by email
2. `bcrypt.compare(submittedPassword, user.passwordHash)`
3. Check `isAdmin || isModerator`
4. If all pass: create NextAuth session
5. On any failure: return generic "Invalid credentials" (no hint about whether the email exists)

**Setup:** A one-time script `scripts/set-admin-password.ts` sets the password for a staff account:
```
npx ts-node scripts/set-admin-password.ts <email> <password>
```
The initial admin account is the `@the_rat_queen` user. Future moderators are set up the same way.

**Route protection:** `middleware.ts` redirects all unauthenticated requests to `/login`. There is no public-facing content.

---

## Pages

The admin app has no route prefix — pages live at the root:

| Route | Purpose |
|-------|---------|
| `/login` | Credentials login form |
| `/dashboard` | Pending appeal count, recent strikes, active ban count |
| `/users` | Searchable user list with strike/ban status |
| `/users/[id]` | User detail — issue strikes, issue/lift bans, mod toggle |
| `/appeals` | PENDING appeal queue |
| `/appeals/[id]` | Appeal detail — approve or deny |

---

## What Moves from Gallery

**Pages** (adapted from `app/(admin)/admin/`):
- `app/(admin)/admin/page.tsx` → `app/dashboard/page.tsx`
- `app/(admin)/admin/users/page.tsx` → `app/users/page.tsx`
- `app/(admin)/admin/users/[id]/page.tsx` → `app/users/[id]/page.tsx`
- `app/(admin)/admin/appeals/page.tsx` → `app/appeals/page.tsx`
- `app/(admin)/admin/appeals/[id]/page.tsx` → `app/appeals/[id]/page.tsx`

**Server code** (copied):
- `server/routers/admin.ts` — full admin tRPC router (all 14 procedures)
- `server/lib/strikes.ts` — `SELLING_VIOLATIONS` set + `isSellingViolation()`
- `server/lib/ban.ts` — `checkNotBanned()` utility

**Prisma schema** — copied in full so the admin app can run `prisma generate`. Migrations never run from here.

---

## What Gets Removed from Gallery

- `app/(admin)/` route group — entire folder deleted
- `admin: adminRouter` removed from `server/routers/_app.ts`
- `server/routers/admin.ts` deleted
- `modProcedure` and `adminProcedure` left in `lib/trpc.ts` — they're harmless exports and may be needed if gallery ever grows its own mod-gated endpoints

---

## What's New in the Admin App

| File | Purpose |
|------|---------|
| `app/login/page.tsx` | Email + password login form |
| `app/layout.tsx` | Clean top nav (Dashboard · Users · Appeals · Sign Out), no gallery chrome |
| `lib/auth.ts` | NextAuth with `CredentialsProvider` — bcrypt check + isAdmin/isModerator guard |
| `lib/trpc.ts` | tRPC setup with `modProcedure` and `adminProcedure` |
| `middleware.ts` | Redirects unauthenticated requests to `/login` |
| `scripts/set-admin-password.ts` | One-time CLI script to set a staff account's password |
| `prisma/schema.prisma` | Copy of gallery schema (includes new `passwordHash String?` on User) |

---

## Schema Change

One addition to the shared `User` model (added in gallery, picked up by admin app via schema copy):

```prisma
passwordHash  String?   // null for regular users; set for admin/mod accounts only
```

This migration runs from the gallery repo.

---

## Tech Stack

Same as gallery: Next.js 15 App Router, tRPC v11, Prisma, PostgreSQL, NextAuth, TypeScript, Vitest.

---

## What This Does NOT Include

- Email notifications for staff (out of scope)
- Two-factor authentication (out of scope)
- An invite/approval flow for new moderators — passwords are set manually via the seed script
- Any gallery UI components (BanBanner, appeal page, Navbar, etc.)
