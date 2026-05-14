"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
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
          style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}
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

  // Auto-advance: schedule next slide whenever imgIdx changes OR isActive changes.
  // This means every manual swipe also resets the 3-second countdown.
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    if (!isActive || images.length < 2) return
    autoTimerRef.current = setTimeout(() => {
      const el = imgScrollRef.current
      if (!el) return
      const next = (imgIdx + 1) % images.length
      el.scrollTo({ left: next * el.offsetWidth, behavior: "smooth" })
    }, 3000)
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current) }
  }, [isActive, images.length, imgIdx])

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
    /* Outer snap container — always full viewport, black sides on wide screens */
    <div
      className="relative flex-shrink-0 snap-start flex items-center justify-center"
      style={{ width: "100%", height: "100svh", background: "#000" }}
    >
      {/* Inner portrait card — 9:16, never wider than the viewport */}
      <div
        className="relative h-full overflow-hidden"
        style={{ width: "min(100%, calc(100svh * 9 / 16))" }}
      >
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
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#0D1640" }}>
            <p className="text-white/30 text-sm">No examples yet</p>
          </div>
        )}

        {/* Gradient overlay — heavy at bottom, light at top */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 20%, transparent 45%, rgba(0,0,0,0.75) 80%, rgba(0,0,0,0.92) 100%)" }} />

        {/* Image pagination dots */}
        {images.length > 1 && (
          <div className="absolute left-0 right-0 flex justify-center gap-1.5 pointer-events-none z-10" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 152px)" }}>
            {images.map((_, i) => (
              <span key={i} className={`block w-1.5 h-1.5 rounded-full transition-colors ${i === imgIdx ? "bg-white" : "bg-white/35"}`} />
            ))}
          </div>
        )}

        {/* Bottom bar: left info + right actions */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-end px-3 z-10"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
        >
          {/* LEFT: artist + caption */}
          <div className="flex-1 min-w-0 pr-4">
            {/* Username row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <button
                onClick={e => { e.stopPropagation(); router.push(`/@${artist.username}?tab=Commissions`) }}
                className="flex items-center gap-2"
              >
                <Avatar src={artist.image} name={artist.name} username={artist.username} size={34} />
                <span className="text-white font-bold text-sm drop-shadow">@{artist.username}</span>
              </button>
              <button
                onClick={handleFollow}
                className="flex-shrink-0 px-3 py-0.5 rounded text-xs font-semibold text-white transition-colors"
                style={followed
                  ? { background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }
                  : { border: "1.5px solid rgba(255,255,255,0.75)" }}
              >
                {followed ? "Following" : "Follow"}
              </button>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${statusBadge[artist.commissionStatus]}`}>
                {artist.commissionStatus === "LIMITED" ? "Limited" : "Open"}
              </span>
            </div>

            {/* Description */}
            {artist.commissionDescription && (
              <p className="text-white/90 text-sm mb-1.5 line-clamp-2 leading-snug drop-shadow">{artist.commissionDescription}</p>
            )}

            {/* Hashtag-style art styles */}
            {artist.artStyles.length > 0 && (
              <p className="text-white/70 text-xs mb-1 leading-relaxed">
                {artist.artStyles.slice(0, 4).map(s => `#${s}`).join("  ")}
              </p>
            )}

            {/* Price */}
            <p className="text-white/55 text-xs">
              {avgPrice(artist.priceRanges)}{artist.commissionTurnaround ? ` · ${artist.commissionTurnaround}` : ""}
            </p>
          </div>

          {/* RIGHT: action buttons */}
          <div className="flex-shrink-0 flex flex-col items-center gap-5 pb-1">
            {/* Save */}
            <button onClick={handleFav} className="flex flex-col items-center gap-1">
              <svg
                className="w-8 h-8 drop-shadow-lg"
                fill={favorited ? "#00D4FF" : "none"}
                viewBox="0 0 24 24"
                stroke={favorited ? "#00D4FF" : "white"}
                strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-white text-[11px] font-medium drop-shadow">{favorited ? "Saved" : "Save"}</span>
            </button>

            {/* Request */}
            <button onClick={handleRequest} className="flex flex-col items-center gap-1">
              <svg
                className="w-8 h-8 drop-shadow-lg"
                fill="none"
                viewBox="0 0 24 24"
                stroke={`url(#rg-${artist.id})`}
                strokeWidth={1.8}
              >
                <defs>
                  <linearGradient id={`rg-${artist.id}`} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#00D4FF" />
                    <stop offset="50%" stopColor="#6B5EFF" />
                    <stop offset="100%" stopColor="#00B4EE" />
                  </linearGradient>
                </defs>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-white text-[11px] font-medium drop-shadow">Request</span>
            </button>

            {/* View profile */}
            <button
              onClick={e => { e.stopPropagation(); router.push(`/@${artist.username}?tab=Commissions`) }}
              className="flex flex-col items-center gap-1"
            >
              <svg className="w-7 h-7 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-white text-[11px] font-medium drop-shadow">Profile</span>
            </button>
          </div>
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
    <div onClick={() => router.push(`/@${artist.username}?tab=Commissions`)} className="cursor-pointer overflow-hidden" style={{ background: "#0A1030" }}>
      <div className="aspect-[3/4] relative">
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
          style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}
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
function ExploreTab({
  onRequest,
  onLightbox,
}: {
  onRequest: (a: DiscoveryUser) => void
  onLightbox: (a: DiscoveryUser, i: number) => void
}) {
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortBy>("default")

  const { data: artists, isLoading } = trpc.commission.getDiscovery.useQuery({
    search: search.trim() || undefined,
    sortBy: sortBy === "default" ? undefined : sortBy,
  })

  const CHIPS: { label: string; value: SortBy }[] = [
    { label: "🌟 Rising Stars", value: "new" },
    { label: "🔥 Top Rated", value: "top" },
    { label: "💰 Affordable", value: "affordable" },
  ]

  return (
    <div className="h-full overflow-y-auto pb-24">
      {/* Search */}
      <div className="px-3 pt-4 pb-3 sticky top-0 z-10" style={{ background: "#070C1C" }}>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search artists, styles…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-sky-500 transition"
            style={{ background: "#ffffff10", border: "1px solid #ffffff18" }}
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => setSortBy(prev => prev === chip.value ? "default" : chip.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                sortBy === chip.value
                  ? "text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
              style={sortBy === chip.value
                ? { background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }
                : { background: "#ffffff10", border: "1px solid #ffffff18" }
              }
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      ) : !artists || artists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-white/50 font-medium">No artists found</p>
          <p className="text-xs text-white/30">
            {search ? "Try a different search term" : "No artists are currently open for commissions"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px" style={{ background: "#ffffff08" }}>
          {artists.map(artist => (
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
        {/* Tab bar */}
        <div className="flex-shrink-0 flex items-center justify-center gap-8 py-3 relative z-20" style={{ background: "rgba(13,13,15,0.95)", backdropFilter: "blur(12px)" }}>
          <button
            onClick={() => setTab("foryou")}
            className={`text-sm font-bold transition-all ${tab === "foryou" ? "text-white" : "text-white/40"}`}
          >
            For You
            {tab === "foryou" && <div className="mt-1 h-0.5 rounded-full" style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }} />}
          </button>
          <button
            onClick={() => setTab("explore")}
            className={`text-sm font-bold transition-all ${tab === "explore" ? "text-white" : "text-white/40"}`}
          >
            Explore
            {tab === "explore" && <div className="mt-1 h-0.5 rounded-full" style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }} />}
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
    </>
  )
}
