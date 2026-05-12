# Commission System — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the database schema, tRPC routers, and Professional Profile page that the rest of the commission system builds on.

**Architecture:** Extend the Prisma schema with three new models (Commission, CommissionDropdownCategory, ProfessionalMessage) and new User fields, wire up a single `commissionRouter` and a `commissionMessageRouter`, then build the Professional Profile artist dashboard page and wire it into the hamburger menu.

**Tech Stack:** Prisma 5 + PostgreSQL (Neon), tRPC v11, Next.js 16 App Router, Tailwind CSS, React 19, NextAuth v4 JWT session.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add 3 new models, new enum, new User fields |
| `server/routers/commission.ts` | Create | All commission + category procedures |
| `server/routers/commissionMessage.ts` | Create | Message send procedure |
| `server/routers/_app.ts` | Modify | Register both new routers |
| `app/professional-profile/page.tsx` | Create | Artist dashboard: settings + business overview |
| `components/Navbar.tsx` | Modify | Add Professional Profile + Professional DMs to hamburger |

---

## Task 1: Extend the Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new fields to the User model**

Open `prisma/schema.prisma`. Inside the `model User` block, after the `artstationHandle` line and before the `accounts` relation, add:

```prisma
  commissionDescription    String?                      @db.Text
  commissionTurnaround     String?
  priceRanges              Json?

  buyerCommissions         Commission[]                 @relation("BuyerCommissions")
  artistCommissions        Commission[]                 @relation("ArtistCommissions")
  commissionCategories     CommissionDropdownCategory[]
  sentProfessionalMessages ProfessionalMessage[]        @relation("SentProfessionalMessages")
```

- [ ] **Step 2: Add the new enum and models**

After the closing `}` of the existing `CommissionStatus` enum at the bottom of the file, append:

```prisma
enum CommissionRequestStatus {
  PENDING
  ACCEPTED
  IN_PROGRESS
  DELIVERED
  COMPLETE
  DECLINED
  CANCELLED
}

model Commission {
  id                 String                  @id @default(cuid())
  buyerId            String
  artistId           String
  buyer              User                    @relation("BuyerCommissions", fields: [buyerId], references: [id], onDelete: Cascade)
  artist             User                    @relation("ArtistCommissions", fields: [artistId], references: [id], onDelete: Cascade)
  status             CommissionRequestStatus @default(PENDING)
  description        String                  @db.Text
  dropdownSelections Json
  referencePhotos    Json                    @default("[]")
  agreedPrice        Float?
  deliveredAt        DateTime?
  createdAt          DateTime                @default(now())
  updatedAt          DateTime                @updatedAt
  messages           ProfessionalMessage[]
}

model CommissionDropdownCategory {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  options   String[]
  order     Int      @default(0)
  createdAt DateTime @default(now())
}

model ProfessionalMessage {
  id           String     @id @default(cuid())
  commissionId String
  commission   Commission @relation(fields: [commissionId], references: [id], onDelete: Cascade)
  senderId     String
  sender       User       @relation("SentProfessionalMessages", fields: [senderId], references: [id], onDelete: Cascade)
  text         String?    @db.Text
  fileUrl      String?    @db.Text
  createdAt    DateTime   @default(now())
}
```

- [ ] **Step 3: Push schema to the database**

```bash
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

If you get `EPERM` errors about a locked `.dll.node` file, stop the dev server first, run the push, then restart it. The schema IS pushed correctly even if that warning appears.

- [ ] **Step 4: Regenerate the Prisma client**

```bash
npx prisma generate
```

Expected output: `Generated Prisma Client`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Commission, CommissionDropdownCategory, ProfessionalMessage schema"
```

---

## Task 2: Commission tRPC router

**Files:**
- Create: `server/routers/commission.ts`

- [ ] **Step 1: Create the file**

Create `server/routers/commission.ts` with the full content below. This single router handles commission lifecycle, dropdown category management, artist profile settings, and the discovery feed query.

```typescript
import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"

const priceRangeSchema = z.array(z.object({
  label: z.string().min(1).max(100),
  price: z.number().positive(),
}))

export const commissionRouter = router({

  // ── Artist profile settings ───────────────────────────────────────────────

  getProfile: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: {
          id: true,
          username: true,
          name: true,
          image: true,
          commissionStatus: true,
          commissionDescription: true,
          commissionTurnaround: true,
          priceRanges: true,
          commissionCategories: { orderBy: { order: "asc" } },
        },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      return user
    }),

  updateProfile: protectedProcedure
    .input(z.object({
      commissionStatus: z.enum(["OPEN", "LIMITED", "CLOSED"]),
      commissionDescription: z.string().max(2000).optional(),
      commissionTurnaround: z.string().max(100).optional(),
      priceRanges: priceRangeSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          commissionStatus: input.commissionStatus,
          commissionDescription: input.commissionDescription ?? null,
          commissionTurnaround: input.commissionTurnaround ?? null,
          priceRanges: input.priceRanges ?? [],
        },
      })
    }),

  // ── Business overview (artist only) ──────────────────────────────────────

  getMyStats: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id

      const [activeCommissions, completedCommissions] = await Promise.all([
        ctx.prisma.commission.findMany({
          where: {
            artistId: userId,
            status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS", "DELIVERED"] },
          },
          select: { id: true, agreedPrice: true, status: true },
        }),
        ctx.prisma.commission.findMany({
          where: { artistId: userId, status: "COMPLETE" },
          select: { agreedPrice: true },
        }),
      ])

      const escrowHeld = activeCommissions
        .filter(c => ["IN_PROGRESS", "DELIVERED"].includes(c.status))
        .reduce((sum, c) => sum + (c.agreedPrice ?? 0), 0)

      const totalEarned = completedCommissions
        .reduce((sum, c) => sum + (c.agreedPrice ?? 0), 0)

      return {
        activeCount: activeCommissions.length,
        escrowHeld,
        totalEarned,
      }
    }),

  // ── Dropdown category management ─────────────────────────────────────────

  getCategories: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.prisma.commissionDropdownCategory.findMany({
        where: { userId: user.id },
        orderBy: { order: "asc" },
      })
    }),

  createCategory: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      options: z.array(z.string().min(1).max(50)).min(1).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.prisma.commissionDropdownCategory.count({
        where: { userId: ctx.session.user.id },
      })
      return ctx.prisma.commissionDropdownCategory.create({
        data: {
          userId: ctx.session.user.id,
          name: input.name,
          options: input.options,
          order: count,
        },
      })
    }),

  updateCategory: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(50).optional(),
      options: z.array(z.string().min(1).max(50)).min(1).max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cat = await ctx.prisma.commissionDropdownCategory.findUnique({ where: { id: input.id } })
      if (!cat) throw new TRPCError({ code: "NOT_FOUND" })
      if (cat.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.commissionDropdownCategory.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.options !== undefined ? { options: input.options } : {}),
        },
      })
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cat = await ctx.prisma.commissionDropdownCategory.findUnique({ where: { id: input.id } })
      if (!cat) throw new TRPCError({ code: "NOT_FOUND" })
      if (cat.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.commissionDropdownCategory.delete({ where: { id: input.id } })
    }),

  // ── Commission request lifecycle ─────────────────────────────────────────

  submitRequest: protectedProcedure
    .input(z.object({
      artistId: z.string(),
      description: z.string().min(1).max(5000),
      dropdownSelections: z.record(z.string()),
      referencePhotos: z.array(z.string()).max(5).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.artistId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot commission yourself" })
      }
      const artist = await ctx.prisma.user.findUnique({ where: { id: input.artistId } })
      if (!artist) throw new TRPCError({ code: "NOT_FOUND", message: "Artist not found" })
      if (artist.commissionStatus === "CLOSED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This artist is not accepting commissions" })
      }
      return ctx.prisma.commission.create({
        data: {
          buyerId: ctx.session.user.id,
          artistId: input.artistId,
          description: input.description,
          dropdownSelections: input.dropdownSelections,
          referencePhotos: input.referencePhotos ?? [],
        },
      })
    }),

  getMine: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id
      const [asBuyer, asArtist] = await Promise.all([
        ctx.prisma.commission.findMany({
          where: { buyerId: userId },
          include: {
            artist: { select: { id: true, username: true, name: true, image: true } },
          },
          orderBy: { updatedAt: "desc" },
        }),
        ctx.prisma.commission.findMany({
          where: { artistId: userId },
          include: {
            buyer: { select: { id: true, username: true, name: true, image: true } },
          },
          orderBy: { updatedAt: "desc" },
        }),
      ])
      return { asBuyer, asArtist }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({
        where: { id: input.id },
        include: {
          buyer: { select: { id: true, username: true, name: true, image: true } },
          artist: { select: { id: true, username: true, name: true, image: true } },
          messages: {
            include: {
              sender: { select: { id: true, username: true, image: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== ctx.session.user.id && commission.artistId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }
      return commission
    }),

  accept: protectedProcedure
    .input(z.object({ id: z.string(), price: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not pending" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "ACCEPTED", agreedPrice: input.price },
      })
    }),

  decline: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not pending" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "DECLINED" },
      })
    }),

  updatePrice: protectedProcedure
    .input(z.object({ id: z.string(), price: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "ACCEPTED") throw new TRPCError({ code: "BAD_REQUEST", message: "Can only update price on accepted commissions" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { agreedPrice: input.price },
      })
    }),

  confirmPayment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "ACCEPTED") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not accepted yet" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "IN_PROGRESS" },
      })
    }),

  markDelivered: protectedProcedure
    .input(z.object({ id: z.string(), fileUrl: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.artistId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "IN_PROGRESS") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission is not in progress" })
      await ctx.prisma.professionalMessage.create({
        data: {
          commissionId: input.id,
          senderId: ctx.session.user.id,
          text: "✅ Work delivered! Please review and confirm receipt.",
          fileUrl: input.fileUrl,
        },
      })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      })
    }),

  confirmDelivery: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (commission.buyerId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (commission.status !== "DELIVERED") throw new TRPCError({ code: "BAD_REQUEST", message: "Commission has not been delivered yet" })
      return ctx.prisma.commission.update({
        where: { id: input.id },
        data: { status: "COMPLETE" },
      })
    }),

  checkAutoRelease: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.id } })
      if (!commission || commission.status !== "DELIVERED" || !commission.deliveredAt) return null
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000
      if (Date.now() - commission.deliveredAt.getTime() >= fiveDaysMs) {
        return ctx.prisma.commission.update({
          where: { id: input.id },
          data: { status: "COMPLETE" },
        })
      }
      return null
    }),

  // ── Discovery feed ────────────────────────────────────────────────────────

  getDiscovery: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const users = await ctx.prisma.user.findMany({
        where: {
          commissionStatus: { in: ["OPEN", "LIMITED"] },
          sellingEnabled: true,
          username: { not: null },
          ...(input.search ? {
            OR: [
              { username: { contains: input.search, mode: "insensitive" } },
              { name: { contains: input.search, mode: "insensitive" } },
              {
                commissionCategories: {
                  some: {
                    options: { has: input.search },
                  },
                },
              },
            ],
          } : {}),
        },
        select: {
          id: true,
          username: true,
          name: true,
          image: true,
          commissionStatus: true,
          priceRanges: true,
          posts: {
            where: { isCommission: true },
            take: 6,
            orderBy: { createdAt: "desc" },
            select: { id: true, image: true },
          },
          commissionCategories: {
            orderBy: { order: "asc" },
            select: { name: true, options: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      // Client-side price filter (avg of price ranges)
      if (input.minPrice !== undefined || input.maxPrice !== undefined) {
        return users.filter(u => {
          const ranges = u.priceRanges as { label: string; price: number }[] | null
          if (!ranges || ranges.length === 0) return false
          const avg = ranges.reduce((s, r) => s + r.price, 0) / ranges.length
          if (input.minPrice !== undefined && avg < input.minPrice) return false
          if (input.maxPrice !== undefined && avg > input.maxPrice) return false
          return true
        })
      }
      return users
    }),
})
```

- [ ] **Step 2: Verify the file was created**

```bash
ls server/routers/commission.ts
```

Expected: file exists.

- [ ] **Step 3: Commit**

```bash
git add server/routers/commission.ts
git commit -m "feat: add commission tRPC router"
```

---

## Task 3: CommissionMessage tRPC router

**Files:**
- Create: `server/routers/commissionMessage.ts`

- [ ] **Step 1: Create the file**

```typescript
import { z } from "zod"
import { router, protectedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"

const CLOSED_STATUSES = ["COMPLETE", "DECLINED", "CANCELLED"]

export const commissionMessageRouter = router({
  send: protectedProcedure
    .input(z.object({
      commissionId: z.string(),
      text: z.string().min(1).max(5000).optional(),
      fileUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.text && !input.fileUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Message must have text or a file" })
      }
      const commission = await ctx.prisma.commission.findUnique({ where: { id: input.commissionId } })
      if (!commission) throw new TRPCError({ code: "NOT_FOUND" })
      if (
        commission.buyerId !== ctx.session.user.id &&
        commission.artistId !== ctx.session.user.id
      ) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }
      if (CLOSED_STATUSES.includes(commission.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This commission thread is closed" })
      }
      return ctx.prisma.professionalMessage.create({
        data: {
          commissionId: input.commissionId,
          senderId: ctx.session.user.id,
          text: input.text ?? null,
          fileUrl: input.fileUrl ?? null,
        },
      })
    }),
})
```

- [ ] **Step 2: Commit**

```bash
git add server/routers/commissionMessage.ts
git commit -m "feat: add commissionMessage tRPC router"
```

---

## Task 4: Register routers in `_app.ts`

**Files:**
- Modify: `server/routers/_app.ts`

- [ ] **Step 1: Update `_app.ts`**

Replace the entire contents of `server/routers/_app.ts` with:

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
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 2: Verify the dev server starts without errors**

```bash
npm run dev
```

Expected: server starts, no TypeScript errors in the console about missing routers.

- [ ] **Step 3: Commit**

```bash
git add server/routers/_app.ts
git commit -m "feat: register commission and commissionMessage routers"
```

---

## Task 5: Professional Profile page

**Files:**
- Create: `app/professional-profile/page.tsx`

This page has two sections visible only to the logged-in artist:
1. **Commission Settings** — status, description, turnaround, price ranges, dropdown categories
2. **Business Overview** — active commissions, escrow held, total earned

- [ ] **Step 1: Create the page**

Create `app/professional-profile/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

type PriceRange = { label: string; price: number }

export default function ProfessionalProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect if not logged in
  if (status === "unauthenticated") {
    router.push("/signin")
    return null
  }

  if (status === "loading" || !session?.user?.username) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    )
  }

  return <ProfessionalProfileInner username={session.user.username!} />
}

function ProfessionalProfileInner({ username }: { username: string }) {
  const utils = trpc.useUtils()
  const { data: profile, isLoading } = trpc.commission.getProfile.useQuery({ username })
  const { data: stats } = trpc.commission.getMyStats.useQuery()
  const { data: categories } = trpc.commission.getCategories.useQuery({ username })

  // Settings form state
  const [status, setStatus] = useState<"OPEN" | "LIMITED" | "CLOSED">("CLOSED")
  const [description, setDescription] = useState("")
  const [turnaround, setTurnaround] = useState("")
  const [priceRanges, setPriceRanges] = useState<PriceRange[]>([])
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Initialize form from loaded profile
  if (profile && !initialized) {
    setStatus(profile.commissionStatus as "OPEN" | "LIMITED" | "CLOSED")
    setDescription(profile.commissionDescription ?? "")
    setTurnaround(profile.commissionTurnaround ?? "")
    setPriceRanges((profile.priceRanges as PriceRange[]) ?? [])
    setInitialized(true)
  }

  // New price range inputs
  const [newRangeLabel, setNewRangeLabel] = useState("")
  const [newRangePrice, setNewRangePrice] = useState("")

  // New category inputs
  const [newCatName, setNewCatName] = useState("")
  const [newCatOptions, setNewCatOptions] = useState("")
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState("")
  const [editCatOptions, setEditCatOptions] = useState("")

  const updateProfile = trpc.commission.updateProfile.useMutation({
    onSuccess: () => {
      utils.commission.getProfile.invalidate({ username })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    },
  })

  const createCategory = trpc.commission.createCategory.useMutation({
    onSuccess: () => {
      utils.commission.getCategories.invalidate({ username })
      setNewCatName("")
      setNewCatOptions("")
    },
  })

  const updateCategory = trpc.commission.updateCategory.useMutation({
    onSuccess: () => {
      utils.commission.getCategories.invalidate({ username })
      setEditingCat(null)
    },
  })

  const deleteCategory = trpc.commission.deleteCategory.useMutation({
    onSuccess: () => utils.commission.getCategories.invalidate({ username }),
  })

  function addPriceRange() {
    const price = parseFloat(newRangePrice)
    if (!newRangeLabel.trim() || isNaN(price) || price <= 0) return
    setPriceRanges(prev => [...prev, { label: newRangeLabel.trim(), price }])
    setNewRangeLabel("")
    setNewRangePrice("")
  }

  function removePriceRange(i: number) {
    setPriceRanges(prev => prev.filter((_, idx) => idx !== i))
  }

  function saveSettings() {
    updateProfile.mutate({ commissionStatus: status, commissionDescription: description, commissionTurnaround: turnaround, priceRanges })
  }

  function startEditCat(id: string, name: string, options: string[]) {
    setEditingCat(id)
    setEditCatName(name)
    setEditCatOptions(options.join(", "))
  }

  function saveEditCat(id: string) {
    const opts = editCatOptions.split(",").map(o => o.trim()).filter(Boolean)
    if (!editCatName.trim() || opts.length === 0) return
    updateCategory.mutate({ id, name: editCatName.trim(), options: opts })
  }

  function addCategory() {
    const opts = newCatOptions.split(",").map(o => o.trim()).filter(Boolean)
    if (!newCatName.trim() || opts.length === 0) return
    createCategory.mutate({ name: newCatName.trim(), options: opts })
  }

  const statusColors = {
    OPEN: "bg-green-100 text-green-700 border-green-200",
    LIMITED: "bg-yellow-100 text-yellow-700 border-yellow-200",
    CLOSED: "bg-gray-100 text-gray-600 border-gray-200",
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Professional Profile</h1>
      <p className="text-sm text-gray-500 mb-8">Manage your commission settings and view your business overview.</p>

      {/* ── Business Overview ── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Business Overview</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats?.activeCount ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Active commissions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">${(stats?.escrowHeld ?? 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">In escrow</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">${(stats?.totalEarned ?? 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Total earned</p>
          </div>
        </div>
      </section>

      {/* ── Commission Settings ── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Commission Settings</h2>

        {/* Status */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 block mb-2">Status</label>
          <div className="flex gap-2">
            {(["OPEN", "LIMITED", "CLOSED"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  status === s ? statusColors[s] : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {s === "OPEN" ? "Open" : s === "LIMITED" ? "Limited" : "Closed"}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 block mb-2">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Tell buyers what you offer, your style, any terms…"
            rows={4}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Turnaround */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-gray-600 block mb-2">Turnaround time</label>
          <input
            type="text"
            value={turnaround}
            onChange={e => setTurnaround(e.target.value)}
            placeholder="e.g. 1–2 weeks"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Price ranges */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 block mb-2">Price ranges</label>
          {priceRanges.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {priceRanges.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-sm text-gray-700">{r.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">${r.price}</span>
                    <button
                      onClick={() => removePriceRange(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newRangeLabel}
              onChange={e => setNewRangeLabel(e.target.value)}
              placeholder="Label (e.g. Bust)"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={newRangePrice}
              onChange={e => setNewRangePrice(e.target.value)}
              placeholder="Price ($)"
              min="0"
              className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addPriceRange}
              className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={updateProfile.isPending}
          className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {updateProfile.isPending ? "Saving…" : settingsSaved ? "✓ Saved" : "Save settings"}
        </button>
      </section>

      {/* ── Dropdown Categories ── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">Commission Form Options</h2>
        <p className="text-xs text-gray-400 mb-4">These dropdowns appear on your commission request form. Each is mandatory for buyers.</p>

        {categories && categories.length > 0 && (
          <div className="flex flex-col gap-3 mb-4">
            {categories.map(cat => (
              <div key={cat.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                {editingCat === cat.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      value={editCatName}
                      onChange={e => setEditCatName(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Category name"
                    />
                    <input
                      value={editCatOptions}
                      onChange={e => setEditCatOptions(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Options, comma separated"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEditCat(cat.id)}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCat(null)}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{cat.options.join(", ")}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => startEditCat(cat.id, cat.name, cat.options)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteCategory.mutate({ id: cat.id })}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new category */}
        <div className="flex flex-col gap-2 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-600">Add a dropdown category</p>
          <input
            type="text"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Category name (e.g. Art Style)"
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={newCatOptions}
            onChange={e => setNewCatOptions(e.target.value)}
            placeholder="Options, comma separated (e.g. Anime, Realistic, Chibi)"
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addCategory}
            disabled={createCategory.isPending}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {createCategory.isPending ? "Adding…" : "Add category"}
          </button>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify the page loads at `/professional-profile`**

Start the dev server (`npm run dev`) and navigate to `http://localhost:3000/professional-profile` while logged in. Expected: the page renders with Business Overview and Commission Settings sections.

- [ ] **Step 3: Commit**

```bash
git add app/professional-profile/page.tsx
git commit -m "feat: add Professional Profile artist dashboard page"
```

---

## Task 6: Add Professional Profile and Professional DMs to the hamburger menu

**Files:**
- Modify: `components/Navbar.tsx`

- [ ] **Step 1: Add the two new menu items**

In `components/Navbar.tsx`, find the `{menuOpen && (` block. Replace the entire dropdown contents with:

```tsx
        {menuOpen && (
          <div className="absolute top-12 right-0 w-52 bg-white rounded-2xl border border-gray-200 shadow-lg py-1 overflow-hidden">
            <button
              onClick={() => { setMenuOpen(false); router.push("/settings?tab=account") }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Account settings
            </button>
            <button
              onClick={() => { setMenuOpen(false); router.push("/professional-profile") }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Professional profile
            </button>
            <button
              onClick={() => { setMenuOpen(false); router.push("/professional-dms") }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Professional DMs
            </button>

            <div className="border-t border-gray-100 mx-3 my-1" />
            <p className="px-4 pt-1 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Site info</p>
            <button
              onClick={() => { setMenuOpen(false); router.push("/terms") }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Terms of Service
            </button>

            <div className="border-t border-gray-100 mx-3 my-1" />
            <button
              onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/signin" }) }}
              className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-gray-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
```

- [ ] **Step 2: Verify the menu shows the new items**

Open the app in the browser, tap the hamburger menu. Expected: "Professional profile" and "Professional DMs" appear above Account settings. Tapping "Professional profile" navigates to `/professional-profile`.

- [ ] **Step 3: Commit and push**

```bash
git add components/Navbar.tsx
git commit -m "feat: add Professional Profile and Professional DMs to hamburger menu"
git push
```

---

## What's next

**Plan 2** covers the discovery feed (`/commissions` page), the commission request modal, and the "Request Commission" button on the artist profile's Commissions tab.

**Plan 3** covers the Professional DMs list and thread pages (`/professional-dms` and `/professional-dms/[id]`).
