"use client"

import { useState, useRef, useCallback, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ART_STYLE_CHIPS,
  type ArtStyleChip,
  PRICE_BUCKETS,
  matchesStyleChip,
  getStartingPrice,
} from "@/lib/art-styles"
import { useSession } from "next-auth/react"
import { trpc } from "@/components/providers"
import CommissionRequestModal from "@/components/CommissionRequestModal"
import Avatar from "@/components/Avatar"

type DiscoveryUser = {
  id: string
  username: string | null
  name: string | null
  image: string | null
  commissionStatus: "OPEN" | "LIMITED" | "CLOSED"
  commissionDescription: string | null
  commissionTurnaround: string | null
  priceRanges: { label: string; price: number }[] | null
  posts: { id: string; image: string }[]
  commissionCategories: { name: string; options: string[] }[]
  commissionCardImages: string[]
  artStyles: string[]
  isFavorited?: boolean
  isFollowed?: boolean
}

type SortBy = "default" | "top" | "new" | "affordable"

const statusBadge = {
  OPEN: "bg-green-500/20 text-green-400 border border-green-500/30",
  LIMITED: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  CLOSED: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
}

function avgPrice(ranges: { label: string; price: number }[] | null): string {
  if (!ranges || ranges.length === 0) return "Price TBD"
  const avg = ranges.reduce((s, r) => s + r.price, 0) / ranges.length
  return `avg $${Math.round(avg)}`
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({
  images,
  startIndex,
  artist,
  onClose,
  onRequest,
}: {
  images: string[]
  startIndex: number
  artist: DiscoveryUser
  onClose: () => void
  onRequest: (artist: DiscoveryUser) => void
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const [idx, setIdx] = useState(startIndex)
  const scrollRef = useRef<HTMLDivElement>(null)

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollLeft = startIndex * el.offsetWidth
    })
  }, [startIndex])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setIdx(Math.round(el.scrollLeft / el.offsetWidth))
  }, [])

  function setRefs(el: HTMLDivElement | null) {
    (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el
    containerRef(el)
  }

  function prev(e: React.MouseEvent) {
    e.stopPropagation()
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: (idx - 1) * el.offsetWidth, behavior: "smooth" })
  }

  function next(e: React.MouseEvent) {
    e.stopPropagation()
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: (idx + 1) * el.offsetWidth, behavior: "smooth" })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Avatar src={artist.image} name={artist.name} username={artist.username} size={28} />
          <button onClick={() => { onClose(); router.push(`/@${artist.username}?tab=Commissions`) }} className="text-white text-sm font-semibold">
            @{artist.username}
          </button>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusBadge[artist.commissionStatus]}`}>
            {artist.commissionStatus === "LIMITED" ? "Limited" : "Open"}
          </span>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 relative min-h-0" onClick={e => e.stopPropagation()}>
        <div ref={setRefs} onScroll={handleScroll} className="absolute inset-0 flex overflow-x-scroll snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
          {images.map((img, i) => (
            <div key={i} className="relative flex-shrink-0 snap-center" style={{ width: "100%", height: "100%" }}>
              <img src={img} alt="" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
            </div>
          ))}
        </div>
        {idx > 0 && (
          <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center z-10">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        {idx < images.length - 1 && (
          <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center z-10">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {images.map((_, i) => (
              <span key={i} className={`block w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-4 py-3 bg-black/80" onClick={e => e.stopPropagation()}>
        <p className="text-white/60 text-xs mb-2">
          {avgPrice(artist.priceRanges)}{artist.commissionTurnaround ? ` · ${artist.commissionTurnaround}` : ""}
          {images.length > 1 ? `  ·  ${idx + 1} / ${images.length}` : ""}
        </p>
        {artist.artStyles.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {artist.artStyles.map(s => <span key={s} className="text-[9px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full">{s}</span>)}
          </div>
        )}
        <button
          onClick={e => { e.stopPropagation(); if (!session) { onClose(); router.push("/signin"); return } onRequest(artist) }}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
        >
          Request commission
        </button>
      </div>
    </div>
  )
}

// ── For You card (full-screen TikTok style) ───────────────────────────────────
function ForYouCard({
  artist,
  onRequest,
  onLightbox,
  isActive,
}: {
  artist: DiscoveryUser
  onRequest: (artist: DiscoveryUser) => void
  onLightbox: (artist: DiscoveryUser, index: number) => void
  isActive: boolean
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const utils = trpc.useUtils()

  const [imgIdx, setImgIdx] = useState(0)
  const [favorited, setFavorited] = useState(artist.isFavorited ?? false)
  const [followed, setFollowed] = useState(artist.isFollowed ?? false)
  const imgScrollRef = useRef<HTMLDivElement>(null)

  const toggleFav = trpc.commission.toggleFavorite.useMutation({
    onMutate: () => setFavorited(f => !f),
    onError: () => setFavorited(f => !f),
  })

  const followMut = trpc.follow.follow.useMutation({
    onMutate: () => setFollowed(true),
    onError: () => setFollowed(false),
    onSuccess: () => utils.commission.getForYouFeed.invalidate(),
  })
  const unfollowMut = trpc.follow.unfollow.useMutation({
    onMutate: () => setFollowed(false),
    onError: () => setFollowed(true),
    onSuccess: () => utils.commission.getForYouFeed.invalidate(),
  })

  const images: string[] = artist.commissionCardImages.length > 0
    ? artist.commissionCardImages
    : artist.posts.map(p => p.image)

  const handleImgScroll = useCallback(() => {
    const el = imgScrollRef.current
    if (!el) return
    setImgIdx(Math.round(el.scrollLeft / el.offsetWidth))
  }, [])

  function handleFollow(e: React.MouseEvent) {
    e.stopPropagation()
    if (!session) { router.push("/signin"); return }
    if (!artist.username) return
    if (followed) unfollowMut.mutate({ username: artist.username })
    else followMut.mutate({ username: artist.username })
  }

  function handleFav(e: React.MouseEvent) {
    e.stopPropagation()
    if (!session) { router.push("/signin"); return }
    toggleFav.mutate({ artistId: artist.id })
  }

  function handleRequest(e: React.MouseEvent) {
    e.stopPropagation()
    if (!session) { router.push("/signin"); return }
    onRequest(artist)
  }

  return (
    <div className="relative flex-shrink-0 snap-start" style={{ width: "100%", height: "100svh" }}>
      {/* Background image */}
      {images.length > 0 ? (
        <div
          ref={imgScrollRef}
          onScroll={handleImgScroll}
          className="absolute inset-0 flex overflow-x-scroll snap-x snap-mandatory"
          style={{ scrollbarWidth: "none" }}
        >
          {images.map((img, i) => (
            <div
              key={i}
              className="relative flex-shrink-0 snap-center cursor-zoom-in"
              style={{ width: "100%", height: "100%" }}
              onClick={() => onLightbox(artist, i)}
            >
              <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
            </div>
          ))}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#1a1a2e" }}>
          <p className="text-white/30 text-sm">No examples yet</p>
        </div>
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 25%, transparent 60%, rgba(0,0,0,0.85) 100%)" }} />

      {/* Top: artist info */}
      <div className="absolute top-0 left-0 right-0 px-4 pt-4 flex items-center gap-3 z-10">
        <button onClick={e => { e.stopPropagation(); router.push(`/@${artist.username}?tab=Commissions`) }} className="flex items-center gap-2">
          <Avatar src={artist.image} name={artist.name} username={artist.username} size={36} />
          <div>
            <p className="text-white font-bold text-sm leading-tight">@{artist.username}</p>
            <p className="text-white/60 text-xs">{artist.name}</p>
          </div>
        </button>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusBadge[artist.commissionStatus]}`}>
          {artist.commissionStatus === "LIMITED" ? "Limited" : "Open"}
        </span>
      </div>

      {/* Right: action buttons */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-5 z-10">
        {/* Follow */}
        <button onClick={handleFollow} className="flex flex-col items-center gap-1">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${followed ? "bg-blue-500" : "bg-white/20 backdrop-blur-sm"}`}>
            {followed ? (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <span className="text-white text-[10px] font-medium drop-shadow">{followed ? "Following" : "Follow"}</span>
        </button>

        {/* Favorite */}
        <button onClick={handleFav} className="flex flex-col items-center gap-1">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${favorited ? "bg-pink-500" : "bg-white/20 backdrop-blur-sm"}`}>
            <svg className="w-6 h-6 text-white" fill={favorited ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span className="text-white text-[10px] font-medium drop-shadow">{favorited ? "Saved" : "Save"}</span>
        </button>

        {/* Image counter (if multiple) */}
        {images.length > 1 && (
          <div className="flex flex-col items-center gap-1.5">
            {images.map((_, i) => (
              <span key={i} className={`block w-1 rounded-full transition-all ${i === imgIdx ? "h-4 bg-white" : "h-1 bg-white/40"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom: info + request */}
      <div className="absolute bottom-0 left-0 right-14 px-4 pb-6 z-10">
        {artist.artStyles.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {artist.artStyles.slice(0, 4).map(s => (
              <span key={s} className="text-[10px] bg-white/15 backdrop-blur-sm text-white/80 px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        )}
        {artist.commissionDescription && (
          <p className="text-white/70 text-xs mb-2 line-clamp-2">{artist.commissionDescription}</p>
        )}
        <div className="flex items-center gap-3">
          <p className="text-white/60 text-xs">
            {avgPrice(artist.priceRanges)}{artist.commissionTurnaround ? ` · ${artist.commissionTurnaround}` : ""}
          </p>
          <button
            onClick={handleRequest}
            className="px-4 py-2 rounded-full text-xs font-bold text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
          >
            Request
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Explore grid card ─────────────────────────────────────────────────────────
function ExploreCard({
  artist,
  onRequest,
  onImageClick,
}: {
  artist: DiscoveryUser
  onRequest: (artist: DiscoveryUser) => void
  onImageClick: (artist: DiscoveryUser, index: number) => void
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const [imgIndex, setImgIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const images: string[] = artist.commissionCardImages.length > 0
    ? artist.commissionCardImages
    : artist.posts.map(p => p.image)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || images.length < 2) return
    setImgIndex(Math.round(el.scrollLeft / el.offsetWidth))
  }, [images.length])

  function handleRequest(e: React.MouseEvent) {
    e.stopPropagation()
    if (!session) { router.push("/signin"); return }
    onRequest(artist)
  }

  return (
    <div onClick={() => router.push(`/@${artist.username}?tab=Commissions`)} className="cursor-pointer overflow-hidden" style={{ background: "#111118" }}>
      <div className="aspect-square relative">
        {images.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5">
            <p className="text-xs text-white/30">No examples</p>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              onClick={e => e.stopPropagation()}
              className="absolute inset-0 flex overflow-x-scroll snap-x snap-mandatory"
              style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
            >
              {images.map((img, i) => (
                <div
                  key={i}
                  className="relative flex-shrink-0 snap-center"
                  style={{ width: "100%", height: "100%" }}
                  onClick={() => onImageClick(artist, i)}
                >
                  <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover cursor-zoom-in" draggable={false} />
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none z-10">
                {images.map((_, i) => (
                  <span key={i} className={`block w-1.5 h-1.5 rounded-full transition-colors ${i === imgIndex ? "bg-white" : "bg-white/40"}`} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div className="px-2 pt-2 pb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Avatar src={artist.image} name={artist.name} username={artist.username} size={20} />
          <p className="text-xs font-semibold text-white truncate flex-1">@{artist.username}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusBadge[artist.commissionStatus]}`}>
            {artist.commissionStatus === "LIMITED" ? "Limited" : "Open"}
          </span>
        </div>
        <p className="text-[10px] text-white/40 mb-2">
          {avgPrice(artist.priceRanges)}{artist.commissionTurnaround ? ` · ${artist.commissionTurnaround}` : ""}
        </p>
        {artist.artStyles.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {artist.artStyles.slice(0, 3).map(s => (
              <span key={s} className="text-[9px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full">{s}</span>
            ))}
            {artist.artStyles.length > 3 && <span className="text-[9px] text-white/30">+{artist.artStyles.length - 3}</span>}
          </div>
        )}
        <button
          onClick={handleRequest}
          className="w-full py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
          style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
        >
          Request
        </button>
      </div>
    </div>
  )
}

// ── For You feed ──────────────────────────────────────────────────────────────
function ForYouFeed({
  onRequest,
  onLightbox,
}: {
  onRequest: (a: DiscoveryUser) => void
  onLightbox: (a: DiscoveryUser, i: number) => void
}) {
  const feedRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [cursor, setCursor] = useState(0)
  const [allArtists, setAllArtists] = useState<DiscoveryUser[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data, isFetching } = trpc.commission.getForYouFeed.useQuery(
    { cursor },
    { enabled: hasMore && !loading }
  )

  useEffect(() => {
    if (!data) return
    setAllArtists(prev => {
      const ids = new Set(prev.map(a => a.id))
      const newOnes = (data.artists as DiscoveryUser[]).filter(a => !ids.has(a.id))
      return [...prev, ...newOnes]
    })
    if (data.nextCursor === null) setHasMore(false)
  }, [data])

  // Track active card via scroll
  useEffect(() => {
    const el = feedRef.current
    if (!el) return
    const handleScroll = () => {
      const idx = Math.round(el.scrollTop / window.innerHeight)
      setActiveIdx(idx)
    }
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [])

  // Load more when approaching end
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isFetching) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !isFetching && data?.nextCursor != null) {
        setCursor(data.nextCursor)
      }
    }, { rootMargin: "200px" })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [hasMore, isFetching, data?.nextCursor])

  if (allArtists.length === 0 && isFetching) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  if (allArtists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
        <div className="text-4xl">🎨</div>
        <p className="text-white font-semibold">No artists open right now</p>
        <p className="text-white/40 text-sm">Check back soon — new artists open regularly</p>
      </div>
    )
  }

  return (
    <div
      ref={feedRef}
      className="h-full overflow-y-scroll snap-y snap-mandatory"
      style={{ scrollbarWidth: "none" }}
    >
      {allArtists.map((artist, i) => (
        <ForYouCard
          key={artist.id}
          artist={artist}
          onRequest={onRequest}
          onLightbox={onLightbox}
          isActive={i === activeIdx}
        />
      ))}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-8">
          {isFetching && <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />}
        </div>
      )}
      {!hasMore && allArtists.length > 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ minHeight: "30svh" }}>
          <p className="text-white/40 text-sm">You&apos;ve seen everyone</p>
          <p className="text-white/20 text-xs">Follow artists to refine your feed</p>
        </div>
      )}
    </div>
  )
}

// ── Explore tab ───────────────────────────────────────────────────────────────
const SORT_CHIPS: { label: string; value: SortBy }[] = [
  { label: "🌟 Rising Stars", value: "new" },
  { label: "🔥 Top Rated", value: "top" },
  { label: "💰 Affordable", value: "affordable" },
]

function ExploreTabInner({
  onRequest,
  onLightbox,
}: {
  onRequest: (a: DiscoveryUser) => void
  onLightbox: (a: DiscoveryUser, i: number) => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parse URL state once (only used as useState initialisers — ignored after mount)
  const styleParam = searchParams.get("style")
  const initialStyles = styleParam
    ? (styleParam.split(",").filter(s => (ART_STYLE_CHIPS as readonly string[]).includes(s)) as ArtStyleChip[])
    : []
  const initialPrice = searchParams.get("price") ?? null
  const initialSort = (searchParams.get("sort") as SortBy) ?? "default"

  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortBy>(initialSort)
  const [selectedStyles, setSelectedStyles] = useState<ArtStyleChip[]>(initialStyles)
  const [selectedPrice, setSelectedPrice] = useState<string | null>(initialPrice)

  const { data: artists, isLoading } = trpc.commission.getDiscovery.useQuery({
    search: search.trim() || undefined,
    sortBy: sortBy === "default" ? undefined : sortBy,
  })

  // Write filters to URL (no page reload)
  function updateUrl(styles: ArtStyleChip[], price: string | null, sort: SortBy) {
    const params = new URLSearchParams()
    if (styles.length > 0) params.set("style", styles.join(","))
    if (price) params.set("price", price)
    if (sort !== "default") params.set("sort", sort)
    const qs = params.toString()
    router.replace(`/commissions?${qs}`, { scroll: false })
  }

  function toggleStyle(chip: ArtStyleChip) {
    const next = selectedStyles.includes(chip)
      ? selectedStyles.filter(s => s !== chip)
      : [...selectedStyles, chip]
    setSelectedStyles(next)
    updateUrl(next, selectedPrice, sortBy)
  }

  function togglePrice(label: string) {
    const next = selectedPrice === label ? null : label
    setSelectedPrice(next)
    updateUrl(selectedStyles, next, sortBy)
  }

  function toggleSort(val: SortBy) {
    const next = sortBy === val ? "default" : val
    setSortBy(next)
    updateUrl(selectedStyles, selectedPrice, next)
  }

  // Client-side filter on top of server results
  const filtered = (artists ?? []).filter(artist => {
    // Style filter
    if (selectedStyles.length > 0) {
      const matches = selectedStyles.some(chip => matchesStyleChip(artist.artStyles, chip))
      if (!matches) return false
    }
    // Price filter
    if (selectedPrice) {
      const bucket = PRICE_BUCKETS.find(b => b.label === selectedPrice)
      if (bucket) {
        const startPrice = getStartingPrice(artist.priceRanges)
        if (startPrice === null) return false
        if (startPrice < bucket.min || startPrice > bucket.max) return false
      }
    }
    return true
  })

  const activeFilterCount = selectedStyles.length + (selectedPrice ? 1 : 0)

  return (
    <div className="h-full overflow-y-auto pb-24">
      {/* Sticky filter bar */}
      <div className="px-3 pt-4 pb-3 sticky top-0 z-10" style={{ background: "#0D0D0F" }}>
        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search artists, styles…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500 transition"
            style={{ background: "#ffffff10", border: "1px solid #ffffff18" }}
          />
        </div>

        {/* Sort chips */}
        <div className="flex gap-2 mb-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {SORT_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => toggleSort(chip.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                sortBy === chip.value ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
              style={sortBy === chip.value
                ? { background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }
                : { background: "#ffffff10", border: "1px solid #ffffff18" }
              }
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Style chips */}
        <div className="flex gap-2 mb-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {ART_STYLE_CHIPS.map(chip => {
            const active = selectedStyles.includes(chip)
            return (
              <button
                key={chip}
                onClick={() => toggleStyle(chip)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
                style={active
                  ? { background: "rgba(176,68,248,0.6)", border: "1px solid rgba(176,68,248,0.8)" }
                  : { background: "#ffffff10", border: "1px solid #ffffff18" }
                }
              >
                {chip}
              </button>
            )
          })}
        </div>

        {/* Price chips */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {PRICE_BUCKETS.map(bucket => {
            const active = selectedPrice === bucket.label
            return (
              <button
                key={bucket.label}
                onClick={() => togglePrice(bucket.label)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
                style={active
                  ? { background: "rgba(0,180,238,0.5)", border: "1px solid rgba(0,180,238,0.8)" }
                  : { background: "#ffffff10", border: "1px solid #ffffff18" }
                }
              >
                {bucket.label}
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-white/50 font-medium">No artists found</p>
          <p className="text-xs text-white/30">
            {activeFilterCount > 0
              ? "Try removing some filters"
              : search
              ? "Try a different search term"
              : "No artists are currently open for commissions"}
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setSelectedStyles([])
                setSelectedPrice(null)
                updateUrl([], null, sortBy)
              }}
              className="mt-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white/70 hover:text-white transition"
              style={{ background: "#ffffff10", border: "1px solid #ffffff18" }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px" style={{ background: "#ffffff08" }}>
          {filtered.map(artist => (
            <ExploreCard
              key={artist.id}
              artist={artist as DiscoveryUser}
              onRequest={onRequest}
              onImageClick={(a, i) => onLightbox(a, i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ExploreTab({
  onRequest,
  onLightbox,
}: {
  onRequest: (a: DiscoveryUser) => void
  onLightbox: (a: DiscoveryUser, i: number) => void
}) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" /></div>}>
      <ExploreTabInner onRequest={onRequest} onLightbox={onLightbox} />
    </Suspense>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CommissionsPage() {
  const [tab, setTab] = useState<"foryou" | "explore">("foryou")
  const [requestTarget, setRequestTarget] = useState<DiscoveryUser | null>(null)
  const [lightbox, setLightbox] = useState<{ artist: DiscoveryUser; index: number } | null>(null)

  return (
    <>
      {requestTarget && (
        <CommissionRequestModal
          artistId={requestTarget.id}
          artistUsername={requestTarget.username!}
          categories={requestTarget.commissionCategories}
          onClose={() => setRequestTarget(null)}
        />
      )}

      {lightbox && (() => {
        const imgs = lightbox.artist.commissionCardImages.length > 0
          ? lightbox.artist.commissionCardImages
          : lightbox.artist.posts.map(p => p.image)
        return (
          <Lightbox
            images={imgs}
            startIndex={lightbox.index}
            artist={lightbox.artist}
            onClose={() => setLightbox(null)}
            onRequest={(a) => { setLightbox(null); setRequestTarget(a) }}
          />
        )
      })()}

      {/* Full-viewport container — breaks out of layout padding */}
      <div className="flex flex-col fixed inset-0 md:left-16" style={{ zIndex: 10 }}>
        {/* Narrow column on desktop */}
        <div className="flex flex-col h-full w-full md:max-w-lg md:mx-auto">
          {/* Tab bar */}
          <div className="flex-shrink-0 flex items-center justify-center gap-8 py-3 relative z-20" style={{ background: "rgba(13,13,15,0.95)", backdropFilter: "blur(12px)" }}>
            <button
              onClick={() => setTab("foryou")}
              className={`text-sm font-bold transition-all ${tab === "foryou" ? "text-white" : "text-white/40"}`}
            >
              For You
              {tab === "foryou" && <div className="mt-1 h-0.5 rounded-full" style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }} />}
            </button>
            <button
              onClick={() => setTab("explore")}
              className={`text-sm font-bold transition-all ${tab === "explore" ? "text-white" : "text-white/40"}`}
            >
              Explore
              {tab === "explore" && <div className="mt-1 h-0.5 rounded-full" style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }} />}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0">
            {tab === "foryou" ? (
              <ForYouFeed
                onRequest={setRequestTarget}
                onLightbox={(a, i) => setLightbox({ artist: a, index: i })}
              />
            ) : (
              <ExploreTab
                onRequest={setRequestTarget}
                onLightbox={(a, i) => setLightbox({ artist: a, index: i })}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
