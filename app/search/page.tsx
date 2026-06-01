"use client"

import { useState, useRef, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"

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
  const router = useRouter()
  if (items.length === 0) return null
  return (
    <div>
      <SectionHeader label="Artists" color="rgba(176,68,248,0.9)" total={total} onSeeAll={onSeeAll} />
      <div className="flex flex-col">
        {items.map((user) => (
          <button
            key={user.id}
            onClick={() => router.push(`/@${user.username}`)}
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
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Posts section ─────────────────────────────────────────────────────────────

type PostItem = { id: string; image: string; description: string | null; user: { username: string | null } }

function PostsSection({ items, total, onSeeAll }: { items: PostItem[]; total: number; onSeeAll: () => void }) {
  const router = useRouter()
  if (items.length === 0) return null
  return (
    <div>
      <SectionHeader label="Posts" color="rgba(0,180,238,0.9)" total={total} onSeeAll={onSeeAll} />
      <div className="grid grid-cols-3 gap-1">
        {items.map((post) => (
          <button
            key={post.id}
            onClick={() => router.push(`/@${post.user.username}`)}
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
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Shop section ──────────────────────────────────────────────────────────────

type ShopItem = { id: string; image: string; title: string; price: number; user: { username: string | null } }

function ShopSection({ items, total, onSeeAll }: { items: ShopItem[]; total: number; onSeeAll: () => void }) {
  const router = useRouter()
  if (items.length === 0) return null
  return (
    <div>
      <SectionHeader label="Shop" color="rgba(255,200,0,0.9)" total={total} onSeeAll={onSeeAll} />
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => router.push(`/@${item.user.username}`)}
            className="flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-white/[0.06] transition-colors"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <img src={item.image} alt={item.title} className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-white truncate">{item.title}</p>
              <p className="text-[10px] text-white/40">@{item.user.username}</p>
            </div>
            <span className="text-[11px] font-bold flex-shrink-0" style={{ color: "rgba(255,200,0,0.9)" }}>
              ${item.price}
            </span>
          </button>
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
  const initialQ = searchParams.get("q") ?? ""
  const [inputValue, setInputValue] = useState(initialQ)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const query = searchParams.get("q") ?? ""
  const enabled = query.trim().length >= 1

  // Debounce URL writes
  function handleInput(value: string) {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const qs = value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ""
      router.replace(`${pathname}${qs}`, { scroll: false })
    }, 300)
  }

  function handleClear() {
    setInputValue("")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    router.replace(pathname, { scroll: false })
  }

  function goTab(tab: string) {
    router.push(`/search?q=${encodeURIComponent(query)}&tab=${tab}`)
  }

  const { data: artistsData } = trpc.search.artists.useQuery(
    { query, limit: 5 },
    { enabled }
  )
  const { data: postsData } = trpc.search.posts.useQuery(
    { query, limit: 6 },
    { enabled }
  )
  const { data: shopData } = trpc.search.shop.useQuery(
    { query, limit: 4 },
    { enabled }
  )

  const hasArtists = (artistsData?.items.length ?? 0) > 0
  const hasPosts = (postsData?.items.length ?? 0) > 0
  const hasShop = (shopData?.items.length ?? 0) > 0
  const hasAnyResults = hasArtists || hasPosts || hasShop
  const searchedAndEmpty = enabled && artistsData && postsData && shopData && !hasAnyResults

  return (
    <div className="min-h-screen" style={{ background: "#0d0d0f" }}>
      {/* Sticky search bar */}
      <div className="sticky top-0 z-10 px-4 py-3" style={{ background: "#0d0d0f", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
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
      </div>

      {/* Results */}
      <div className="px-4 py-4 flex flex-col gap-5 pb-24">
        {searchedAndEmpty && (
          <p className="text-sm text-white/40 text-center mt-12">No results for &ldquo;{query}&rdquo;</p>
        )}

        {hasArtists && (
          <ArtistsSection
            items={artistsData!.items}
            total={artistsData!.total}
            onSeeAll={() => goTab("artists")}
          />
        )}

        {hasPosts && (
          <PostsSection
            items={postsData!.items}
            total={postsData!.total}
            onSeeAll={() => goTab("posts")}
          />
        )}

        {hasShop && (
          <ShopSection
            items={shopData!.items}
            total={shopData!.total}
            onSeeAll={() => goTab("shop")}
          />
        )}
      </div>
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
