"use client"

import { useRef, useCallback, useState } from "react"
import { trpc } from "@/components/providers"
import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/lib/cart"
import type { CartItem } from "@/lib/cart"
import CartDrawer from "@/components/CartDrawer"

type FeedItem = {
  id: string
  title: string
  price: number
  image: string
  status: string
  user: { username: string | null; image: string | null; name: string | null }
}

function ShopItemCard({ item }: { item: FeedItem }) {
  const { items: cartItems, dispatch } = useCart()
  const inCart = cartItems.some(i => i.id === item.id)

  function addToCart() {
    const cartItem: CartItem = {
      id: item.id,
      title: item.title,
      price: item.price,
      image: item.image,
      sellerUsername: item.user.username ?? "",
    }
    dispatch({ type: "add", item: cartItem })
  }

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "#1a1a2e", border: "1px solid #ffffff0f" }}
    >
      <Link href={`/@${item.user.username}/shop/${item.id}`}>
        <div className="relative aspect-square overflow-hidden">
          <Image
            src={item.image}
            alt={item.title}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>
      </Link>
      <div className="p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/@${item.user.username}`}>
            <span className="text-xs transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}>
              @{item.user.username}
            </span>
          </Link>
          <p className="text-sm font-bold text-white mt-0.5">${item.price.toFixed(2)}</p>
        </div>
        <button
          onClick={addToCart}
          disabled={inCart}
          className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          style={{
            background: inCart
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)",
            color: "white",
          }}
        >
          {inCart ? "In cart" : "Add to cart"}
        </button>
      </div>
    </div>
  )
}

export default function ShopPage() {
  const [cartOpen, setCartOpen] = useState(false)
  const { count: cartCount } = useCart()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.shop.getFeed.useInfiniteQuery(
      {},
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    )

  const observer = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observer.current) observer.current.disconnect()
      if (!node) return
      observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      })
      observer.current.observe(node)
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage],
  )

  const allItems = data?.pages.flatMap(p => p.items) ?? []

  return (
    <>
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    <div className="min-h-screen pb-24 md:pl-16" style={{ background: "#0D0D0F" }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Shop</h1>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
              Digital artwork, brush packs, and more from Gallery artists
            </p>
          </div>
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

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl aspect-square animate-pulse"
                style={{ background: "#1a1a2e" }}
              />
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-24" style={{ color: "rgba(255,255,255,0.4)" }}>
            <p className="text-lg">No items yet</p>
            <p className="text-sm mt-2">Artists haven&apos;t listed anything here yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {allItems.map(item => (
                <ShopItemCard key={item.id} item={item} />
              ))}
            </div>
            <div ref={sentinelRef} className="h-4" />
            {isFetchingNextPage && (
              <p className="text-center text-sm py-4" style={{ color: "rgba(255,255,255,0.4)" }}>
                Loading more…
              </p>
            )}
          </>
        )}
      </div>
    </div>
    </>
  )
}
