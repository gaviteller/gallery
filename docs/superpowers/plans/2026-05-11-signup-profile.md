# Sign-Up & Profile Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dev-only credentials login with a real Instagram-style sign-up/sign-in flow (email + password), and add a basic profile page at `/@username`.

**Architecture:** A new `/signup` page POSTs to a Next.js API route that creates the user with a bcrypt-hashed password. The existing CredentialsProvider is updated to verify passwords instead of upserting. Username is collected at sign-up (not onboarding). After onboarding the user lands on their profile at `/@username`.

**Tech Stack:** Next.js 16 App Router, NextAuth.js v4, Prisma 5, bcryptjs, tRPC v11, Tailwind CSS v4

---

## File Map

```
gallery/
├── prisma/
│   └── schema.prisma                     # Add password field to User
├── lib/
│   └── auth.ts                           # Update CredentialsProvider to verify password
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── signup/
│   │           └── route.ts              # POST — create account with hashed password
│   ├── (auth)/
│   │   ├── signin/
│   │   │   └── page.tsx                  # Redesign — email + password + "Sign up" link
│   │   └── signup/
│   │       └── page.tsx                  # New — name, email, username, password, ToS
│   ├── onboarding/
│   │   └── page.tsx                      # Simplify — remove username step, selling only
│   ├── [username]/
│   │   └── page.tsx                      # New — public profile page at /@username
│   └── page.tsx                          # Update redirect → /@username
├── server/
│   └── routers/
│       └── user.ts                       # Remove username from completeOnboarding
└── tests/
    └── server/
        └── user.test.ts                  # Update completeOnboarding test
```

---

## Task 1: Add password field to User schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add password field**

Open `prisma/schema.prisma`. In the `User` model, add `password String?` after `image`:

```prisma
model User {
  id                 String           @id @default(cuid())
  name               String?
  email              String?          @unique
  emailVerified      DateTime?
  image              String?
  password           String?

  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  username           String?          @unique
  bio                String?
  sellingEnabled     Boolean          @default(false)
  onboardingComplete Boolean          @default(false)
  commissionStatus   CommissionStatus @default(CLOSED)

  accounts           Account[]
  sessions           Session[]
}
```

- [ ] **Step 2: Install bcryptjs**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 3: Push schema to database**

```bash
DATABASE_URL="postgresql://neondb_owner:npg_2JUPFn7gYALq@ep-super-sky-apyhuih0-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Regenerate Prisma client**

```bash
DATABASE_URL="postgresql://neondb_owner:npg_2JUPFn7gYALq@ep-super-sky-apyhuih0-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma package.json package-lock.json
git commit -m "feat: add password field to User schema"
```

---

## Task 2: Update CredentialsProvider to verify password

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Replace auth.ts**

Replace the entire contents of `lib/auth.ts` with:

```typescript
import { type NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import EmailProvider from "next-auth/providers/email"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          username: user.username,
          sellingEnabled: user.sellingEnabled,
          onboardingComplete: user.onboardingComplete,
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [AppleProvider({ clientId: process.env.APPLE_ID, clientSecret: process.env.APPLE_SECRET })]
      : []),
    ...(process.env.EMAIL_SERVER
      ? [EmailProvider({ server: process.env.EMAIL_SERVER, from: process.env.EMAIL_FROM ?? "Gallery <noreply@gallery.app>" })]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({ where: { id: token.id as string } })
        if (fresh) {
          token.username = fresh.username
          token.sellingEnabled = fresh.sellingEnabled
          token.onboardingComplete = fresh.onboardingComplete
        }
      }
      if (user) {
        token.id = user.id
        token.username = (user as any).username ?? null
        token.sellingEnabled = (user as any).sellingEnabled ?? false
        token.onboardingComplete = (user as any).onboardingComplete ?? false
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string | null
        session.user.sellingEnabled = token.sellingEnabled as boolean
        session.user.onboardingComplete = token.onboardingComplete as boolean
      }
      return session
    },
  },
  pages: {
    signIn: "/signin",
    newUser: "/onboarding",
  },
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: update credentials provider to verify password with bcrypt"
```

---

## Task 3: Sign-up API route

**Files:**
- Create: `app/api/auth/signup/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/auth/signup/route.ts`:

```typescript
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { name, email, username, password } = await req.json()

    if (!name || !email || !username || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username) || username.length < 3 || username.length > 30) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 })
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

    await prisma.user.create({
      data: { name, email, username, password: hashedPassword },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/signup/
git commit -m "feat: add sign-up API route with bcrypt password hashing"
```

---

## Task 4: Sign-up page

**Files:**
- Create: `app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create the sign-up page**

Create `app/(auth)/signup/page.tsx`:

```typescript
"use client"

import { useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { trpc } from "@/components/providers"

function SignUpForm() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", username: "", password: "" })
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const { data: usernameCheck, isFetching: checkingUsername } = trpc.user.checkUsername.useQuery(
    { username: form.username },
    { enabled: form.username.length >= 3 }
  )

  const usernameValid =
    /^[a-zA-Z0-9_]+$/.test(form.username) &&
    form.username.length >= 3 &&
    form.username.length <= 30
  const usernameAvailable = usernameValid && usernameCheck?.available === true

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) { setError("You must agree to the Terms of Service"); return }
    if (!usernameAvailable) { setError("Please choose a valid, available username"); return }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return }

    setLoading(true)
    setError("")

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? "Something went wrong")
      setLoading(false)
      return
    }

    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    })

    if (result?.error) {
      setError("Account created but sign-in failed. Try signing in manually.")
      setLoading(false)
      return
    }

    router.push("/onboarding")
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gallery</h1>
        <p className="text-gray-500 mt-1 text-sm">Sign up to discover art from creators you love.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Full name"
          value={form.name}
          onChange={set("name")}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={set("email")}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div>
          <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <span className="pl-4 text-gray-400 text-sm">@</span>
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                }))
              }
              maxLength={30}
              required
              className="flex-1 px-2 py-3 text-sm bg-transparent focus:outline-none"
            />
          </div>
          <div className="mt-1 h-4">
            {form.username.length >= 3 &&
              (checkingUsername ? (
                <p className="text-xs text-gray-400">Checking...</p>
              ) : usernameAvailable ? (
                <p className="text-xs text-green-600">✓ Available</p>
              ) : (
                <p className="text-xs text-red-500">✗ Already taken</p>
              ))}
          </div>
        </div>

        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={set("password")}
          required
          minLength={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <label className="flex items-start gap-3 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 rounded"
          />
          <span className="text-xs text-gray-500">
            By signing up, you agree to our{" "}
            <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.
          </span>
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading || !form.name || !form.email || !form.password || !agreed}
          className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        Already have an account?{" "}
        <Link href="/signin" className="text-blue-600 font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/signup/"
git commit -m "feat: add Instagram-style sign-up page"
```

---

## Task 5: Redesign sign-in page

**Files:**
- Modify: `app/(auth)/signin/page.tsx`

- [ ] **Step 1: Replace sign-in page**

Replace the entire contents of `app/(auth)/signin/page.tsx` with:

```typescript
"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    })

    if (result?.error) {
      setError("Incorrect email or password.")
      setLoading(false)
    } else if (result?.url) {
      router.push(result.url)
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Gallery</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="text-center mt-4">
          <a href="#" className="text-xs text-blue-600 hover:underline">Forgot password?</a>
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 text-center">
        <p className="text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-blue-600 font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/signin/page.tsx"
git commit -m "feat: redesign sign-in page to Instagram-style layout"
```

---

## Task 6: Update tRPC user router — remove username from completeOnboarding

**Files:**
- Modify: `server/routers/user.ts`
- Modify: `tests/server/user.test.ts`

- [ ] **Step 1: Update user router**

Replace the entire contents of `server/routers/user.ts` with:

```typescript
import { z } from "zod"
import { router, publicProcedure, protectedProcedure } from "@/lib/trpc"

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
    })
  }),

  checkUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({
        where: { username: input.username },
      })
      return { available: !existing }
    }),

  completeOnboarding: protectedProcedure
    .input(z.object({ sellingEnabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          sellingEnabled: input.sellingEnabled,
          onboardingComplete: true,
        },
      })
    }),

  updateSellingEnabled: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { sellingEnabled: input.enabled },
      })
    }),
})
```

- [ ] **Step 2: Update the test**

Read `tests/server/user.test.ts`. Find the `describe("user.completeOnboarding")` block and update it:

```typescript
describe("user.completeOnboarding", () => {
  it("sets onboardingComplete and sellingEnabled", async () => {
    const updated = { ...mockUser, onboardingComplete: true, sellingEnabled: true }
    mockPrisma.user.update.mockResolvedValue(updated)
    const caller = getCaller()
    const result = await caller.user.completeOnboarding({ sellingEnabled: true })
    expect(result.onboardingComplete).toBe(true)
    expect(result.sellingEnabled).toBe(true)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { sellingEnabled: true, onboardingComplete: true },
    })
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: 5/5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/routers/user.ts tests/server/user.test.ts
git commit -m "feat: remove username from completeOnboarding (now set at sign-up)"
```

---

## Task 7: Simplify onboarding page

**Files:**
- Modify: `app/onboarding/page.tsx`

- [ ] **Step 1: Replace onboarding page**

Replace the entire contents of `app/onboarding/page.tsx` with:

```typescript
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { trpc } from "@/components/providers"

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [selected, setSelected] = useState<boolean | null>(null)

  const completeOnboarding = trpc.user.completeOnboarding.useMutation({
    onSuccess: async () => {
      await update()
      const username = session?.user?.username
      router.push(username ? `/@${username}` : "/")
    },
  })

  function handleContinue() {
    if (selected === null) return
    completeOnboarding.mutate({ sellingEnabled: selected })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome{session?.user?.username ? `, @${session.user.username}` : ""}
          </h1>
          <p className="text-gray-500 mt-2">One quick question before we get started</p>
        </div>

        <p className="text-center text-gray-700 font-medium mb-6">
          Do you want to sell art or take commissions?
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setSelected(true)}
            className={`p-6 rounded-xl border-2 text-left transition-all ${
              selected === true ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-2xl mb-2">🎨</div>
            <div className="font-semibold text-gray-900">Yes</div>
            <div className="text-sm text-gray-500 mt-1">Enable shop and commission features</div>
          </button>

          <button
            onClick={() => setSelected(false)}
            className={`p-6 rounded-xl border-2 text-left transition-all ${
              selected === false ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-2xl mb-2">🖼️</div>
            <div className="font-semibold text-gray-900">Not yet</div>
            <div className="text-sm text-gray-500 mt-1">Just browsing — enable this later in Settings</div>
          </button>
        </div>

        {completeOnboarding.error && (
          <p className="text-sm text-red-500 text-center mb-4">{completeOnboarding.error.message}</p>
        )}

        <button
          onClick={handleContinue}
          disabled={selected === null || completeOnboarding.isPending}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {completeOnboarding.isPending ? "Setting up your account..." : "Continue"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/onboarding/page.tsx
git commit -m "feat: simplify onboarding to single selling step, redirect to profile"
```

---

## Task 8: Basic profile page

**Files:**
- Create: `app/[username]/page.tsx`

- [ ] **Step 1: Create profile page**

Create `app/[username]/page.tsx`:

```typescript
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

const statusColors = {
  OPEN: "bg-green-100 text-green-700",
  LIMITED: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-gray-100 text-gray-500",
}

const statusLabels = {
  OPEN: "Open for commissions",
  LIMITED: "Limited commissions",
  CLOSED: "Closed for commissions",
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const profileUser = await prisma.user.findUnique({
    where: { username },
  })

  if (!profileUser) notFound()

  const session = await getServerSession(authOptions)
  const isOwn = session?.user?.id === profileUser.id

  const initials = (profileUser.name ?? profileUser.username ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold flex-shrink-0">
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{profileUser.name ?? profileUser.username}</h1>
            {isOwn && (
              <Link
                href="/settings/account"
                className="text-sm px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Edit profile
              </Link>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">@{profileUser.username}</p>

          {profileUser.bio && (
            <p className="text-gray-700 text-sm mt-3">{profileUser.bio}</p>
          )}

          <div className="mt-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                statusColors[profileUser.commissionStatus]
              }`}
            >
              {statusLabels[profileUser.commissionStatus]}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {["Posts", "Shop", "Commissions", "About"].map((tab) => (
            <button
              key={tab}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === "Posts"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Posts tab — empty state */}
      <div className="text-center py-16 text-gray-400">
        <div className="text-4xl mb-3">🖼️</div>
        <p className="font-medium text-gray-500">No posts yet</p>
        {isOwn && (
          <p className="text-sm mt-1">Share your first piece of art</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/[username]/
git commit -m "feat: add basic profile page at /@username"
```

---

## Task 9: Update home page redirect

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update home page**

Replace the entire contents of `app/page.tsx` with:

```typescript
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect("/signin")
  if (!session.user.onboardingComplete || !session.user.username) redirect("/onboarding")

  redirect(`/@${session.user.username}`)
}
```

- [ ] **Step 2: TypeScript check + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: no errors, 5/5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: home page redirects to profile after auth"
```
