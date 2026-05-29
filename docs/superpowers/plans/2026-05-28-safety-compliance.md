# Safety & Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three safety/compliance features: email notification when a post is flagged for review, age gate (13+) at signup with required date of birth, and an ad-targeting opt-out toggle in Settings.

**Architecture:** Schema migration adds `dateOfBirth DateTime?` and `adTargetingOptOut Boolean` to User. The flagged email wires into the existing `report` procedure in `post.ts` — after the PENDING_REVIEW transition, fire `sendPostFlaggedEmail` (added to `lib/email.ts`). The age gate lives in the signup API route (`app/api/auth/signup/route.ts`) with a shared `isAtLeast13` helper in `lib/age.ts`. The ad targeting toggle follows the exact pattern of `updateShowRealName` in `user.ts` and the commission toggle in `settings/page.tsx`.

**Tech Stack:** Next.js App Router, tRPC v11, Prisma (PostgreSQL), Resend (email), Vitest

---

## File Map

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `dateOfBirth DateTime?` + `adTargetingOptOut Boolean @default(false)` to User |
| `lib/age.ts` | New — `isAtLeast13(dateStr: string): boolean` helper |
| `lib/email.ts` | Add `sendPostFlaggedEmail` |
| `server/routers/post.ts` | Extend initial `post` select to include `user.email`/`username`; call `sendPostFlaggedEmail` after PENDING_REVIEW transition |
| `app/api/auth/signup/route.ts` | Accept + validate `dateOfBirth`; save to DB |
| `app/(auth)/signup/page.tsx` | Add DOB date input to form; client-side 13+ validation |
| `server/routers/user.ts` | Add `updateAdTargetingOptOut` mutation |
| `app/settings/page.tsx` | Add ad-targeting opt-out toggle to account tab |
| `docs/roadmap.md` | Mark the three items complete |

---

### Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to User model**

Open `prisma/schema.prisma`. Find the User model. After the `showRealName` line, add:

```prisma
  dateOfBirth               DateTime?
  adTargetingOptOut         Boolean          @default(false)
```

The block after your edit should look like:

```prisma
  showRealName              Boolean          @default(false)
  dateOfBirth               DateTime?
  adTargetingOptOut         Boolean          @default(false)
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name compliance-fields
```

Expected output: `The following migration(s) have been applied: …compliance-fields`

- [ ] **Step 3: Verify TypeScript picks up the new fields**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add dateOfBirth and adTargetingOptOut to User schema"
```

---

### Task 2: Age Validation Helper

**Files:**
- Create: `lib/age.ts`
- Create: `tests/age-validation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/age-validation.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { isAtLeast13 } from "@/lib/age"

describe("isAtLeast13", () => {
  it("accepts someone born exactly 13 years ago today", () => {
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 13)
    expect(isAtLeast13(dob.toISOString().split("T")[0])).toBe(true)
  })

  it("accepts someone born 20 years ago", () => {
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 20)
    expect(isAtLeast13(dob.toISOString().split("T")[0])).toBe(true)
  })

  it("rejects someone who will turn 13 tomorrow", () => {
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 13)
    dob.setDate(dob.getDate() + 1) // one day short
    expect(isAtLeast13(dob.toISOString().split("T")[0])).toBe(false)
  })

  it("rejects someone born 5 years ago", () => {
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 5)
    expect(isAtLeast13(dob.toISOString().split("T")[0])).toBe(false)
  })

  it("rejects an invalid date string", () => {
    expect(isAtLeast13("not-a-date")).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/age-validation.test.ts
```

Expected: FAIL — `isAtLeast13` not found.

- [ ] **Step 3: Implement the helper**

Create `lib/age.ts`:

```ts
/**
 * Returns true if the given ISO date string (YYYY-MM-DD) represents
 * a person who is at least 13 years old today.
 */
export function isAtLeast13(dateStr: string): boolean {
  const dob = new Date(dateStr)
  if (isNaN(dob.getTime())) return false
  const threshold = new Date()
  threshold.setFullYear(threshold.getFullYear() - 13)
  return dob <= threshold
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run tests/age-validation.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/age.ts tests/age-validation.test.ts
git commit -m "feat: add isAtLeast13 age validation helper"
```

---

### Task 3: Age Gate in Signup API Route

**Files:**
- Modify: `app/api/auth/signup/route.ts`

The current route is at `app/api/auth/signup/route.ts`. It accepts `{ name, email, username, password }` and calls `prisma.user.create`. We add `dateOfBirth` validation and saving.

- [ ] **Step 1: Add dateOfBirth to the route**

Open `app/api/auth/signup/route.ts`. Replace the entire file with:

```ts
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { runBanEvasionCheck } from "@/lib/auth"
import { isAtLeast13 } from "@/lib/age"

export async function POST(req: Request) {
  try {
    const { name, email, username, password, dateOfBirth } = await req.json()

    if (!name || !email || !username || !password || !dateOfBirth) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username) || username.length < 3 || username.length > 30) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 })
    }

    if (!isAtLeast13(dateOfBirth)) {
      return NextResponse.json({ error: "You must be at least 13 years old to create an account." }, { status: 400 })
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } })
    if (existingEmail) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 })
    }

    const existingUsername = await prisma.user.findUnique({ where: { username } })
    if (existingUsername) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        username,
        password: hashedPassword,
        dateOfBirth: new Date(dateOfBirth),
      },
    })

    if (newUser.email) {
      await runBanEvasionCheck(newUser.id, newUser.email)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/signup/route.ts
git commit -m "feat: require dateOfBirth (13+) in signup API route"
```

---

### Task 4: Age Gate in Signup UI

**Files:**
- Modify: `app/(auth)/signup/page.tsx`

The form currently has `{ name, email, username, password }` and sends them to `/api/auth/signup`. We add a required date-of-birth field and a client-side 13+ check.

- [ ] **Step 1: Add dateOfBirth to form state and submit**

Open `app/(auth)/signup/page.tsx`. Make these changes:

**a)** Change the form state (line ~86):
```ts
const [form, setForm] = useState({ name: "", email: "", username: "", password: "", dateOfBirth: "" })
```

**b)** Add client-side age validation inside `handleSubmit`, after the `usernameAvailable` check (after line ~112):
```ts
if (!form.dateOfBirth) { setError("Date of birth is required"); return }
if (!isAtLeast13(form.dateOfBirth)) { setError("You must be at least 13 years old to create an account."); return }
```

**c)** Add the import at the top of the file (after the existing imports):
```ts
import { isAtLeast13 } from "@/lib/age"
```

**d)** Include `dateOfBirth` in the fetch body (replace the `body: JSON.stringify(form)` call — `form` already contains it, so no change needed there since we're spreading the whole form object).

**e)** Update the `disabled` condition on the submit button (line ~256):
```ts
disabled={loading || !form.name || !form.email || !form.password || !form.dateOfBirth || !agreed}
```

- [ ] **Step 2: Add the date of birth input to the form JSX**

In the JSX, add this input between the password input and the Terms section (after the closing `</input>` for password, before `{/* Terms */}`):

```tsx
<div>
  <label className="block text-xs text-white/40 mb-1 pl-1">Date of birth</label>
  <input
    type="date"
    value={form.dateOfBirth}
    onChange={set("dateOfBirth")}
    max={new Date().toISOString().split("T")[0]}
    required
    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500 transition"
    style={{ background: "#ffffff12", border: "1px solid #ffffff18", colorScheme: "dark" }}
  />
</div>
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual test**

```bash
npm run dev
```

1. Go to `http://localhost:3000/signup`
2. Fill all fields. Set DOB to a date that makes you 12 — submit should show "You must be at least 13"
3. Set DOB to a date that makes you 13+ — form should submit successfully

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/signup/page.tsx
git commit -m "feat: add required date of birth field to signup with 13+ gate"
```

---

### Task 5: sendPostFlaggedEmail

**Files:**
- Modify: `lib/email.ts`

- [ ] **Step 1: Add the email function**

Open `lib/email.ts`. Append this function at the end of the file (after `sendPasswordResetEmail`):

```ts
export async function sendPostFlaggedEmail(to: string, opts: { username: string }) {
  await send(to, "One of your posts has been flagged for review", layout(
    "Post Flagged for Review",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Your post has been flagged</h1>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.username}, one of your posts has received enough community reports to be placed under review. It remains visible on your profile while our team reviews it.</p>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">If the review is not resolved within 14 days, the post will be automatically removed. If it is removed and you believe this was a mistake, you can appeal.</p>
     <a href="${GALLERY_URL}/appeal" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">Learn about appeals</a>`
  ))
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat: add sendPostFlaggedEmail to lib/email.ts"
```

---

### Task 6: Wire Flagged Email into Post Router

**Files:**
- Modify: `server/routers/post.ts`

The `report` procedure (around line 214) fetches the post with:
```ts
select: { id: true, userId: true, status: true, reportCount: true }
```

It then transitions to `PENDING_REVIEW` when `reportCount >= 3` but sends no email. We extend the select to include the owner's email and username, then fire the email after the transaction.

- [ ] **Step 1: Add the import**

At the top of `server/routers/post.ts`, add `sendPostFlaggedEmail` to the email import. Find the existing email import line (e.g. `import { sendPostAutoRemovedEmail } from "@/lib/email"`) and update it:

```ts
import { sendPostAutoRemovedEmail, sendPostFlaggedEmail } from "@/lib/email"
```

- [ ] **Step 2: Extend the post select in the report procedure**

In the `report` procedure, find this select (line ~224-227):
```ts
const post = await ctx.prisma.post.findUnique({
  where: { id: input.postId },
  select: { id: true, userId: true, status: true, reportCount: true },
})
```

Replace with:
```ts
const post = await ctx.prisma.post.findUnique({
  where: { id: input.postId },
  select: {
    id: true,
    userId: true,
    status: true,
    reportCount: true,
    user: { select: { email: true, username: true } },
  },
})
```

- [ ] **Step 3: Fire the email after the PENDING_REVIEW transition**

Find the closing of the `if (updated.reportCount >= 3 && updated.status === "PUBLISHED")` block (line ~278). After the closing `}` of that block, and before `return { success: true }`, add:

```ts
      // Send flagged email after transaction commits
      if (updated.reportCount >= 3 && updated.status === "PUBLISHED" && post.user.email) {
        void sendPostFlaggedEmail(post.user.email, {
          username: post.user.username ?? "there",
        })
      }
```

The section should now look like:

```ts
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
          await tx.notification.create({
            data: {
              userId: post.userId,
              fromUserId: null,
              type: "post_pending_review",
            },
          })
        })
      }

      // Send flagged email after transaction commits
      if (updated.reportCount >= 3 && updated.status === "PUBLISHED" && post.user.email) {
        void sendPostFlaggedEmail(post.user.email, {
          username: post.user.username ?? "there",
        })
      }

      return { success: true }
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/routers/post.ts
git commit -m "feat: send email to post owner when post is flagged for review"
```

---

### Task 7: Ad Targeting Opt-Out tRPC Mutation

**Files:**
- Modify: `server/routers/user.ts`

Add `updateAdTargetingOptOut` following the exact pattern of `updateShowRealName` (line ~237).

- [ ] **Step 1: Add the mutation**

Open `server/routers/user.ts`. Find the `updateShowRealName` mutation. After its closing `}),`, add:

```ts
  updateAdTargetingOptOut: protectedProcedure
    .input(z.object({ optOut: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { adTargetingOptOut: input.optOut },
        select: { id: true, adTargetingOptOut: true },
      })
    }),
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/routers/user.ts
git commit -m "feat: add updateAdTargetingOptOut tRPC mutation"
```

---

### Task 8: Ad Targeting Opt-Out UI in Settings

**Files:**
- Modify: `app/settings/page.tsx`

Add a toggle to the account tab using the same pattern as the commission toggle (around line 362). The settings page uses light theme (`bg-white rounded-2xl border border-gray-200 p-5`).

- [ ] **Step 1: Add the mutation and state**

In `app/settings/page.tsx`, find the existing mutations near the top of the component (around line 65–100). Add:

```ts
const updateAdTargeting = trpc.user.updateAdTargetingOptOut.useMutation()
```

Also add a local state initialised from `user`:

```ts
const [adTargetingOptOut, setAdTargetingOptOut] = useState(user?.adTargetingOptOut ?? false)
```

Add a `useEffect` to sync it when `user` loads (find the existing pattern for `showRealName` and follow it):

```ts
useEffect(() => {
  if (user) setAdTargetingOptOut(user.adTargetingOptOut)
}, [user])
```

- [ ] **Step 2: Check that user.me returns adTargetingOptOut**

In `server/routers/user.ts`, find the `me` procedure and check its `select`. If it doesn't already include `adTargetingOptOut`, add it:

```ts
adTargetingOptOut: true,
```

- [ ] **Step 3: Add the toggle card to the account tab**

In `app/settings/page.tsx`, in the account tab section, find the commission toggle card. After it, add:

```tsx
{/* Ad targeting opt-out */}
<div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
  <div>
    <div className="text-sm font-medium text-gray-900">Opt out of location-based ad targeting</div>
    <div className="text-xs text-gray-500 mt-0.5">
      When on, your location will not be used to personalise ads shown to you.
    </div>
  </div>
  <button
    onClick={() => {
      const next = !adTargetingOptOut
      setAdTargetingOptOut(next)
      updateAdTargeting.mutate({ optOut: next })
    }}
    disabled={updateAdTargeting.isPending}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
      adTargetingOptOut ? "bg-blue-600" : "bg-gray-200"
    }`}
    role="switch"
    aria-checked={adTargetingOptOut}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${adTargetingOptOut ? "translate-x-6" : "translate-x-1"}`} />
  </button>
</div>
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual test**

```bash
npm run dev
```

1. Go to `http://localhost:3000/settings` → Account tab
2. Find "Opt out of location-based ad targeting"
3. Toggle it on — check the DB: `SELECT "adTargetingOptOut" FROM "User" WHERE username = 'youruser'`
4. Toggle it off — verify it reverts

- [ ] **Step 6: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat: add ad targeting opt-out toggle to settings"
```

---

### Task 9: Roadmap Update

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Mark items complete**

In `docs/roadmap.md`, under Tier 1 Safety & Compliance, change:

```md
- [ ] Email notification on content flagged/removed
```
to:
```md
- [x] Email notification on content flagged/removed
```

And:
```md
- [ ] Age gate — 13+ at signup, EU under-16 requires parental consent
```
to:
```md
- [x] Age gate — 13+ at signup (US; EU under-16 parental consent deferred)
```

And:
```md
- [ ] "Opt out of location-based ad targeting" toggle in Settings
```
to:
```md
- [x] "Opt out of location-based ad targeting" toggle in Settings
```

- [ ] **Step 2: Commit**

```bash
git add docs/roadmap.md
git commit -m "chore: mark safety compliance items complete in roadmap"
```
