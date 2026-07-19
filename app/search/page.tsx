"use client"

import { useState, useRef, Suspense, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/components/providers"
import FilteredArtistList from "@/components/discovery/FilteredArtistList"
import type { DiscoveryArtist } from "@/components/discovery/ArtistDiscoveryCard"
import { ART_STYLE_CHIPS } from "@/lib/art-styles"

const STYLE_CHIPS = ["All", ...ART_STYLE_CHIPS] as const
type StyleChip = (typeof STYLE_CHIPS)[number]

const CONTENT_TYPES = ["All", "Artists", "Posts", "Shop", "Commissions"] as const
const SORT_OPTIONS = ["Trending", "Newest", "Most liked"] as const

// ── Helpers ──────────────────────────────────────────────────────────────────

function GradientRing({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, #FF3CAC, #784BA0, #2B86C5)",
      padding: 2, flexShrink: 0,
    }}>
      <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "var(--bg)" }}>
        {children}
      </div>
    </div>
  )
}

function AvatarImg({ src, name, size }: { src: string | null; name: string | null; size: number }) {
  if (src) {
    return <img src={src} alt={name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  }
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #FF3CAC, #784BA0)", fontFamily: "'Playfair Display', serif", fontSize: size * 0.35, fontWeight: 700, color: "white" }}>
      {(name ?? "?")[0].toUpperCase()}
    </div>
  )
}

// ── Filter sheet ──────────────────────────────────────────────────────────────

function FilterSheet({
  onClose,
  activeType,
  activeSort,
  onApply,
}: {
  onClose: () => void
  activeType: string
  activeSort: string
  onApply: (type: string, sort: string) => void
}) {
  const [type, setType] = useState(activeType)
  const [sort, setSort] = useState(activeSort)

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.6)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "var(--surface)", borderRadius: "20px 20px 0 0",
        padding: "0 16px 32px", maxWidth: 470, margin: "0 auto",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border)", margin: "12px auto 18px" }} />
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 18 }}>
          Filter
        </div>

        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 9 }}>
          Content type
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
          {CONTENT_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                fontSize: 11, padding: "5px 13px", borderRadius: 99, cursor: "pointer",
                fontFamily: "Inter, sans-serif", fontWeight: 500,
                ...(type === t
                  ? { background: "linear-gradient(var(--bg),var(--bg)) padding-box, linear-gradient(90deg,#FF3CAC,#2B86C5) border-box", border: "1.5px solid transparent", color: "var(--text)" }
                  : { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--muted)" }
                ),
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 9 }}>
          Sort by
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 24 }}>
          {SORT_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={{
                fontSize: 11, padding: "5px 13px", borderRadius: 99, cursor: "pointer",
                fontFamily: "Inter, sans-serif", fontWeight: 500,
                ...(sort === s
                  ? { background: "linear-gradient(var(--bg),var(--bg)) padding-box, linear-gradient(90deg,#FF3CAC,#2B86C5) border-box", border: "1.5px solid transparent", color: "var(--text)" }
                  : { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--muted)" }
                ),
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={() => onApply(type, sort)}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 10, cursor: "pointer",
            background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)",
            color: "white", fontSize: 13, fontWeight: 600, border: "none",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Apply filters
        </button>
      </div>
    </>
  )
}

// ── Rising Stars row ──────────────────────────────────────────────────────────

function RisingStarsRow({ items, total }: { items: DiscoveryArtist[]; total: number }) {
  if (items.length === 0) return null

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 8px" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
          Rising Stars
        </div>
        {total > items.length && (
          <Link href="/search?filter=rising-stars" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none" }}>
            See all
          </Link>
        )}
      </div>

      <div style={{ display: "flex", gap: 14, padding: "0 16px 12px", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {items.map(artist => {
          if (!artist.username) return null
          return (
            <Link key={artist.id} href={`/@${artist.username}`} style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textDecoration: "none", width: 60 }}>
              <GradientRing size={52}>
                <AvatarImg src={artist.image} name={artist.name} size={52} />
              </GradientRing>
              <div style={{ fontSize: 10, color: "var(--text)", fontFamily: "Inter, sans-serif", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                {artist.name ?? artist.username}
              </div>
              <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "Inter, sans-serif", textAlign: "center", marginTop: -3 }}>
                {artist.commissionStatus === "OPEN" ? "Open" : artist.commissionStatus === "LIMITED" ? "Limited" : ""}
              </div>
            </Link>
          )
        })}
        {total > items.length && (
          <Link href="/search?filter=rising-stars" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: "50%", border: "1.5px dashed var(--border)", textDecoration: "none" }}>
            <span style={{ fontSize: 9, color: "var(--muted)", textAlign: "center" }}>See{"\n"}all →</span>
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Spotlight row ─────────────────────────────────────────────────────────────

function SpotlightRow({ items, total }: { items: DiscoveryArtist[]; total: number }) {
  if (items.length === 0) return null

  function formatFollowers(n: number) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 16px 8px" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
          Spotlight
        </div>
        {total > items.length && (
          <Link href="/search?filter=spotlight" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none" }}>
            See all
          </Link>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, padding: "0 16px 14px", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {items.map(artist => {
          if (!artist.username) return null
          return (
            <Link key={artist.id} href={`/@${artist.username}`} style={{ flexShrink: 0, width: 140, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface)", textDecoration: "none", display: "flex", flexDirection: "column" }}>
              <div style={{ width: "100%", height: 80, overflow: "hidden", position: "relative" }}>
                {artist.image
                  ? <img src={artist.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #241830, #1E2838)" }} />
                }
              </div>
              <div style={{ padding: "8px 10px 10px" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 11, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {artist.name ?? artist.username}
                </div>
                <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "Inter, sans-serif", marginTop: 2 }}>
                  {formatFollowers(artist.followerCount)} followers
                </div>
                <div style={{
                  marginTop: 7, fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6, display: "inline-block",
                  background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", color: "white", fontFamily: "Inter, sans-serif",
                }}>
                  Follow
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── Posts grid ────────────────────────────────────────────────────────────────

type PostItem = { id: string; image: string; description: string | null; user: { username: string | null } }

function PostsGrid({ items }: { items: PostItem[] }) {
  if (items.length === 0) return null
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
      {items.map(post => (
        <Link
          key={post.id}
          href={post.user.username ? `/@${post.user.username}/${post.id}` : "#"}
          style={{ aspectRatio: "1", display: "block", overflow: "hidden", background: "var(--surface)" }}
        >
          <img src={post.image} alt={post.description ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </Link>
      ))}
    </div>
  )
}

// ── Discovery screen ──────────────────────────────────────────────────────────

function DiscoveryScreen({ selectedStyle }: { selectedStyle: StyleChip }) {
  const [forYouLimit, setForYouLimit] = useState(9)
  const { data: risingData } = trpc.discovery.risingStars.useQuery({ limit: 20 })
  const { data: spotlightData } = trpc.discovery.spotlight.useQuery({ limit: 20 })
  const { data: forYouData } = trpc.discovery.forYou.useQuery({ limit: forYouLimit }, { enabled: selectedStyle === "All" })
  const styleQuery = selectedStyle !== "All" ? selectedStyle : ""
  const { data: styledPosts } = trpc.search.posts.useQuery({ query: styleQuery, limit: 18 }, { enabled: selectedStyle !== "All" })

  const posts = selectedStyle === "All" ? (forYouData?.items ?? []) : (styledPosts?.items ?? [])

  return (
    <div style={{ paddingBottom: 80 }}>
      <RisingStarsRow items={risingData?.items ?? []} total={risingData?.total ?? 0} />
      <SpotlightRow items={spotlightData?.items ?? []} total={spotlightData?.total ?? 0} />

      {posts.length > 0 && (
        <>
          <div style={{ height: 1, background: "var(--border)", margin: "4px 0 8px" }} />
          <div style={{ fontSize: 9, color: "var(--muted)", padding: "0 16px 8px", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "Inter, sans-serif" }}>
            {selectedStyle === "All" ? "For you" : selectedStyle}
          </div>
          <PostsGrid items={posts} />
          {selectedStyle === "All" && forYouData && forYouData.items.length === forYouLimit && (
            <button
              onClick={() => setForYouLimit(l => l + 9)}
              style={{ width: "100%", padding: "12px 0", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--muted)", fontFamily: "Inter, sans-serif" }}
            >
              Load more
            </button>
          )}
        </>
      )}

      {/* Full filter view (rising-stars or spotlight) is rendered by parent */}
    </div>
  )
}

// ── Artists section ───────────────────────────────────────────────────────────

type ArtistItem = { id: string; username: string | null; name: string | null; image: string | null; commissionStatus: "OPEN" | "LIMITED" | "CLOSED" }

function ArtistsSection({ items, total, onSeeAll }: { items: ArtistItem[]; total: number; onSeeAll: () => void }) {
  if (items.length === 0) return null
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Artists</div>
        {total > items.length && (
          <button onClick={onSeeAll} style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>See all {total}</button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map(user => (
          <Link key={user.id} href={`/@${user.username}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border)", textDecoration: "none" }}>
            <GradientRing size={38}>
              <AvatarImg src={user.image} name={user.name} size={38} />
            </GradientRing>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.name ?? user.username}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "Inter, sans-serif", marginTop: 1 }}>
                @{user.username}
              </div>
            </div>
            {user.commissionStatus !== "CLOSED" && (
              <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: "Inter, sans-serif", flexShrink: 0, ...(user.commissionStatus === "OPEN" ? { background: "rgba(0,200,120,0.2)", color: "rgba(0,230,130,0.9)", border: "1px solid rgba(0,200,120,0.3)" } : { background: "rgba(255,160,0,0.2)", color: "rgba(255,185,0,0.9)", border: "1px solid rgba(255,160,0,0.3)" }) }}>
                {user.commissionStatus}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Shop section ──────────────────────────────────────────────────────────────

type ShopItem = { id: string; image: string; title: string; price: number; user: { username: string | null } }

function ShopSection({ items, total, onSeeAll }: { items: ShopItem[]; total: number; onSeeAll: () => void }) {
  if (items.length === 0) return null
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Shop</div>
        {total > items.length && (
          <button onClick={onSeeAll} style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>See all {total}</button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(item => (
          <Link key={item.id} href={item.user.username ? `/@${item.user.username}` : "#"} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}>
            <img src={item.image} alt={item.title} style={{ width: 44, height: 44, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 12, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.title}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>@{item.user.username}</div>
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, flexShrink: 0, background: "linear-gradient(90deg,#FF3CAC,#784BA0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              ${item.price.toFixed(2)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Main search inner component ───────────────────────────────────────────────

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

  useEffect(() => {
    setInputValue(searchParams.get("q") ?? "")
  }, [searchParams])

  useEffect(() => {
    setLimit(20)
  }, [query, tab])

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

  function handleClear() {
    setInputValue("")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    router.replace(pathname, { scroll: false })
  }

  function goTab(t: string) {
    router.push(`/search?q=${encodeURIComponent(query)}&tab=${t}`)
  }

  function handleApplyFilter(type: string, sort: string) {
    setActiveType(type)
    setActiveSort(sort)
    setShowFilter(false)
    if (type === "All") {
      router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search")
    } else {
      const typeParam = type.toLowerCase()
      router.push(query ? `/search?q=${encodeURIComponent(query)}&tab=${typeParam}` : `/search?tab=${typeParam}`)
    }
  }

  // Overview queries
  const overviewEnabled = enabled && !tab
  const { data: artistsData } = trpc.search.artists.useQuery({ query, limit: 5 }, { enabled: overviewEnabled })
  const { data: postsData } = trpc.search.posts.useQuery({ query, limit: 6 }, { enabled: overviewEnabled })
  const { data: shopData } = trpc.search.shop.useQuery({ query, limit: 4 }, { enabled: overviewEnabled })

  // Tab queries
  const { data: tabArtists } = trpc.search.artists.useQuery({ query, limit }, { enabled: enabled && tab === "artists" })
  const { data: tabPosts } = trpc.search.posts.useQuery({ query, limit }, { enabled: enabled && tab === "posts" })
  const { data: tabShop } = trpc.search.shop.useQuery({ query, limit }, { enabled: enabled && tab === "shop" })

  const hasArtists = (artistsData?.items.length ?? 0) > 0
  const hasPosts = (postsData?.items.length ?? 0) > 0
  const hasShop = (shopData?.items.length ?? 0) > 0
  const searchedAndEmpty = overviewEnabled && artistsData && postsData && shopData && !hasArtists && !hasPosts && !hasShop

  const filterHasActive = activeType !== "All" || activeSort !== "Trending"

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--nav)", borderBottom: "1px solid var(--border)" }}>
        {/* Back button (filter / tab views) */}
        {(tab || filter) && (
          <div style={{ padding: "8px 16px 0" }}>
            <button
              onClick={() => {
                if (filter) router.push("/search")
                else router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search")
              }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 12, fontFamily: "Inter, sans-serif" }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {filter ? "Back to discover" : "All results"}
            </button>
          </div>
        )}

        {/* Logo */}
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.1em", background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", padding: "10px 16px 0" }}>
          Explore
        </div>

        {/* Search row */}
        <div style={{ display: "flex", gap: 8, padding: "8px 16px 10px", alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={inputValue}
              onChange={e => handleInput(e.target.value)}
              placeholder="Artists, styles, tags…"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 12, color: "var(--text)", fontFamily: "Inter, sans-serif" }}
            />
            {inputValue && (
              <button onClick={handleClear} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
            )}
          </div>

          {/* Filter button */}
          <button
            onClick={() => setShowFilter(true)}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: filterHasActive ? "linear-gradient(135deg, rgba(255,60,172,0.2), rgba(43,134,197,0.2))" : "var(--surface)",
              borderWidth: 1, borderStyle: "solid",
              borderColor: filterHasActive ? "rgba(255,60,172,0.5)" : "var(--border)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={filterHasActive ? "#FF3CAC" : "var(--muted)"} strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
          </button>
        </div>

        {/* Style chips */}
        <div style={{ display: "flex", gap: 6, padding: "0 16px 10px", overflowX: "auto", scrollbarWidth: "none" } as React.CSSProperties}>
          {STYLE_CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => setSelectedStyle(chip)}
              style={{
                flexShrink: 0, fontSize: 10, padding: "4px 12px", borderRadius: 99, cursor: "pointer",
                fontFamily: "Inter, sans-serif", border: "1px solid",
                ...(selectedStyle === chip
                  ? { background: "linear-gradient(var(--nav),var(--nav)) padding-box, linear-gradient(90deg,#FF3CAC,#2B86C5) border-box", borderColor: "transparent", color: "var(--text)" }
                  : { background: "var(--surface)", borderColor: "var(--border)", color: "var(--muted)" }
                ),
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Filter view: rising-stars / spotlight full list */}
      {filter && !enabled && (
        <div style={{ paddingBottom: 80 }}>
          <FilteredArtistList filter={filter} />
        </div>
      )}

      {/* Discovery screen */}
      {!filter && !enabled && (
        <DiscoveryScreen selectedStyle={selectedStyle} />
      )}

      {/* Search results */}
      {enabled && (
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 18, paddingBottom: 80 }}>
          {!tab && (
            <>
              {searchedAndEmpty && (
                <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginTop: 40, fontFamily: "Inter, sans-serif" }}>
                  No results for &ldquo;{query}&rdquo;
                </p>
              )}
              {hasArtists && (
                <ArtistsSection items={artistsData!.items} total={artistsData!.total} onSeeAll={() => goTab("artists")} />
              )}
              {hasPosts && (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: -10 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Posts</div>
                    {(postsData?.total ?? 0) > (postsData?.items.length ?? 0) && (
                      <button onClick={() => goTab("posts")} style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>See all {postsData!.total}</button>
                    )}
                  </div>
                  <PostsGrid items={postsData!.items} />
                </>
              )}
              {hasShop && (
                <ShopSection items={shopData!.items} total={shopData!.total} onSeeAll={() => goTab("shop")} />
              )}
            </>
          )}

          {tab === "artists" && tabArtists && (
            <>
              {tabArtists.items.length === 0
                ? <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginTop: 40, fontFamily: "Inter, sans-serif" }}>No artists for &ldquo;{query}&rdquo;</p>
                : <ArtistsSection items={tabArtists.items} total={tabArtists.total} onSeeAll={() => {}} />
              }
              {tabArtists.items.length < tabArtists.total && (
                <button onClick={() => setLimit(l => l + 20)} style={{ width: "100%", padding: "10px 0", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", fontSize: 12, color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>
                  Load more
                </button>
              )}
            </>
          )}

          {tab === "posts" && tabPosts && (
            <>
              {tabPosts.items.length === 0
                ? <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginTop: 40, fontFamily: "Inter, sans-serif" }}>No posts for &ldquo;{query}&rdquo;</p>
                : <PostsGrid items={tabPosts.items} />
              }
              {tabPosts.items.length < tabPosts.total && (
                <button onClick={() => setLimit(l => l + 20)} style={{ width: "100%", padding: "10px 0", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", fontSize: 12, color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>
                  Load more
                </button>
              )}
            </>
          )}

          {tab === "shop" && tabShop && (
            <>
              {tabShop.items.length === 0
                ? <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginTop: 40, fontFamily: "Inter, sans-serif" }}>No shop items for &ldquo;{query}&rdquo;</p>
                : <ShopSection items={tabShop.items} total={tabShop.total} onSeeAll={() => {}} />
              }
              {tabShop.items.length < tabShop.total && (
                <button onClick={() => setLimit(l => l + 20)} style={{ width: "100%", padding: "10px 0", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", fontSize: 12, color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>
                  Load more
                </button>
              )}
            </>
          )}
        </div>
      )}

      {showFilter && (
        <FilterSheet
          onClose={() => setShowFilter(false)}
          activeType={activeType}
          activeSort={activeSort}
          onApply={handleApplyFilter}
        />
      )}
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <p style={{ color: "var(--muted)", fontSize: 13, fontFamily: "Inter, sans-serif" }}>Loading…</p>
      </div>
    }>
      <SearchInner />
    </Suspense>
  )
}
