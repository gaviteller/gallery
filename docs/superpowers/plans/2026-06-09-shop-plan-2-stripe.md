# Shop Plan 2 — Stripe Connect, Checkout & Download Delivery

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real Stripe payments into the Gallery shop — Connect onboarding for artists, hosted Checkout Sessions for buyers (single item + cart), download delivery by email (signed Cloudinary URL), and order history for buyers.

**Architecture:** Stripe hosted Checkout Sessions (redirect flow). Gallery collects full payment, then issues separate transfers to seller Connect accounts minus the 8% Gallery fee. Download tokens are permanent DB keys; Cloudinary signed URLs are generated fresh on each download (24h TTL). Cart is capped at 10 items to stay within Stripe metadata limits.

**Tech Stack:** Stripe (npm install stripe), Cloudinary signed URLs (cloudinary.utils.private_download_url), Resend (lib/email.ts), tRPC v11, Prisma/Neon (`prisma db push`), Next.js 16 App Router

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `lib/stripe.ts` | Singleton Stripe SDK instance |
| `lib/shopFees.ts` | Pure fee calculator (8% Gallery, seller payout, all in cents) |
| `tests/shop-fees.test.ts` | Vitest unit tests for fee calculator |
| `app/api/stripe/shop-webhook/route.ts` | Stripe webhook handler — processes `checkout.session.completed` |
| `app/api/shop/download/[token]/route.ts` | Secure download endpoint — validates token, generates 24h signed URL, redirects |
| `app/shop/connect-return/page.tsx` | Landing page after Stripe Connect onboarding redirect |
| `app/shop/order-success/page.tsx` | Landing page after successful checkout |
| `app/shop/orders/page.tsx` | Buyer's order history |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `stripeConnectId String?` to User model |
| `lib/email.ts` | Add `sendShopPurchaseEmail` and `sendShopSaleEmail` |
| `server/routers/shop.ts` | Add `createCheckout`, `createCartCheckout`, `createConnectLink`, `getConnectStatus`, `getMyOrders` procedures |
| `server/routers/index.ts` | No change needed (shop router already wired) |
| `app/[username]/shop/page.tsx` | Add Connect banner for owners without `stripeConnectId` |
| `app/[username]/shop/[itemId]/page.tsx` | Wire Buy Now button to `createCheckout` mutation |
| `components/CartDrawer.tsx` | Wire Checkout button to `createCartCheckout` mutation |

---

## Task 1: Stripe install + lib/stripe.ts + lib/shopFees.ts + schema

**Files:**
- Create: `lib/stripe.ts`
- Create: `lib/shopFees.ts`
- Create: `tests/shop-fees.test.ts`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Install Stripe**

```bash
cd C:\Users\gavri\OneDrive\Documents\Projects\gallery
npm install stripe
```

Expected: stripe added to package.json dependencies.

- [ ] **Step 2: Write failing tests for fee calculator**

Create `tests/shop-fees.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { calculateFee } from "../lib/shopFees"

describe("calculateFee", () => {
  it("calculates 8% gallery fee and seller payout for $10.00", () => {
    const result = calculateFee(10.00)
    expect(result.galleryFee).toBeCloseTo(0.80, 2)
    expect(result.sellerPayout).toBeCloseTo(9.20, 2)
    expect(result.totalCents).toBe(1000)
    expect(result.galleryFeeCents).toBe(80)
    expect(result.sellerPayoutCents).toBe(920)
  })

  it("rounds cents correctly for $3.99", () => {
    const result = calculateFee(3.99)
    expect(result.totalCents).toBe(399)
    expect(result.galleryFeeCents).toBe(32) // floor(399 * 0.08) = 31.92 → 32
    expect(result.sellerPayoutCents).toBe(367) // 399 - 32 = 367
    expect(result.galleryFeeCents + result.sellerPayoutCents).toBe(result.totalCents)
  })

  it("galleryFeeCents + sellerPayoutCents always equals totalCents", () => {
    const prices = [0.99, 1.50, 9.99, 25.00, 99.99, 249.99]
    for (const price of prices) {
      const result = calculateFee(price)
      expect(result.galleryFeeCents + result.sellerPayoutCents).toBe(result.totalCents)
    }
  })

  it("returns float representations consistent with cents", () => {
    const result = calculateFee(5.00)
    expect(result.galleryFee).toBe(result.galleryFeeCents / 100)
    expect(result.sellerPayout).toBe(result.sellerPayoutCents / 100)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test tests/shop-fees.test.ts
```

Expected: FAIL — `calculateFee` not found.

- [ ] **Step 4: Create lib/shopFees.ts**

```typescript
export interface FeeBreakdown {
  galleryFee: number       // float, e.g. 0.80
  sellerPayout: number     // float, e.g. 9.20
  galleryFeeCents: number  // integer cents, e.g. 80
  sellerPayoutCents: number
  totalCents: number
}

const GALLERY_FEE_RATE = 0.08

export function calculateFee(price: number): FeeBreakdown {
  const totalCents = Math.round(price * 100)
  const galleryFeeCents = Math.round(totalCents * GALLERY_FEE_RATE)
  const sellerPayoutCents = totalCents - galleryFeeCents
  return {
    galleryFee: galleryFeeCents / 100,
    sellerPayout: sellerPayoutCents / 100,
    galleryFeeCents,
    sellerPayoutCents,
    totalCents,
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test tests/shop-fees.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 6: Create lib/stripe.ts**

```typescript
import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-05-28.basil",
})
```

> Note: Check the installed stripe version's supported API version. Run `node -e "console.log(require('stripe').LATEST_API_VERSION)"` if unsure, and use whatever version it reports.

- [ ] **Step 7: Add stripeConnectId to schema**

In `prisma/schema.prisma`, find the `model User` block and add the field after the existing shop relations:

```prisma
  stripeConnectId    String?
```

Specifically, find this line in the User model:
```
  cartOrders         CartOrder[]
```
And add the new field after it:
```
  cartOrders         CartOrder[]
  stripeConnectId    String?
```

- [ ] **Step 8: Push schema**

```bash
npx prisma db push
npx prisma generate
```

Expected: Schema applied, no errors.

- [ ] **Step 9: Add env vars to .env.local**

Check `.env.local` for STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. If not present, note them for manual addition — do not add dummy values. The procedure names are:
- `STRIPE_SECRET_KEY` — from Stripe Dashboard → Developers → API keys
- `STRIPE_WEBHOOK_SECRET` — from Stripe Dashboard → Webhooks (created in Task 5)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — public key (not secret) for future client use

Skip if already present. Do not error if absent; Task 6 will verify.

- [ ] **Step 10: Commit**

```bash
git add lib/stripe.ts lib/shopFees.ts tests/shop-fees.test.ts prisma/schema.prisma package.json package-lock.json
git commit -m "feat: add Stripe SDK, fee calculator, stripeConnectId schema field"
```

---

## Task 2: Email functions — sendShopPurchaseEmail + sendShopSaleEmail

**Files:**
- Modify: `lib/email.ts`

First, read `lib/email.ts` to understand the existing patterns (`layout()`, `FROM`, `GALLERY_URL`, how Resend is called).

- [ ] **Step 1: Read lib/email.ts**

Read `lib/email.ts` in full. Identify:
- How `layout(title, body)` wraps content
- How `resend.emails.send(...)` is called
- The `FROM` constant
- The `GALLERY_URL` constant

- [ ] **Step 2: Write failing test**

Create `tests/email-shop.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock resend before importing email module
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
  })),
}))

describe("shop email functions", () => {
  it("sendShopPurchaseEmail exports as a function", async () => {
    const { sendShopPurchaseEmail } = await import("../lib/email")
    expect(typeof sendShopPurchaseEmail).toBe("function")
  })

  it("sendShopSaleEmail exports as a function", async () => {
    const { sendShopSaleEmail } = await import("../lib/email")
    expect(typeof sendShopSaleEmail).toBe("function")
  })

  it("sendShopPurchaseEmail returns without throwing for valid input", async () => {
    const { sendShopPurchaseEmail } = await import("../lib/email")
    await expect(
      sendShopPurchaseEmail({
        to: "buyer@example.com",
        buyerName: "Alice",
        itemTitle: "Cozy Cat Procreate Brush",
        sellerUsername: "artist123",
        downloadUrl: "https://gallery.example.com/api/shop/download/tok_abc123",
        amountPaid: 9.99,
      })
    ).resolves.not.toThrow()
  })

  it("sendShopSaleEmail returns without throwing for valid input", async () => {
    const { sendShopSaleEmail } = await import("../lib/email")
    await expect(
      sendShopSaleEmail({
        to: "artist@example.com",
        artistName: "Bob",
        itemTitle: "Cozy Cat Procreate Brush",
        buyerUsername: "alice",
        sellerPayout: 9.19,
      })
    ).resolves.not.toThrow()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test tests/email-shop.test.ts
```

Expected: FAIL — `sendShopPurchaseEmail` and `sendShopSaleEmail` not exported.

- [ ] **Step 4: Add sendShopPurchaseEmail to lib/email.ts**

Append to `lib/email.ts` (after the last existing function):

```typescript
export async function sendShopPurchaseEmail({
  to,
  buyerName,
  itemTitle,
  sellerUsername,
  downloadUrl,
  amountPaid,
}: {
  to: string
  buyerName: string
  itemTitle: string
  sellerUsername: string
  downloadUrl: string
  amountPaid: number
}) {
  const body = `
    <p>Hi ${buyerName},</p>
    <p>Your purchase was successful! Here's your download link for <strong>${itemTitle}</strong> by <a href="${GALLERY_URL}/@${sellerUsername}">@${sellerUsername}</a>:</p>
    <p style="margin: 24px 0;">
      <a href="${downloadUrl}" style="background: linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%); color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">
        Download your file
      </a>
    </p>
    <p style="color: rgba(255,255,255,0.5); font-size: 13px;">This link expires in 24 hours. You can generate a new link from your <a href="${GALLERY_URL}/shop/orders">order history</a> at any time.</p>
    <p style="color: rgba(255,255,255,0.5); font-size: 13px;">Amount paid: $${amountPaid.toFixed(2)}. All sales are final — no refunds once a download link has been issued.</p>
  `
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your download is ready — ${itemTitle}`,
    html: layout("Your purchase from Gallery", body),
  })
}
```

- [ ] **Step 5: Add sendShopSaleEmail to lib/email.ts**

Append to `lib/email.ts` after `sendShopPurchaseEmail`:

```typescript
export async function sendShopSaleEmail({
  to,
  artistName,
  itemTitle,
  buyerUsername,
  sellerPayout,
}: {
  to: string
  artistName: string
  itemTitle: string
  buyerUsername: string
  sellerPayout: number
}) {
  const body = `
    <p>Hi ${artistName},</p>
    <p>You made a sale! <a href="${GALLERY_URL}/@${buyerUsername}">@${buyerUsername}</a> purchased <strong>${itemTitle}</strong>.</p>
    <p>Your payout of <strong>$${sellerPayout.toFixed(2)}</strong> will be transferred to your connected Stripe account.</p>
    <p><a href="${GALLERY_URL}/dashboard">View your dashboard →</a></p>
  `
  await resend.emails.send({
    from: FROM,
    to,
    subject: `New sale — ${itemTitle}`,
    html: layout("You made a sale on Gallery", body),
  })
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test tests/email-shop.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 7: Commit**

```bash
git add lib/email.ts tests/email-shop.test.ts
git commit -m "feat: add sendShopPurchaseEmail and sendShopSaleEmail"
```

---

## Task 3: Stripe Connect tRPC procedures + Connect banner

**Files:**
- Modify: `server/routers/shop.ts`
- Modify: `app/[username]/shop/page.tsx`
- Create: `app/shop/connect-return/page.tsx`

Read `server/routers/shop.ts` and `app/[username]/shop/page.tsx` before editing.

- [ ] **Step 1: Read current files**

Read both files in full:
- `server/routers/shop.ts`
- `app/[username]/shop/page.tsx`

- [ ] **Step 2: Add createConnectLink and getConnectStatus to shop router**

Add these two procedures to `server/routers/shop.ts`. Add them in the "Artist management" section, after the existing `delete` procedure.

First, add the stripe import at the top of the file, after existing imports:

```typescript
import { stripe } from "@/lib/stripe"
```

Then add the procedures:

```typescript
  // ─── Stripe Connect ───────────────────────────────────────────────────────────

  getConnectStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { stripeConnectId: true },
    })
    if (!user?.stripeConnectId) return { connected: false, stripeConnectId: null }

    const account = await stripe.accounts.retrieve(user.stripeConnectId)
    return {
      connected: account.charges_enabled && account.payouts_enabled,
      stripeConnectId: user.stripeConnectId,
    }
  }),

  createConnectLink: protectedProcedure.mutation(async ({ ctx }) => {
    await checkNotBanned(ctx.prisma, ctx.session.user.id)

    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { stripeConnectId: true, email: true },
    })

    let accountId = user?.stripeConnectId

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user?.email ?? undefined,
        capabilities: { transfers: { requested: true } },
      })
      accountId = account.id
      await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { stripeConnectId: accountId },
      })
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/shop/connect-return?refresh=1`,
      return_url: `${baseUrl}/shop/connect-return`,
      type: "account_onboarding",
    })

    return { url: link.url }
  }),
```

- [ ] **Step 3: Create app/shop/connect-return/page.tsx**

```typescript
"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"

export default function ConnectReturnPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const isRefresh = searchParams.get("refresh") === "1"

  return (
    <div
      className="min-h-screen md:pl-16 flex items-center justify-center"
      style={{ background: "#0D0D0F" }}
    >
      <div className="max-w-md mx-auto px-6 text-center">
        {isRefresh ? (
          <>
            <h1 className="text-2xl font-bold text-white mb-3">Session expired</h1>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              Your Stripe Connect session timed out. Click below to try again.
            </p>
            <Link
              href={`/@${session?.user?.username}/shop`}
              className="inline-block py-3 px-6 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
            >
              Back to your shop
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-3">You&apos;re connected!</h1>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              Your Stripe account is set up. You can now receive payouts from sales.
            </p>
            <Link
              href={`/@${session?.user?.username}/shop`}
              className="inline-block py-3 px-6 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
            >
              Back to your shop
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add Connect banner to app/[username]/shop/page.tsx**

Read `app/[username]/shop/page.tsx`. Find the owner section (where the "Add listing" button appears). Add a Connect banner above the listing grid for owners who are not yet connected.

The banner goes in the owner section, after the header row with the "Add listing" button and before the items grid. Add a new tRPC query at the top of the component:

```typescript
const { data: connectStatus } = trpc.shop.getConnectStatus.useQuery(undefined, {
  enabled: isOwner,
})
```

Then, inside the owner JSX, add this banner between the header row and the items grid — only show it when `isOwner && connectStatus && !connectStatus.connected`:

```typescript
{isOwner && connectStatus && !connectStatus.connected && (
  <ConnectBanner />
)}
```

Create the `ConnectBanner` as a local component at the top of the file (before the default export):

```typescript
function ConnectBanner() {
  const utils = trpc.useUtils()
  const createLink = trpc.shop.createConnectLink.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })

  return (
    <div
      className="rounded-2xl p-4 mb-6 flex items-start gap-3"
      style={{ background: "rgba(255, 180, 0, 0.08)", border: "1px solid rgba(255, 180, 0, 0.2)" }}
    >
      <span className="text-xl">⚡</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white mb-1">Connect Stripe to receive payouts</p>
        <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
          You need a Stripe account to get paid for your sales. It only takes a few minutes.
        </p>
        <button
          onClick={() => createLink.mutate()}
          disabled={createLink.isPending}
          className="text-xs font-semibold py-2 px-4 rounded-xl text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
        >
          {createLink.isPending ? "Loading…" : "Set up payouts →"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any type errors before committing.

- [ ] **Step 6: Commit**

```bash
git add server/routers/shop.ts app/[username]/shop/page.tsx app/shop/connect-return/page.tsx
git commit -m "feat: Stripe Connect onboarding — createConnectLink, getConnectStatus, Connect banner"
```

---

## Task 4: Checkout tRPC mutations — createCheckout + createCartCheckout

**Files:**
- Modify: `server/routers/shop.ts`

Read `server/routers/shop.ts` in full before editing (it was already modified in Task 3).

- [ ] **Step 1: Add createCheckout procedure to shop router**

Add in the "Artist management" section (after `createConnectLink`/`getConnectStatus`):

```typescript
  // ─── Checkout ─────────────────────────────────────────────────────────────────

  createCheckout: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)

      const item = await ctx.prisma.shopItem.findUnique({
        where: { id: input.itemId },
        include: { user: { select: { id: true, stripeConnectId: true, username: true } } },
      })
      if (!item || item.status !== "ACTIVE") throw new TRPCError({ code: "NOT_FOUND" })
      if (item.userId === ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot buy your own item" })
      if (!item.user.stripeConnectId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Artist has not connected Stripe" })

      const { totalCents } = calculateFee(item.price)
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: item.title,
                images: [item.image],
              },
              unit_amount: totalCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: "shop_single",
          itemId: item.id,
          buyerId: ctx.session.user.id,
          sellerId: item.userId,
        },
        success_url: `${baseUrl}/shop/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/@${item.user.username}/shop/${item.id}`,
      })

      return { url: session.url! }
    }),
```

Also add the `calculateFee` import at the top of the file:

```typescript
import { calculateFee } from "@/lib/shopFees"
```

- [ ] **Step 2: Add createCartCheckout procedure**

Add after `createCheckout`:

```typescript
  createCartCheckout: protectedProcedure
    .input(
      z.object({
        items: z
          .array(z.object({ id: z.string() }))
          .min(1)
          .max(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await checkNotBanned(ctx.prisma, ctx.session.user.id)

      const itemIds = input.items.map(i => i.id)
      const dbItems = await ctx.prisma.shopItem.findMany({
        where: { id: { in: itemIds }, status: "ACTIVE" },
        include: { user: { select: { id: true, stripeConnectId: true } } },
      })

      if (dbItems.length !== itemIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "One or more items are unavailable" })
      }
      if (dbItems.some(item => item.userId === ctx.session.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot buy your own items" })
      }
      if (dbItems.some(item => !item.user.stripeConnectId)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "One or more artists have not connected Stripe" })
      }

      const lineItems = dbItems.map(item => {
        const { totalCents } = calculateFee(item.price)
        return {
          price_data: {
            currency: "usd",
            product_data: { name: item.title, images: [item.image] },
            unit_amount: totalCents,
          },
          quantity: 1,
        }
      })

      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: lineItems,
        metadata: {
          type: "shop_cart",
          buyerId: ctx.session.user.id,
          itemIds: JSON.stringify(itemIds),
        },
        success_url: `${baseUrl}/shop/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/shop`,
      })

      return { url: session.url! }
    }),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 4: Commit**

```bash
git add server/routers/shop.ts lib/shopFees.ts
git commit -m "feat: createCheckout and createCartCheckout tRPC mutations"
```

---

## Task 5: Stripe webhook handler

**Files:**
- Create: `app/api/stripe/shop-webhook/route.ts`

This is the most critical file. It processes `checkout.session.completed`, creates `ShopOrder`(s) and optionally a `CartOrder`, sends emails, and issues Stripe transfers to sellers.

- [ ] **Step 1: Read email.ts for import names**

Read `lib/email.ts` to confirm the exact function names: `sendShopPurchaseEmail` and `sendShopSaleEmail`.

- [ ] **Step 2: Create the webhook route**

Create `app/api/stripe/shop-webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { calculateFee } from "@/lib/shopFees"
import { sendShopPurchaseEmail, sendShopSaleEmail } from "@/lib/email"
import Stripe from "stripe"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 })
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const meta = session.metadata ?? {}
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? ""

  // Idempotency guard
  const existing = await prisma.shopOrder.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  })
  if (existing) return NextResponse.json({ received: true })

  if (meta.type === "shop_single") {
    await handleSinglePurchase({ meta, paymentIntentId, session })
  } else if (meta.type === "shop_cart") {
    await handleCartPurchase({ meta, paymentIntentId, session })
  }

  return NextResponse.json({ received: true })
}

async function handleSinglePurchase({
  meta,
  paymentIntentId,
  session,
}: {
  meta: Record<string, string>
  paymentIntentId: string
  session: Stripe.Checkout.Session
}) {
  const { itemId, buyerId, sellerId } = meta

  const [item, buyer, seller] = await Promise.all([
    prisma.shopItem.findUnique({ where: { id: itemId } }),
    prisma.user.findUnique({ where: { id: buyerId }, select: { id: true, email: true, name: true } }),
    prisma.user.findUnique({ where: { id: sellerId }, select: { id: true, email: true, name: true, username: true, stripeConnectId: true } }),
  ])

  if (!item || !buyer || !seller) return

  const fees = calculateFee(item.price)

  const order = await prisma.shopOrder.create({
    data: {
      buyerId,
      sellerId,
      itemId,
      amountTotal: item.price,
      galleryFee: fees.galleryFee,
      sellerPayout: fees.sellerPayout,
      stripePaymentIntentId: paymentIntentId,
      downloadTokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year (token is permanent; signed URL has 24h)
      status: "PURCHASED",
    },
  })

  await prisma.shopItem.update({
    where: { id: itemId },
    data: { purchaseCount: { increment: 1 } },
  })

  // Issue transfer to seller
  if (seller.stripeConnectId) {
    try {
      await stripe.transfers.create({
        amount: fees.sellerPayoutCents,
        currency: "usd",
        destination: seller.stripeConnectId,
        transfer_group: paymentIntentId,
        metadata: { orderId: order.id },
      })
    } catch (e) {
      console.error("Transfer failed for order", order.id, e)
    }
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  const downloadUrl = `${baseUrl}/api/shop/download/${order.downloadToken}`

  // Emails (fire-and-forget; don't let email failure block the response)
  if (buyer.email) {
    sendShopPurchaseEmail({
      to: buyer.email,
      buyerName: buyer.name ?? "there",
      itemTitle: item.title,
      sellerUsername: seller.username ?? sellerId,
      downloadUrl,
      amountPaid: item.price,
    }).catch(console.error)
  }

  if (seller.email) {
    sendShopSaleEmail({
      to: seller.email,
      artistName: seller.name ?? "there",
      itemTitle: item.title,
      buyerUsername: buyer.name ?? buyerId,
      sellerPayout: fees.sellerPayout,
    }).catch(console.error)
  }
}

async function handleCartPurchase({
  meta,
  paymentIntentId,
  session,
}: {
  meta: Record<string, string>
  paymentIntentId: string
  session: Stripe.Checkout.Session
}) {
  const { buyerId, itemIds: itemIdsJson } = meta
  const itemIds: string[] = JSON.parse(itemIdsJson)

  const [items, buyer] = await Promise.all([
    prisma.shopItem.findMany({
      where: { id: { in: itemIds } },
      include: { user: { select: { id: true, email: true, name: true, username: true, stripeConnectId: true } } },
    }),
    prisma.user.findUnique({ where: { id: buyerId }, select: { id: true, email: true, name: true } }),
  ])

  if (!buyer || items.length === 0) return

  const totalAmount = items.reduce((sum, item) => sum + item.price, 0)
  const totalFees = items.reduce((sum, item) => sum + calculateFee(item.price).galleryFee, 0)

  const cartOrder = await prisma.cartOrder.create({
    data: {
      buyerId,
      amountTotal: totalAmount,
      galleryFee: totalFees,
      stripePaymentIntentId: paymentIntentId,
      status: "PAID",
    },
  })

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

  for (const item of items) {
    const fees = calculateFee(item.price)

    const order = await prisma.shopOrder.create({
      data: {
        buyerId,
        sellerId: item.userId,
        itemId: item.id,
        cartOrderId: cartOrder.id,
        amountTotal: item.price,
        galleryFee: fees.galleryFee,
        sellerPayout: fees.sellerPayout,
        stripePaymentIntentId: paymentIntentId,
        downloadTokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: "PURCHASED",
      },
    })

    await prisma.shopItem.update({
      where: { id: item.id },
      data: { purchaseCount: { increment: 1 } },
    })

    if (item.user.stripeConnectId) {
      stripe.transfers.create({
        amount: fees.sellerPayoutCents,
        currency: "usd",
        destination: item.user.stripeConnectId,
        transfer_group: paymentIntentId,
        metadata: { orderId: order.id },
      }).catch(e => console.error("Transfer failed for order", order.id, e))
    }

    const downloadUrl = `${baseUrl}/api/shop/download/${order.downloadToken}`

    if (buyer.email) {
      sendShopPurchaseEmail({
        to: buyer.email,
        buyerName: buyer.name ?? "there",
        itemTitle: item.title,
        sellerUsername: item.user.username ?? item.userId,
        downloadUrl,
        amountPaid: item.price,
      }).catch(console.error)
    }

    if (item.user.email) {
      sendShopSaleEmail({
        to: item.user.email,
        artistName: item.user.name ?? "there",
        itemTitle: item.title,
        buyerUsername: buyer.name ?? buyerId,
        sellerPayout: fees.sellerPayout,
      }).catch(console.error)
    }
  }
}
```

> Note: `prisma` is imported from `@/lib/prisma` (the singleton). Check this path by looking at how other API routes import it (e.g. `app/api/upload/route.ts`). If the path is different, adjust accordingly.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix type errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/stripe/shop-webhook/route.ts
git commit -m "feat: Stripe shop webhook — handleSinglePurchase, handleCartPurchase, transfer to seller"
```

---

## Task 6: Download endpoint

**Files:**
- Create: `app/api/shop/download/[token]/route.ts`

The download endpoint validates the token, generates a 24h Cloudinary signed URL for the private file, and redirects the browser to it. It marks `downloadedAt` on first use (but the link remains valid for 24h; the buyer can re-generate from order history).

- [ ] **Step 1: Find how Cloudinary is used in the codebase**

Read `lib/upload.ts` and `app/api/upload/route.ts` to find: how `cloudinary` is imported, what env vars are used, and whether there's a cloudinary singleton. Also check if there's an existing import like `import { v2 as cloudinary } from "cloudinary"` anywhere.

```bash
grep -r "cloudinary" lib/ app/api/upload/ --include="*.ts" -l
```

- [ ] **Step 2: Create the download route**

Create `app/api/shop/download/[token]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { v2 as cloudinary } from "cloudinary"

export const runtime = "nodejs"

// Cloudinary is configured via env vars CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// These should already be set (existing upload infrastructure uses them)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const order = await prisma.shopOrder.findUnique({
    where: { downloadToken: token },
    include: { item: { select: { fileUrl: true, title: true } } },
  })

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (order.status !== "PURCHASED") {
    return NextResponse.json({ error: "Order not eligible for download" }, { status: 403 })
  }

  if (!order.item.fileUrl) {
    return NextResponse.json({ error: "No file attached to this item" }, { status: 404 })
  }

  // Mark first download time (informational only; link stays valid)
  if (!order.downloadedAt) {
    await prisma.shopOrder.update({
      where: { id: order.id },
      data: { downloadedAt: new Date() },
    }).catch(() => {}) // non-critical
  }

  // Generate 24h signed URL for the private Cloudinary file
  // order.item.fileUrl stores the public_id (set during upload in app/api/upload-file/route.ts)
  const signedUrl = cloudinary.utils.private_download_url(order.item.fileUrl, "", {
    resource_type: "raw",
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
    attachment: true, // triggers browser download instead of inline display
  })

  return NextResponse.redirect(signedUrl)
}
```

> Note: `cloudinary.utils.private_download_url` signature: `(public_id, format, options)`. Passing `""` as format works for raw files. If the cloudinary import or configuration differs from the existing upload code, match the existing pattern.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/shop/download/[token]/route.ts
git commit -m "feat: download endpoint — signed Cloudinary URL, marks downloadedAt"
```

---

## Task 7: Order history — getMyOrders tRPC + /shop/orders page

**Files:**
- Modify: `server/routers/shop.ts`
- Create: `app/shop/orders/page.tsx`

- [ ] **Step 1: Add getMyOrders to shop router**

Add in the "Public browsing" section of `server/routers/shop.ts`:

```typescript
  getMyOrders: protectedProcedure.query(async ({ ctx }) => {
    const orders = await ctx.prisma.shopOrder.findMany({
      where: { buyerId: ctx.session.user.id },
      select: {
        id: true,
        downloadToken: true,
        amountTotal: true,
        status: true,
        createdAt: true,
        downloadedAt: true,
        item: {
          select: {
            id: true,
            title: true,
            image: true,
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })
    return orders
  }),
```

- [ ] **Step 2: Create app/shop/orders/page.tsx**

```typescript
"use client"

import { trpc } from "@/components/providers"
import Image from "next/image"
import Link from "next/link"
import { useSession } from "next-auth/react"

export default function OrdersPage() {
  const { data: session, status } = useSession()
  const { data: orders, isLoading } = trpc.shop.getMyOrders.useQuery(undefined, {
    enabled: status === "authenticated",
  })

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen md:pl-16 pb-24" style={{ background: "#0D0D0F" }}>
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl animate-pulse"
              style={{ background: "#1a1a2e" }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div
        className="min-h-screen md:pl-16 flex items-center justify-center"
        style={{ background: "#0D0D0F" }}
      >
        <p style={{ color: "rgba(255,255,255,0.4)" }}>Sign in to view your orders</p>
      </div>
    )
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""

  return (
    <div className="min-h-screen md:pl-16 pb-24" style={{ background: "#0D0D0F" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Your orders</h1>

        {!orders || orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              No purchases yet.{" "}
              <Link href="/shop" className="underline" style={{ color: "rgba(255,255,255,0.6)" }}>
                Browse the shop →
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div
                key={order.id}
                className="rounded-2xl p-4 flex items-center gap-4"
                style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {order.item.image && (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                    <Image
                      src={order.item.image}
                      alt={order.item.title}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{order.item.title}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    @{order.item.user.username} · ${order.amountTotal.toFixed(2)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {new Date(order.createdAt).toLocaleDateString()}
                    {order.downloadedAt && " · Downloaded"}
                  </p>
                </div>
                <a
                  href={`/api/shop/download/${order.downloadToken}`}
                  className="flex-shrink-0 py-2 px-4 rounded-xl text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/routers/shop.ts app/shop/orders/page.tsx
git commit -m "feat: getMyOrders tRPC query and order history page"
```

---

## Task 8: Wire Buy Now button + Cart Checkout + order-success page

**Files:**
- Modify: `app/[username]/shop/[itemId]/page.tsx`
- Modify: `components/CartDrawer.tsx`
- Create: `app/shop/order-success/page.tsx`

Read both files before editing.

- [ ] **Step 1: Wire Buy Now in item detail page**

Read `app/[username]/shop/[itemId]/page.tsx`.

Replace the disabled "Buy Now" button with a working one. The button calls `createCheckout` and redirects to the Stripe Checkout URL.

Add a mutation at the top of the component (after existing hooks):

```typescript
const checkout = trpc.shop.createCheckout.useMutation({
  onSuccess: ({ url }) => {
    window.location.href = url
  },
  onError: (err) => {
    // Show artist-not-connected error distinctly
    alert(err.message)
  },
})
```

Replace the disabled Buy Now button:

```typescript
<button
  onClick={() => checkout.mutate({ itemId: item.id })}
  disabled={checkout.isPending}
  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
  style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
>
  {checkout.isPending ? "Loading…" : "Buy Now"}
</button>
```

- [ ] **Step 2: Wire Cart Checkout in CartDrawer**

Read `components/CartDrawer.tsx`.

Add a mutation:

```typescript
const checkout = trpc.shop.createCartCheckout.useMutation({
  onSuccess: ({ url }) => {
    window.location.href = url
  },
  onError: (err) => {
    alert(err.message)
  },
})
```

Replace the disabled Checkout button with:

```typescript
<button
  onClick={() =>
    checkout.mutate({
      items: items.map(i => ({ id: i.id })),
    })
  }
  disabled={checkout.isPending || items.length === 0}
  className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
  style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
>
  {checkout.isPending ? "Loading…" : `Checkout · $${total.toFixed(2)}`}
</button>
```

- [ ] **Step 3: Create order-success page**

Create `app/shop/order-success/page.tsx`:

```typescript
"use client"

import Link from "next/link"
import { useCart } from "@/lib/cart"
import { useEffect } from "react"

export default function OrderSuccessPage() {
  const { dispatch } = useCart()

  useEffect(() => {
    // Clear cart after successful checkout
    dispatch({ type: "clear" })
  }, [dispatch])

  return (
    <div
      className="min-h-screen md:pl-16 flex items-center justify-center"
      style={{ background: "#0D0D0F" }}
    >
      <div className="max-w-md mx-auto px-6 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-white mb-3">Purchase complete!</h1>
        <p className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
          Check your email for your download link. It expires in 24 hours.
        </p>
        <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
          You can also access all your downloads from your order history.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/shop/orders"
            className="py-3 px-6 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
          >
            View orders
          </Link>
          <Link
            href="/shop"
            className="py-3 px-6 rounded-xl text-sm font-semibold"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            Back to shop
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/[username]/shop/[itemId]/page.tsx components/CartDrawer.tsx app/shop/order-success/page.tsx
git commit -m "feat: wire Buy Now, Cart Checkout, and order-success page"
```

---

## Task 9: Roadmap update

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Update roadmap**

Read `docs/roadmap.md`. Mark the following items as complete (`[x]`):

In the **Shop** section under "Pre-Launch":
- `[ ] Stripe Connect onboarding for artists — *Plan 2*` → `[x]`
- `[ ] Stripe payment intent (single item + cart checkout) — *Plan 2*` → `[x]`
- `[ ] Download delivery by email (signed Cloudinary URL, 24h) — *Plan 2*` → `[x]`

Also update the **Last updated** date at the top of the file to `2026-06-09`.

- [ ] **Step 2: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: mark shop Plan 2 items complete in roadmap"
```

---

## Environment Variables Checklist

Before testing end-to-end, verify these are set in `.env.local`:

| Variable | Source |
|----------|--------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → your endpoint → Signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → API keys (for future client use) |
| `CLOUDINARY_CLOUD_NAME` | Already set (Plan 1) |
| `CLOUDINARY_API_KEY` | Already set (Plan 1) |
| `CLOUDINARY_API_SECRET` | Already set (Plan 1) |

For local webhook testing, use the Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/stripe/shop-webhook
```
This gives you a local `STRIPE_WEBHOOK_SECRET` to put in `.env.local`.
