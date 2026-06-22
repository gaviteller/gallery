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
      style={{ background: "var(--bg)" }}
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
            style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
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
