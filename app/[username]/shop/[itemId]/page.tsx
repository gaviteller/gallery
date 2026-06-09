"use client"

import { use } from "react"
import { trpc } from "@/components/providers"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/lib/cart"

export default function ShopItemPage({
  params,
}: {
  params: Promise<{ username: string; itemId: string }>
}) {
  const { username, itemId } = use(params)
  const displayUsername = username.startsWith("@") ? username.slice(1) : username
  const { data: session } = useSession()
  const { items: cartItems, dispatch } = useCart()

  const { data: item, isLoading } = trpc.shop.getById.useQuery({ id: itemId })

  const checkout = trpc.shop.createCheckout.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url
    },
    onError: (err) => {
      alert(err.message)
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen md:pl-16 pb-24" style={{ background: "#0D0D0F" }}>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div
            className="rounded-2xl aspect-square w-full animate-pulse"
            style={{ background: "#1a1a2e" }}
          />
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div
        className="min-h-screen md:pl-16 flex items-center justify-center"
        style={{ background: "#0D0D0F" }}
      >
        <p style={{ color: "rgba(255,255,255,0.4)" }}>Item not found</p>
      </div>
    )
  }

  const inCart = cartItems.some(i => i.id === item.id)
  const isOwner =
    session?.user?.username?.toLowerCase() === displayUsername.toLowerCase()

  return (
    <div className="min-h-screen md:pl-16 pb-24" style={{ background: "#0D0D0F" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href={`/@${displayUsername}/shop`}
          className="inline-block text-sm mb-6 transition-colors"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          ← @{displayUsername}&apos;s shop
        </Link>

        {/* Preview image */}
        <div className="rounded-2xl overflow-hidden aspect-square w-full relative mb-6">
          <Image
            src={item.image}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 672px) 100vw, 672px"
            priority
          />
          {item.status === "PAUSED" && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.7)" }}
            >
              <span className="text-sm font-semibold text-white bg-black/50 px-3 py-1.5 rounded-xl">
                Paused
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* Title + price */}
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-white">{item.title}</h1>
            <span className="text-2xl font-bold text-white flex-shrink-0">
              ${item.price.toFixed(2)}
            </span>
          </div>

          {/* Artist */}
          <Link href={`/@${item.user.username ?? displayUsername}`} className="flex items-center gap-2">
            {item.user.image && (
              <Image
                src={item.user.image}
                alt=""
                width={28}
                height={28}
                className="rounded-full"
              />
            )}
            <span
              className="text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              @{item.user.username ?? displayUsername}
            </span>
          </Link>

          {/* Description */}
          {item.description && (
            <p
              className="text-sm leading-relaxed whitespace-pre-line"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {item.description}
            </p>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* No-refund notice */}
          <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.3)" }}>
            All sales are final. Once a download link is sent, no refunds are issued.
          </p>

          {/* Buyer actions */}
          {!isOwner && item.status === "ACTIVE" && (
            <div className="flex gap-3 mt-2">
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
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                {inCart ? "In cart ✓" : "Add to cart"}
              </button>
              <button
                onClick={() => checkout.mutate({ itemId: item.id })}
                disabled={checkout.isPending}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
              >
                {checkout.isPending ? "Loading…" : "Buy Now"}
              </button>
            </div>
          )}

          {/* Owner shortcut */}
          {isOwner && (
            <Link
              href={`/@${displayUsername}/shop`}
              className="block text-center py-3 rounded-xl text-sm font-semibold transition-colors mt-2"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              Manage your shop →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
