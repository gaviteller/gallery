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
