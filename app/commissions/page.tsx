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

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  OPEN:    { background: "rgba(72,200,120,0.13)", color: "#48C878", border: "1px solid rgba(72,200,120,0.3)" },
  LIMITED: { background: "rgba(255,180,60,0.12)",  color: "#FFB43C", border: "1px solid rgba(255,180,60,0.28)" },
  CLOSED:  { background: "rgba(200,60,60,0.1)",   color: "#E06060", border: "1px solid rgba(200,60,60,0.22)" },
}

function statusLabel(s: "OPEN" | "LIMITED" | "CLOSED") {
  return s === "LIMITED" ? "Limited" : s === "OPEN" ? "Open" : "Closed"
}

function startingPrice(ranges: { label: string; price: number }[] | null): string {
  if (!ranges || ranges.length === 0) return "Price TBD"
  const min = Math.min(...ranges.map(r => r.price))
  return `from $${min}`
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ images, startIndex, artist, onClose, onRequest }: {
  images: string[]
  startIndex: number
  artist: DiscoveryUser
  onClose: () => void
  onRequest: (a: DiscoveryUser) => void
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const [idx, setIdx] = useState(startIndex)
  const scrollRef = useRef<HTMLDivElement>(null)

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    requestAnimationFrame(() => { el.scrollLeft = startIndex * el.offsetWidth })
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
    scrollRef.current?.scrollTo({ left: (idx - 1) * scrollRef.current.offsetWidth, behavior: "smooth" })
  }
  function next(e: React.MouseEvent) {
    e.stopPropagation()
    scrollRef.current?.scrollTo({ left: (idx + 1) * scrollRef.current.offsetWidth, behavior: "smooth" })
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "#000", display: "flex", flexDirection: "column" }} onClick={onClose}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar src={artist.image} name={artist.name} username={artist.username} size={28} />
          <button
            onClick={() => { onClose(); router.push(`/@${artist.username}?tab=Commissions`) }}
            style={{ fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 13, color: "white", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            @{artist.username}
          </button>
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 99, ...STATUS_STYLE[artist.commissionStatus] }}>
            {statusLabel(artist.commissionStatus)}
          </span>
        </div>
        <button onClick={onClose} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer" }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Images */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }} onClick={e => e.stopPropagation()}>
        <div ref={setRefs} onScroll={handleScroll} style={{ position: "absolute", inset: 0, display: "flex", overflowX: "scroll", scrollSnapType: "x mandatory", scrollbarWidth: "none" } as React.CSSProperties}>
          {images.map((img, i) => (
            <div key={i} style={{ flexShrink: 0, width: "100%", height: "100%", position: "relative", scrollSnapAlign: "center" }}>
              <img src={img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} draggable={false} />
            </div>
          ))}
        </div>
        {idx > 0 && (
          <button onClick={prev} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        {idx < images.length - 1 && (
          <button onClick={next} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
        {images.length > 1 && (
          <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, pointerEvents: "none" }}>
            {images.map((_, i) => <span key={i} style={{ display: "block", width: 6, height: 6, borderRadius: "50%", background: i === idx ? "white" : "rgba(255,255,255,0.3)", transition: "background 0.2s" }} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, padding: "12px 16px 16px", background: "rgba(0,0,0,0.85)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 10, color: "rgba(240,235,248,0.45)", marginBottom: 8, fontFamily: "Inter,sans-serif" }}>
          {startingPrice(artist.priceRanges)}
          {artist.commissionTurnaround ? ` · ${artist.commissionTurnaround}` : ""}
          {images.length > 1 ? ` · ${idx + 1}/${images.length}` : ""}
        </div>
        {artist.artStyles.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {artist.artStyles.map(s => (
              <span key={s} style={{ fontSize: 8, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)", padding: "2px 8px", borderRadius: 99, fontFamily: "Inter,sans-serif" }}>{s}</span>
            ))}
          </div>
        )}
        <button
          onClick={e => { e.stopPropagation(); if (!session) { onClose(); router.push("/signin"); return } onRequest(artist) }}
          style={{ width: "100%", padding: "11px 0", borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", color: "white", fontWeight: 700, fontSize: 13, fontFamily: "Inter,sans-serif" }}
        >
          Request commission
        </button>
      </div>
    </div>
  )
}

// ── For You card ──────────────────────────────────────────────────────────────

function ForYouCard({ artist, onRequest, onLightbox, isActive }: {
  artist: DiscoveryUser
  onRequest: (a: DiscoveryUser) => void
  onLightbox: (a: DiscoveryUser, i: number) => void
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
    <div style={{ position: "relative", flexShrink: 0, width: "100%", height: "100svh", scrollSnapAlign: "start" }}>
      {/* Background art */}
      {images.length > 0 ? (
        <div ref={imgScrollRef} onScroll={handleImgScroll} style={{ position: "absolute", inset: 0, display: "flex", overflowX: "scroll", scrollSnapType: "x mandatory", scrollbarWidth: "none" } as React.CSSProperties}>
          {images.map((img, i) => (
            <div key={i} style={{ flexShrink: 0, width: "100%", height: "100%", position: "relative", scrollSnapAlign: "center", cursor: "zoom-in" }} onClick={() => onLightbox(artist, i)}>
              <img src={img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)" }}>
          <span style={{ color: "rgba(240,235,248,0.25)", fontSize: 13, fontFamily: "Inter,sans-serif" }}>No examples yet</span>
        </div>
      )}

      {/* Dark gradient overlays */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 28%, transparent 58%, rgba(0,0,0,0.88) 100%)" }} />

      {/* Top: artist */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "14px 16px 0", display: "flex", alignItems: "center", gap: 10, zIndex: 10 }}>
        <button onClick={e => { e.stopPropagation(); router.push(`/@${artist.username}?tab=Commissions`) }} style={{ display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#FF3CAC,#784BA0,#2B86C5)", padding: 2, flexShrink: 0 }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
              <Avatar src={artist.image} name={artist.name} username={artist.username} size={36} />
            </div>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: "white", lineHeight: 1.2 }}>{artist.name ?? artist.username}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "Inter,sans-serif" }}>@{artist.username}</div>
          </div>
        </button>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 99, ...STATUS_STYLE[artist.commissionStatus] }}>
          {statusLabel(artist.commissionStatus)}
        </span>
      </div>

      {/* Right: action buttons */}
      <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, zIndex: 10 }}>
        {/* Follow */}
        <button onClick={handleFollow} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: followed ? "#2B86C5" : "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", transition: "background 0.2s" }}>
            {followed
              ? <svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
              : <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            }
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "white", fontFamily: "Inter,sans-serif", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>{followed ? "Following" : "Follow"}</span>
        </button>

        {/* Save */}
        <button onClick={handleFav} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: favorited ? "#FF3CAC" : "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", transition: "background 0.2s" }}>
            <svg width="22" height="22" fill={favorited ? "white" : "none"} viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "white", fontFamily: "Inter,sans-serif", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>{favorited ? "Saved" : "Save"}</span>
        </button>

        {/* Image dots */}
        {images.length > 1 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            {images.map((_, i) => (
              <span key={i} style={{ display: "block", width: 4, borderRadius: 99, transition: "all 0.2s", height: i === imgIdx ? 16 : 4, background: i === imgIdx ? "white" : "rgba(255,255,255,0.35)" }} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom-center swipe dots */}
      {images.length > 1 && (
        <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 10, pointerEvents: "none" }}>
          {images.map((_, i) => (
            <span key={i} style={{ display: "block", borderRadius: 99, transition: "all 0.2s", width: i === imgIdx ? 16 : 6, height: 6, background: i === imgIdx ? "#FF3CAC" : "rgba(255,255,255,0.3)" }} />
          ))}
        </div>
      )}

      {/* Bottom: info + CTA */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 56, padding: "0 16px 28px", zIndex: 10 }}>
        {artist.artStyles.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {artist.artStyles.slice(0, 4).map(s => (
              <span key={s} style={{ fontSize: 11, background: "rgba(255,255,255,0.14)", backdropFilter: "blur(6px)", color: "rgba(255,255,255,0.85)", padding: "3px 10px", borderRadius: 99, fontFamily: "Inter,sans-serif" }}>{s}</span>
            ))}
          </div>
        )}
        {artist.commissionDescription && (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 10, fontFamily: "Inter,sans-serif", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
            {artist.commissionDescription}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "white" }}>{startingPrice(artist.priceRanges)}</div>
            {artist.commissionTurnaround && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter,sans-serif", marginTop: 1 }}>{artist.commissionTurnaround}</div>}
          </div>
          <button
            onClick={handleRequest}
            style={{ marginLeft: "auto", padding: "10px 24px", borderRadius: 99, border: "none", cursor: "pointer", background: "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", color: "white", fontWeight: 700, fontSize: 14, fontFamily: "Inter,sans-serif" }}
          >
            Request
          </button>
        </div>
      </div>
    </div>
  )
}

// ── For You feed ──────────────────────────────────────────────────────────────

function ForYouFeed({ onRequest, onLightbox }: {
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
      return [...prev, ...(data.artists as DiscoveryUser[]).filter(a => !ids.has(a.id))]
    })
    if (data.nextCursor === null) setHasMore(false)
  }, [data])

  useEffect(() => {
    const el = feedRef.current
    if (!el) return
    const onScroll = () => setActiveIdx(Math.round(el.scrollTop / window.innerHeight))
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isFetching) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !isFetching && data?.nextCursor != null) setCursor(data.nextCursor)
    }, { rootMargin: "200px" })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [hasMore, isFetching, data?.nextCursor])

  if (allArtists.length === 0 && isFetching) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "white", animation: "spin 0.7s linear infinite" }} />
      </div>
    )
  }

  if (allArtists.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, padding: "0 32px", textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>🎨</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>No artists open right now</div>
        <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>Check back soon — new artists open regularly</div>
      </div>
    )
  }

  return (
    <div ref={feedRef} style={{ height: "100%", overflowY: "scroll", scrollSnapType: "y mandatory", scrollbarWidth: "none" } as React.CSSProperties}>
      {allArtists.map((artist, i) => (
        <ForYouCard key={artist.id} artist={artist} onRequest={onRequest} onLightbox={onLightbox} isActive={i === activeIdx} />
      ))}
      {hasMore && (
        <div ref={sentinelRef} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 0" }}>
          {isFetching && <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "white", animation: "spin 0.7s linear infinite" }} />}
        </div>
      )}
      {!hasMore && allArtists.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 6, minHeight: "30svh" }}>
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>You&apos;ve seen everyone</div>
          <div style={{ fontSize: 10, color: "rgba(107,95,136,0.6)", fontFamily: "Inter,sans-serif" }}>Follow artists to refine your feed</div>
        </div>
      )}
    </div>
  )
}

// ── Explore card ──────────────────────────────────────────────────────────────

function ExploreCard({ artist, onRequest }: {
  artist: DiscoveryUser
  onRequest: (a: DiscoveryUser) => void
}) {
  const router = useRouter()
  const { data: session } = useSession()

  const cover: string | null = artist.commissionCardImages[0] ?? artist.posts[0]?.image ?? null

  function handleRequest(e: React.MouseEvent) {
    e.stopPropagation()
    if (!session) { router.push("/signin"); return }
    onRequest(artist)
  }

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Art banner */}
      <div style={{ height: 108, overflow: "hidden", position: "relative", cursor: "pointer" }} onClick={() => router.push(`/@${artist.username}?tab=Commissions`)}>
        {cover
          ? <img src={cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
          : <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 60% 40%, rgba(120,75,160,0.5), transparent 65%), linear-gradient(135deg,#2A1838,#1E1430)" }} />
        }
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 65, background: "linear-gradient(transparent,rgba(8,6,15,0.96))", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "flex-end", gap: 8, padding: "0 12px 9px" }}>
          <Avatar src={artist.image} name={artist.name} username={artist.username} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 12, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {artist.name ?? artist.username}
            </div>
            {artist.artStyles.length > 0 && (
              <div style={{ fontSize: 7, color: "rgba(240,235,248,0.4)", marginTop: 1 }}>
                {artist.artStyles.slice(0, 3).join(" · ")}
              </div>
            )}
          </div>
          <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, flexShrink: 0, ...STATUS_STYLE[artist.commissionStatus] }}>
            {statusLabel(artist.commissionStatus)}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: "10px 12px 12px", background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 7 }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
            {startingPrice(artist.priceRanges)}
          </span>
          {artist.commissionTurnaround && (
            <span style={{ fontSize: 8, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>· {artist.commissionTurnaround}</span>
          )}
        </div>

        {artist.priceRanges && artist.priceRanges.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 9 }}>
            {artist.priceRanges.map(r => (
              <span key={r.label} style={{ fontSize: 7.5, padding: "2px 8px", borderRadius: 4, background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--border)", fontFamily: "Inter,sans-serif" }}>
                {r.label} <span style={{ color: "var(--text)", fontWeight: 600 }}>${r.price}</span>
              </span>
            ))}
          </div>
        )}

        <button
          onClick={handleRequest}
          style={{
            width: "100%", padding: "9px 0", borderRadius: 8, border: artist.commissionStatus === "CLOSED" ? "1px solid var(--border)" : "none",
            cursor: artist.commissionStatus === "CLOSED" ? "default" : "pointer",
            background: artist.commissionStatus === "CLOSED" ? "var(--bg)" : "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)",
            color: artist.commissionStatus === "CLOSED" ? "var(--muted)" : "white",
            fontWeight: 700, fontSize: 10, fontFamily: "Inter,sans-serif",
          }}
        >
          {artist.commissionStatus === "CLOSED" ? "Closed" : "Request commission"}
        </button>
      </div>
    </div>
  )
}

// ── Explore tab ───────────────────────────────────────────────────────────────

const SORT_CHIPS: { label: string; value: SortBy }[] = [
  { label: "🌟 Rising Stars", value: "new" },
  { label: "🔥 Top Rated",    value: "top" },
  { label: "💰 Affordable",   value: "affordable" },
]

function ExploreTabInner({ onRequest }: { onRequest: (a: DiscoveryUser) => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const styleParam = searchParams.get("style")
  const initialStyles = styleParam
    ? (styleParam.split(",").filter(s => (ART_STYLE_CHIPS as readonly string[]).includes(s)) as ArtStyleChip[])
    : []
  const initialPrice = searchParams.get("price") ?? null
  const sortRaw = searchParams.get("sort")
  const initialSort: SortBy = (["top", "new", "affordable"] as string[]).includes(sortRaw ?? "")
    ? (sortRaw as SortBy) : "default"

  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortBy>(initialSort)
  const [selectedStyles, setSelectedStyles] = useState<ArtStyleChip[]>(initialStyles)
  const [selectedPrice, setSelectedPrice] = useState<string | null>(initialPrice)

  const { data: artists, isLoading } = trpc.commission.getDiscovery.useQuery({
    search: search.trim() || undefined,
    sortBy: sortBy === "default" ? undefined : sortBy,
  })

  function updateUrl(styles: ArtStyleChip[], price: string | null, sort: SortBy) {
    const params = new URLSearchParams()
    if (styles.length > 0) params.set("style", styles.join(","))
    if (price) params.set("price", price)
    if (sort !== "default") params.set("sort", sort)
    const qs = params.toString()
    router.replace(qs ? `/commissions?${qs}` : "/commissions", { scroll: false })
  }

  function toggleStyle(chip: ArtStyleChip) {
    const next = selectedStyles.includes(chip) ? selectedStyles.filter(s => s !== chip) : [...selectedStyles, chip]
    setSelectedStyles(next); updateUrl(next, selectedPrice, sortBy)
  }
  function togglePrice(label: string) {
    const next = selectedPrice === label ? null : label
    setSelectedPrice(next); updateUrl(selectedStyles, next, sortBy)
  }
  function toggleSort(val: SortBy) {
    const next = sortBy === val ? "default" : val
    setSortBy(next); updateUrl(selectedStyles, selectedPrice, next)
  }

  const filtered = (artists ?? []).filter(artist => {
    if (selectedStyles.length > 0 && !selectedStyles.some(chip => matchesStyleChip(artist.artStyles, chip))) return false
    if (selectedPrice) {
      const bucket = PRICE_BUCKETS.find(b => b.label === selectedPrice)
      if (bucket) {
        const sp = getStartingPrice(artist.priceRanges)
        if (sp === null || sp < bucket.min || sp > bucket.max) return false
      }
    }
    return true
  })

  const activeFilterCount = selectedStyles.length + (selectedPrice ? 1 : 0)

  const chipActive: React.CSSProperties = {
    background: "linear-gradient(var(--bg),var(--bg)) padding-box, linear-gradient(90deg,#FF3CAC,#2B86C5) border-box",
    borderColor: "transparent", color: "var(--text)",
  }
  const chipIdle: React.CSSProperties = {
    background: "var(--surface)", borderColor: "var(--border)", color: "var(--muted)",
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", paddingBottom: 96 }}>
      {/* Sticky filter bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg)", padding: "12px 14px 10px" }}>
        {/* Search */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search artists, styles…"
            style={{ width: "100%", boxSizing: "border-box", paddingLeft: 32, paddingRight: 14, paddingTop: 9, paddingBottom: 9, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12, fontFamily: "Inter,sans-serif", outline: "none" }}
          />
        </div>

        {/* Sort chips */}
        <div style={{ display: "flex", gap: 6, marginBottom: 7, overflowX: "auto", scrollbarWidth: "none" } as React.CSSProperties}>
          {SORT_CHIPS.map(chip => (
            <button key={chip.value} onClick={() => toggleSort(chip.value)}
              style={{ flexShrink: 0, fontSize: 10, padding: "4px 11px", borderRadius: 99, border: "1px solid", cursor: "pointer", fontFamily: "Inter,sans-serif", ...(sortBy === chip.value ? chipActive : chipIdle) }}>
              {chip.label}
            </button>
          ))}
        </div>

        {/* Style chips */}
        <div style={{ display: "flex", gap: 6, marginBottom: 7, overflowX: "auto", scrollbarWidth: "none" } as React.CSSProperties}>
          {ART_STYLE_CHIPS.map(chip => (
            <button key={chip} onClick={() => toggleStyle(chip)}
              style={{ flexShrink: 0, fontSize: 10, padding: "4px 11px", borderRadius: 99, border: "1px solid", cursor: "pointer", fontFamily: "Inter,sans-serif", ...(selectedStyles.includes(chip) ? chipActive : chipIdle) }}>
              {chip}
            </button>
          ))}
        </div>

        {/* Price chips */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" } as React.CSSProperties}>
          {PRICE_BUCKETS.map(bucket => (
            <button key={bucket.label} onClick={() => togglePrice(bucket.label)}
              style={{ flexShrink: 0, fontSize: 10, padding: "4px 11px", borderRadius: 99, border: "1px solid", cursor: "pointer", fontFamily: "Inter,sans-serif", ...(selectedPrice === bucket.label ? chipActive : chipIdle) }}>
              {bucket.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.12)", borderTopColor: "white", animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>No artists found</div>
          <div style={{ fontSize: 11, color: "rgba(107,95,136,0.55)", fontFamily: "Inter,sans-serif" }}>
            {activeFilterCount > 0 ? "Try removing some filters" : search ? "Try a different search" : "No artists open right now"}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={() => { setSelectedStyles([]); setSelectedPrice(null); updateUrl([], null, sortBy) }}
              style={{ marginTop: 6, padding: "5px 14px", borderRadius: 99, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", fontSize: 10, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div>
          {filtered.map(artist => (
            <ExploreCard key={artist.id} artist={artist as DiscoveryUser} onRequest={onRequest} />
          ))}
        </div>
      )}
    </div>
  )
}

function ExploreTab({ onRequest }: { onRequest: (a: DiscoveryUser) => void }) {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.12)", borderTopColor: "white", animation: "spin 0.7s linear infinite" }} />
      </div>
    }>
      <ExploreTabInner onRequest={onRequest} />
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

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
            onRequest={a => { setLightbox(null); setRequestTarget(a) }}
          />
        )
      })()}

      {/* Full-viewport container */}
      <div style={{ position: "fixed", top: 56, left: 0, right: 0, bottom: 0, zIndex: 10, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", maxWidth: 512, margin: "0 auto" }}>

          {/* Tab bar */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 36, padding: "11px 0", background: "rgba(15,13,20,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)", position: "relative", zIndex: 20 }}>
            {(["foryou", "explore"] as const).map(t => {
              const active = tab === t
              const label = t === "foryou" ? "For You" : "Explore"
              return (
                <button key={t} onClick={() => setTab(t)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span style={{ fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 13, color: active ? "var(--text)" : "var(--muted)", transition: "color 0.15s" }}>{label}</span>
                  <div style={{ height: 2, width: active ? "100%" : 0, borderRadius: 99, background: "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", transition: "width 0.2s" }} />
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {tab === "foryou" ? (
              <ForYouFeed
                onRequest={setRequestTarget}
                onLightbox={(a, i) => setLightbox({ artist: a, index: i })}
              />
            ) : (
              <ExploreTab onRequest={setRequestTarget} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
