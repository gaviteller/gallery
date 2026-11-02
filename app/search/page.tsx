"use client"

import { useState, useRef, Suspense, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/components/providers"
import FilteredArtistList from "@/components/discovery/FilteredArtistList"
import type { DiscoveryArtist } from "@/components/discovery/ArtistDiscoveryCard"
import { ART_STYLE_CHIPS } from "@/lib/art-styles"
import GalleryRightRail from "@/components/GalleryRightRail"

const STYLE_CHIPS = ["All", ...ART_STYLE_CHIPS] as const
type StyleChip = (typeof STYLE_CHIPS)[number]

const CONTENT_TYPES = ["All", "Artists", "Posts", "Shop", "Commissions"] as const
const SORT_OPTIONS = ["Trending", "Newest", "Most liked"] as const

type PostItem = {
  id: string
  image: string
  description: string | null
  user: { username: string | null }
  _count?: { likes?: number; comments?: number }
}

type ArtistItem = { id: string; username: string | null; name: string | null; image: string | null; commissionStatus: "OPEN" | "LIMITED" | "CLOSED" }
type ShopItem = { id: string; image: string; title: string; price: number; user: { username: string | null } }

function GradientRing({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #FF3CAC, #784BA0, #2B86C5)", padding: 2, flexShrink: 0 }}>
      <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "var(--bg)" }}>{children}</div>
    </div>
  )
}

function AvatarImg({ src, name, size }: { src: string | null; name: string | null; size: number }) {
  if (src) return <img src={src} alt={name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #FF3CAC, #784BA0)", fontFamily: "'Playfair Display', serif", fontSize: size * 0.35, fontWeight: 700, color: "white" }}>
      {(name ?? "?")[0].toUpperCase()}
    </div>
  )
}

function FilterSheet({ onClose, activeType, activeSort, onApply }: { onClose: () => void; activeType: string; activeSort: string; onApply: (type: string, sort: string) => void }) {
  const [type, setType] = useState(activeType)
  const [sort, setSort] = useState(activeSort)
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90, background: "var(--surface)", borderRadius: "20px 20px 0 0", padding: "0 16px 32px", maxWidth: 470, margin: "0 auto" }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border)", margin: "12px auto 18px" }} />
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 18 }}>Filter</div>
        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 9 }}>Content type</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
          {CONTENT_TYPES.map(t => <button key={t} onClick={() => setType(t)} className={type === t ? "gallery-filter-chip is-active" : "gallery-filter-chip"}>{t}</button>)}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 9 }}>Sort by</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 24 }}>
          {SORT_OPTIONS.map(s => <button key={s} onClick={() => setSort(s)} className={sort === s ? "gallery-filter-chip is-active" : "gallery-filter-chip"}>{s}</button>)}
        </div>
        <button onClick={() => onApply(type, sort)} className="gallery-filter-apply">Apply filters</button>
      </div>
    </>
  )
}

function RisingStarsRow({ items, total }: { items: DiscoveryArtist[]; total: number }) {
  if (items.length === 0) return null
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 8px" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Rising Stars</div>
        {total > items.length && <Link href="/search?filter=rising-stars" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none" }}>See all</Link>}
      </div>
      <div style={{ display: "flex", gap: 14, padding: "0 16px 12px", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {items.map(artist => artist.username ? (
          <Link key={artist.id} href={`/@${artist.username}`} style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textDecoration: "none", width: 60 }}>
            <GradientRing size={52}><AvatarImg src={artist.image} name={artist.name} size={52} /></GradientRing>
            <div style={{ fontSize: 10, color: "var(--text)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{artist.name ?? artist.username}</div>
          </Link>
        ) : null)}
      </div>
    </div>
  )
}

function HighlightsArtistRow({ items, total }: { items: DiscoveryArtist[]; total: number }) {
  if (items.length === 0) return null
  const formatFollowers = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 16px 8px" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Highlights</div>
        {total > items.length && <Link href="/search?filter=spotlight" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none" }}>See all</Link>}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "0 16px 14px", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {items.map(artist => artist.username ? (
          <Link key={artist.id} href={`/@${artist.username}`} style={{ flexShrink: 0, width: 140, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface)", textDecoration: "none" }}>
            <div style={{ width: "100%", height: 80, overflow: "hidden", background: "linear-gradient(135deg,#251531,#16273a)" }}>
              {artist.image && <img src={artist.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <div style={{ padding: "8px 10px 10px" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 11, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{artist.name ?? artist.username}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>{formatFollowers(artist.followerCount)} followers</div>
            </div>
          </Link>
        ) : null)}
      </div>
    </div>
  )
}

function PostsGrid({ items }: { items: PostItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="gallery-search-post-grid">
      {items.map(post => <Link key={post.id} href={post.user.username ? `/@${post.user.username}/${post.id}` : "#"}><img src={post.image} alt={post.description ?? ""} /></Link>)}
    </div>
  )
}

function postTitle(post: PostItem, index: number) {
  const text = (post.description ?? "").replace(/#[\w-]+/g, "").trim()
  return text ? text.slice(0, 38) : `Artwork ${index + 1}`
}

function firstTag(post: PostItem) {
  return (post.description ?? "").match(/#[a-zA-Z0-9_]+/)?.[0] ?? "#artwork"
}

function ExploreArtworkCard({ post, index, compact = false }: { post: PostItem; index: number; compact?: boolean }) {
  return (
    <article className={compact ? "gallery-explore-art-card compact" : "gallery-explore-art-card"}>
      <Link href={post.user.username ? `/@${post.user.username}/${post.id}` : "#"} className="gallery-explore-art-image-wrap">
        <img src={post.image} alt={post.description ?? ""} />
      </Link>
      <div className="gallery-explore-art-meta">
        <div className="gallery-explore-card-title">{postTitle(post, index)}</div>
        <div className="gallery-explore-card-sub">{firstTag(post)}</div>
        <div className="gallery-explore-card-bottom">
          <Link href={post.user.username ? `/@${post.user.username}` : "#"}>@{post.user.username ?? "artist"}</Link>
          <span>♥ {post._count?.likes ?? 0}</span>
        </div>
      </div>
    </article>
  )
}

function DiscoveryScreen({ selectedStyle }: { selectedStyle: StyleChip }) {
  const [forYouLimit, setForYouLimit] = useState(15)
  const { data: risingData } = trpc.discovery.risingStars.useQuery({ limit: 20 })
  const { data: spotlightData } = trpc.discovery.spotlight.useQuery({ limit: 20 })
  const { data: forYouData } = trpc.discovery.forYou.useQuery({ limit: forYouLimit }, { enabled: selectedStyle === "All" })
  const styleQuery = selectedStyle !== "All" ? selectedStyle : ""
  const { data: styledPosts } = trpc.search.posts.useQuery({ query: styleQuery, limit: 20 }, { enabled: selectedStyle !== "All" })

  const posts = (selectedStyle === "All" ? (forYouData?.items ?? []) : (styledPosts?.items ?? [])) as PostItem[]
  const highlights = posts.slice(0, 4)



  return (
    <>
      <div className="gallery-explore-desktop-discovery">
        <div className="gallery-explore-wide-wrap">
          <div className="gallery-explore-main-col">
            {(risingData?.items.length ?? 0) > 0 && (
              <section className="gallery-explore-section gallery-rising-desktop">
                <div className="gallery-explore-section-head"><h2>Rising Stars</h2><Link href="/search?filter=rising-stars">See All</Link></div>
                <div className="gallery-rising-list">
                  {risingData!.items.slice(0, 10).map(artist => artist.username ? (
                    <Link key={artist.id} href={`/@${artist.username}`} className="gallery-rising-item">
                      <span className="gallery-rising-ring"><span>{artist.image ? <img src={artist.image} alt="" /> : (artist.name ?? artist.username)[0]?.toUpperCase()}</span></span>
                      <b>{artist.name ?? artist.username}</b>
                    </Link>
                  ) : null)}
                </div>
              </section>
            )}

            {highlights.length > 0 && (
              <section className="gallery-explore-section">
                <div className="gallery-explore-section-head"><h2>Highlights</h2><Link href="/search">See All</Link></div>
                <div className="gallery-highlights-grid">{highlights.map((post, i) => <ExploreArtworkCard key={post.id} post={post} index={i} compact />)}</div>
              </section>
            )}

            {posts.length > 0 && (
              <section className="gallery-explore-section gallery-for-you-section">
                <div className="gallery-explore-section-head gallery-for-you-head">
                  <h2>{selectedStyle === "All" ? "For You" : selectedStyle}</h2>
                  <div className="gallery-for-you-mini-chips"><button className="active">All</button><button>Digital</button><button>Traditional</button><button>Anime/Manga</button><button>3D</button></div>
                </div>
                <div className="gallery-for-you-grid">{posts.map((post, i) => <ExploreArtworkCard key={post.id} post={post} index={i} />)}</div>
                {selectedStyle === "All" && forYouData && forYouData.items.length === forYouLimit && <button className="gallery-load-more" onClick={() => setForYouLimit(v => v + 10)}>Load more</button>}
              </section>
            )}
          </div>

          <div className="gallery-explore-right-col"><GalleryRightRail variant="split" /></div>
        </div>
      </div>

      <div className="gallery-explore-mobile-discovery" style={{ paddingBottom: 80 }}>
        <RisingStarsRow items={risingData?.items ?? []} total={risingData?.total ?? 0} />
        <HighlightsArtistRow items={spotlightData?.items ?? []} total={spotlightData?.total ?? 0} />
        {posts.length > 0 && (
          <>
            <div style={{ height: 1, background: "var(--border)", margin: "4px 0 8px" }} />
            <div style={{ fontSize: 9, color: "var(--muted)", padding: "0 16px 8px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{selectedStyle === "All" ? "For you" : selectedStyle}</div>
            <PostsGrid items={posts} />
            {selectedStyle === "All" && forYouData && forYouData.items.length === forYouLimit && <button onClick={() => setForYouLimit(l => l + 9)} className="gallery-load-more">Load more</button>}
          </>
        )}
      </div>
    </>
  )
}

function ArtistsSection({ items, total, onSeeAll }: { items: ArtistItem[]; total: number; onSeeAll: () => void }) {
  if (items.length === 0) return null
  return (
    <section className="gallery-search-result-section">
      <div className="gallery-search-result-head"><h3>Artists</h3>{total > items.length && <button onClick={onSeeAll}>See all {total}</button>}</div>
      <div className="gallery-search-artist-results">
        {items.map(user => <Link key={user.id} href={`/@${user.username}`} className="gallery-search-artist-result"><GradientRing size={42}><AvatarImg src={user.image} name={user.name} size={42} /></GradientRing><div><b>{user.name ?? user.username}</b><span>@{user.username}</span></div>{user.commissionStatus !== "CLOSED" && <em>{user.commissionStatus}</em>}</Link>)}
      </div>
    </section>
  )
}

function ShopSection({ items, total, onSeeAll }: { items: ShopItem[]; total: number; onSeeAll: () => void }) {
  if (items.length === 0) return null
  return (
    <section className="gallery-search-result-section">
      <div className="gallery-search-result-head"><h3>Shop</h3>{total > items.length && <button onClick={onSeeAll}>See all {total}</button>}</div>
      <div className="gallery-search-shop-results">
        {items.map(item => <Link key={item.id} href={item.user.username ? `/@${item.user.username}` : "#"}><img src={item.image} alt={item.title} /><div><b>{item.title}</b><span>@{item.user.username}</span></div><strong>${item.price.toFixed(2)}</strong></Link>)}
      </div>
    </section>
  )
}

function SearchInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const filter = searchParams.get("filter") as "rising-stars" | "spotlight" | null
  const initialQ = searchParams.get("q") ?? ""
  const tab = searchParams.get("tab") as "artists" | "posts" | "shop" | null

  const [inputValue, setInputValue] = useState(initialQ)
  const [selectedStyle, setSelectedStyle] = useState<StyleChip>("All")
  const [showFilter, setShowFilter] = useState(false)
  const [activeType, setActiveType] = useState("All")
  const [activeSort, setActiveSort] = useState("Trending")
  const [limit, setLimit] = useState(20)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const query = searchParams.get("q") ?? ""
  const enabled = query.trim().length >= 1

  useEffect(() => setInputValue(searchParams.get("q") ?? ""), [searchParams])
  useEffect(() => setLimit(20), [query, tab])
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  function handleInput(value: string) {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams()
      if (value.trim()) params.set("q", value.trim())
      if (tab) params.set("tab", tab)
      const qs = params.toString()
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
    }, 300)
  }

  function handleClear() { setInputValue(""); if (debounceRef.current) clearTimeout(debounceRef.current); router.replace(pathname, { scroll: false }) }
  function goTab(t: string) { router.push(`/search?q=${encodeURIComponent(query)}&tab=${t}`) }
  function handleApplyFilter(type: string, sort: string) {
    setActiveType(type); setActiveSort(sort); setShowFilter(false)
    if (type === "All") router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search")
    else { const typeParam = type.toLowerCase(); router.push(query ? `/search?q=${encodeURIComponent(query)}&tab=${typeParam}` : `/search?tab=${typeParam}`) }
  }

  // Maps the filter sheet's sort label to the value the search API expects.
  const postSort = activeSort === "Newest" ? "newest" : activeSort === "Most liked" ? "mostLiked" : "trending"

  const overviewEnabled = enabled && !tab
  const { data: artistsData } = trpc.search.artists.useQuery({ query, limit: 5 }, { enabled: overviewEnabled })
  const { data: postsData } = trpc.search.posts.useQuery({ query, limit: 8, sort: postSort }, { enabled: overviewEnabled })
  const { data: shopData } = trpc.search.shop.useQuery({ query, limit: 5 }, { enabled: overviewEnabled })
  const { data: tabArtists } = trpc.search.artists.useQuery({ query, limit }, { enabled: enabled && tab === "artists" })
  const { data: tabPosts } = trpc.search.posts.useQuery({ query, limit, sort: postSort }, { enabled: enabled && tab === "posts" })
  const { data: tabShop } = trpc.search.shop.useQuery({ query, limit }, { enabled: enabled && tab === "shop" })

  const hasArtists = (artistsData?.items.length ?? 0) > 0
  const hasPosts = (postsData?.items.length ?? 0) > 0
  const hasShop = (shopData?.items.length ?? 0) > 0
  const searchedAndEmpty = overviewEnabled && artistsData && postsData && shopData && !hasArtists && !hasPosts && !hasShop
  const filterHasActive = activeType !== "All" || activeSort !== "Trending"

  const SearchField = ({ desktop = false }: { desktop?: boolean }) => (
    <div className={desktop ? "gallery-explore-search-field desktop" : "gallery-explore-search-field"}>
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/></svg>
      <input value={inputValue} onChange={e => handleInput(e.target.value)} placeholder={desktop ? "Search artists, styles, tags, or artwork..." : "Artists, styles, tags…"} />
      {inputValue && <button onClick={handleClear}>✕</button>}
    </div>
  )

  return (
    <div className="gallery-explore-page">
      <div className="gallery-explore-desktop-head gallery-card">
        <div className="gallery-explore-title-wrap"><h1>Explore</h1><p>Discover amazing artists, trending artwork, and new inspiration.</p></div>
        <div className="gallery-explore-search-row"><SearchField desktop /><button className={filterHasActive ? "gallery-explore-filter is-active" : "gallery-explore-filter"} onClick={() => setShowFilter(true)} aria-label="Filter"><svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg></button></div>
        <div className="gallery-explore-style-chips">{STYLE_CHIPS.map(chip => <button key={chip} onClick={() => setSelectedStyle(chip)} className={selectedStyle === chip ? "is-active" : ""}>{chip}</button>)}</div>
      </div>

      <div className="gallery-explore-mobile-head">
        {(tab || filter) && <div style={{ padding: "8px 16px 0" }}><button onClick={() => filter ? router.push("/search") : router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 12 }}>← {filter ? "Back to discover" : "All results"}</button></div>}
        <div className="gallery-explore-mobile-title">Explore</div>
        <div className="gallery-explore-mobile-search-row"><SearchField /><button className={filterHasActive ? "gallery-explore-filter is-active" : "gallery-explore-filter"} onClick={() => setShowFilter(true)}><svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg></button></div>
        <div className="gallery-explore-mobile-chips">{STYLE_CHIPS.map(chip => <button key={chip} onClick={() => setSelectedStyle(chip)} className={selectedStyle === chip ? "is-active" : ""}>{chip}</button>)}</div>
      </div>

      {filter && !enabled && <div className="gallery-filtered-artists-wrap"><FilteredArtistList filter={filter} /></div>}
      {!filter && !enabled && <DiscoveryScreen selectedStyle={selectedStyle} />}

      {enabled && (
        <div className="gallery-search-results-page">
          {!tab && <>{searchedAndEmpty && <p className="gallery-empty-results">No results for “{query}”</p>}{hasArtists && <ArtistsSection items={artistsData!.items} total={artistsData!.total} onSeeAll={() => goTab("artists")} />}{hasPosts && <section className="gallery-search-result-section"><div className="gallery-search-result-head"><h3>Posts</h3>{(postsData?.total ?? 0) > (postsData?.items.length ?? 0) && <button onClick={() => goTab("posts")}>See all {postsData!.total}</button>}</div><PostsGrid items={postsData!.items} /></section>}{hasShop && <ShopSection items={shopData!.items} total={shopData!.total} onSeeAll={() => goTab("shop")} />}</>}
          {tab === "artists" && tabArtists && <>{tabArtists.items.length ? <ArtistsSection items={tabArtists.items} total={tabArtists.total} onSeeAll={() => {}} /> : <p className="gallery-empty-results">No artists for “{query}”</p>}{tabArtists.items.length < tabArtists.total && <button className="gallery-load-more" onClick={() => setLimit(l => l + 20)}>Load more</button>}</>}
          {tab === "posts" && tabPosts && <>{tabPosts.items.length ? <PostsGrid items={tabPosts.items} /> : <p className="gallery-empty-results">No posts for “{query}”</p>}{tabPosts.items.length < tabPosts.total && <button className="gallery-load-more" onClick={() => setLimit(l => l + 20)}>Load more</button>}</>}
          {tab === "shop" && tabShop && <>{tabShop.items.length ? <ShopSection items={tabShop.items} total={tabShop.total} onSeeAll={() => {}} /> : <p className="gallery-empty-results">No shop items for “{query}”</p>}{tabShop.items.length < tabShop.total && <button className="gallery-load-more" onClick={() => setLimit(l => l + 20)}>Load more</button>}</>}
        </div>
      )}

      {showFilter && <FilterSheet onClose={() => setShowFilter(false)} activeType={activeType} activeSort={activeSort} onApply={handleApplyFilter} />}
    </div>
  )
}

export default function SearchPage() {
  return <Suspense fallback={<div style={{ flex: "1 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--muted)" }}>Loading…</div>}><SearchInner /></Suspense>
}
