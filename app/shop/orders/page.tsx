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
                    {order.item.user?.username ? `@${order.item.user.username}` : "Unknown artist"} · ${order.amountTotal.toFixed(2)}
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
