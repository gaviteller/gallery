import Stripe from "stripe"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set")
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia",
    })
  }
  return _stripe
}

// Proxy so existing `stripe.xxx` call sites keep working without changes
export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string) {
    return (getStripe() as unknown as Record<string, unknown>)[prop]
  },
})
