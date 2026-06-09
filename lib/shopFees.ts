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
