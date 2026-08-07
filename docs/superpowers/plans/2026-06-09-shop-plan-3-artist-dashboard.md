# Shop Plan 3 — Artist Orders & Earnings Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show artists their shop sales history and earnings summary inside the existing professional dashboard at `/professional-profile`.

**Architecture:** Add a `getMySales` tRPC procedure that returns all orders where the artist is the seller, extract a pure `computeShopStats` utility function to aggregate totals, and render a new "Shop Sales" section at the bottom of the existing `ProfessionalProfileInner` component.

**Tech Stack:** tRPC v11, Prisma, Next.js 16 App Router, TypeScript, Vitest, Tailwind

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `lib/shopFees.ts` | Modify | Add `computeShopStats` pure helper |
| `server/__tests__/shop-sales.test.ts` | Create | Unit tests for `computeShopStats` |
| `server/routers/shop.ts` | Modify | Add `getMySales` protectedProcedure |
| `app/professional-profile/page.tsx` | Modify | Add Shop Sales section to dashboard |
| `docs/roadmap.md` | Modify | Mark Plan 3 item as done |

---

### Task 1: `computeShopStats` utility + `getMySales` tRPC procedure

**Files:**
- Modify: `lib/shopFees.ts`
- Create: `server/__tests__/shop-sales.test.ts`
- Modify: `server/routers/shop.ts`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/shop-sales.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { computeShopStats } from "@/lib/shopFees"

describe("computeShopStats", () => {
  it("returns zeros for empty order list", () => {
    const result = computeShopStats([])
    expect(result).toEqual({
      totalSales: 0,
      totalRevenue: 0,
      totalFees: 0,
      totalPayout: 0,
    })
  })

  it("sums a single order correctly", () => {
    const result = computeShopStats([
      { amountTotal: 10, galleryFee: 0.8, sellerPayout: 9.2 },
    ])
    expect(result.totalSales).toBe(1)
    expect(result.totalRevenue).toBeCloseTo(10)
    expect(result.totalFees).toBeCloseTo(0.8)
    expect(result.totalPayout).toBeCloseTo(9.2)
  })

  it("sums multiple orders", () => {
    const result = computeShopStats([
      { amountTotal: 10, galleryFee: 0.8, sellerPayout: 9.2 },
      { amountTotal: 20, galleryFee: 1.6, sellerPayout: 18.4 },
    ])
    expect(result.totalSales).toBe(2)
    expect(result.totalRevenue).toBeCloseTo(30)
    expect(result.totalFees).toBeCloseTo(2.4)
    expect(result.totalPayout).toBeCloseTo(27.6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test server/__tests__/shop-sales.test.ts`

Expected: FAIL with "computeShopStats is not a function" or similar import error.

- [ ] **Step 3: Add `computeShopStats` to `lib/shopFees.ts`**

Open `lib/shopFees.ts`. It currently has `FeeBreakdown` interface and `calculateFee`. Append the following **after** the existing exports:

```typescript
export interface ShopStats {
  totalSales: number
  totalRevenue: number
  totalFees: number
  totalPayout: number
}

export function computeShopStats(
  orders: Array<{ amountTotal: number; galleryFee: number; sellerPayout: number }>
): ShopStats {
  return {
    totalSales: orders.length,
    totalRevenue: orders.reduce((sum, o) => sum + o.amountTotal, 0),
    totalFees: orders.reduce((sum, o) => sum + o.galleryFee, 0),
    totalPayout: orders.reduce((sum, o) => sum + o.sellerPayout, 0),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test server/__tests__/shop-sales.test.ts`

Expected: PASS (3 tests).

- [ ] **Step 5: Add `getMySales` to `server/routers/shop.ts`**

Open `server/routers/shop.ts`. Find the `getMyOrders` procedure (around line 125). Add `getMySales` **right after** `getMyOrders` (before the `create:` procedure):

```typescript
  getMySales: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.shopOrder.findMany({
      where: { sellerId: ctx.session.user.id },
      select: {
        id: true,
        amountTotal: true,
        galleryFee: true,
        sellerPayout: true,
        status: true,
        createdAt: true,
        item: {
          select: {
            id: true,
            title: true,
            image: true,
          },
        },
        buyer: {
          select: {
            username: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  }),
```

- [ ] **Step 6: Run full test suite**

Run: `npm test`

Expected: All tests pass (153+).

- [ ] **Step 7: Commit**

```bash
git add lib/shopFees.ts server/__tests__/shop-sales.test.ts server/routers/shop.ts
git commit -m "feat: add getMySales tRPC procedure and computeShopStats utility"
```

---

### Task 2: Shop Sales section in the professional dashboard

**Files:**
- Modify: `app/professional-profile/page.tsx`

The existing dashboard has these sections in order:
1. Active Commissions
2. Business Overview
3. Commission Settings
4. Commission Form Options (Dropdown Categories)

We add a **Shop Sales** section between Business Overview and Commission Settings. It shows:
- A 3-stat summary row: total sales count / total revenue / net payout
- A list of the most recent 20 sales (buyer avatar + username, item title, amount, date)
- A "No sales yet" empty state

**UI pattern** to follow: identical styling to the existing "Active Commissions" section — same card shell (`#111118` background, `#ffffff10` border, `rounded-2xl`), same row layout, same `text-sm` typography.

- [ ] **Step 1: Add the `getMySales` query call and `computeShopStats` import**

Open `app/professional-profile/page.tsx`.

At the top of the file, add `computeShopStats` to the existing import from `@/lib/shopFees` **if** that import already exists, or add a new import line:

```typescript
import { computeShopStats } from "@/lib/shopFees"
```

Inside `ProfessionalProfileInner`, add the query right after the existing `myCommissions` query line:

```typescript
const { data: mySales } = trpc.shop.getMySales.useQuery()
```

Then compute stats where you'll use them (in JSX):

```typescript
const shopStats = computeShopStats(mySales ?? [])
```

Place this line in the render body, right before the `return` statement.

- [ ] **Step 2: Add the Shop Sales section to the JSX**

Inside the `return (...)` in `ProfessionalProfileInner`, find the comment `{/* ── Business Overview ── */}`. Add the new Shop Sales section **immediately after** the closing `</section>` of Business Overview (before the Commission Settings section):

```tsx
{/* ── Shop Sales ── */}
<section className="rounded-2xl overflow-hidden mb-6" style={{ background: "#111118", border: "1px solid #ffffff10" }}>
  <div className="px-6 py-4" style={{ borderBottom: "1px solid #ffffff10" }}>
    <h2 className="text-sm font-bold text-white/70 uppercase tracking-wide">Shop Sales</h2>
  </div>

  {/* Stats row */}
  <div className="grid grid-cols-3 gap-4 px-6 py-4" style={{ borderBottom: "1px solid #ffffff10" }}>
    <div className="text-center">
      <p className="text-2xl font-bold text-white">{shopStats.totalSales}</p>
      <p className="text-xs text-white/50 mt-1">Total sales</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold text-white">${shopStats.totalRevenue.toFixed(2)}</p>
      <p className="text-xs text-white/50 mt-1">Total revenue</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold text-white">${shopStats.totalPayout.toFixed(2)}</p>
      <p className="text-xs text-white/50 mt-1">Net payout</p>
    </div>
  </div>

  {/* Sales list */}
  {!mySales || mySales.length === 0 ? (
    <div className="px-6 py-8 text-center">
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No sales yet</p>
    </div>
  ) : (
    mySales.slice(0, 20).map(order => (
      <div
        key={order.id}
        className="flex items-center gap-3 px-6 py-3.5 last:border-0"
        style={{ borderBottom: "1px solid #ffffff08" }}
      >
        {/* Item thumbnail */}
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0" style={{ background: "#ffffff10" }}>
          <img
            src={order.item.image}
            alt={order.item.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Item + buyer */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{order.item.title}</p>
          <p className="text-xs text-white/40 mt-0.5">
            @{order.buyer.username ?? order.buyer.name ?? "unknown"}
          </p>
        </div>

        {/* Amount + date */}
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold text-white">${order.sellerPayout.toFixed(2)}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {new Date(order.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
    ))
  )}
</section>
```

- [ ] **Step 3: Verify the page renders without TypeScript errors**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Run full test suite**

Run: `npm test`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/professional-profile/page.tsx
git commit -m "feat: add Shop Sales section to artist dashboard"
```

---

### Task 3: Roadmap update

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Mark the Plan 3 item as done**

Open `docs/roadmap.md`. Find:

```
- [ ] Artist orders + earnings in professional dashboard — *Plan 3*
```

Change it to:

```
- [x] Artist orders + earnings in professional dashboard — *Plan 3*
```

- [ ] **Step 2: Update the "Last updated" date**

Find the line:

```
Last updated: 2026-06-09
```

It already reads 2026-06-09, so no change needed unless the date has advanced.

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: mark Shop Plan 3 complete in roadmap"
```
