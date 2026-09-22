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

const TYPE_CHIPS = ["All", "Digital", "Prints", "Originals", "Merch", "Stickers", "Keychains", "Apparel", "Home Decor", "Accessories", "Commissions"] as const
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
  if (h < 24) return `${Math.max(1, Math.floor(h))}h ago`
  if (h < 168) return `${Math.floor(h / 24)}d ago`
  return `${Math.floor(h / 168)}w ago`
}

function filterByType(items: FeedItem[], type: TypeChip): FeedItem[] {
  if (type === "All") return items
  const map: Record<TypeChip, string[]> = {
    All: [], Digital: ["digital", "download", "file"], Prints: ["print", "poster"], Originals: ["original", "one of a kind", "unique"], Merch: ["merch"],
    Stickers: ["sticker"], Keychains: ["keychain", "charm"], Apparel: ["shirt", "hoodie", "apparel", "clothing"], "Home Decor": ["decor", "home", "wall"], Accessories: ["accessory", "accessories", "bag", "pin"], Commissions: ["commission"],
  }
  const kw = map[type]
  return items.filter(item => item.tags.some(t => kw.some(k => t.toLowerCase().includes(k))) || kw.some(k => item.title.toLowerCase().includes(k)))
}

function AvatarImg({ src, name, size }: { src: string | null; name: string | null; size: number }) {
  if (src) return <img src={src} alt="" />
  return <div className="gallery-avatar-fallback" style={{ fontSize: size * 0.38 }}>{(name ?? "?")[0].toUpperCase()}</div>
}

function FeaturedCarousel({ items }: { items: FeedItem[] }) {
  const [active, setActive] = useState(0)
  const { items: cartItems, dispatch } = useCart()
  if (items.length === 0) return null
  const item = items[Math.min(active, items.length - 1)]!
  const inCart = cartItems.some(i => i.id === item.id)

  function addToCart(e: React.MouseEvent) {
    e.preventDefault()
    const cartItem: CartItem = { id: item.id, title: item.title, price: item.price, image: item.image, sellerUsername: item.user.username ?? "" }
    dispatch({ type: "add", item: cartItem })
  }

  return (
    <section className="gallery-shop-featured">
      <Link href={`/@${item.user.username}/shop/${item.id}`} className="gallery-shop-feature-link">
        <img className="gallery-shop-feature-bg" src={item.image} alt="" aria-hidden="true" />
        <img className="gallery-shop-feature-image" src={item.image} alt={item.title} />
        <div className="gallery-shop-feature-shade" />
        <div className="gallery-shop-feature-copy">
          <span>★ NEW DROP</span>
          <h2>{item.title}</h2>
          <p>{item.user.name ?? item.user.username} · {timeAgo(item.createdAt)}</p>
          <span className="gallery-shop-view-product">View Product <b>→</b></span>
        </div>
        <strong className="gallery-shop-feature-price">${item.price.toFixed(2)}</strong>
        <button onClick={addToCart} disabled={inCart} className="gallery-shop-feature-cart">{inCart ? "In cart" : "+ Cart"}</button>
      </Link>
      {items.length > 1 && <div className="gallery-shop-carousel-dots">{items.map((_, i) => <button key={i} className={i === active ? "active" : ""} onClick={() => setActive(i)} />)}</div>}
    </section>
  )
}

function ShopItemCard({ item, isNew }: { item: FeedItem; isNew: boolean }) {
  const { items: cartItems, dispatch } = useCart()
  const inCart = cartItems.some(i => i.id === item.id)
  const isOriginal = item.tags.some(t => ["original", "one of a kind", "unique"].includes(t.toLowerCase()))
  function addToCart(e: React.MouseEvent) {
    e.preventDefault()
    dispatch({ type: "add", item: { id: item.id, title: item.title, price: item.price, image: item.image, sellerUsername: item.user.username ?? "" } })
  }
  return (
    <Link href={`/@${item.user.username}/shop/${item.id}`} className="gallery-shop-product-card">
      <div className="gallery-shop-product-image-wrap">
        <img src={item.image} alt={item.title} />
        {isNew && <span className="gallery-shop-product-badge new">NEW</span>}
        {isOriginal && !isNew && <span className="gallery-shop-product-badge original">ORIGINAL</span>}
        <button onClick={addToCart} disabled={inCart} className="gallery-shop-product-cart">{inCart ? "✓ In cart" : "+ Cart"}</button>
      </div>
      <span className="gallery-shop-product-title">{item.title}</span>
      <strong>${item.price.toFixed(2)}</strong>
    </Link>
  )
}

function ArtistBlock({ username, name, image, bannerImage, items, bannerIdx, newestItemId }: { username: string | null; name: string | null; image: string | null; bannerImage: string | null; items: FeedItem[]; bannerIdx: number; newestItemId: string }) {
  if (!username || items.length === 0) return null
  const fallback = ARTIST_BANNER_GRADIENTS[bannerIdx % ARTIST_BANNER_GRADIENTS.length]
  return (
    <section className="gallery-shop-artist-block">
      <div className="gallery-shop-artist-banner" style={!bannerImage ? { background: fallback } : undefined}>
        {bannerImage && <><img className="gallery-shop-banner-blur" src={bannerImage} alt="" aria-hidden="true" /><img className="gallery-shop-banner-contain" src={bannerImage} alt={`${name ?? username} shop banner`} /></>}
        <div className="gallery-shop-banner-overlay" />
        <div className="gallery-shop-artist-row">
          <Link href={`/@${username}`} className="gallery-shop-artist-avatar"><AvatarImg src={image} name={name} size={36} /></Link>
          <Link href={`/@${username}`} className="gallery-shop-artist-name">{name ?? username}</Link>
          <Link href={`/@${username}/shop`} className="gallery-shop-artist-link">Shop →</Link>
        </div>
      </div>
      <div className="gallery-shop-items-row">{items.map(item => <ShopItemCard key={item.id} item={item} isNew={item.id === newestItemId} />)}</div>
    </section>
  )
}

function ShopRisingStars({ items }: { items: Array<{ id: string; username: string | null; name: string | null; image: string | null }> }) {
  if (!items.length) return null
  return (
    <section className="gallery-shop-discovery-row gallery-shop-desktop-only">
      <div className="gallery-shop-section-head"><h2>Rising Stars</h2><Link href="/search?filter=rising-stars">See All</Link></div>
      <div className="gallery-shop-rising-list">{items.slice(0, 8).map(artist => artist.username ? <Link key={artist.id} href={`/@${artist.username}`}><span className="gallery-shop-rising-ring"><span>{artist.image ? <img src={artist.image} alt="" /> : (artist.name ?? artist.username)[0]?.toUpperCase()}</span></span><b>{artist.name ?? artist.username}</b></Link> : null)}</div>
    </section>
  )
}

function ShopFollowButton({ username }: { username: string | null }) {
  const [followed, setFollowed] = useState(false)
  const follow = trpc.follow.follow.useMutation({ onSuccess: () => setFollowed(true) })
  if (!username) return null
  return <button className={followed ? "gallery-shop-highlight-follow followed" : "gallery-shop-highlight-follow"} disabled={followed || follow.isPending} onClick={() => follow.mutate({ username })}>{followed ? "Following" : follow.isPending ? "…" : "Follow"}</button>
}

function ShopHighlights({ items }: { items: Array<{ id: string; username: string | null; name: string | null; image: string | null; bannerImage?: string | null; followerCount: number }> }) {
  if (!items.length) return null
  return (
    <section className="gallery-shop-highlights gallery-shop-desktop-only">
      <div className="gallery-shop-section-head"><h2>Highlights</h2><Link href="/search?filter=spotlight">See All</Link></div>
      <div className="gallery-shop-highlight-grid">
        {items.slice(0, 5).map(artist => (
          <article key={artist.id} className="gallery-shop-highlight-card">
            <Link href={artist.username ? `/@${artist.username}` : "#"} className="gallery-shop-highlight-media">
              {artist.bannerImage ? <img src={artist.bannerImage} alt="" /> : artist.image ? <img src={artist.image} alt="" /> : <span />}
            </Link>
            <div className="gallery-shop-highlight-meta"><b>{artist.name ?? artist.username}</b><span>{artist.followerCount.toLocaleString()} followers</span><ShopFollowButton username={artist.username} /></div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default function ShopPage() {
  const [cartOpen, setCartOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<TypeChip>("All")
  const { count: cartCount } = useCart()
  const { data, isLoading } = trpc.shop.getFeed.useInfiniteQuery({}, { getNextPageParam: last => last.nextCursor ?? undefined })
  const { data: risingData } = trpc.discovery.risingStars.useQuery({ limit: 12 })
  const { data: spotlightData } = trpc.discovery.spotlight.useQuery({ limit: 10 })

  const allItems: FeedItem[] = data?.pages.flatMap(p => p.items) ?? []
  const filtered = filterByType(allItems, selectedType)
  const featuredItems = filtered.slice(0, 5)

  const artistOrder: string[] = []
  const byArtist: Record<string, FeedItem[]> = {}
  for (const item of filtered) {
    const key = item.user.username ?? ""
    if (!key) continue
    if (!byArtist[key]) { artistOrder.push(key); byArtist[key] = [] }
    byArtist[key].push(item)
  }
  const newestByArtist: Record<string, string> = {}
  for (const key of artistOrder) {
    const sorted = [...(byArtist[key] ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    if (sorted[0]) newestByArtist[key] = sorted[0].id
  }

  return (
    <>
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
      <div className="gallery-shop-page">
        <div className="gallery-shop-desktop-head">
          <div><h1>Shop</h1><p>Support artists and discover unique creations.</p></div>
          <button className="gallery-shop-cart-button" onClick={() => setCartOpen(true)}><span>🛒</span> Cart {cartCount > 0 && <b>{cartCount > 9 ? "9+" : cartCount}</b>}</button>
        </div>

        <div className="gallery-shop-mobile-head">
          <h1>Shop</h1>
          <button onClick={() => setCartOpen(true)}>Cart {cartCount > 0 && <b>{cartCount > 9 ? "9+" : cartCount}</b>}</button>
        </div>

        <div className="gallery-shop-type-chips">
          {TYPE_CHIPS.map(chip => <button key={chip} onClick={() => setSelectedType(chip)} className={selectedType === chip ? "is-active" : ""}>{chip}</button>)}
        </div>

        {isLoading ? <div className="gallery-shop-status">Loading…</div> : filtered.length === 0 ? <div className="gallery-shop-status">Nothing here yet</div> : (
          <>
            <FeaturedCarousel items={featuredItems} />
            <ShopRisingStars items={risingData?.items ?? []} />
            <ShopHighlights items={(spotlightData?.items ?? []) as Array<{ id: string; username: string | null; name: string | null; image: string | null; bannerImage?: string | null; followerCount: number }>} />
            <div className="gallery-shop-artist-sections">
              {artistOrder.map((username, i) => {
                const items = byArtist[username] ?? []
                const first = items[0]
                return <ArtistBlock key={username} username={username} name={first?.user.name ?? null} image={first?.user.image ?? null} bannerImage={first?.user.bannerImage ?? null} items={items} bannerIdx={i} newestItemId={newestByArtist[username] ?? ""} />
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}
