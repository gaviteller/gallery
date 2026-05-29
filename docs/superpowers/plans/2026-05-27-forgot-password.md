# Forgot Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users who forgot their password reset it via a time-limited email link.

**Architecture:** New public tRPC router (`server/routers/auth.ts`) with two procedures — `forgotPassword` (send email) and `resetPassword` (consume token). Tokens are stored as sha256 hashes in the existing `VerificationToken` table (NextAuth already owns this). Two new pages: `/forgot-password` and `/reset-password`. Sign-in page link wired up and `?reset=success` banner added.

**Tech Stack:** Next.js App Router, tRPC v11, Prisma, Node.js `crypto`, bcryptjs, Resend (already set up in `lib/email.ts`)

---

## File Map

| File | Change |
|---|---|
| `server/routers/auth.ts` | Create — `forgotPassword` + `resetPassword` procedures |
| `server/routers/_app.ts` | Add `auth: authRouter` |
| `lib/email.ts` | Add `sendPasswordResetEmail` |
| `app/forgot-password/page.tsx` | Create — email form + success message |
| `app/reset-password/page.tsx` | Create — new password form |
| `app/(auth)/signin/page.tsx` | Wire "Forgot password?" link + `?reset=success` banner |

---

### Task 1: `sendPasswordResetEmail` in `lib/email.ts`

**Files:**
- Modify: `lib/email.ts`

- [ ] **Step 1: Add the function at the bottom of `lib/email.ts`**

The file already has `layout()` and `send()` helpers. Append:

```ts
export async function sendPasswordResetEmail(to: string, opts: {
  username: string
  token: string  // raw (unhashed) token
}) {
  const resetUrl = `${GALLERY_URL}/reset-password?token=${opts.token}`
  await send(to, "Reset your Gallery password", layout(
    "Reset your Gallery password",
    `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Reset your password</h1>
     <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.7);">Hi @${opts.username}, we received a request to reset your Gallery password. Click the button below to choose a new one.</p>
     <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:rgba(176,68,248,0.15);border:1px solid rgba(176,68,248,0.4);border-radius:6px;color:#b044f8;font-size:14px;font-weight:600;text-decoration:none;">Reset password</a>
     <p style="margin:24px 0 0;font-size:13px;color:rgba(255,255,255,0.4);">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>`
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
git commit -m "feat: add sendPasswordResetEmail"
```

---

### Task 2: `server/routers/auth.ts` — tRPC procedures

**Files:**
- Create: `server/routers/auth.ts`

- [ ] **Step 1: Create the file**

```ts
import { z } from "zod"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { router, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { sendPasswordResetEmail } from "@/lib/email"

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

export const authRouter = router({
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { normalizedEmail: input.email.toLowerCase().trim() },
        select: { id: true, email: true, username: true },
      })

      // Always return success — never reveal whether email is registered
      if (!user || !user.email) return { success: true }

      // Delete any existing reset token for this email
      await ctx.prisma.verificationToken.deleteMany({
        where: { identifier: user.email },
      })

      // Generate token
      const rawToken = crypto.randomBytes(32).toString("hex")
      const hashedToken = sha256(rawToken)
      const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await ctx.prisma.verificationToken.create({
        data: {
          identifier: user.email,
          token: hashedToken,
          expires,
        },
      })

      void sendPasswordResetEmail(user.email, {
        username: user.username ?? "there",
        token: rawToken,
      })

      return { success: true }
    }),

  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      password: z.string().min(8).max(128),
    }))
    .mutation(async ({ ctx, input }) => {
      const hashedToken = sha256(input.token)

      const record = await ctx.prisma.verificationToken.findUnique({
        where: { token: hashedToken },
      })

      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reset link is invalid or has expired.",
        })
      }

      if (record.expires < new Date()) {
        await ctx.prisma.verificationToken.delete({
          where: { token: hashedToken },
        })
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reset link has expired. Please request a new one.",
        })
      }

      const user = await ctx.prisma.user.findFirst({
        where: { email: record.identifier },
        select: { id: true },
      })

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reset link is invalid or has expired." })
      }

      const hashed = await bcrypt.hash(input.password, 12)

      await ctx.prisma.$transaction([
        ctx.prisma.user.update({
          where: { id: user.id },
          data: { password: hashed },
        }),
        ctx.prisma.verificationToken.delete({
          where: { token: hashedToken },
        }),
      ])

      return { success: true }
    }),
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/routers/auth.ts
git commit -m "feat: auth tRPC router — forgotPassword + resetPassword"
```

---

### Task 3: Register `authRouter` in `_app.ts`

**Files:**
- Modify: `server/routers/_app.ts`

- [ ] **Step 1: Add the import**

At the top of `server/routers/_app.ts`, after the existing imports:

```ts
import { authRouter } from "./auth"
```

- [ ] **Step 2: Add to the router object**

Inside the `router({...})` call, add:

```ts
auth: authRouter,
```

The full `appRouter` should look like:

```ts
export const appRouter = router({
  user: userRouter,
  post: postRouter,
  follow: followRouter,
  notification: notificationRouter,
  interaction: interactionRouter,
  hashtag: hashtagRouter,
  shop: shopRouter,
  commission: commissionRouter,
  commissionMessage: commissionMessageRouter,
  dm: dmRouter,
  push: pushRouter,
  story: storyRouter,
  dmca: dmcaRouter,
  auth: authRouter,
})
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/routers/_app.ts
git commit -m "feat: register authRouter in app router"
```

---

### Task 4: `/forgot-password` page

**Files:**
- Create: `app/forgot-password/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { trpc } from "@/components/providers"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  const mutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      setSubmitted(true)
      setCooldown(true)
      setTimeout(() => setCooldown(false), 60_000)
    },
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate({ email })
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 p-8" style={{ background: "#1a1a2e" }}>
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="Gallery" width={100} height={100} className="mb-3" />
          <p className="text-white/50 text-sm">Reset your password</p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-white/70 leading-relaxed">
              If that email is registered, you&apos;ll receive a reset link shortly.
            </p>
            <button
              onClick={() => { setSubmitted(false); setEmail("") }}
              disabled={cooldown}
              className="text-xs text-white/40 hover:text-white/70 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {cooldown ? "Wait 60s before requesting again" : "Send another link"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500 transition"
              style={{ background: "#ffffff12", border: "1px solid #ffffff18" }}
            />
            <button
              type="submit"
              disabled={mutation.isPending || !email}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
            >
              {mutation.isPending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 p-5 text-center" style={{ background: "#1a1a2e" }}>
        <p className="text-sm text-white/50">
          <Link href="/signin" className="font-semibold text-white hover:opacity-80 transition">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check it renders**

```bash
npm run dev
```

Visit `http://localhost:3000/forgot-password`. You should see the email form styled to match the sign-in page.

- [ ] **Step 3: Commit**

```bash
git add app/forgot-password/page.tsx
git commit -m "feat: /forgot-password page"
```

---

### Task 5: `/reset-password` page

**Files:**
- Create: `app/reset-password/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { trpc } from "@/components/providers"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [matchError, setMatchError] = useState("")

  useEffect(() => {
    if (!token) router.replace("/forgot-password")
  }, [token, router])

  const mutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      router.push("/signin?reset=success")
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setMatchError("Passwords don't match.")
      return
    }
    setMatchError("")
    mutation.mutate({ token: token!, password })
  }

  if (!token) return null

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 p-8" style={{ background: "#1a1a2e" }}>
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="Gallery" width={100} height={100} className="mb-3" />
          <p className="text-white/50 text-sm">Choose a new password</p>
        </div>

        {mutation.isSuccess ? null : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500 transition"
              style={{ background: "#ffffff12", border: "1px solid #ffffff18" }}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500 transition"
              style={{ background: "#ffffff12", border: "1px solid #ffffff18" }}
            />

            {matchError && <p className="text-sm text-red-400 text-center">{matchError}</p>}
            {mutation.isError && (
              <p className="text-sm text-red-400 text-center">
                {mutation.error.message}
              </p>
            )}

            <button
              type="submit"
              disabled={mutation.isPending || !password || !confirm}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
            >
              {mutation.isPending ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}

        {mutation.isError && (mutation.error.data?.code === "NOT_FOUND" || mutation.error.data?.code === "BAD_REQUEST") && (
          <p className="mt-4 text-center text-sm text-white/50">
            <Link href="/forgot-password" className="text-purple-400 hover:underline">
              Request a new reset link
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/reset-password/page.tsx
git commit -m "feat: /reset-password page"
```

---

### Task 6: Wire sign-in page

**Files:**
- Modify: `app/(auth)/signin/page.tsx`

- [ ] **Step 1: Wire the "Forgot password?" link**

Find this line in `app/(auth)/signin/page.tsx`:

```tsx
<a href="#" className="text-xs text-white/40 hover:text-white/70 transition">Forgot password?</a>
```

Replace with:

```tsx
<Link href="/forgot-password" className="text-xs text-white/40 hover:text-white/70 transition">Forgot password?</Link>
```

- [ ] **Step 2: Add the `Link` import if not already present**

The file already imports `Link` from `"next/link"` (check line 4 — it's there).

- [ ] **Step 3: Add `?reset=success` banner**

Read the current `searchParams` values at the top of `SignInForm`:

```tsx
const callbackUrl = searchParams.get("callbackUrl") ?? "/"
const authError = searchParams.get("error")
const resetSuccess = searchParams.get("reset") === "success"
```

Then add the banner just before the `<form>` tag, inside the card `<div>`:

```tsx
{resetSuccess && (
  <p className="text-sm text-green-400 text-center mb-4">
    Password reset — please sign in with your new password.
  </p>
)}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: End-to-end smoke test (manual)**

1. `npm run dev`
2. Go to `/signin` — confirm "Forgot password?" links to `/forgot-password`
3. Go to `/forgot-password` — submit any email — see success message
4. (With a real account) go to `/reset-password?token=faketoken` — see error message with link back
5. Go to `/signin?reset=success` — see the green banner

- [ ] **Step 6: Commit**

```bash
git add app/(auth)/signin/page.tsx
git commit -m "feat: wire forgot-password link and reset-success banner on sign-in"
```
