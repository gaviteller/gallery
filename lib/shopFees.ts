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
