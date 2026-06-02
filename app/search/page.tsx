"use client"

import { useState, useRef, Suspense, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"
import ArtistScrollRow from "@/components/discovery/ArtistScrollRow"
import ForYouGrid from "@/components/discovery/ForYouGrid"
import FilteredArtistList from "@/components/discovery/FilteredArtistList"

// ── Commission status badge ──────────────────────────────────────────────────

function CommissionBadge({ status }: { status: "OPEN" | "LIMITED" | "CLOSED" }) {
  if (status === "OPEN") {
    return (
      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md"
        style={{ background: "rgba(0,200,120,0.25)", color: "rgba(0,230,130,0.9)", border: "1px solid rgba(0,200,120,0.3)" }}>
        OPEN
      </span>
    )
  }
  if (status === "LIMITED") {
    return (
      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md"
        style={{ background: "rgba(255,160,0,0.2)", color: "rgba(255,185,0,0.9)", border: "1px solid rgba(255,160,0,0.3)" }}>
        LIMITED
      </span>
    )
  }
  return null
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, color, total, onSeeAll }: {
  label: string
  color: string
  total: number
  onSeeAll: () => void
}) {
  return (
    <div className="flex justify-between items-center mb-2.5">
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
      {total > 0 && (
        <button onClick={onSeeAll} className="text-[10px] text-white/35 hover:text-white/60 transition-colors">
          See all {total} →
        </button>
      )}
    </div>
  )
}

// ── Artists section ───────────────────────────────────────────────────────────

type ArtistItem = { id: string; username: string | null; name: string | null; image: string | null; commissionStatus: "OPEN" | "LIMITED" | "CLOSED" }

function ArtistsSection({ items, total, onSeeAll }: { items: ArtistItem[]; total: number; onSeeAll: () => void }) {
  if (items.length === 0) return null
  return (
    <div>
      <SectionHeader label="Artists" color="rgba(176,68,248,0.9)" total={total} onSeeAll={onSeeAll} />
      <div className="flex flex-col">
        {items.map((user) => (
          <Link
            key={user.id}
            href={`/@${user.username}`}
            className="flex items-center gap-2.5 py-2 border-b last:border-b-0 text-left hover:bg-white/[0.03] rounded-lg px-1 transition-colors"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            <Avatar src={user.image} name={user.name} username={user.username} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white truncate">{user.name ?? `@${user.username}`}</span>
                <CommissionBadge status={user.commissionStatus} />
              </div>
              <span className="text-[10px] text-white/40">@{user.username}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Posts section ─────────────────────────────────────────────────────────────

type PostItem = { id: string; image: string; description: string | null; user: { username: string | null } }

function PostsSection({ items, total, onSeeAll }: { items: PostItem[]; total: number; onSeeAll: () => void }) {
  if (items.length === 0) return null
  return (
    <div>
      <SectionHeader label="Posts" color="rgba(0,180,238,0.9)" total={total} onSeeAll={onSeeAll} />
      <div className="grid grid-cols-3 gap-1">
        {items.map((post) => (
          <Link
            key={post.id}
            href={post.user.username ? `/@${post.user.username}` : "#"}
            className="aspect-square rounded-md overflow-hidden relative"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <img src={post.image} alt={post.description ?? ""} className="w-full h-full object-cover" />
            {post.description && (
              <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1"
                style={{ background: "rgba(0,0,0,0.6)" }}>
                <p className="text-[7px] text-white truncate">{post.description}</p>
              </div>
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
      <SectionHeader label="Shop" color="rgba(255,200,0,0.9)" total={total} onSeeAll={onSeeAll} />
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.user.username ? `/@${item.user.username}` : "#"}
            className="flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-white/[0.06] transition-colors"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <img src={item.image} alt={item.title} className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-white truncate">{item.title}</p>
              <p className="text-[10px] text-white/40">@{item.user.username}</p>
            </div>
            <span className="text-[11px] font-bold flex-shrink-0" style={{ color: "rgba(255,200,0,0.9)" }}>
              ${item.price.toFixed(2)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Discovery screen (shown when no query) ────────────────────────────────────

function DiscoveryScreen() {
  const { data: risingData } = trpc.discovery.risingStars.useQuery({ limit: 15 })
  const { data: spotlightData } = trpc.discovery.spotlight.useQuery({ limit: 15 })

  return (
    <div className="flex flex-col gap-5 pb-24 pt-3">
      <ArtistScrollRow
        label="⬆ Rising Stars"
        labelColor="rgba(255,200,0,0.9)"
        filterParam="rising-stars"
        items={risingData?.items ?? []}
        total={risingData?.total ?? 0}
      />

      {(risingData?.items.length ?? 0) > 0 && (
        <div className="mx-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
      )}

      <ArtistScrollRow
        label="✦ Spotlight"
        labelColor="rgba(176,68,248,0.9)"
        filterParam="spotlight"
        items={spotlightData?.items ?? []}
        total={spotlightData?.total ?? 0}
      />

      {(spotlightData?.items.length ?? 0) > 0 && (
        <div className="mx-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
      )}

      <ForYouGrid />
    </div>
  )
}

// ── Main search inner component ───────────────────────────────────────────────

function SearchInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const initialQ = searchParams.get("q") ?? ""
  const tab = searchParams.get("tab") as "artists" | "posts" | "shop" | null
  const filter = searchParams.get("filter") as "rising-stars" | "spotlight" | null
  const filterLabels: Record<string, string> = {
    "rising-stars": "⬆ Rising Stars",
    "spotlight": "✦ Spotlight",
  }
  const filterColors: Record<string, string> = {
    "rising-stars": "rgba(255,200,0,0.9)",
    "spotlight": "rgba(176,68,248,0.9)",
  }
  const [inputValue, setInputValue] = useState(initialQ)
  const [limit, setLimit] = useState(20)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const query = searchParams.get("q") ?? ""
  const enabled = query.trim().length >= 1

  // Sync input with URL on external navigation (back/forward)
  useEffect(() => {
    const urlQ = searchParams.get("q") ?? ""
    setInputValue(urlQ)
  }, [searchParams])

  // Reset limit when query or tab changes
  useEffect(() => {
    setLimit(20)
  }, [query, tab])

  // Debounce URL writes
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

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleClear() {
    setInputValue("")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    router.replace(pathname, { scroll: false })
  }

  function goTab(t: string) {
    router.push(`/search?q=${encodeURIComponent(query)}&tab=${t}`)
  }

  function goBack() {
    router.push(`/search?q=${encodeURIComponent(query)}`)
  }

  // Overview queries (small limits)
  const overviewEnabled = enabled && !tab
  const { data: artistsData } = trpc.search.artists.useQuery({ query, limit: 5 }, { enabled: overviewEnabled })
  const { data: postsData } = trpc.search.posts.useQuery({ query, limit: 6 }, { enabled: overviewEnabled })
  const { data: shopData } = trpc.search.shop.useQuery({ query, limit: 4 }, { enabled: overviewEnabled })

  // Tab queries (full paginated)
  const { data: tabArtists } = trpc.search.artists.useQuery({ query, limit }, { enabled: enabled && tab === "artists" })
  const { data: tabPosts } = trpc.search.posts.useQuery({ query, limit }, { enabled: enabled && tab === "posts" })
  const { data: tabShop } = trpc.search.shop.useQuery({ query, limit }, { enabled: enabled && tab === "shop" })

  const hasArtists = (artistsData?.items.length ?? 0) > 0
  const hasPosts = (postsData?.items.length ?? 0) > 0
  const hasShop = (shopData?.items.length ?? 0) > 0
  const hasAnyResults = hasArtists || hasPosts || hasShop
  const searchedAndEmpty = overviewEnabled && artistsData && postsData && shopData && !hasAnyResults

  const tabColors: Record<string, string> = {
    artists: "rgba(176,68,248,0.9)",
    posts: "rgba(0,180,238,0.9)",
    shop: "rgba(255,200,0,0.9)",
  }
  const tabLabels: Record<string, string> = {
    artists: "Artists",
    posts: "Posts",
    shop: "Shop",
  }

  return (
    <div className="min-h-screen" style={{ background: "#0d0d0f" }}>
      {/* Sticky search bar */}
      <div className="sticky top-0 z-10 px-4 py-3" style={{ background: "#0d0d0f", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {(tab || filter) && (
          <button
            onClick={tab ? goBack : () => router.push("/search")}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mb-2"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {filter ? "Back to discover" : "Back to results"}
          </button>
        )}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            autoFocus
            type="text"
            value={inputValue}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search artists, posts, shop…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
          {inputValue && (
            <button onClick={handleClear} className="text-white/40 hover:text-white/70 transition-colors text-xs">✕</button>
          )}
        </div>
        {tab && (
          <p className="text-[11px] font-bold uppercase tracking-widest mt-2 px-1"
            style={{ color: tabColors[tab] }}>
            {tabLabels[tab]}
          </p>
        )}
        {filter && (
          <p
            className="text-[11px] font-bold uppercase tracking-widest mt-2 px-1"
            style={{ color: filterColors[filter] }}
          >
            {filterLabels[filter]}
          </p>
        )}
      </div>

      {/* Filter view: full Rising Stars or Spotlight list */}
      {filter && !enabled && (
        <div className="py-4">
          <FilteredArtistList filter={filter} />
        </div>
      )}

      {/* Discovery screen: no query, no filter */}
      {!filter && !enabled && (
        <DiscoveryScreen />
      )}

      {/* Results */}
      {enabled && (
      <div className="px-4 py-4 flex flex-col gap-5 pb-24">

        {/* Overview mode */}
        {!tab && (
          <>
            {searchedAndEmpty && (
              <p className="text-sm text-white/40 text-center mt-12">No results for &ldquo;{query}&rdquo;</p>
            )}
            {hasArtists && (
              <ArtistsSection items={artistsData!.items} total={artistsData!.total} onSeeAll={() => goTab("artists")} />
            )}
            {hasPosts && (
              <PostsSection items={postsData!.items} total={postsData!.total} onSeeAll={() => goTab("posts")} />
            )}
            {hasShop && (
              <ShopSection items={shopData!.items} total={shopData!.total} onSeeAll={() => goTab("shop")} />
            )}
          </>
        )}

        {/* Tab: Artists */}
        {tab === "artists" && tabArtists && (
          <>
            {tabArtists.items.length === 0 ? (
              <p className="text-sm text-white/40 text-center mt-12">No artists found for &ldquo;{query}&rdquo;</p>
            ) : (
              <ArtistsSection items={tabArtists.items} total={tabArtists.total} onSeeAll={() => {}} />
            )}
            {tabArtists.items.length < tabArtists.total && (
              <button
                onClick={() => setLimit(l => l + 20)}
                className="w-full py-2.5 text-xs font-semibold text-white/50 hover:text-white transition-colors rounded-xl"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Load more
              </button>
            )}
          </>
        )}

        {/* Tab: Posts */}
        {tab === "posts" && tabPosts && (
          <>
            {tabPosts.items.length === 0 ? (
              <p className="text-sm text-white/40 text-center mt-12">No posts found for &ldquo;{query}&rdquo;</p>
            ) : (
              <PostsSection items={tabPosts.items} total={tabPosts.total} onSeeAll={() => {}} />
            )}
            {tabPosts.items.length < tabPosts.total && (
              <button
                onClick={() => setLimit(l => l + 20)}
                className="w-full py-2.5 text-xs font-semibold text-white/50 hover:text-white transition-colors rounded-xl"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Load more
              </button>
            )}
          </>
        )}

        {/* Tab: Shop */}
        {tab === "shop" && tabShop && (
          <>
            {tabShop.items.length === 0 ? (
              <p className="text-sm text-white/40 text-center mt-12">No shop items found for &ldquo;{query}&rdquo;</p>
            ) : (
              <ShopSection items={tabShop.items} total={tabShop.total} onSeeAll={() => {}} />
            )}
            {tabShop.items.length < tabShop.total && (
              <button
                onClick={() => setLimit(l => l + 20)}
                className="w-full py-2.5 text-xs font-semibold text-white/50 hover:text-white transition-colors rounded-xl"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>
      )}
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d0f" }}>
        <p className="text-white/40 text-sm">Loading…</p>
      </div>
    }>
      <SearchInner />
    </Suspense>
  )
}
