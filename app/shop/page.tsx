"use client"
/**
 * SHOP (/shop) — Codex redesign, real data. Styling: app/redesign/shop.css (generated).
 * Listings: trpc.shop.getFeed (24 per page). Cart: lib/cart (browser storage) →
 * Stripe Checkout via shop.createCartCheckout. Items are digital, so one of each.
 * Category chips match a listing's tags/title (listings have no category field).
 */
import "../redesign/shop.css"
import "../redesign/shell.css"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ShoppingBag, X, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Star, Plus, Trash2 } from "lucide-react"
import { trpc } from "@/components/providers"
import { useCart } from "@/lib/cart"
import ProtectedArtwork from "@/components/ProtectedArtwork"
import RedesignShell, { GallerySidebar, Avatar, useShell } from "@/components/redesign/RedesignShell"
import { timeAgo } from "@/components/redesign/FeedParts"

const CATEGORIES = ["All", "Digital", "Prints", "Originals", "Merch", "Stickers", "Wallpapers", "Brushes", "Commissions"] as const
const money = (dollars: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(dollars)

type Listing = {
  id: string; image: string; title: string; description: string | null; price: number; tags: string[]; createdAt: Date
  user: { username: string | null; name: string | null; image: string | null; bannerImage: string | null }
}
type Seller = { username: string; name: string; image: string | null; listings: Listing[] }

export default function ShopPage() {
  return (
    <RedesignShell wrapperClass="gx-shop">
      <div className="desktop-layout shop-layout">
        <GallerySidebar note={"Support the makers.\nCollect the magic."} />
        <ShopMain />
      </div>
    </RedesignShell>
  )
}

function ShopMain() {
  const { toast } = useShell()
  const cart = useCart()
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All")
  const [sellerFilter, setSellerFilter] = useState("")
  const [slide, setSlide] = useState(0)
  const [openListing, setOpenListing] = useState<Listing | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = trpc.shop.getFeed.useInfiniteQuery({}, { getNextPageParam: (last) => last.nextCursor ?? undefined })

  const listings = (data?.pages.flatMap((page) => page.items) ?? []) as Listing[]
  const matchesCategory = (listing: Listing) => category === "All" || [listing.title, ...listing.tags].some((text) => text.toLowerCase().includes(category.toLowerCase().replace(/s$/, "")))
  const filtered = listings.filter((listing) => matchesCategory(listing) && (!sellerFilter || listing.user.username === sellerFilter))

  const sellers: Seller[] = []
  for (const listing of listings) {
    const username = listing.user.username ?? ""
    let seller = sellers.find((s) => s.username === username)
    if (!seller) { seller = { username, name: listing.user.name ?? username, image: listing.user.image, listings: [] }; sellers.push(seller) }
    seller.listings.push(listing)
  }
  const shopGroups = sellers
    .map((seller) => ({ ...seller, listings: seller.listings.filter((listing) => filtered.includes(listing)) }))
    .filter((seller) => seller.listings.length >= 3 || (sellerFilter === seller.username && seller.listings.length > 0))
  const catalog = filtered.filter((listing) => !shopGroups.some((group) => group.username === listing.user.username))
  const featured = listings.slice(0, 5)

  function addToCart(listing: Listing) {
    if (cart.items.some((item) => item.id === listing.id)) { toast("Already in your cart."); return }
    cart.dispatch({ type: "add", item: { id: listing.id, title: listing.title, price: listing.price, image: listing.image, sellerUsername: listing.user.username ?? "" } })
    toast(`${listing.title} added to your cart.`)
  }
  const chooseSeller = (username: string) => { setSellerFilter(username); setCategory("All"); document.querySelector(".shop-results")?.scrollIntoView({ behavior: "smooth", block: "start" }) }

  return (
    <main className="shop-main" aria-label="Shop content">
      <div className="shop-page-heading">
        <div>
          <span className="eyebrow">ART YOU LOVE. ARTISTS YOU BELIEVE IN.</span>
          <h1>Shop <span>✦</span></h1>
          <p>Support artists and discover unique creations.</p>
        </div>
        <button className="shop-cart-button" onClick={() => setCartOpen(true)}><ShoppingBag size={18} />Cart<span>{cart.count}</span></button>
      </div>
      <div className="shop-categories" aria-label="Shop categories">
        {CATEGORIES.map((c) => <button key={c} aria-pressed={category === c} className={category === c ? "selected" : ""} onClick={() => setCategory(c)}>{c}</button>)}
      </div>

      {featured.length > 0 && <FeaturedCarousel listings={featured} index={slide} onIndex={setSlide} onOpen={setOpenListing} />}

      {sellers.length > 0 && (
        <section className="rising-artists">
          <div className="shop-section-heading">
            <div><h2>Rising Stars <span>✧</span></h2><p>Small shops. Big creative energy.</p></div>
            <button onClick={(e) => e.currentTarget.closest("section")?.querySelector(".rising-highlight-row")?.scrollBy({ left: 350, behavior: "smooth" })}>See All <ArrowRight size={13} /></button>
          </div>
          <div className="rising-highlight-row">
            {sellers.map((seller) => (
              <div className={`rising-highlight-item ${sellerFilter === seller.username ? "selected" : ""}`} key={seller.username}>
                <SellerCard seller={seller} onSelect={() => (sellerFilter === seller.username ? setSellerFilter("") : chooseSeller(seller.username))} />
                {sellerFilter === seller.username && <span className="selected-artist-label">Selected artist</span>}
              </div>
            ))}
          </div>
          {sellerFilter && <button className="clear-artist" onClick={() => setSellerFilter("")}><X size={12} />Clear artist selection</button>}
        </section>
      )}

      <section className="shop-results">
        <div className="shop-section-heading">
          <div>
            <h2>{sellerFilter ? `Shop @${sellerFilter}` : category === "All" ? "Find something that feels like you" : category}</h2>
            <p>{filtered.length} unique creations · Made with a little soul</p>
          </div>
          {(sellerFilter || category !== "All") && <button onClick={() => { setSellerFilter(""); setCategory("All") }}><X size={13} />Clear filters</button>}
        </div>
        {shopGroups.map((group) => (
          <section className="artist-shop" key={group.username}>
            <div className="artist-shop-header" style={{ backgroundImage: `linear-gradient(90deg,#31203fe8,#15172bc9),url(${group.listings[0].image})` }}>
              <button className="shop-artist-title" onClick={() => chooseSeller(group.username)}>
                <Avatar src={group.image} name={group.name} className="" /><strong>@{group.username}</strong><span>{group.listings.length} creations</span>
              </button>
              <Link className="visit-shop" href={`/@${group.username}/shop`}>Shop <ArrowRight size={14} /></Link>
            </div>
            <div className="artist-products">{group.listings.map((listing) => <ProductCard key={listing.id} listing={listing} onOpen={() => setOpenListing(listing)} onAdd={() => addToCart(listing)} />)}</div>
          </section>
        ))}
        {catalog.length > 0 && (
          <div className="community-catalog">
            {shopGroups.length > 0 && <div className="shop-section-heading"><div><h2>More to fall in love with</h2><p>Little discoveries from across the creative community.</p></div></div>}
            <div className="community-product-grid">
              {catalog.map((listing) => (
                <div className="catalog-item" key={listing.id}>
                  <ProductCard listing={listing} onOpen={() => setOpenListing(listing)} onAdd={() => addToCart(listing)} />
                  <button className="catalog-artist" onClick={() => chooseSeller(listing.user.username ?? "")}>By @{listing.user.username}</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="shop-empty">
            <ShoppingBag size={32} /><h3>A little discovery takes a little wandering.</h3>
            <p>No products match these filters. Try another category or artist.</p>
            <button onClick={() => { setCategory("All"); setSellerFilter("") }}>Explore all creations →</button>
          </div>
        )}
        {hasNextPage && <button className="keep-browsing" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>{isFetchingNextPage ? "Loading…" : "Load more creations"}</button>}
      </section>
      <footer className="shop-footer"><p>Every purchase is a little vote for a more creative world. <span>✧</span></p><span>GALLERY · MADE FOR THE MAKERS · 2026</span></footer>

      {openListing && <ShopDialog onClose={() => setOpenListing(null)} wide><ProductDetail listing={openListing} inCart={cart.items.some((item) => item.id === openListing.id)} onAdd={() => addToCart(openListing)} /></ShopDialog>}
      {cartOpen && <ShopDialog onClose={() => setCartOpen(false)}><CartContent onBrowse={() => setCartOpen(false)} /></ShopDialog>}
    </main>
  )
}

function FeaturedCarousel({ listings, index, onIndex, onOpen }: { listings: Listing[]; index: number; onIndex: (n: number) => void; onOpen: (l: Listing) => void }) {
  const touchStart = useRef<number | null>(null)
  const listing = listings[index % listings.length]
  const move = (step: number) => onIndex((index + step + listings.length) % listings.length)
  return (
    <section className="featured-section" aria-label="Featured products">
      <div className="featured-banner"
        onTouchStart={(e) => { touchStart.current = e.touches[0].clientX }}
        onTouchEnd={(e) => { if (touchStart.current !== null) { const dx = e.changedTouches[0].clientX - touchStart.current; if (Math.abs(dx) > 45) move(dx < 0 ? 1 : -1); touchStart.current = null } }}>
        <ProtectedArtwork className="featured-art" src={listing.image} alt={listing.title} />
        <div className="featured-shade" />
        <div className="featured-copy">
          <span className="new-drop"><Star size={13} fill="currentColor" /> NEW DROP</span>
          <h2>{listing.title}</h2>
          <p>@{listing.user.username}<span>·</span>{timeAgo(listing.createdAt)}</p>
          <button onClick={() => onOpen(listing)}>View Product<ArrowRight size={17} /></button>
        </div>
        <span className="featured-price">{money(listing.price)}<small>BY AN INDEPENDENT ARTIST</small></span>
        {listings.length > 1 && <>
          <button className="carousel-arrow previous" aria-label="Previous featured product" onClick={() => move(-1)}><ChevronLeft size={21} /></button>
          <button className="carousel-arrow next" aria-label="Next featured product" onClick={() => move(1)}><ChevronRight size={21} /></button>
        </>}
        <span className="featured-number">0{index + 1}<i />0{listings.length}</span>
      </div>
      <div className="carousel-dots">{listings.map((l, i) => <button key={l.id} aria-label={`Show featured product ${i + 1}`} aria-pressed={index === i} onClick={() => onIndex(i)} className={index === i ? "selected" : ""} />)}</div>
    </section>
  )
}

function SellerCard({ seller, onSelect }: { seller: Seller; onSelect: () => void }) {
  const [following, setFollowing] = useState(false)
  const follow = trpc.follow.follow.useMutation({ onSuccess: () => setFollowing(true) })
  const unfollow = trpc.follow.unfollow.useMutation({ onSuccess: () => setFollowing(false) })
  return (
    <article className="artist-highlight">
      <button className="highlight-image" onClick={onSelect} aria-label={`Shop ${seller.name}`}><img src={seller.listings[0].image} alt={`${seller.name}'s artwork`} /><ArrowUpRight size={15} /></button>
      <div className="highlight-body">
        <Link className="highlight-name" href={`/@${seller.username}`}>@{seller.username}</Link>
        <span>{seller.listings.length} for sale</span>
        <button className={`highlight-follow ${following ? "following" : ""}`} disabled={follow.isPending || unfollow.isPending} onClick={() => (following ? unfollow : follow).mutate({ username: seller.username })} aria-pressed={following}>
          {following ? <><Check size={11} />Following</> : "+ Follow"}
        </button>
      </div>
    </article>
  )
}

function ProductCard({ listing, onOpen, onAdd }: { listing: Listing; onOpen: () => void; onAdd: () => void }) {
  return (
    <article className="product-card">
      <div className="product-picture">
        <button className="product-image" aria-label={`View ${listing.title}`} onClick={onOpen}><ProtectedArtwork src={listing.image} alt={listing.title} /></button>
        {listing.tags[0] && <span className="product-category">{listing.tags[0]}</span>}
      </div>
      <div className="product-copy">
        <button className="product-name" onClick={onOpen}>{listing.title}</button>
        <div className="product-buy"><strong>{money(listing.price)}</strong><button onClick={onAdd} aria-label={`Add ${listing.title} to cart`}><Plus size={13} /><span>Add</span></button></div>
      </div>
    </article>
  )
}

function ProductDetail({ listing, inCart, onAdd }: { listing: Listing; inCart: boolean; onAdd: () => void }) {
  return (
    <div className="product-detail">
      <div className="product-detail-image"><ProtectedArtwork src={listing.image} alt={listing.title} /></div>
      <div className="product-detail-copy">
        <span className="eyebrow">MADE BY AN INDEPENDENT ARTIST</span>
        {listing.tags[0] && <span className="detail-category">{listing.tags[0]}</span>}
        <h2>{listing.title}</h2>
        <Link className="detail-artist" href={`/@${listing.user.username}`}><Avatar src={listing.user.image} name={listing.user.name ?? listing.user.username ?? "?"} className="" />@{listing.user.username}<ArrowUpRight size={13} /></Link>
        {listing.description && <p>{listing.description}</p>}
        <div className="product-format">Digital download · delivered by email</div>
        <strong className="detail-price">{money(listing.price)}<small>USD</small></strong>
        <button className="gradient-button add-to-cart" onClick={onAdd} disabled={inCart}><ShoppingBag size={17} />{inCart ? "In your cart" : "Add to Cart"}</button>
        <Link className="demo-note" href={`/@${listing.user.username}/shop/${listing.id}`}>Open full product page →</Link>
      </div>
    </div>
  )
}

function CartContent({ onBrowse }: { onBrowse: () => void }) {
  const { items, total, count, dispatch } = useCart()
  const checkout = trpc.shop.createCartCheckout.useMutation({ onSuccess: ({ url }) => { window.location.href = url } })
  return (
    <div className="cart-content">
      <span className="eyebrow">A LITTLE ART. A LOT OF JOY.</span>
      <h2>Your cart <span>{count}</span></h2>
      {items.length ? <>
        <div className="cart-items">
          {items.map((item) => (
            <article className="cart-line" key={item.id}>
              <img src={item.image} alt={item.title} />
              <div>
                <h3>{item.title}</h3><p>@{item.sellerUsername}</p><strong>{money(item.price)}</strong>
                <div className="cart-line-controls"><button className="remove-item" onClick={() => dispatch({ type: "remove", id: item.id })} aria-label={`Remove ${item.title}`}><Trash2 size={14} /></button></div>
              </div>
            </article>
          ))}
        </div>
        <div className="cart-summary">
          <div><span>Total</span><strong>{money(total)}</strong></div>
          {checkout.error && <p className="gx-error">{checkout.error.message}</p>}
          <button className="gradient-button" disabled={checkout.isPending} onClick={() => checkout.mutate({ items: items.map((item) => ({ id: item.id })) })}>{checkout.isPending ? "Opening checkout…" : <>Continue to checkout<ArrowRight size={16} /></>}</button>
          <button className="keep-browsing" onClick={onBrowse}>Keep exploring the shop</button>
        </div>
      </> : (
        <div className="empty-cart">
          <ShoppingBag size={42} /><h3>Make room for something special.</h3><p>Your cart is waiting for its first little piece of art.</p>
          <button className="gradient-button" onClick={onBrowse}>Explore the shop<ArrowRight size={15} /></button>
        </div>
      )}
    </div>
  )
}

function ShopDialog({ onClose, wide, children }: { onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialogRef.current?.showModal() }, [])
  return (
    <dialog ref={dialogRef} className={`shop-dialog ${wide ? "product-dialog" : "cart-dialog"}`} onCancel={onClose} onClick={(e) => { if (e.target === dialogRef.current) onClose() }}>
      <button className="icon-button shop-dialog-close" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>
      {children}
    </dialog>
  )
}
