# Shop — Plan 1: Core Infrastructure & Browsing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the schema, overhaul the shop tRPC router, build all three shop pages (`/shop`, `/@username/shop`, `/@username/shop/[itemId]`), and wire in a localStorage cart — giving artists a way to list digital items and buyers a way to browse and cart them. No payments in this plan.

**Architecture:** Prisma migration adds `fileUrl`/`tags`/`status`/`purchaseCount` to `ShopItem` and introduces `ShopOrder`/`CartOrder` models. A new private-file upload endpoint handles the digital files. The shop tRPC router is overhauled with `getFeed`, `getById`, `update`, `togglePause` and the old `sendInquiry` is removed. Three new Next.js App Router pages are created. A `cartReducer`/`useCart` hook backed by `localStorage` is unit-tested. Cart drawer and nav icons are wired into both `BottomNav` and `Navbar`.

**Tech Stack:** Prisma + Neon PostgreSQL, Next.js 16 App Router, tRPC v11, Cloudinary, Tailwind, vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add ShopItem fields + ShopOrder + CartOrder models |
| Modify | `app/api/upload/route.ts` | Add `shop-previews` to allowed folders |
| Modify | `lib/upload.ts` | Widen folder type |
| **Create** | `app/api/upload-file/route.ts` | Private file upload (Cloudinary `type: "private"`) |
| **Create** | `lib/uploadFile.ts` | Client helper for private file upload |
| **Create** | `lib/cart.ts` | `cartReducer` + `useCart` hook (localStorage) |
| **Create** | `tests/shop-cart.test.ts` | Unit tests for cart reducer |
| Modify | `server/routers/shop.ts` | Full overhaul — remove `sendInquiry`, add `getFeed`/`getById`/`update`/`togglePause` |
| Modify | `lib/email.ts` | Remove `sendShopInquiryEmail` |
| Modify | `app/[username]/page.tsx` | Remove inquiry modal; add "View" link + "Browse all →" |
| **Create** | `app/shop/page.tsx` | Global shop feed (infinite scroll) |
| **Create** | `app/[username]/shop/page.tsx` | Artist storefront |
| **Create** | `app/[username]/shop/new/page.tsx` | Create listing form |
| **Create** | `app/[username]/shop/[itemId]/page.tsx` | Item detail page |
| **Create** | `components/CartDrawer.tsx` | Cart slide-in drawer |
| Modify | `components/BottomNav.tsx` | Add Shop nav item + cart icon/drawer |
| Modify | `components/Navbar.tsx` | Add cart icon/drawer + Shop in menu |
| Modify | `docs/roadmap.md` | Mark plan-1 items complete |

---

### Task 1: Schema migration — ShopItem + ShopOrder + CartOrder

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update ShopItem model**

In `prisma/schema.prisma`, replace the existing `ShopItem` model (currently has id, userId, image, title, description?, price, createdAt, updatedAt, user) with:

```prisma
model ShopItem {
  id            String      @id @default(cuid())
  userId        String
  image         String
  title         String
  description   String?
  price         Float
  fileUrl       String      @default("")
  tags          String[]    @default([])
  status        String      @default("ACTIVE")
  purchaseCount Int         @default(0)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  orders        ShopOrder[]
}
```

- [ ] **Step 2: Add ShopOrder model**

After the ShopItem model, add:

```prisma
model ShopOrder {
  id                     String     @id @default(cuid())
  buyerId                String
  sellerId               String
  itemId                 String
  cartOrderId            String?
  amountTotal            Float
  galleryFee             Float
  sellerPayout           Float
  stripePaymentIntentId  String
  downloadToken          String     @unique @default(cuid())
  downloadTokenExpiresAt DateTime
  downloadedAt           DateTime?
  status                 String     @default("PURCHASED")
  createdAt              DateTime   @default(now())
  buyer                  User       @relation("ShopOrderBuyer", fields: [buyerId], references: [id])
  seller                 User       @relation("ShopOrderSeller", fields: [sellerId], references: [id])
  item                   ShopItem   @relation(fields: [itemId], references: [id])
  cartOrder              CartOrder? @relation(fields: [cartOrderId], references: [id])
}
```

- [ ] **Step 3: Add CartOrder model**

After ShopOrder, add:

```prisma
model CartOrder {
  id                    String      @id @default(cuid())
  buyerId               String
  amountTotal           Float
  galleryFee            Float
  stripePaymentIntentId String
  status                String      @default("PENDING")
  createdAt             DateTime    @default(now())
  buyer                 User        @relation(fields: [buyerId], references: [id])
  orders                ShopOrder[]
}
```

- [ ] **Step 4: Add User back-relations**

In the `User` model, after `shopItems ShopItem[]`, add:

```prisma
  shopOrdersAsBuyer  ShopOrder[] @relation("ShopOrderBuyer")
  shopOrdersAsSeller ShopOrder[] @relation("ShopOrderSeller")
  cartOrders         CartOrder[]
```

- [ ] **Step 5: Run migration**

```bash
npx prisma migrate dev --name add-shop-orders
```

Expected: "Your database is now in sync with your schema."  
`prisma generate` runs automatically.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: schema — ShopOrder, CartOrder, extend ShopItem with fileUrl/tags/status/purchaseCount"
```

---

### Task 2: Upload infrastructure — shop-previews + private file endpoint

**Files:**
- Modify: `app/api/upload/route.ts`
- Modify: `lib/upload.ts`
- Create: `app/api/upload-file/route.ts`
- Create: `lib/uploadFile.ts`

- [ ] **Step 1: Add shop-previews to upload route**

In `app/api/upload/route.ts`, update the `ALLOWED_FOLDERS` const:

```typescript
const ALLOWED_FOLDERS = ["posts", "avatars", "banners", "stories", "commissions", "shop-previews"] as const
```

- [ ] **Step 2: Update lib/upload.ts folder type**

In `lib/upload.ts`, update the function signature:

```typescript
export async function uploadImage(base64: string, folder: "posts" | "avatars" | "banners" | "stories" | "commissions" | "shop-previews"): Promise<string> {
```

- [ ] **Step 3: Create private file upload route**

Create `app/api/upload-file/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { v2 as cloudinary } from "cloudinary"
import { prisma } from "@/lib/prisma"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { bannedUntil: true },
  })
  if (user?.bannedUntil && user.bannedUntil > new Date()) {
    return NextResponse.json({ error: "Your account is currently suspended." }, { status: 403 })
  }

  let body: { file?: unknown; filename?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { file, filename } = body
  if (typeof file !== "string" || !file.startsWith("data:")) {
    return NextResponse.json({ error: "file must be a base64 data URL" }, { status: 400 })
  }

  const base64Data = file.split(",")[1] ?? ""
  const approxBytes = Math.ceil((base64Data.length * 3) / 4)
  if (approxBytes > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds maximum size (50 MB)" }, { status: 413 })
  }

  try {
    const safeFilename =
      typeof filename === "string"
        ? `${session.user.id}_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`
        : `${session.user.id}_${Date.now()}`

    const result = await cloudinary.uploader.upload(file, {
      folder: "shop-files",
      type: "private",
      resource_type: "raw",
      public_id: safeFilename,
    })
    // Return only public_id — never the direct URL (requires signed access)
    return NextResponse.json({ publicId: result.public_id })
  } catch (err) {
    console.error("[upload-file] cloudinary error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create lib/uploadFile.ts client helper**

Create `lib/uploadFile.ts`:

```typescript
/**
 * Uploads a base64 data URL as a private file via /api/upload-file.
 * Returns the Cloudinary public_id (NOT a direct URL).
 * Store this value in ShopItem.fileUrl — generate signed URLs on demand.
 */
export async function uploadFile(base64: string, filename: string): Promise<string> {
  const res = await fetch("/api/upload-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: base64, filename }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? "File upload failed")
  }
  const data = await res.json() as { publicId: string }
  return data.publicId
}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/upload/route.ts lib/upload.ts app/api/upload-file/route.ts lib/uploadFile.ts
git commit -m "feat: upload — shop-previews folder + private file upload endpoint"
```

---

### Task 3: Cart hook + tests

**Files:**
- Create: `lib/cart.ts`
- Create: `tests/shop-cart.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/shop-cart.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { cartReducer } from "@/lib/cart"
import type { CartItem } from "@/lib/cart"

const ITEM_A: CartItem = { id: "a", title: "Brush Pack", price: 9.99, image: "https://res.cloudinary.com/x/a.jpg", sellerUsername: "artist1" }
const ITEM_B: CartItem = { id: "b", title: "Reference Sheet", price: 4.99, image: "https://res.cloudinary.com/x/b.jpg", sellerUsername: "artist2" }

describe("cartReducer", () => {
  it("add: inserts a new item", () => {
    const next = cartReducer([], { type: "add", item: ITEM_A })
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe("a")
  })

  it("add: does not duplicate an existing item", () => {
    const next = cartReducer([ITEM_A], { type: "add", item: ITEM_A })
    expect(next).toHaveLength(1)
  })

  it("remove: removes the matching item", () => {
    const next = cartReducer([ITEM_A, ITEM_B], { type: "remove", id: "a" })
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe("b")
  })

  it("remove: is a no-op when id is not in cart", () => {
    const next = cartReducer([ITEM_A], { type: "remove", id: "zzz" })
    expect(next).toHaveLength(1)
  })

  it("clear: empties the cart", () => {
    const next = cartReducer([ITEM_A, ITEM_B], { type: "clear" })
    expect(next).toHaveLength(0)
  })

  it("total: sums all item prices", () => {
    const items = cartReducer(cartReducer([], { type: "add", item: ITEM_A }), { type: "add", item: ITEM_B })
    const total = items.reduce((s, i) => s + i.price, 0)
    expect(total).toBeCloseTo(14.98)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/shop-cart.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/cart'`

- [ ] **Step 3: Implement lib/cart.ts**

Create `lib/cart.ts`:

```typescript
"use client"

import { useState, useEffect, useCallback } from "react"

export interface CartItem {
  id: string
  title: string
  price: number
  image: string
  sellerUsername: string
}

export type CartAction =
  | { type: "add"; item: CartItem }
  | { type: "remove"; id: string }
  | { type: "clear" }

export function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case "add":
      if (state.some(i => i.id === action.item.id)) return state
      return [...state, action.item]
    case "remove":
      return state.filter(i => i.id !== action.id)
    case "clear":
      return []
  }
}

const STORAGE_KEY = "gallery_cart"

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setItems(JSON.parse(stored) as CartItem[])
    } catch {
      // corrupt data — start fresh
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const dispatch = useCallback((action: CartAction) => {
    setItems(prev => cartReducer(prev, action))
  }, [])

  const total = items.reduce((sum, i) => sum + i.price, 0)
  const count = items.length

  return { items, total, count, dispatch }
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- tests/shop-cart.test.ts
```

Expected: PASS — 6 passing

- [ ] **Step 5: Commit**

```bash
git add lib/cart.ts tests/shop-cart.test.ts
git commit -m "feat: cart hook — localStorage-backed cart with reducer + tests"
```

---

### Task 4: Shop tRPC router overhaul

**Files:**
- Modify: `server/routers/shop.ts`
- Modify: `lib/email.ts`

Note: `server/routers/_app.ts` already imports and mounts `shopRouter` — no change needed there.

- [ ] **Step 1: Remove sendShopInquiryEmail from lib/email.ts**

In `lib/email.ts`, delete the entire `sendShopInquiryEmail` function (the last export in the file).

- [ ] **Step 2: Replace server/routers/shop.ts entirely**

```typescript
import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { checkNotBanned } from "@/server/lib/ban"

const PAGE_SIZE = 24

export const shopRouter = router({
  // ─── Public browsing ─────────────────────────────────────────────────────────

  getFeed: publicProcedure
    .input(z.object({ cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // Collect all IDs the current user has blocked or is blocked by
      const blockedIds: string[] =
        ctx.session?.user?.id
          ? (
              await ctx.prisma.block.findMany({
                where: {
                  OR: [
                    { blockerId: ctx.session.user.id },
                    { blockedId: ctx.session.user.id },
                  ],
                },
                select: { blockerId: true, blockedId: true },
              })
            )
              .flatMap(b => [b.blockerId, b.blockedId])
              .filter(id => id !== ctx.session!.user.id)
          : []

      const items = await ctx.prisma.shopItem.findMany({
        where: {
          status: "ACTIVE",
          userId: { notIn: blockedIds },
        },
        include: {
          user: { select: { username: true, image: true, name: true } },
        },
        orderBy: [
          { purchaseCount: "desc" },
          { createdAt: "desc" },
        ],
        take: PAGE_SIZE + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
      })

      const hasMore = items.length > PAGE_SIZE
      const page = hasMore ? items.slice(0, PAGE_SIZE) : items
      return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null }
    }),

  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })

      const isOwner = ctx.session?.user?.id === user.id
      return ctx.prisma.shopItem.findMany({
        where: {
          userId: user.id,
          ...(isOwner ? {} : { status: "ACTIVE" }),
        },
        orderBy: { createdAt: "desc" },
      })
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.shopItem.findUnique({
        where: { id: input.id },
        include: {
          user: { select: { username: true, image: true, name: true } },
        },
      })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      // Non-owners cannot see PAUSED items
      if (item.status === "PAUSED" && ctx.session?.user?.id !== item.userId) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return item
    }),

  // ─── Artist management ───────────────────────────────────────────────────────

  create: protectedProcedure
    .input(
      z.object({
        image: z.string().min(1),       // Cloudinary URL (from /api/upload)
        fileUrl: z.string().min(1),     // Cloudinary public_id (from /api/upload-file)
        title: z.string().min(1).max(100),
        description: z.string().max(1000).optional(),
        price: z.number().min(0.99),
        tags: z.array(z.string().max(50)).max(10).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      return ctx.prisma.shopItem.create({
        data: {
          userId: ctx.session.user.id,
          image: input.image,
          fileUrl: input.fileUrl,
          title: input.title,
          description: input.description ?? null,
          price: input.price,
          tags: input.tags,
          status: "ACTIVE",
        },
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        image: z.string().min(1).optional(),
        fileUrl: z.string().min(1).optional(),
        title: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).optional(),
        price: z.number().min(0.99).optional(),
        tags: z.array(z.string().max(50)).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const item = await ctx.prisma.shopItem.findUnique({ where: { id: input.id } })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      if (item.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })

      const { id, ...fields } = input
      return ctx.prisma.shopItem.update({
        where: { id },
        data: {
          ...(fields.image !== undefined && { image: fields.image }),
          ...(fields.fileUrl !== undefined && { fileUrl: fields.fileUrl }),
          ...(fields.title !== undefined && { title: fields.title }),
          ...(fields.description !== undefined && { description: fields.description }),
          ...(fields.price !== undefined && { price: fields.price }),
          ...(fields.tags !== undefined && { tags: fields.tags }),
        },
      })
    }),

  togglePause: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const item = await ctx.prisma.shopItem.findUnique({ where: { id: input.id } })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      if (item.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.shopItem.update({
        where: { id: input.id },
        data: { status: item.status === "ACTIVE" ? "PAUSED" : "ACTIVE" },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)
      const item = await ctx.prisma.shopItem.findUnique({ where: { id: input.id } })
      if (!item) throw new TRPCError({ code: "NOT_FOUND" })
      if (item.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.shopItem.delete({ where: { id: input.id } })
    }),
})
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors in shop.ts or email.ts.

- [ ] **Step 4: Commit**

```bash
git add server/routers/shop.ts lib/email.ts
git commit -m "feat: shop router — getFeed, getById, update, togglePause; remove sendInquiry"
```

---

### Task 5: Remove inquiry modal from profile page

**Files:**
- Modify: `app/[username]/page.tsx`

- [ ] **Step 1: Remove inquiry state, mutation, and modal**

In `app/[username]/page.tsx`:

1. Delete these state declarations (exact names from the existing code):
   ```typescript
   const [inquiryItem, setInquiryItem] = useState<{ id: string; title: string } | null>(null)
   const [inquiryMessage, setInquiryMessage] = useState("")
   const [inquirySent, setInquirySent] = useState(false)
   const sendInquiry = trpc.shop.sendInquiry.useMutation({ onSuccess: () => setInquirySent(true) })
   ```

2. Delete the inquiry modal JSX block — find `{inquiryItem && (` and delete the entire block through its closing `)}`.

- [ ] **Step 2: Replace inquiry buttons with "View" links**

In the shop tab, each item card has a button that called `setInquiryItem`. Replace each such button with a Link:

```tsx
import Link from "next/link"

// Replace the inquiry button with:
<Link
  href={`/@${profileData.username}/shop/${item.id}`}
  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
  style={{ background: "#B044F820", color: "#B044F8", border: "1px solid #B044F830" }}
>
  View
</Link>
```

- [ ] **Step 3: Add "Browse all →" link to shop tab header**

Find the Shop tab heading/section in the profile page. After the heading, add:

```tsx
<Link
  href={`/@${profileData.username}/shop`}
  className="text-sm transition-colors"
  style={{ color: "rgba(255,255,255,0.4)" }}
>
  Browse all →
</Link>
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add "app/[username]/page.tsx"
git commit -m "feat: profile shop tab — remove inquiry modal, add View links to storefront"
```

---

### Task 6: /shop global feed page

**Files:**
- Create: `app/shop/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/shop/page.tsx`:

```tsx
"use client"

import { useRef, useCallback } from "react"
import { trpc } from "@/components/providers"
import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/lib/cart"
import type { CartItem } from "@/lib/cart"

type FeedItem = {
  id: string
  title: string
  price: number
  image: string
  status: string
  user: { username: string | null; image: string | null; name: string | null }
}

function ShopItemCard({ item }: { item: FeedItem }) {
  const { items: cartItems, dispatch } = useCart()
  const inCart = cartItems.some(i => i.id === item.id)

  function addToCart() {
    const cartItem: CartItem = {
      id: item.id,
      title: item.title,
      price: item.price,
      image: item.image,
      sellerUsername: item.user.username ?? "",
    }
    dispatch({ type: "add", item: cartItem })
  }

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "#1a1a2e", border: "1px solid #ffffff0f" }}
    >
      <Link href={`/@${item.user.username}/shop/${item.id}`}>
        <div className="relative aspect-square overflow-hidden">
          <Image
            src={item.image}
            alt={item.title}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>
      </Link>
      <div className="p-3 flex flex-col gap-2">
        <Link href={`/@${item.user.username}/shop/${item.id}`}>
          <p className="text-sm font-semibold text-white line-clamp-1">{item.title}</p>
        </Link>
        <Link href={`/@${item.user.username}`} className="flex items-center gap-1.5">
          {item.user.image && (
            <Image
              src={item.user.image}
              alt=""
              width={16}
              height={16}
              className="rounded-full"
            />
          )}
          <span className="text-xs transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}>
            @{item.user.username}
          </span>
        </Link>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm font-bold text-white">${item.price.toFixed(2)}</span>
          <button
            onClick={addToCart}
            disabled={inCart}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{
              background: inCart
                ? "rgba(255,255,255,0.08)"
                : "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)",
              color: "white",
            }}
          >
            {inCart ? "In cart" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ShopPage() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.shop.getFeed.useInfiniteQuery(
      {},
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    )

  const observer = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return
      if (observer.current) observer.current.disconnect()
      if (!node) return
      observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && hasNextPage) fetchNextPage()
      })
      observer.current.observe(node)
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage],
  )

  const allItems = data?.pages.flatMap(p => p.items) ?? []

  return (
    <div className="min-h-screen pb-24 md:pl-16" style={{ background: "#0D0D0F" }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Shop</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Digital artwork, brush packs, and more from Gallery artists
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl aspect-square animate-pulse"
                style={{ background: "#1a1a2e" }}
              />
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-24" style={{ color: "rgba(255,255,255,0.4)" }}>
            <p className="text-lg">No items yet</p>
            <p className="text-sm mt-2">Artists haven&apos;t listed anything here yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {allItems.map(item => (
                <ShopItemCard key={item.id} item={item} />
              ))}
            </div>
            <div ref={sentinelRef} className="h-4" />
            {isFetchingNextPage && (
              <p className="text-center text-sm py-4" style={{ color: "rgba(255,255,255,0.4)" }}>
                Loading more…
              </p>
            )}
          </>
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

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/shop/page.tsx
git commit -m "feat: /shop global feed page with infinite scroll"
```

---

### Task 7: /@username/shop artist storefront

**Files:**
- Create: `app/[username]/shop/page.tsx`

- [ ] **Step 1: Create the storefront page**

Create `app/[username]/shop/page.tsx`:

```tsx
"use client"

import { use } from "react"
import { trpc } from "@/components/providers"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/lib/cart"

export default function ArtistShopPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = use(params)
  const displayUsername = username.startsWith("@") ? username.slice(1) : username
  const { data: session } = useSession()
  const { items: cartItems, dispatch } = useCart()
  const utils = trpc.useUtils()

  const { data: shopItems, isLoading } = trpc.shop.getByUsername.useQuery({
    username: displayUsername,
  })

  const deleteMutation = trpc.shop.delete.useMutation({
    onSuccess: () => utils.shop.getByUsername.invalidate({ username: displayUsername }),
  })
  const togglePauseMutation = trpc.shop.togglePause.useMutation({
    onSuccess: () => utils.shop.getByUsername.invalidate({ username: displayUsername }),
  })

  const isOwner =
    session?.user?.username?.toLowerCase() === displayUsername.toLowerCase()

  if (isLoading) {
    return (
      <div className="min-h-screen pb-24 md:pl-16" style={{ background: "#0D0D0F" }}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl aspect-square animate-pulse"
                style={{ background: "#1a1a2e" }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24 md:pl-16" style={{ background: "#0D0D0F" }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href={`/@${displayUsername}`}
              className="text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              ← @{displayUsername}
            </Link>
            <h1 className="text-2xl font-bold text-white mt-1">Shop</h1>
          </div>
          {isOwner && (
            <Link
              href={`/@${displayUsername}/shop/new`}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)",
              }}
            >
              + Add listing
            </Link>
          )}
        </div>

        {!shopItems || shopItems.length === 0 ? (
          <div className="text-center py-24" style={{ color: "rgba(255,255,255,0.4)" }}>
            {isOwner ? (
              <>
                <p className="text-lg">Your shop is empty</p>
                <p className="text-sm mt-2">Add your first listing to start selling</p>
                <Link
                  href={`/@${displayUsername}/shop/new`}
                  className="inline-block mt-4 px-6 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{
                    background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)",
                  }}
                >
                  Add listing
                </Link>
              </>
            ) : (
              <p className="text-lg">No items for sale yet</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {shopItems.map(item => {
              const inCart = cartItems.some(i => i.id === item.id)
              return (
                <div
                  key={item.id}
                  className="rounded-2xl overflow-hidden flex flex-col"
                  style={{ background: "#1a1a2e", border: "1px solid #ffffff0f" }}
                >
                  <Link href={`/@${displayUsername}/shop/${item.id}`}>
                    <div className="relative aspect-square overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        className="object-cover hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, 33vw"
                      />
                      {item.status === "PAUSED" && (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.6)" }}
                        >
                          <span className="text-xs font-semibold text-white/70 bg-black/50 px-2 py-1 rounded-lg">
                            Paused
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-3 flex flex-col gap-2">
                    <Link href={`/@${displayUsername}/shop/${item.id}`}>
                      <p className="text-sm font-semibold text-white line-clamp-1">
                        {item.title}
                      </p>
                    </Link>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">
                        ${item.price.toFixed(2)}
                      </span>
                      {isOwner ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => togglePauseMutation.mutate({ id: item.id })}
                            disabled={togglePauseMutation.isPending}
                            className="text-xs px-2 py-1 rounded-lg transition-colors"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              color: "rgba(255,255,255,0.5)",
                            }}
                          >
                            {item.status === "ACTIVE" ? "Pause" : "Unpause"}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this listing? This cannot be undone."))
                                deleteMutation.mutate({ id: item.id })
                            }}
                            disabled={deleteMutation.isPending}
                            className="text-xs px-2 py-1 rounded-lg transition-colors"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              color: "rgba(248,113,113,0.7)",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            dispatch({
                              type: "add",
                              item: {
                                id: item.id,
                                title: item.title,
                                price: item.price,
                                image: item.image,
                                sellerUsername: displayUsername,
                              },
                            })
                          }
                          disabled={inCart}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          style={{
                            background: inCart
                              ? "rgba(255,255,255,0.08)"
                              : "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)",
                            color: "white",
                          }}
                        >
                          {inCart ? "In cart" : "Add to cart"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
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

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "app/[username]/shop/page.tsx"
git commit -m "feat: /@username/shop artist storefront page"
```

---

### Task 8: Create listing form + item detail page

**Files:**
- Create: `app/[username]/shop/new/page.tsx`
- Create: `app/[username]/shop/[itemId]/page.tsx`

- [ ] **Step 1: Create the listing creation form**

Create `app/[username]/shop/new/page.tsx`:

```tsx
"use client"

import { use, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import { uploadImage } from "@/lib/upload"
import { uploadFile } from "@/lib/uploadFile"

export default function NewListingPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = use(params)
  const displayUsername = username.startsWith("@") ? username.slice(1) : username
  const { data: session, status } = useSession()
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [tags, setTags] = useState("")
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [digitalFile, setDigitalFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const createMutation = trpc.shop.create.useMutation({
    onSuccess: () => router.push(`/@${displayUsername}/shop`),
    onError: (err) => {
      setError(err.message)
      setUploading(false)
    },
  })

  if (
    status === "authenticated" &&
    session.user?.username?.toLowerCase() !== displayUsername.toLowerCase()
  ) {
    router.replace(`/@${displayUsername}/shop`)
    return null
  }
  if (status === "unauthenticated") {
    router.replace("/signin")
    return null
  }
  if (status === "loading") return null

  function handlePreviewChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPreviewDataUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!previewDataUrl || !digitalFile) {
      setError("Please provide a preview image and a digital file.")
      return
    }
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0.99) {
      setError("Price must be at least $0.99.")
      return
    }

    setUploading(true)
    setError("")

    try {
      const imageUrl = await uploadImage(previewDataUrl, "shop-previews")

      const fileDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target?.result as string)
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsDataURL(digitalFile!)
      })
      const filePublicId = await uploadFile(fileDataUrl, digitalFile!.name)

      const tagList = tags
        .split(",")
        .map(t => t.trim())
        .filter(Boolean)
        .slice(0, 10)

      createMutation.mutate({
        image: imageUrl,
        fileUrl: filePublicId,
        title,
        description: description || undefined,
        price: priceNum,
        tags: tagList,
      })
    } catch {
      setError("Upload failed. Please try again.")
      setUploading(false)
    }
  }

  const inputStyle = {
    background: "#1a1a2e",
    border: "1px solid rgba(255,255,255,0.08)",
  }
  const inputClass =
    "w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-purple-500"

  return (
    <div className="min-h-screen pb-24 md:pl-16" style={{ background: "#0D0D0F" }}>
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-sm mb-2 transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-white">New listing</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Preview image */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Preview image *
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePreviewChange}
              required
              className="w-full text-sm text-white/50 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white/70 hover:file:bg-white/15"
            />
            {previewDataUrl && (
              <img
                src={previewDataUrl}
                alt="Preview"
                className="mt-2 rounded-xl object-cover"
                style={{ maxHeight: 200, maxWidth: "100%" }}
              />
            )}
          </div>

          {/* Digital file */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Digital file *{" "}
              <span className="font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>
                PNG, JPG, PDF, ZIP, PSD, Procreate — max 50 MB
              </span>
            </label>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,.zip,.psd,.procreate,.webp,.gif"
              onChange={e => setDigitalFile(e.target.files?.[0] ?? null)}
              required
              className="w-full text-sm text-white/50 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white/70 hover:file:bg-white/15"
            />
            {digitalFile && (
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                {digitalFile.name} ({(digitalFile.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
              required
              placeholder="e.g. Watercolour brush pack"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Description{" "}
              <span className="font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>
                (what&apos;s included, format, resolution, usage rights)
              </span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Describe what buyers will receive…"
              className={`${inputClass} resize-none`}
              style={inputStyle}
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Price (USD) *
            </label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                $
              </span>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                min="0.99"
                step="0.01"
                required
                placeholder="9.99"
                className={`${inputClass} pl-6`}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Tags{" "}
              <span className="font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>
                comma-separated, up to 10
              </span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="brush pack, watercolour, digital art"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={uploading || createMutation.isPending}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
          >
            {uploading || createMutation.isPending ? "Publishing…" : "Publish listing"}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create item detail page**

Create `app/[username]/shop/[itemId]/page.tsx`:

```tsx
"use client"

import { use } from "react"
import { trpc } from "@/components/providers"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/lib/cart"

export default function ShopItemPage({
  params,
}: {
  params: Promise<{ username: string; itemId: string }>
}) {
  const { username, itemId } = use(params)
  const displayUsername = username.startsWith("@") ? username.slice(1) : username
  const { data: session } = useSession()
  const { items: cartItems, dispatch } = useCart()

  const { data: item, isLoading } = trpc.shop.getById.useQuery({ id: itemId })

  if (isLoading) {
    return (
      <div className="min-h-screen md:pl-16 pb-24" style={{ background: "#0D0D0F" }}>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div
            className="rounded-2xl aspect-square w-full animate-pulse"
            style={{ background: "#1a1a2e" }}
          />
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div
        className="min-h-screen md:pl-16 flex items-center justify-center"
        style={{ background: "#0D0D0F" }}
      >
        <p style={{ color: "rgba(255,255,255,0.4)" }}>Item not found</p>
      </div>
    )
  }

  const inCart = cartItems.some(i => i.id === item.id)
  const isOwner =
    session?.user?.username?.toLowerCase() === displayUsername.toLowerCase()

  return (
    <div className="min-h-screen md:pl-16 pb-24" style={{ background: "#0D0D0F" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href={`/@${displayUsername}/shop`}
          className="inline-block text-sm mb-6 transition-colors"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          ← @{displayUsername}&apos;s shop
        </Link>

        {/* Preview image */}
        <div className="rounded-2xl overflow-hidden aspect-square w-full relative mb-6">
          <Image
            src={item.image}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 672px) 100vw, 672px"
            priority
          />
          {item.status === "PAUSED" && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.7)" }}
            >
              <span className="text-sm font-semibold text-white bg-black/50 px-3 py-1.5 rounded-xl">
                Paused
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* Title + price */}
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-white">{item.title}</h1>
            <span className="text-2xl font-bold text-white flex-shrink-0">
              ${item.price.toFixed(2)}
            </span>
          </div>

          {/* Artist */}
          <Link href={`/@${item.user.username}`} className="flex items-center gap-2">
            {item.user.image && (
              <Image
                src={item.user.image}
                alt=""
                width={28}
                height={28}
                className="rounded-full"
              />
            )}
            <span
              className="text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              @{item.user.username}
            </span>
          </Link>

          {/* Description */}
          {item.description && (
            <p
              className="text-sm leading-relaxed whitespace-pre-line"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {item.description}
            </p>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* No-refund notice */}
          <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.3)" }}>
            All sales are final. Once a download link is sent, no refunds are issued.
          </p>

          {/* Buyer actions */}
          {!isOwner && item.status === "ACTIVE" && (
            <div className="flex gap-3 mt-2">
              <button
                onClick={() =>
                  dispatch({
                    type: "add",
                    item: {
                      id: item.id,
                      title: item.title,
                      price: item.price,
                      image: item.image,
                      sellerUsername: displayUsername,
                    },
                  })
                }
                disabled={inCart}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                {inCart ? "In cart ✓" : "Add to cart"}
              </button>
              <button
                disabled
                title="Checkout coming in the next update"
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white opacity-40 cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
              >
                Buy Now
              </button>
            </div>
          )}

          {/* Owner shortcut */}
          {isOwner && (
            <Link
              href={`/@${displayUsername}/shop`}
              className="block text-center py-3 rounded-xl text-sm font-semibold transition-colors mt-2"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              Manage your shop →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add "app/[username]/shop/new/page.tsx" "app/[username]/shop/[itemId]/page.tsx"
git commit -m "feat: shop item detail page + new listing creation form"
```

---

### Task 9: Cart drawer + navigation wiring

**Files:**
- Create: `components/CartDrawer.tsx`
- Modify: `components/BottomNav.tsx`
- Modify: `components/Navbar.tsx`

- [ ] **Step 1: Create CartDrawer component**

Create `components/CartDrawer.tsx`:

```tsx
"use client"

import { useCart } from "@/lib/cart"
import Image from "next/image"
import Link from "next/link"

export default function CartDrawer({ onClose }: { onClose: () => void }) {
  const { items, total, dispatch } = useCart()

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Slide-in panel */}
      <div
        className="fixed z-50 right-0 top-0 h-full w-full max-w-sm flex flex-col shadow-2xl"
        style={{ background: "#1a1a2e", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <h2 className="font-bold text-white text-lg">
            Cart {items.length > 0 && `(${items.length})`}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            ×
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {items.length === 0 ? (
            <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>
              <p className="text-lg">Your cart is empty</p>
              <Link
                href="/shop"
                onClick={onClose}
                className="inline-block mt-3 text-sm"
                style={{ color: "#a78bfa" }}
              >
                Browse the shop →
              </Link>
            </div>
          ) : (
            items.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "#0D0D0F" }}
              >
                <Link
                  href={`/@${item.sellerUsername}/shop/${item.id}`}
                  onClick={onClose}
                  className="flex-shrink-0"
                >
                  <Image
                    src={item.image}
                    alt={item.title}
                    width={56}
                    height={56}
                    className="rounded-lg object-cover"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/@${item.sellerUsername}/shop/${item.id}`}
                    onClick={onClose}
                  >
                    <p className="text-sm font-semibold text-white line-clamp-1">
                      {item.title}
                    </p>
                  </Link>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    @{item.sellerUsername}
                  </p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    ${item.price.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => dispatch({ type: "remove", id: item.id })}
                  className="text-xl leading-none flex-shrink-0 transition-colors"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div
            className="px-5 py-4 flex flex-col gap-3 flex-shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                Total
              </span>
              <span className="font-bold text-white text-lg">${total.toFixed(2)}</span>
            </div>
            <button
              disabled
              title="Checkout coming in the next update"
              className="w-full py-3 rounded-xl text-sm font-semibold text-white opacity-40 cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
            >
              Checkout (coming soon)
            </button>
            <button
              onClick={() => dispatch({ type: "clear" })}
              className="w-full py-2 text-xs transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Add Shop nav item + cart to BottomNav**

In `components/BottomNav.tsx`:

**A.** At the top of the file, add imports:
```tsx
import CartDrawer from "@/components/CartDrawer"
import { useCart } from "@/lib/cart"
```

**B.** Inside `BottomNav()`, after the `const [moreOpen, setMoreOpen] = useState(false)` line, add:
```tsx
const [cartOpen, setCartOpen] = useState(false)
const { count: cartCount } = useCart()
```

**C.** In the `navItems` array, insert a Shop entry after the Search item (before Commissions):
```tsx
{
  label: "Shop",
  href: "/shop",
  active: isActive("/shop"),
  icon: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  ),
},
```

**D.** In the mobile `<nav>` JSX, after the notifications bell button, add the cart button:
```tsx
<button onClick={() => setCartOpen(v => !v)}>
  <div className={`flex flex-col items-center gap-0.5 px-2 py-2 ${cartOpen ? "text-white" : "text-white/40"}`}>
    <div className="relative">
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="9" cy="21" r="1"/>
        <circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61H19a2 2 0 001.98-1.7L22 8H6"/>
      </svg>
      {cartCount > 0 && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-purple-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
          {cartCount > 9 ? "9+" : cartCount}
        </span>
      )}
    </div>
    <span className="text-[10px] font-medium">Cart</span>
  </div>
</button>
```

**E.** After the opening `<>` of the BottomNav return (where `{notifOpen && <NotificationPanel .../>}` lives), add:
```tsx
{cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
```

- [ ] **Step 3: Add cart to Navbar**

In `components/Navbar.tsx`:

**A.** Add imports at the top:
```tsx
import CartDrawer from "@/components/CartDrawer"
import { useCart } from "@/lib/cart"
```

**B.** Inside the `Navbar()` function body (after the existing state declarations), add:
```tsx
const [cartOpen, setCartOpen] = useState(false)
const { count: cartCount } = useCart()
```

**C.** Add a cart button just before the notification bell button in the JSX:
```tsx
{/* Cart */}
<div className="relative">
  <button
    onClick={() => { setCartOpen(v => !v); setNotifOpen(false) }}
    className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
    aria-label="Cart"
  >
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="9" cy="21" r="1"/>
      <circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61H19a2 2 0 001.98-1.7L22 8H6"/>
    </svg>
    {cartCount > 0 && (
      <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
        {cartCount > 9 ? "9+" : cartCount}
      </span>
    )}
  </button>
  {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
</div>
```

**D.** In the hamburger dropdown menu, add a Shop link before "Account settings":
```tsx
<button
  onClick={() => { setMenuOpen(false); router.push("/shop") }}
  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
>
  Shop
</button>
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add components/CartDrawer.tsx components/BottomNav.tsx components/Navbar.tsx
git commit -m "feat: cart drawer + Shop in sidebar + cart icon in both navs"
```

---

### Task 10: Roadmap update

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Update roadmap**

In `docs/roadmap.md`, under `### Shop` in the Pre-Launch section, replace the current content with:

```markdown
### Shop
- [x] Shop inquiry — replaced by real shop purchasing
- [x] Global /shop feed page (infinite scroll, add-to-cart)
- [x] /@username/shop artist storefront (replaces profile shop tab)
- [x] /@username/shop/[itemId] item detail page
- [x] New listing form — preview image, private digital file, title, price, tags
- [x] Pause/unpause + delete listings
- [x] localStorage cart — drawer UI, count badge in both navs
- [ ] Stripe Connect onboarding for artists — *Plan 2*
- [ ] Stripe payment intent (single item + cart checkout) — *Plan 2*
- [ ] Download delivery by email (signed Cloudinary URL, 24h) — *Plan 2*
- [ ] Artist orders + earnings in professional dashboard — *Plan 3*
```

- [ ] **Step 2: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: roadmap — shop plan 1 complete"
```

---

## Spec Coverage Checklist

| Spec requirement | Implemented in |
|---|---|
| Global `/shop` feed — infinite scroll, item cards | Task 6 |
| `/@username/shop` storefront | Task 7 |
| `/@username/shop/[itemId]` item detail | Task 8 |
| Preview image, title, description, price, tags on listing | Tasks 4 + 8 |
| Digital file upload (private, signed-URL access) | Task 2 |
| ShopItem: fileUrl, tags, status, purchaseCount | Task 1 |
| ShopOrder + CartOrder models (ready for Plan 2) | Task 1 |
| Artist can edit any field | `update` procedure, Task 4 |
| Artist can pause/unpause listing | `togglePause`, Task 4 |
| ACTIVE-only items shown to buyers | `getFeed` + `getByUsername` filter, Task 4 |
| Blocked artists excluded from feed | `getFeed` block filter, Task 4 |
| Owner view: Add listing button + edit/pause/delete | Task 7 |
| No-refund notice on item page | Task 8 |
| "Add to cart" + cart UI | Tasks 3, 6, 7, 8, 9 |
| Cart icon with count badge in navbar | Task 9 |
| `/shop` in nav (bottom + desktop sidebar) | Task 9 |
| Remove `sendInquiry` mutation | Task 4 |
| Remove inquiry modal from profile | Task 5 |
| Min price $0.99 | `z.number().min(0.99)`, Task 4 |
| Payments / downloads / email delivery | Deferred — Plan 2 |
| Professional dashboard shop/orders/earnings | Deferred — Plan 3 |
