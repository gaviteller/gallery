/**
 * STRIPE (payments) CLIENT.
 *
 * Created lazily — only on the first payment call — so the site still runs
 * when STRIPE_SECRET_KEY isn't set (payments are intentionally not live yet).
 */
import Stripe from "stripe"

let stripeClient: Stripe | null = null

/** Returns the shared Stripe client, creating it on first use. Throws if no key is configured. */
export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set")
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia",
    })
  }
  return stripeClient
}

// Proxy so existing `stripe.xxx` call sites keep working without changes
export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string) {
    return (getStripe() as unknown as Record<string, unknown>)[prop]
  },
})
