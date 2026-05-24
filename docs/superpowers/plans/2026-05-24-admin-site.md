# Gallery Admin — Standalone Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the admin panel from the gallery app into a standalone Next.js application at `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin` with its own credentials-based login, while removing the `/admin` route from gallery.

**Architecture:** New standalone Next.js app pointing at the same PostgreSQL DB. The admin router is copied from gallery (mod-facing procedures only). Auth uses NextAuth `CredentialsProvider` — login checks email + password (bcrypt) + `isAdmin || isModerator`. All routes except `/login` protected by `middleware.ts`. After the admin app is verified, the `app/(admin)/` route group is deleted from gallery.

**Tech Stack:** Next.js 16.2.6, tRPC v11, Prisma 5, PostgreSQL, NextAuth 4, bcryptjs, superjson, TypeScript, Vitest

---

## File Map — gallery-admin

| Action | File | Purpose |
|--------|------|---------|
| Create | `package.json` | App metadata + dependencies |
| Create | `tsconfig.json` | TypeScript config with `@/*` alias |
| Create | `next.config.ts` | Next.js config |
| Create | `vitest.config.ts` | Test runner config |
| Create | `middleware.ts` | Redirect unauthenticated requests to `/login` |
| Create | `prisma/schema.prisma` | Copy of gallery schema (for `prisma generate`) |
| Create | `lib/prisma.ts` | Singleton Prisma client |
| Create | `lib/auth.ts` | NextAuth with CredentialsProvider — checks password + isAdmin/isModerator |
| Create | `lib/trpc.ts` | tRPC init + `modProcedure` + `adminProcedure` |
| Create | `types/next-auth.d.ts` | Session/JWT type extensions |
| Create | `server/context.ts` | tRPC context — session + prisma |
| Create | `server/lib/ban.ts` | `checkNotBanned()` utility (copied) |
| Create | `server/lib/strikes.ts` | `SELLING_VIOLATIONS` set (copied) |
| Create | `server/routers/admin.ts` | Admin tRPC router — mod procedures only (copied) |
| Create | `server/routers/_app.ts` | Root router — just adminRouter |
| Create | `app/api/auth/[...nextauth]/route.ts` | NextAuth handler |
| Create | `app/api/trpc/[trpc]/route.ts` | tRPC handler |
| Create | `components/providers.tsx` | tRPC + SessionProvider wrapper |
| Create | `app/layout.tsx` | Root layout with Providers |
| Create | `app/page.tsx` | Root redirect → /dashboard |
| Create | `app/login/page.tsx` | Email + password login form |
| Create | `app/dashboard/page.tsx` | Pending appeals count |
| Create | `app/users/page.tsx` | Searchable user list |
| Create | `app/users/[id]/page.tsx` | User detail — strikes, bans, mod toggle |
| Create | `app/appeals/page.tsx` | PENDING appeal queue |
| Create | `app/appeals/[id]/page.tsx` | Appeal detail — approve/deny |
| Create | `scripts/set-admin-password.ts` | CLI: set password for a staff account |
| Create | `tests/server/auth.test.ts` | Unit tests for admin authorize function |

## File Map — gallery (changes)

| Action | File | Change |
|--------|------|--------|
| Delete | `app/(admin)/` | Entire route group removed |
| Modify | `server/routers/_app.ts` | Remove `admin: adminRouter` and import |
| Delete | `server/routers/admin.ts` | No longer needed in gallery |

---

## Task 1: Scaffold gallery-admin

**Files:**
- Create: `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\package.json`
- Create: `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\tsconfig.json`
- Create: `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\next.config.ts`
- Create: `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\vitest.config.ts`
- Create: `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\.env.local`
- Create: `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\.gitignore`

- [ ] **Step 1: Create the project directory**

```bash
mkdir "C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin"
cd "C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin"
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "gallery-admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "@tanstack/react-query": "^5.100.9",
    "@trpc/client": "^11.17.0",
    "@trpc/react-query": "^11.17.0",
    "@trpc/server": "^11.17.0",
    "bcryptjs": "^3.0.3",
    "next": "16.2.6",
    "next-auth": "^4.24.14",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "superjson": "^2.2.6",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.0.1",
    "prisma": "^5.22.0",
    "typescript": "^5",
    "vite-tsconfig-paths": "^6.1.1",
    "vitest": "^4.1.5"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.ts`**

```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
  },
})
```

- [ ] **Step 6: Create `.env.local`**

```
DATABASE_URL="<paste the same DATABASE_URL from gallery's .env.local>"
NEXTAUTH_SECRET="<generate a new secret: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3001"
```

Note: Use port 3001 so it doesn't conflict with gallery's dev server on 3000.

- [ ] **Step 7: Create `.gitignore`**

```
.next/
node_modules/
.env.local
.env
*.tsbuildinfo
```

- [ ] **Step 8: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 9: Init git and commit**

```bash
git init
git add .
git commit -m "chore: scaffold gallery-admin app"
```

---

## Task 2: Prisma Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`

- [ ] **Step 1: Copy prisma schema from gallery**

Copy the entire contents of `C:\Users\gavri\OneDrive\Documents\Projects\gallery\prisma\schema.prisma` to `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\prisma\schema.prisma`.

The file should start with:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

> **Important:** This is a read-only copy. The admin app NEVER runs `prisma migrate`. Migrations are always run from the gallery repo. Only `prisma generate` is run here.

- [ ] **Step 2: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `@prisma/client` generated successfully.

- [ ] **Step 3: Create `lib/prisma.ts`**

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

- [ ] **Step 4: Commit**

```bash
git add prisma/ lib/prisma.ts
git commit -m "feat: add Prisma schema and client"
```

---

## Task 3: Auth Setup (TDD)

**Files:**
- Create: `lib/auth.ts`
- Create: `types/next-auth.d.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Test: `tests/server/auth.test.ts`

The admin `CredentialsProvider` differs from gallery's: it additionally checks `isAdmin || isModerator` and stores those flags in the JWT. Regular gallery users cannot log in even if they know their password.

- [ ] **Step 1: Create `tests/server/auth.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}))

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn() },
}))

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

// The CredentialsProvider's authorize function
const authorize = (authOptions.providers[0] as any).options.authorize as (
  credentials: Record<string, string> | undefined
) => Promise<unknown>

const adminUser = {
  id: "admin-1",
  username: "the_rat_queen",
  password: "$2b$10$hashedpassword",
  isAdmin: true,
  isModerator: false,
}

const modUser = {
  id: "mod-1",
  username: "moddy",
  password: "$2b$10$hashedpassword",
  isAdmin: false,
  isModerator: true,
}

const regularUser = {
  id: "user-1",
  username: "regular",
  password: "$2b$10$hashedpassword",
  isAdmin: false,
  isModerator: false,
}

beforeEach(() => vi.clearAllMocks())

describe("admin authorize", () => {
  it("returns null for missing credentials", async () => {
    expect(await authorize(undefined)).toBeNull()
  })

  it("returns null for empty email/password", async () => {
    expect(await authorize({ email: "", password: "" })).toBeNull()
  })

  it("returns null when user not found", async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(null)
    expect(await authorize({ email: "x@x.com", password: "pw" })).toBeNull()
  })

  it("returns null when user has no password set", async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue({ ...adminUser, password: null })
    expect(await authorize({ email: "x@x.com", password: "pw" })).toBeNull()
  })

  it("returns null for wrong password", async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(adminUser)
    ;(bcrypt.compare as any).mockResolvedValue(false)
    expect(await authorize({ email: "admin@x.com", password: "wrong" })).toBeNull()
  })

  it("returns null for regular user even with correct password", async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(regularUser)
    ;(bcrypt.compare as any).mockResolvedValue(true)
    expect(await authorize({ email: "user@x.com", password: "pw" })).toBeNull()
  })

  it("returns user data for valid admin credentials", async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(adminUser)
    ;(bcrypt.compare as any).mockResolvedValue(true)
    const result = await authorize({ email: "admin@x.com", password: "pw" })
    expect(result).toEqual({
      id: "admin-1",
      username: "the_rat_queen",
      isAdmin: true,
      isModerator: false,
    })
  })

  it("returns user data for valid moderator credentials", async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(modUser)
    ;(bcrypt.compare as any).mockResolvedValue(true)
    const result = await authorize({ email: "mod@x.com", password: "pw" })
    expect(result).toEqual({
      id: "mod-1",
      username: "moddy",
      isAdmin: false,
      isModerator: true,
    })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/server/auth.test.ts
```

Expected: FAIL — `lib/auth.ts` not found.

- [ ] **Step 3: Create `types/next-auth.d.ts`**

```typescript
import { type DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string | null
      isAdmin: boolean
      isModerator: boolean
    } & DefaultSession["user"]
  }

  interface User {
    username: string | null
    isAdmin: boolean
    isModerator: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username: string | null
    isAdmin: boolean
    isModerator: boolean
  }
}
```

- [ ] **Step 4: Create `lib/auth.ts`**

```typescript
import { type NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
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
          select: { id: true, username: true, password: true, isAdmin: true, isModerator: true },
        })

        if (!user || !user.password) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        // Only staff can access the admin app
        if (!user.isAdmin && !user.isModerator) return null

        return {
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin,
          isModerator: user.isModerator,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = (user as any).username ?? null
        token.isAdmin = (user as any).isAdmin ?? false
        token.isModerator = (user as any).isModerator ?? false
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
        session.user.isAdmin = token.isAdmin as boolean
        session.user.isModerator = token.isModerator as boolean
      }
      return session
    },
  },
  cookies: {
    sessionToken: {
      name: "gallery-admin.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
}
```

- [ ] **Step 5: Create `app/api/auth/[...nextauth]/route.ts`**

First create the directory: `app/api/auth/[...nextauth]/`

```typescript
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npx vitest run tests/server/auth.test.ts
```

Expected: 8 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/auth.ts types/next-auth.d.ts app/api/auth tests/server/auth.test.ts
git commit -m "feat: add admin credentials auth with staff-only guard"
```

---

## Task 4: tRPC Setup

**Files:**
- Create: `server/context.ts`
- Create: `lib/trpc.ts`
- Create: `server/routers/_app.ts`
- Create: `app/api/trpc/[trpc]/route.ts`
- Create: `components/providers.tsx`

- [ ] **Step 1: Create `server/context.ts`**

```typescript
import { getServerSession, type Session } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export type Context = {
  session: Session | null
  prisma: typeof prisma
}

export async function createContext(): Promise<Context> {
  const session = await getServerSession(authOptions)
  return { session, prisma }
}
```

- [ ] **Step 2: Create `lib/trpc.ts`**

```typescript
import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import { type Context } from "@/server/context"

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

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

- [ ] **Step 3: Create a temporary `server/routers/_app.ts`**

This will be updated in Task 5 once the admin router exists. For now, create an empty router just so the tRPC API route compiles.

```typescript
import { router } from "@/lib/trpc"

export const appRouter = router({})

export type AppRouter = typeof appRouter
```

- [ ] **Step 4: Create `app/api/trpc/[trpc]/route.ts`**

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

- [ ] **Step 5: Create `components/providers.tsx`**

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
  return `http://localhost:${process.env.PORT || 3001}`
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

- [ ] **Step 6: Run tests**

```bash
npx vitest run
```

Expected: 8 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/trpc.ts server/context.ts server/routers/_app.ts app/api/trpc components/providers.tsx
git commit -m "feat: add tRPC setup and providers"
```

---

## Task 5: Server Utilities + Admin Router

**Files:**
- Create: `server/lib/ban.ts`
- Create: `server/lib/strikes.ts`
- Create: `server/routers/admin.ts`

These are copied from gallery. The admin router keeps only the mod-facing procedures — the three user-facing ones (`getMyStrikes`, `submitAppeal`, `getMyAppeals`) are dropped since gallery users don't interact with this app.

- [ ] **Step 1: Create `server/lib/ban.ts`**

```typescript
import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "@prisma/client"

export async function checkNotBanned(prisma: PrismaClient, userId: string): Promise<void> {
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

- [ ] **Step 2: Create `server/lib/strikes.ts`**

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

- [ ] **Step 3: Create `server/routers/admin.ts`**

```typescript
import { z } from "zod"
import { router, modProcedure, adminProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { isSellingViolation } from "@/server/lib/strikes"

function getBanDate(duration: "3d" | "14d" | "30d" | "permanent"): Date {
  switch (duration) {
    case "3d": return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    case "14d": return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    case "30d": return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    case "permanent": return new Date("9999-12-31")
  }
}

export const adminRouter = router({

  // ── User management ─────────────────────────────────────────────────────────

  listUsers: modProcedure
    .input(z.object({ query: z.string().max(100).optional() }))
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
      const target = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { isAdmin: true },
      })
      if (!target) throw new TRPCError({ code: "NOT_FOUND" })
      if (target.isAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot modify admin roles" })

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
      const target = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { isAdmin: true, isModerator: true },
      })
      if (!target) throw new TRPCError({ code: "NOT_FOUND" })
      if (target.isAdmin || target.isModerator) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot take moderation actions against staff accounts" })
      }

      return ctx.prisma.$transaction(async tx => {
        const s = await tx.strike.create({
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
        await tx.notification.create({
          data: {
            userId: input.userId,
            fromUserId: ctx.session.user.id,
            type: "strike",
          },
        })
        return s
      })
    }),

  // ── Bans ────────────────────────────────────────────────────────────────────

  issueBan: modProcedure
    .input(z.object({
      userId: z.string(),
      duration: z.enum(["3d", "14d", "30d", "permanent"]),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { isAdmin: true, isModerator: true },
      })
      if (!target) throw new TRPCError({ code: "NOT_FOUND" })
      if (target.isAdmin || target.isModerator) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot take moderation actions against staff accounts" })
      }

      return ctx.prisma.$transaction(async tx => {
        const u = await tx.user.update({
          where: { id: input.userId },
          data: { bannedUntil: getBanDate(input.duration), banReason: input.reason },
          select: { id: true, bannedUntil: true },
        })
        await tx.notification.create({
          data: {
            userId: input.userId,
            fromUserId: ctx.session.user.id,
            type: "ban",
          },
        })
        return u
      })
    }),

  liftBan: modProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { isAdmin: true, isModerator: true },
      })
      if (!target) throw new TRPCError({ code: "NOT_FOUND" })
      if (target.isAdmin || target.isModerator) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot take moderation actions against staff accounts" })
      }

      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { bannedUntil: null, banReason: null },
        select: { id: true, bannedUntil: true },
      })
    }),

  // ── Appeals ─────────────────────────────────────────────────────────────────

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
      await ctx.prisma.$transaction(async tx => {
        const appeal = await tx.appeal.findUnique({
          where: { id: input.appealId },
          include: { user: true },
        })
        if (!appeal) throw new TRPCError({ code: "NOT_FOUND" })
        if (appeal.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Appeal is no longer pending." })

        await tx.appeal.update({
          where: { id: input.appealId },
          data: { status: "APPROVED", reviewedById: ctx.session.user.id, reviewedAt: new Date() },
        })
        if (appeal.strikeId) {
          await tx.strike.update({ where: { id: appeal.strikeId }, data: { reversed: true } })
        }
        if (appeal.user.bannedUntil && appeal.user.bannedUntil > new Date()) {
          await tx.user.update({
            where: { id: appeal.userId },
            data: { bannedUntil: null, banReason: null },
          })
        }
        await tx.notification.create({
          data: { userId: appeal.userId, fromUserId: ctx.session.user.id, type: "appeal_approved" },
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

      await ctx.prisma.$transaction(async tx => {
        await tx.appeal.update({
          where: { id: input.appealId },
          data: { status: "DENIED", reviewedById: ctx.session.user.id, reviewedAt: new Date() },
        })
        await tx.notification.create({
          data: { userId: appeal.userId, fromUserId: ctx.session.user.id, type: "appeal_denied" },
        })
      })
      return { success: true }
    }),
})
```

- [ ] **Step 4: Commit**

```bash
git add server/
git commit -m "feat: add server utilities and admin tRPC router"
```

---

## Task 6: Middleware + App Shell

**Files:**
- Create: `middleware.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`

- [ ] **Step 1: Create `middleware.ts`**

This redirects any unauthenticated request to `/login`. The `/login` route and NextAuth API routes are public.

```typescript
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token }) {
        return !!token
      },
    },
    pages: {
      signIn: "/login",
    },
  }
)

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)"],
}
```

- [ ] **Step 2: Create `app/layout.tsx`**

```typescript
import { type Metadata } from "next"
import { Providers } from "@/components/providers"

export const metadata: Metadata = {
  title: "Gallery Admin",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0D0D0F", minHeight: "100vh" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create `app/page.tsx`**

Root `/` redirects to `/dashboard` (authenticated users hit `/` after login). This is a server component.

```typescript
import { redirect } from "next/navigation"

export default function RootPage() {
  redirect("/dashboard")
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts app/layout.tsx app/page.tsx
git commit -m "feat: add middleware route protection and app shell"
```

---

## Task 7: Login Page

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Create `app/login/page.tsx`**

```typescript
"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("Invalid credentials.")
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0D0D0F",
    }}>
      <div style={{
        width: 360, padding: 32,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
      }}>
        <h1 style={{ color: "white", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Gallery Admin
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>
          Staff access only
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              padding: "10px 14px", borderRadius: 8, fontSize: 14,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              color: "white", outline: "none",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{
              padding: "10px 14px", borderRadius: 8, fontSize: 14,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              color: "white", outline: "none",
            }}
          />
          {error && (
            <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: loading ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white", cursor: loading ? "not-allowed" : "pointer",
              marginTop: 4,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: 8 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/login/
git commit -m "feat: add admin login page"
```

---

## Task 8: Admin Nav Layout Component

**Files:**
- Create: `components/AdminLayout.tsx`

This component wraps all authenticated pages (dashboard, users, appeals). It renders the top nav bar and the page content. It reads `isAdmin`/`isModerator` from the session (already verified by the middleware and auth).

- [ ] **Step 1: Create `components/AdminLayout.tsx`**

```typescript
"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/users", label: "Users" },
    { href: "/appeals", label: "Appeals" },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0F" }}>
      {/* Top bar */}
      <div style={{
        background: "#1a0535",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "12px 20px",
        display: "flex", alignItems: "center", gap: 24,
      }}>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>
          Gallery Admin
        </span>
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              color: pathname.startsWith(item.href) ? "white" : "rgba(255,255,255,0.5)",
              fontSize: 13,
              fontWeight: pathname.startsWith(item.href) ? 600 : 400,
              textDecoration: "none",
            }}
          >
            {item.label}
          </Link>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
            {session?.user?.isAdmin ? "Admin" : "Moderator"} · @{session?.user?.username ?? "—"}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{
              color: "rgba(255,255,255,0.4)", fontSize: 12, background: "none",
              border: "none", cursor: "pointer", padding: 0,
            }}
          >
            Sign out
          </button>
        </div>
      </div>
      {/* Page content */}
      <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: 8 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add components/AdminLayout.tsx
git commit -m "feat: add admin nav layout component"
```

---

## Task 9: Dashboard + Users List Pages

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `app/users/page.tsx`

- [ ] **Step 1: Create `app/dashboard/page.tsx`**

```typescript
"use client"

import AdminLayout from "@/components/AdminLayout"
import { trpc } from "@/components/providers"

export default function DashboardPage() {
  const { data: pendingAppeals } = trpc.admin.listAppeals.useQuery({ status: "PENDING" })

  return (
    <AdminLayout>
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
    </AdminLayout>
  )
}
```

- [ ] **Step 2: Create `app/users/page.tsx`**

```typescript
"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { trpc } from "@/components/providers"

export default function UsersPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 300)
  }

  const { data: users, isLoading } = trpc.admin.listUsers.useQuery(
    { query: debouncedQuery || undefined }
  )

  return (
    <AdminLayout>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Users</h1>
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
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span style={{ color: "white", fontSize: 14, fontWeight: 500, flex: 1 }}>
                @{u.username ?? "—"}
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

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: 8 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/ app/users/page.tsx
git commit -m "feat: add dashboard and users list pages"
```

---

## Task 10: User Detail Page

**Files:**
- Create: `app/users/[id]/page.tsx`

This is the most complex page: strike summary with threshold warnings, ban status panel, issue strike modal, issue ban modal, strike history table, mod toggle. Adapted from gallery's `app/(admin)/admin/users/[id]/page.tsx`.

- [ ] **Step 1: Create `app/users/[id]/page.tsx`**

Copy the content from `C:\Users\gavri\OneDrive\Documents\Projects\gallery\app\(admin)\admin\users\[id]\page.tsx` into `C:\Users\gavri\OneDrive\Documents\Projects\gallery-admin\app\users\[id]\page.tsx`, then make these changes:

1. Change the import at the top:
   - Remove: `import { useSession } from "next-auth/react"`
   - Add: `import { useSession } from "next-auth/react"` (keep — it's still used)
   - Change: `import { trpc } from "@/components/providers"` → keep as-is
   - Add: `import AdminLayout from "@/components/AdminLayout"`

2. Change the `useRouter` push calls from `/admin/users` to `/users`:
   - `router.push("/admin/users")` → `router.push("/users")`

3. Wrap the return value with `<AdminLayout>`:
   - The outermost `<div style={{ maxWidth: 680 }}>` should be wrapped in `<AdminLayout>...</AdminLayout>`

4. The component signature changes from Next.js dynamic params pattern — keep `use(params)` as-is.

The full file with all changes applied:

```typescript
"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import AdminLayout from "@/components/AdminLayout"
import { trpc } from "@/components/providers"

const LEVEL_COLORS: Record<string, string> = {
  MINOR: "#facc15", MODERATE: "#fb923c", SEVERE: "#f87171", ZERO_TOLERANCE: "#dc2626",
}

const ALL_VIOLATIONS = [
  "ARTIST_CANCEL", "FAKE_DELIVERY", "FALSE_ADVERTISING", "BAIT_AND_SWITCH",
  "OFF_PLATFORM_PAYMENT", "COMMISSION_FARMING", "SHOP_FALSE_ADVERTISING",
  "UNLABELLED_AI", "GORE", "HARASSMENT", "HATE_SPEECH", "SPAM",
  "DMCA_VIOLATION", "FTC_DISCLOSURE", "NCMEC_VIOLATION",
  "CHARGEBACK_FRAUD", "ZERO_TOLERANCE_CONDUCT",
] as const

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()

  const { data: user, refetch } = trpc.admin.getUser.useQuery({ userId: id })

  const [showBanModal, setShowBanModal] = useState(false)
  const [banDuration, setBanDuration] = useState<"3d" | "14d" | "30d" | "permanent">("3d")
  const [banReason, setBanReason] = useState("")

  const [showStrikeModal, setShowStrikeModal] = useState(false)
  const [strikeLevel, setStrikeLevel] = useState<"MINOR" | "MODERATE" | "SEVERE" | "ZERO_TOLERANCE">("MINOR")
  const [strikeViolation, setStrikeViolation] = useState<typeof ALL_VIOLATIONS[number]>("SPAM")
  const [strikeContentId, setStrikeContentId] = useState("")
  const [strikeContentType, setStrikeContentType] = useState("")
  const [strikeNotes, setStrikeNotes] = useState("")

  const setModerator = trpc.admin.setModerator.useMutation({ onSuccess: () => refetch() })
  const issueStrike = trpc.admin.issueStrike.useMutation({
    onSuccess: () => { setShowStrikeModal(false); refetch() },
    onError: (err) => alert(err.message),
  })
  const issueBan = trpc.admin.issueBan.useMutation({
    onSuccess: () => { setShowBanModal(false); refetch() },
    onError: (err) => alert(err.message),
  })
  const liftBan = trpc.admin.liftBan.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => alert(err.message),
  })

  if (!user) return <AdminLayout><div style={{ color: "rgba(255,255,255,0.4)", padding: 24 }}>Loading…</div></AdminLayout>

  const isAdmin = session?.user?.isAdmin ?? false
  const isBanned = user.bannedUntil && new Date(user.bannedUntil) > new Date()
  const isPermanentBan = user.bannedUntil && new Date(user.bannedUntil).getFullYear() === 9999

  const activeStrikes = user.receivedStrikes.filter(s => !s.reversed)
  const minorCount = activeStrikes.filter(s => s.level === "MINOR").length
  const moderateCount = activeStrikes.filter(s => s.level === "MODERATE").length
  const severeCount = activeStrikes.filter(s => s.level === "SEVERE").length
  const zeroCount = activeStrikes.filter(s => s.level === "ZERO_TOLERANCE").length

  return (
    <AdminLayout>
      <div style={{ maxWidth: 680 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => router.push("/users")} style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>← Back</button>
          <h1 style={{ color: "white", fontSize: 20, fontWeight: 700 }}>@{user.username ?? "—"}</h1>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>{user.email}</span>
          {user.isAdmin && <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>ADMIN</span>}
          {user.isModerator && !user.isAdmin && <span style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700 }}>MOD</span>}
        </div>

        {/* Mod toggle (admin only) */}
        {isAdmin && !user.isAdmin && (
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Moderator status</span>
            <button
              onClick={() => setModerator.mutate({ userId: id, isModerator: !user.isModerator })}
              disabled={setModerator.isPending}
              style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: user.isModerator ? "rgba(248,113,113,0.15)" : "rgba(96,165,250,0.15)", border: `1px solid ${user.isModerator ? "rgba(248,113,113,0.4)" : "rgba(96,165,250,0.4)"}`, color: user.isModerator ? "#f87171" : "#60a5fa" }}
            >
              {user.isModerator ? "Remove Moderator" : "Make Moderator"}
            </button>
          </div>
        )}

        {/* Ban status */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Ban Status</p>
          {isBanned ? (
            <div>
              <p style={{ color: "#f87171", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {isPermanentBan ? "Permanently suspended" : `Banned until ${new Date(user.bannedUntil!).toLocaleDateString()}`}
              </p>
              {user.banReason && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 12 }}>{user.banReason}</p>}
              <button
                onClick={() => liftBan.mutate({ userId: id })}
                disabled={liftBan.isPending}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", cursor: "pointer" }}
              >
                Lift Ban
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Not banned</span>
              {!user.isAdmin && !user.isModerator && (
                <button
                  onClick={() => setShowBanModal(true)}
                  style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171", cursor: "pointer" }}
                >
                  Issue Ban
                </button>
              )}
            </div>
          )}
        </div>

        {/* Strike summary */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Strikes</p>
            {!user.isAdmin && !user.isModerator && (
              <button
                onClick={() => setShowStrikeModal(true)}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", cursor: "pointer" }}
              >
                Issue Strike
              </button>
            )}
          </div>
          <p style={{ color: "white", fontSize: 14 }}>
            <span style={{ color: LEVEL_COLORS.MINOR }}>{minorCount} Minor</span>
            {" · "}
            <span style={{ color: LEVEL_COLORS.MODERATE }}>{moderateCount} Moderate</span>
            {" · "}
            <span style={{ color: LEVEL_COLORS.SEVERE }}>{severeCount} Severe</span>
            {" · "}
            <span style={{ color: LEVEL_COLORS.ZERO_TOLERANCE }}>{zeroCount} Zero Tolerance</span>
          </p>
          {minorCount >= 6 && <p style={{ color: "#fbbf24", fontSize: 12, marginTop: 6 }}>⚠ 6+ Minor — ToS threshold</p>}
          {moderateCount >= 4 && <p style={{ color: "#fbbf24", fontSize: 12, marginTop: 6 }}>⚠ 4+ Moderate — ToS threshold</p>}
          {severeCount >= 1 && <p style={{ color: "#fbbf24", fontSize: 12, marginTop: 6 }}>⚠ Severe strike — ToS threshold</p>}
        </div>

        {/* Strike history */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Strike History</p>
          {user.receivedStrikes.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No strikes.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {user.receivedStrikes.map(s => (
                <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", opacity: s.reversed ? 0.5 : 1 }}>
                  <span style={{ color: LEVEL_COLORS[s.level] ?? "white", fontSize: 12, fontWeight: 700, minWidth: 80 }}>{s.level}</span>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, flex: 1 }}>{s.violation.replace(/_/g, " ")}</span>
                  {s.reversed && <span style={{ color: "#4ade80", fontSize: 11 }}>REVERSED</span>}
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>by @{s.issuedBy.username ?? "—"}</span>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ban modal */}
        {showBanModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 24, width: 360 }}>
              <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Issue Ban</h2>
              <select value={banDuration} onChange={e => setBanDuration(e.target.value as typeof banDuration)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14 }}>
                <option value="3d">3 days</option>
                <option value="14d">14 days</option>
                <option value="30d">30 days</option>
                <option value="permanent">Permanent</option>
              </select>
              <textarea
                placeholder="Reason (shown to user)…"
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 16, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14, resize: "none", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowBanModal(false)} style={{ flex: 1, padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", cursor: "pointer", fontSize: 14 }}>Cancel</button>
                <button
                  onClick={() => issueBan.mutate({ userId: id, duration: banDuration, reason: banReason })}
                  disabled={!banReason.trim() || issueBan.isPending}
                  style={{ flex: 1, padding: 10, borderRadius: 8, background: "rgba(248,113,113,0.2)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
                >
                  {issueBan.isPending ? "Banning…" : "Ban User"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Strike modal */}
        {showStrikeModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 24, width: 400 }}>
              <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Issue Strike</h2>
              <select value={strikeLevel} onChange={e => setStrikeLevel(e.target.value as typeof strikeLevel)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14 }}>
                <option value="MINOR">Minor</option>
                <option value="MODERATE">Moderate</option>
                <option value="SEVERE">Severe</option>
                <option value="ZERO_TOLERANCE">Zero Tolerance</option>
              </select>
              <select value={strikeViolation} onChange={e => setStrikeViolation(e.target.value as typeof strikeViolation)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14 }}>
                {ALL_VIOLATIONS.map(v => <option key={v} value={v}>{v.replace(/_/g, " ")}</option>)}
              </select>
              <input placeholder="Content ID (optional)" value={strikeContentId} onChange={e => setStrikeContentId(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14, boxSizing: "border-box" }} />
              <select value={strikeContentType} onChange={e => setStrikeContentType(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14 }}>
                <option value="">Content type (optional)</option>
                <option value="post">Post</option>
                <option value="commission">Commission</option>
                <option value="shop_item">Shop item</option>
              </select>
              <textarea placeholder="Internal notes (optional)" value={strikeNotes} onChange={e => setStrikeNotes(e.target.value)} rows={2} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 16, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14, resize: "none", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowStrikeModal(false)} style={{ flex: 1, padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", cursor: "pointer", fontSize: 14 }}>Cancel</button>
                <button
                  onClick={() => issueStrike.mutate({
                    userId: id, level: strikeLevel, violation: strikeViolation,
                    contentId: strikeContentId || undefined,
                    contentType: strikeContentType as "post" | "commission" | "shop_item" | undefined || undefined,
                    notes: strikeNotes || undefined,
                  })}
                  disabled={issueStrike.isPending}
                  style={{ flex: 1, padding: 10, borderRadius: 8, background: "rgba(255,100,100,0.2)", border: "1px solid rgba(255,100,100,0.4)", color: "#f87171", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
                >
                  {issueStrike.isPending ? "Issuing…" : "Issue Strike"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: 8 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/users/
git commit -m "feat: add user detail page with strike and ban management"
```

---

## Task 11: Appeals Pages

**Files:**
- Create: `app/appeals/page.tsx`
- Create: `app/appeals/[id]/page.tsx`

- [ ] **Step 1: Create `app/appeals/page.tsx`**

```typescript
"use client"

import { useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { trpc } from "@/components/providers"

export default function AppealsPage() {
  const router = useRouter()
  const { data: appeals, isLoading } = trpc.admin.listAppeals.useQuery({ status: "PENDING" })

  return (
    <AdminLayout>
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
              onClick={() => router.push(`/appeals/${a.id}`)}
              style={{
                padding: "14px 16px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "inherit",
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
    </AdminLayout>
  )
}
```

- [ ] **Step 2: Create `app/appeals/[id]/page.tsx`**

```typescript
"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { trpc } from "@/components/providers"

const LEVEL_COLORS: Record<string, string> = {
  MINOR: "#facc15", MODERATE: "#fb923c", SEVERE: "#f87171", ZERO_TOLERANCE: "#dc2626",
}

export default function AppealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: appeal, isLoading, error } = trpc.admin.getAppeal.useQuery({ appealId: id })

  const approveAppeal = trpc.admin.approveAppeal.useMutation({
    onSuccess: () => router.push("/appeals"),
    onError: (err) => alert(err.message),
  })
  const denyAppeal = trpc.admin.denyAppeal.useMutation({
    onSuccess: () => router.push("/appeals"),
    onError: (err) => alert(err.message),
  })

  if (isLoading) return <AdminLayout><div style={{ color: "rgba(255,255,255,0.4)", padding: 24 }}>Loading…</div></AdminLayout>
  if (error || !appeal) return <AdminLayout><div style={{ color: "#f87171", padding: 24 }}>Appeal not found.</div></AdminLayout>

  const isPending = appeal.status === "PENDING"

  return (
    <AdminLayout>
      <div style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => router.push("/appeals")} style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>← Back</button>
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

        {/* User's full strike history */}
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
              disabled={approveAppeal.isPending || denyAppeal.isPending}
              style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", cursor: "pointer" }}
            >
              {approveAppeal.isPending ? "Approving…" : "✓ Approve — Reverse strike & lift ban"}
            </button>
            <button
              onClick={() => denyAppeal.mutate({ appealId: id })}
              disabled={approveAppeal.isPending || denyAppeal.isPending}
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
    </AdminLayout>
  )
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: 8 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/appeals/
git commit -m "feat: add appeals queue and appeal detail pages"
```

---

## Task 12: Password Seed Script

**Files:**
- Create: `scripts/set-admin-password.ts`

This is a one-time CLI script to set a password for any staff account. Run it once to set the password for `@the_rat_queen`, and again whenever a new moderator needs a password.

- [ ] **Step 1: Create `scripts/set-admin-password.ts`**

```typescript
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const [email, password] = process.argv.slice(2)

  if (!email || !password) {
    console.error("Usage: npx ts-node scripts/set-admin-password.ts <email> <password>")
    process.exit(1)
  }

  if (password.length < 12) {
    console.error("Password must be at least 12 characters.")
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, username: true, isAdmin: true, isModerator: true },
  })

  if (!user) {
    console.error(`No user found with email: ${email}`)
    process.exit(1)
  }

  if (!user.isAdmin && !user.isModerator) {
    console.error(`User @${user.username} is not an admin or moderator. Set isAdmin/isModerator first.`)
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 10)

  await prisma.user.update({
    where: { email },
    data: { password: hash },
  })

  console.log(`✓ Password set for @${user.username} (${user.isAdmin ? "Admin" : "Moderator"})`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Add `ts-node` to devDependencies**

In `package.json`, add to `devDependencies`:
```json
"ts-node": "^10.9.2"
```

Then run:
```bash
npm install
```

- [ ] **Step 3: Test the script manually**

After installing, run with your admin account's email and a strong password (12+ characters):

```bash
npx ts-node --esm scripts/set-admin-password.ts <your-admin-email> <your-password>
```

Expected output: `✓ Password set for @the_rat_queen (Admin)`

If you see `User is not an admin or moderator`, that means `isAdmin` is `false` in the DB — you'll need to set it directly first:
```sql
UPDATE "User" SET "isAdmin" = true WHERE email = '<your-email>';
```

- [ ] **Step 4: Commit**

```bash
git add scripts/ package.json package-lock.json
git commit -m "feat: add set-admin-password seed script"
```

---

## Task 13: Smoke Test the Admin App

Before cleaning up gallery, verify the admin app actually works end to end.

- [ ] **Step 1: Start the admin dev server on port 3001**

In `package.json` scripts, update dev:
```json
"dev": "next dev -p 3001"
```

Then run:
```bash
npm run dev
```

Expected: server starts at `http://localhost:3001`

- [ ] **Step 2: Verify login page**

Open `http://localhost:3001` in a browser.

Expected: redirected to `http://localhost:3001/login` (middleware working).

- [ ] **Step 3: Sign in with admin credentials**

Enter the email and password you set via the seed script in Task 12.

Expected:
- Successful login redirects to `/dashboard`
- Top nav shows "Gallery Admin" · Dashboard · Users · Appeals · "Admin · @the_rat_queen" · Sign out

- [ ] **Step 4: Test Users page**

Click "Users" in the nav.

Expected: user list loads, search works.

- [ ] **Step 5: Test a User detail page**

Click any user row.

Expected: strike summary, ban panel, and strike history load.

- [ ] **Step 6: Test Appeals page**

Click "Appeals" in the nav.

Expected: appeals queue loads (may be empty).

- [ ] **Step 7: Test sign out**

Click "Sign out".

Expected: redirected to `/login`.

- [ ] **Step 8: Run tests**

```bash
npx vitest run
```

Expected: 8 tests PASS.

- [ ] **Step 9: Commit**

```bash
# Update dev script in package.json
git add package.json
git commit -m "chore: set dev server to port 3001"
```

---

## Task 14: Clean Up Gallery

Now that the admin app works, remove the admin panel from the gallery app.

Working directory for this task: `C:\Users\gavri\OneDrive\Documents\Projects\gallery`

**Files:**
- Delete: `app/(admin)/` (entire folder)
- Delete: `server/routers/admin.ts`
- Modify: `server/routers/_app.ts`

- [ ] **Step 1: Delete the admin route group from gallery**

```bash
# Working in: C:\Users\gavri\OneDrive\Documents\Projects\gallery
Remove-Item -Recurse -Force "app/(admin)"
```

- [ ] **Step 2: Delete the admin router from gallery**

```bash
Remove-Item "server/routers/admin.ts"
```

- [ ] **Step 3: Remove admin from `server/routers/_app.ts`**

Open `server/routers/_app.ts`. Remove the import line:
```typescript
import { adminRouter } from "./admin"
```

And remove from the router:
```typescript
  admin: adminRouter,
```

The file should look like:
```typescript
import { router } from "@/lib/trpc"
import { userRouter } from "./user"
import { postRouter } from "./post"
import { followRouter } from "./follow"
import { notificationRouter } from "./notification"
import { interactionRouter } from "./interaction"
import { hashtagRouter } from "./hashtag"
import { shopRouter } from "./shop"
import { commissionRouter } from "./commission"
import { commissionMessageRouter } from "./commissionMessage"
import { dmRouter } from "./dm"
import { pushRouter } from "./push"
import { storyRouter } from "./story"

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
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 4: Run gallery tests to confirm nothing broke**

```bash
npx vitest run
```

Expected: 107 tests PASS. (The admin tests from `tests/server/admin.test.ts` will now fail because the admin router is gone — delete that test file too.)

Actually check first: if `tests/server/admin.test.ts` imports from `@/server/routers/_app` and the admin router is gone, it will fail. Delete it:

```bash
Remove-Item "tests/server/admin.test.ts"
```

Then run:
```bash
npx vitest run
```

Expected: remaining tests PASS (admin tests gone, rest intact).

- [ ] **Step 5: Commit in gallery**

```bash
git add -A
git commit -m "feat: remove admin panel from gallery (moved to gallery-admin)"
```

- [ ] **Step 6: Push gallery**

```bash
git push origin master
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] `http://localhost:3001/login` — shows login form
- [ ] Correct credentials → redirected to `/dashboard`
- [ ] Wrong credentials → "Invalid credentials." error
- [ ] Direct navigation to `/users` without login → redirected to `/login`
- [ ] `http://localhost:3000/admin` in gallery → 404 (route removed)
- [ ] Gallery tests still pass: `npx vitest run` in gallery directory
- [ ] Admin app tests pass: `npx vitest run` in gallery-admin directory
