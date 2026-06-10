"use client"

import { use, useState } from "react"
import { trpc } from "@/components/providers"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/lib/cart"
import CartDrawer from "@/components/CartDrawer"

function ConnectBanner() {
  const utils = trpc.useUtils()
  const createLink = trpc.shop.createConnectLink.useMutation({
    onSuccess: ({ url }) => {
      utils.shop.getConnectStatus.invalidate()
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

export default function ArtistShopPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = use(params)
  const displayUsername = username.startsWith("@") ? username.slice(1) : username
  const { data: session } = useSession()
  const { items: cartItems, count: cartCount, dispatch } = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const utils = trpc.useUtils()

  const { data: shopItems, isLoading } = trpc.shop.getByUsername.useQuery({
    username: displayUsername,
  })

  const deleteMutation = trpc.shop.delete.useMutation({
    onSuccess: () => utils.shop.getByUsername.invalidate({ username: displayUsername }),
  })
  const togglePauseMutation = trpc.shop.togglePause.useMutation({
    onSuccess: () => utils.shop.getByUsername.invalidate({ username: displayUsername }),
  })

  const isOwner =
    session?.user?.username?.toLowerCase() === displayUsername.toLowerCase()

  const { data: connectStatus } = trpc.shop.getConnectStatus.useQuery(undefined, {
    enabled: isOwner,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen pb-24 md:pl-16" style={{ background: "#0D0D0F" }}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl aspect-square animate-pulse"
                style={{ background: "#1a1a2e" }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    <div className="min-h-screen pb-24 md:pl-16" style={{ background: "#0D0D0F" }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href={`/@${displayUsername}`}
              className="text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              ← @{displayUsername}
            </Link>
            <h1 className="text-2xl font-bold text-white mt-1">Shop</h1>
          </div>
          <div className="flex items-center gap-2">
          {isOwner && (
            <Link
              href={`/@${displayUsername}/shop/new`}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)",
              }}
            >
              + Add listing
            </Link>
          )}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-white">
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61H19a2 2 0 001.98-1.7L22 8H6"/>
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {isOwner && connectStatus && !connectStatus.connected && (
          <ConnectBanner />
        )}

        {!shopItems || shopItems.length === 0 ? (
          <div className="text-center py-24" style={{ color: "rgba(255,255,255,0.4)" }}>
            {isOwner ? (
              <>
                <p className="text-lg">Your shop is empty</p>
                <p className="text-sm mt-2">Add your first listing to start selling</p>
                <Link
                  href={`/@${displayUsername}/shop/new`}
                  className="inline-block mt-4 px-6 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{
                    background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)",
                  }}
                >
                  Add listing
                </Link>
              </>
            ) : (
              <p className="text-lg">No items for sale yet</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {shopItems.map(item => {
              const inCart = cartItems.some(i => i.id === item.id)
              return (
                <div
                  key={item.id}
                  className="rounded-2xl overflow-hidden flex flex-col"
                  style={{ background: "#1a1a2e", border: "1px solid #ffffff0f" }}
                >
                  <Link href={`/@${displayUsername}/shop/${item.id}`}>
                    <div className="relative aspect-square overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        className="object-cover hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, 33vw"
                      />
                      {item.status === "PAUSED" && (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.6)" }}
                        >
                          <span className="text-xs font-semibold text-white/70 bg-black/50 px-2 py-1 rounded-lg">
                            Paused
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>@{displayUsername}</p>
                      <span className="text-sm font-bold text-white">${item.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isOwner ? (
                        <>
                          <button
                            onClick={() => togglePauseMutation.mutate({ id: item.id })}
                            disabled={togglePauseMutation.isPending}
                            className="text-xs px-2 py-1 rounded-lg transition-colors"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              color: "rgba(255,255,255,0.5)",
                            }}
                          >
                            {item.status === "ACTIVE" ? "Pause" : "Unpause"}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this listing? This cannot be undone."))
                                deleteMutation.mutate({ id: item.id })
                            }}
                            disabled={deleteMutation.isPending}
                            className="text-xs px-2 py-1 rounded-lg transition-colors"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              color: "rgba(248,113,113,0.7)",
                            }}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() =>
                            dispatch({
                              type: "add",
                              item: {
                                id: item.id,
                                title: item.title,
                                price: item.price,
                                image: item.image,
                                sellerUsername: displayUsername,
                              },
                            })
                          }
                          disabled={inCart}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          style={{
                            background: inCart
                              ? "rgba(255,255,255,0.08)"
                              : "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)",
                            color: "white",
                          }}
                        >
                          {inCart ? "In cart" : "Add to cart"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
    </>
  )
}
