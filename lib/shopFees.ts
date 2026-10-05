/**
 * SHOP FEES — Gallery keeps 8% of every shop sale; the artist gets the rest.
 * All math is done in whole cents to avoid floating-point rounding errors.
 */
export interface FeeBreakdown {
  galleryFee: number       // float, e.g. 0.80
  sellerPayout: number     // float, e.g. 9.20
  galleryFeeCents: number  // integer cents, e.g. 80
  sellerPayoutCents: number
  totalCents: number
}

const GALLERY_FEE_RATE = 0.08

/** Splits a sale price (in dollars) into Gallery's fee and the artist's payout. */
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

export interface ShopStats {
  totalSales: number
  totalRevenue: number
  totalFees: number
  totalPayout: number
}

/** Totals for an artist's sales dashboard: number of sales, revenue, fees paid, and payout. */
export function computeShopStats(
  orders: Array<{ amountTotal: number; galleryFee: number; sellerPayout: number }>
): ShopStats {
  return {
    totalSales: orders.length,
    totalRevenue: orders.reduce((sum, order) => sum + order.amountTotal, 0),
    totalFees: orders.reduce((sum, order) => sum + order.galleryFee, 0),
    totalPayout: orders.reduce((sum, order) => sum + order.sellerPayout, 0),
  }
}
