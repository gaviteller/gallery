"use client"

import { useState } from "react"
import { trpc } from "@/components/providers"
import Link from "next/link"
import { useCart } from "@/lib/cart"
import type { CartItem } from "@/lib/cart"
import CartDrawer from "@/components/CartDrawer"

type FeedItem = {
  id: string
  title: string
  price: number
  image: string
  tags: string[]
  status: string
  createdAt: Date
  user: { username: string | null; image: string | null; name: string | null; bannerImage: string | null }
}

const TYPE_CHIPS = ["All", "Digital", "Prints", "Originals", "Merch"] as const
type TypeChip = (typeof TYPE_CHIPS)[number]

const ARTIST_BANNER_GRADIENTS = [
  "linear-gradient(105deg, #1E1030, #301A50, #1A2030)",
  "linear-gradient(105deg, #101A28, #1A2840, #201830)",
  "linear-gradient(105deg, #201018, #381828, #201020)",
  "linear-gradient(105deg, #0E1E1E, #162E28, #1A1E1A)",
  "linear-gradient(105deg, #1A1820, #2A2038, #201A28)",
]

function timeAgo(date: Date): string {
  const h = (Date.now() - new Date(date).getTime()) / 3_600_000
  if (h < 24) return `${Math.floor(h)}h ago`
  if (h < 168) return `${Math.floor(h / 24)}d ago`
  return `${Math.floor(h / 168)}w ago`
}

function filterByType(items: FeedItem[], type: TypeChip): FeedItem[] {
  if (type === "All") return items
  const map: Record<TypeChip, string[]> = {
    All: [],
    Digital: ["digital", "download", "file"],
    Prints: ["print", "poster"],
    Originals: ["original", "one of a kind", "unique"],
    Merch: ["merch", "shirt", "sticker", "hoodie"],
  }
  const kw = map[type]
  return items.filter(item =>
    item.tags.some(t => kw.some(k => t.toLowerCase().includes(k))) ||
    item.title.toLowerCase().includes(map[type][0] ?? "")
  )
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function AvatarImg({ src, name, size }: { src: string | null; name: string | null; size: number }) {
  if (src) return <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#FF3CAC,#784BA0)", fontFamily: "'Playfair Display',serif", fontSize: size * 0.38, fontWeight: 700, color: "white" }}>
      {(name ?? "?")[0].toUpperCase()}
    </div>
  )
}

// ── Featured carousel ──────────────────────────────────────────────────────────

function FeaturedCarousel({ items }: { items: FeedItem[] }) {
  const [active, setActive] = useState(0)
  const { items: cartItems, dispatch } = useCart()

  if (items.length === 0) return null
  const item = items[active]!
  const inCart = cartItems.some(i => i.id === item.id)

  function addToCart(e: React.MouseEvent) {
    e.preventDefault()
    const cartItem: CartItem = { id: item.id, title: item.title, price: item.price, image: item.image, sellerUsername: item.user.username ?? "" }
    dispatch({ type: "add", item: cartItem })
  }

  return (
    <div style={{ position: "relative", borderBottom: "1px solid var(--border)" }}>
      <Link href={`/@${item.user.username}/shop/${item.id}`} style={{ display: "block", position: "relative", height: 160, overflow: "hidden", textDecoration: "none" }}>
        <img src={item.image} alt={item.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 5%, rgba(8,6,15,0.75) 55%, rgba(8,6,15,0.98))" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 14px 14px" }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#FF3CAC", marginBottom: 3 }}>
            ✦ New Drop
          </div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontStyle: "italic", fontWeight: 700, color: "white", lineHeight: 1.25 }}>
            {item.title}
          </div>
          <div style={{ fontSize: 9, color: "rgba(240,235,248,0.5)", marginTop: 3 }}>
            {item.user.name ?? item.user.username} · {timeAgo(item.createdAt)}
          </div>
        </div>
        <div style={{ position: "absolute", top: 12, right: 14, fontFamily: "'Playfair Display',serif", fontSize: 19, fontWeight: 700, color: "white" }}>
          ${item.price.toFixed(2)}
        </div>
        <button
          onClick={addToCart}
          disabled={inCart}
          style={{ position: "absolute", bottom: 14, right: 14, fontSize: 9, fontWeight: 600, padding: "5px 11px", borderRadius: 6, border: "none", cursor: inCart ? "default" : "pointer", background: inCart ? "rgba(255,255,255,0.15)" : "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", color: "white", fontFamily: "Inter,sans-serif" }}
        >
          {inCart ? "In cart" : "Add to cart"}
        </button>
      </Link>

      {/* Dot nav */}
      {items.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 5, padding: "8px 0 6px" }}>
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{ width: i === active ? 16 : 6, height: 6, borderRadius: 99, border: "none", cursor: "pointer", padding: 0, transition: "width 0.2s", background: i === active ? "#FF3CAC" : "var(--border)" }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shop item card ─────────────────────────────────────────────────────────────

function ShopItemCard({ item, isNew }: { item: FeedItem; isNew: boolean }) {
  const { items: cartItems, dispatch } = useCart()
  const inCart = cartItems.some(i => i.id === item.id)

  function addToCart(e: React.MouseEvent) {
    e.preventDefault()
    const cartItem: CartItem = { id: item.id, title: item.title, price: item.price, image: item.image, sellerUsername: item.user.username ?? "" }
    dispatch({ type: "add", item: cartItem })
  }

  const isOriginal = item.tags.some(t => ["original", "one of a kind", "unique"].includes(t.toLowerCase()))

  return (
    <Link href={`/@${item.user.username}/shop/${item.id}`} style={{ flexShrink: 0, width: 80, textDecoration: "none", display: "block" }}>
      <div style={{ width: 80, height: 78, borderRadius: 8, overflow: "hidden", background: "var(--surface)", position: "relative" }}>
        <img src={item.image} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {isNew && (
          <div style={{ position: "absolute", top: 4, left: 4, fontSize: 6, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "2px 5px", borderRadius: 3, background: "rgba(255,60,172,0.88)", color: "white" }}>
            New
          </div>
        )}
        {isOriginal && !isNew && (
          <div style={{ position: "absolute", top: 4, left: 4, fontSize: 6, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "2px 5px", borderRadius: 3, background: "rgba(43,134,197,0.88)", color: "white" }}>
            Original
          </div>
        )}
        <button
          onClick={addToCart}
          disabled={inCart}
          style={{ position: "absolute", bottom: 0, insetInline: 0, fontSize: 8, fontWeight: 600, padding: "3px 0", border: "none", cursor: inCart ? "default" : "pointer", background: inCart ? "rgba(255,255,255,0.15)" : "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", color: "white", fontFamily: "Inter,sans-serif" }}
        >
          {inCart ? "✓" : "+ Cart"}
        </button>
      </div>
      <div style={{ fontSize: 9, color: "var(--text)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "Inter,sans-serif" }}>{item.title}</div>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 12, fontWeight: 700, color: "var(--text)", marginTop: 1 }}>${item.price.toFixed(2)}</div>
    </Link>
  )
}

// ── Artist block ───────────────────────────────────────────────────────────────

function ArtistBlock({ username, name, image, bannerImage, items, bannerIdx, newestItemId }: {
  username: string | null
  name: string | null
  image: string | null
  bannerImage: string | null
  items: FeedItem[]
  bannerIdx: number
  newestItemId: string
}) {
  if (!username || items.length === 0) return null

  const bannerBg = bannerImage
    ? `url(${bannerImage})`
    : ARTIST_BANNER_GRADIENTS[bannerIdx % ARTIST_BANNER_GRADIENTS.length]

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Artist banner strip — real banner image or fallback gradient */}
      <div style={{ height: 44, background: bannerBg, backgroundSize: "cover", backgroundPosition: "center" }} />

      {/* Artist row — overlaps banner */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 14px 9px", marginTop: -13, position: "relative", zIndex: 2 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#FF3CAC,#784BA0,#2B86C5)", padding: 2, flexShrink: 0, outline: "2px solid var(--bg)" }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
            <AvatarImg src={image} name={name} size={30} />
          </div>
        </div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 12, fontWeight: 700, color: "var(--text)", flex: 1 }}>{name ?? username}</div>
        <Link href={`/@${username}/shop`} style={{ fontSize: 9, color: "var(--muted)", textDecoration: "none" }}>Shop →</Link>
      </div>

      {/* Items row */}
      <div style={{ display: "flex", gap: 8, padding: "0 14px 12px", overflowX: "auto", scrollbarWidth: "none" } as React.CSSProperties}>
        {items.map(item => (
          <ShopItemCard key={item.id} item={item} isNew={item.id === newestItemId} />
        ))}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ShopPage() {
  const [cartOpen, setCartOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<TypeChip>("All")
  const { count: cartCount } = useCart()

  const { data, isLoading } = trpc.shop.getFeed.useInfiniteQuery(
    {},
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  )

  const allItems: FeedItem[] = data?.pages.flatMap(p => p.items) ?? []
  const filtered = filterByType(allItems, selectedType)

  // Featured: up to 5 newest items for the carousel
  const FEATURED_COUNT = 5
  const featuredItems = filtered.slice(0, FEATURED_COUNT)

  // Group ALL items by artist for the artist sections
  const artistOrder: string[] = []
  const byArtist: Record<string, FeedItem[]> = {}
  for (const item of filtered) {
    const key = item.user.username ?? ""
    if (!key) continue
    if (!byArtist[key]) { artistOrder.push(key); byArtist[key] = [] }
    byArtist[key].push(item)
  }

  // newest item id per artist (for NEW badge)
  const newestByArtist: Record<string, string> = {}
  for (const key of artistOrder) {
    const sorted = [...(byArtist[key] ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    if (sorted[0]) newestByArtist[key] = sorted[0].id
  }

  return (
    <>
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}

      <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
        {/* Sticky nav */}
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--nav)", borderBottom: "1px solid var(--border)", padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, background: "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Shop
          </div>
          <button
            onClick={() => setCartOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer", background: "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", color: "white", fontFamily: "Inter,sans-serif" }}
          >
            Cart
            {cartCount > 0 && (
              <span style={{ background: "white", color: "#784BA0", borderRadius: 99, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700 }}>
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Type chips */}
        <div style={{ display: "flex", gap: 6, padding: "9px 14px", borderBottom: "1px solid var(--border)", overflowX: "auto", scrollbarWidth: "none" } as React.CSSProperties}>
          {TYPE_CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => setSelectedType(chip)}
              style={{
                flexShrink: 0, fontSize: 10, padding: "4px 12px", borderRadius: 99, cursor: "pointer",
                fontFamily: "Inter,sans-serif", border: "1px solid",
                ...(selectedType === chip
                  ? { background: "linear-gradient(var(--bg),var(--bg)) padding-box, linear-gradient(90deg,#FF3CAC,#2B86C5) border-box", borderColor: "transparent", color: "var(--text)" }
                  : { background: "var(--surface)", borderColor: "var(--border)", color: "var(--muted)" }
                ),
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13, fontFamily: "Inter,sans-serif" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--muted)", fontSize: 13, fontFamily: "Inter,sans-serif" }}>Nothing here yet</div>
        ) : (
          <>
            {/* Featured carousel */}
            <FeaturedCarousel items={featuredItems} />

            {/* Artist sections */}
            {artistOrder.map((username, i) => {
              const items = byArtist[username] ?? []
              const first = items[0]
              return (
                <ArtistBlock
                  key={username}
                  username={username}
                  name={first?.user.name ?? null}
                  image={first?.user.image ?? null}
                  bannerImage={first?.user.bannerImage ?? null}
                  items={items}
                  bannerIdx={i}
                  newestItemId={newestByArtist[username] ?? ""}
                />
              )
            })}
          </>
        )}
      </div>
    </>
  )
}
