# Auth & Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Gallery Next.js app and build a complete auth system — sign up/in via email, Google, and Apple, with an onboarding step and a settings page to toggle selling on/off.

**Architecture:** Next.js 15 App Router monolith. NextAuth.js v4 handles authentication with the Prisma adapter persisting users and sessions to PostgreSQL. tRPC provides a type-safe API layer for account mutations. Auth state flows from NextAuth sessions into tRPC context. After first sign-in, users are redirected to `/onboarding` until they complete it.

**Tech Stack:** Next.js 15, TypeScript, NextAuth.js v4, @next-auth/prisma-adapter, Prisma 5, PostgreSQL (Neon — free tier), tRPC v11, @tanstack/react-query v5, Zod, Tailwind CSS, Vitest

---

## Environment Variables Needed

Before starting, create a `.env.local` file in the project root with:

```env
# Database — get free Neon PostgreSQL at https://neon.tech
DATABASE_URL="postgresql://user:password@host/gallery?sslmode=require"

# NextAuth — generate secret with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# Google OAuth — https://console.cloud.google.com
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Apple OAuth — https://developer.apple.com (can leave blank for now)
APPLE_ID=""
APPLE_SECRET=""

# Email (Resend) — https://resend.com (can leave blank for now, magic link)
EMAIL_SERVER=""
EMAIL_FROM="Gallery <noreply@gallery.app>"
```

> **Note:** Google and Apple OAuth credentials require setting up apps in their developer consoles. For initial testing, email (magic link) works immediately with Resend. You can add Google/Apple later.

---

## File Map

```
gallery/
├── prisma/
│   └── schema.prisma              # Database schema — User, Account, Session, VerificationToken
├── lib/
│   ├── prisma.ts                  # Prisma client singleton
│   ├── auth.ts                    # NextAuth config (providers, callbacks, pages)
│   └── trpc.ts                    # tRPC init, context, middleware, procedure types
├── server/
│   ├── routers/
│   │   ├── user.ts                # tRPC user router (me, completeOnboarding, updateSelling)
│   │   └── _app.ts                # Root tRPC router
│   └── context.ts                 # tRPC context factory
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   │   └── route.ts           # NextAuth route handler
│   │   └── trpc/[trpc]/
│   │       └── route.ts           # tRPC route handler
│   ├── (auth)/
│   │   ├── signin/
│   │   │   └── page.tsx           # Sign in page (email + Google + Apple)
│   │   └── layout.tsx             # Centered auth layout
│   ├── onboarding/
│   │   └── page.tsx               # "Do you want to sell?" onboarding step
│   ├── settings/
│   │   └── account/
│   │       └── page.tsx           # Account settings — toggle selling on/off
│   ├── layout.tsx                 # Root layout (providers)
│   └── page.tsx                   # Temp home page (redirects based on auth state)
├── components/
│   └── providers.tsx              # NextAuth SessionProvider + tRPC + ReactQuery providers
├── types/
│   └── next-auth.d.ts             # Extend NextAuth session types
└── tests/
    └── server/
        └── user.test.ts           # tRPC user router unit tests
```

---

## Task 1: Scaffold the Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Run create-next-app in the gallery folder**

```bash
cd "C:/Users/gavri/OneDrive/Documents/Projects/gallery"
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --no-git
```

When prompted, answer:
- Would you like to use ESLint? → Yes
- Would you like to use Turbopack? → Yes

- [ ] **Step 2: Verify the scaffold**

```bash
npm run dev
```

Expected: server starts at http://localhost:3000 and shows the default Next.js page. Stop with Ctrl+C.

- [ ] **Step 3: Install all Gallery dependencies**

```bash
npm install next-auth@^4 @next-auth/prisma-adapter @prisma/client @trpc/server@^11 @trpc/client@^11 @trpc/react-query@^11 @tanstack/react-query@^5 zod superjson
npm install -D prisma vitest @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 4: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
  },
})
```

- [ ] **Step 5: Add test script to package.json**

Open `package.json`. Find the `"scripts"` section and add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

## Task 2: Prisma schema and database

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`

- [ ] **Step 1: Initialise Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and `.env`. Move the `DATABASE_URL` to `.env.local` instead (Next.js reads `.env.local` automatically). Delete the generated `.env` file.

```bash
rm .env
```

- [ ] **Step 2: Write the schema**

Replace the contents of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── NextAuth required models ──────────────────────────────────────────────────

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ── Gallery user ──────────────────────────────────────────────────────────────

model User {
  id                 String           @id @default(cuid())
  name               String?
  email              String?          @unique
  emailVerified      DateTime?
  image              String?
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  // Gallery profile
  username           String?          @unique
  bio                String?
  sellingEnabled     Boolean          @default(false)
  onboardingComplete Boolean          @default(false)
  commissionStatus   CommissionStatus @default(CLOSED)

  accounts           Account[]
  sessions           Session[]
}

enum CommissionStatus {
  OPEN
  LIMITED
  CLOSED
}
```

- [ ] **Step 3: Create Prisma client singleton**

Create `lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

- [ ] **Step 4: Run the migration**

Make sure your `DATABASE_URL` is set in `.env.local`, then:

```bash
npx prisma migrate dev --name init
```

Expected output: migration created and applied, Prisma client generated.

- [ ] **Step 5: Verify schema in Prisma Studio (optional)**

```bash
npx prisma studio
```

Opens at http://localhost:5555 — you should see the User, Account, Session, VerificationToken tables. Close with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add prisma/ lib/prisma.ts
git commit -m "feat: add Prisma schema and client"
```

---

## Task 3: NextAuth configuration

**Files:**
- Create: `lib/auth.ts`
- Create: `types/next-auth.d.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Extend NextAuth session types**

Create `types/next-auth.d.ts`:

```typescript
import { type DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string | null
      sellingEnabled: boolean
      onboardingComplete: boolean
    } & DefaultSession["user"]
  }

  interface User {
    username: string | null
    sellingEnabled: boolean
    onboardingComplete: boolean
  }
}
```

- [ ] **Step 2: Create the NextAuth config**

Create `lib/auth.ts`:

```typescript
import { type NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import EmailProvider from "next-auth/providers/email"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [
          AppleProvider({
            clientId: process.env.APPLE_ID,
            clientSecret: process.env.APPLE_SECRET,
          }),
        ]
      : []),
    ...(process.env.EMAIL_SERVER
      ? [
          EmailProvider({
            server: process.env.EMAIL_SERVER,
            from: process.env.EMAIL_FROM ?? "Gallery <noreply@gallery.app>",
          }),
        ]
      : []),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        session.user.username = user.username
        session.user.sellingEnabled = user.sellingEnabled
        session.user.onboardingComplete = user.onboardingComplete
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

- [ ] **Step 3: Create the NextAuth route handler**

Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts types/next-auth.d.ts app/api/auth/
git commit -m "feat: configure NextAuth with Prisma adapter"
```

---

## Task 4: tRPC setup

**Files:**
- Create: `lib/trpc.ts`
- Create: `server/context.ts`
- Create: `server/routers/_app.ts`
- Create: `app/api/trpc/[trpc]/route.ts`

- [ ] **Step 1: Create tRPC init and procedure types**

Create `lib/trpc.ts`:

```typescript
import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import { type Context } from "@/server/context"

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  })
})
```

- [ ] **Step 2: Create tRPC context factory**

Create `server/context.ts`:

```typescript
import { getServerSession, type Session } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { type NextRequest } from "next/server"

export type Context = {
  session: Session | null
  prisma: typeof prisma
}

export async function createContext(req?: NextRequest): Promise<Context> {
  const session = await getServerSession(authOptions)
  return { session, prisma }
}
```

- [ ] **Step 3: Create root router (empty for now)**

Create `server/routers/_app.ts`:

```typescript
import { router } from "@/lib/trpc"
import { userRouter } from "./user"

export const appRouter = router({
  user: userRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 4: Create tRPC route handler**

Create `app/api/trpc/[trpc]/route.ts`:

```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@/server/routers/_app"
import { createContext } from "@/server/context"

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  })

export { handler as GET, handler as POST }
```

- [ ] **Step 5: Commit**

```bash
git add lib/trpc.ts server/ app/api/trpc/
git commit -m "feat: set up tRPC with context and route handler"
```

---

## Task 5: User tRPC router + tests

**Files:**
- Create: `server/routers/user.ts`
- Create: `tests/server/user.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `tests/server/user.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { createCallerFactory } from "@trpc/server"
import { appRouter } from "@/server/routers/_app"

const createCaller = createCallerFactory(appRouter)

// Mock prisma
const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  username: null,
  bio: null,
  sellingEnabled: false,
  onboardingComplete: false,
  commissionStatus: "CLOSED" as const,
}

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

const mockSession = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    image: null,
    username: null,
    sellingEnabled: false,
    onboardingComplete: false,
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}

function getCaller(session = mockSession) {
  return createCaller({
    session,
    prisma: mockPrisma as any,
  })
}

describe("user.me", () => {
  it("returns the current user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser)
    const caller = getCaller()
    const result = await caller.user.me()
    expect(result).toEqual(mockUser)
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
    })
  })

  it("throws UNAUTHORIZED when not logged in", async () => {
    const caller = createCaller(null as any)
    const unauthCaller = getCaller(null as any)
    await expect(unauthCaller.user.me()).rejects.toThrow("UNAUTHORIZED")
  })
})

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

describe("user.updateSellingEnabled", () => {
  it("enables selling", async () => {
    const updated = { ...mockUser, sellingEnabled: true }
    mockPrisma.user.update.mockResolvedValue(updated)
    const caller = getCaller()
    const result = await caller.user.updateSellingEnabled({ enabled: true })
    expect(result.sellingEnabled).toBe(true)
  })

  it("disables selling", async () => {
    const updated = { ...mockUser, sellingEnabled: false }
    mockPrisma.user.update.mockResolvedValue(updated)
    const caller = getCaller()
    const result = await caller.user.updateSellingEnabled({ enabled: false })
    expect(result.sellingEnabled).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```

Expected: tests fail because `server/routers/user.ts` doesn't exist yet.

- [ ] **Step 3: Implement the user router**

Create `server/routers/user.ts`:

```typescript
import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc"

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
    })
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

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/routers/user.ts tests/
git commit -m "feat: add user tRPC router with tests"
```

---

## Task 6: Client-side providers

**Files:**
- Create: `components/providers.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create the providers component**

Create `components/providers.tsx`:

```typescript
"use client"

import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink } from "@trpc/client"
import { createTRPCReact } from "@trpc/react-query"
import { useState } from "react"
import superjson from "superjson"
import { type AppRouter } from "@/server/routers/_app"

export const trpc = createTRPCReact<AppRouter>()

function getBaseUrl() {
  if (typeof window !== "undefined") return ""
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  )

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  )
}
```

- [ ] **Step 2: Wrap the root layout with providers**

Replace the contents of `app/layout.tsx` with:

```typescript
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Gallery",
  description: "The platform built for every kind of creator",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/providers.tsx app/layout.tsx
git commit -m "feat: add tRPC and NextAuth client providers"
```

---

## Task 7: Sign in page

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/signin/page.tsx`

- [ ] **Step 1: Create auth layout**

Create `app/(auth)/layout.tsx`:

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Create sign in page**

Create `app/(auth)/signin/page.tsx`:

```typescript
"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useSearchParams } from "next/navigation"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await signIn("email", { email, callbackUrl, redirect: false })
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-gray-500">
          We sent a sign in link to <strong>{email}</strong>
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gallery</h1>
        <p className="text-gray-500 mt-1">Sign in to your account</p>
      </div>

      <div className="space-y-3 mb-6">
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <button
          onClick={() => signIn("apple", { callbackUrl })}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
          </svg>
          Continue with Apple
        </button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-400">or</span>
        </div>
      </div>

      <form onSubmit={handleEmailSignIn} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email}
          className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Continue with Email"}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        By continuing, you agree to Gallery&apos;s Terms of Service and Privacy Policy.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/
git commit -m "feat: add sign in page with email, Google, Apple"
```

---

## Task 8: Onboarding page

**Files:**
- Create: `app/onboarding/page.tsx`

- [ ] **Step 1: Create onboarding page**

Create `app/onboarding/page.tsx`:

```typescript
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { trpc } from "@/components/providers"

export default function OnboardingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<boolean | null>(null)
  const completeOnboarding = trpc.user.completeOnboarding.useMutation({
    onSuccess: () => router.push("/"),
  })

  function handleContinue() {
    if (selected === null) return
    completeOnboarding.mutate({ sellingEnabled: selected })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Gallery</h1>
          <p className="text-gray-500 mt-2">One quick question before we get started</p>
        </div>

        <p className="text-center text-gray-700 font-medium mb-6">
          Do you want to sell art or take commissions?
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setSelected(true)}
            className={`p-6 rounded-xl border-2 text-left transition-all ${
              selected === true
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-2xl mb-2">🎨</div>
            <div className="font-semibold text-gray-900">Yes</div>
            <div className="text-sm text-gray-500 mt-1">
              Enable shop and commission features
            </div>
          </button>

          <button
            onClick={() => setSelected(false)}
            className={`p-6 rounded-xl border-2 text-left transition-all ${
              selected === false
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-2xl mb-2">🖼️</div>
            <div className="font-semibold text-gray-900">Not yet</div>
            <div className="text-sm text-gray-500 mt-1">
              Just browsing — I can enable this later in Settings
            </div>
          </button>
        </div>

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

- [ ] **Step 2: Commit**

```bash
git add app/onboarding/
git commit -m "feat: add onboarding page with selling toggle"
```

---

## Task 9: Account settings page

**Files:**
- Create: `app/settings/account/page.tsx`

- [ ] **Step 1: Create account settings page**

Create `app/settings/account/page.tsx`:

```typescript
"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { trpc } from "@/components/providers"

export default function AccountSettingsPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const { data: user } = trpc.user.me.useQuery()
  const updateSelling = trpc.user.updateSellingEnabled.useMutation({
    onSuccess: () => update(),
  })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
  }, [status, router])

  if (status === "loading" || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Account Settings</h1>

      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900">Selling & Commissions</div>
            <div className="text-sm text-gray-500 mt-0.5">
              Enable your shop and commission features
            </div>
          </div>
          <button
            onClick={() =>
              updateSelling.mutate({ enabled: !user.sellingEnabled })
            }
            disabled={updateSelling.isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              user.sellingEnabled ? "bg-blue-600" : "bg-gray-200"
            }`}
            role="switch"
            aria-checked={user.sellingEnabled}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                user.sellingEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="p-6">
          <div className="font-medium text-gray-900">Email</div>
          <div className="text-sm text-gray-500 mt-0.5">{user.email}</div>
        </div>

        <div className="p-6">
          <button
            onClick={() => router.push("/api/auth/signout")}
            className="text-sm text-red-500 hover:text-red-600 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/settings/
git commit -m "feat: add account settings with selling toggle"
```

---

## Task 10: Home page redirect logic

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the default home page**

Replace `app/page.tsx` with:

```typescript
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect("/signin")
  if (!session.user.onboardingComplete) redirect("/onboarding")

  // Placeholder until feed is built
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Welcome to Gallery</h1>
        <p className="text-gray-500 mt-2">Signed in as {session.user.email}</p>
        <a
          href="/settings/account"
          className="mt-4 inline-block text-blue-600 hover:underline text-sm"
        >
          Account Settings →
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the app end-to-end**

```bash
npm run dev
```

Test the full flow manually:
1. Visit http://localhost:3000 — should redirect to `/signin`
2. Sign in with email — should receive magic link
3. Click the link — should redirect to `/onboarding`
4. Complete onboarding — should land on home page
5. Visit `/settings/account` — should show selling toggle

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Final commit**

```bash
git add app/page.tsx
git commit -m "feat: home page redirect based on auth and onboarding state"
```
