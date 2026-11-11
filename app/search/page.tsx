"use client"
/**
 * EXPLORE (/search) — Codex redesign, real data. Styling: app/redesign/explore.css (generated).
 *
 * No search: Rising Stars + "Highlights" and "For You" grids (discovery.forYou).
 * With ?q= (header search, a tag, or a category chip): matching artists + posts (search.*).
 * Posts have no category field, so a category chip simply searches for that style.
 */
import "../redesign/explore.css"
import "../redesign/shell.css"
import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { SlidersHorizontal, X, ArrowDownWideNarrow, ArrowRight, ArrowUpRight, Heart, Sparkles } from "lucide-react"
import { trpc } from "@/components/providers"
import ProtectedArtwork from "@/components/ProtectedArtwork"
import RedesignShell, { GallerySidebar, Avatar } from "@/components/redesign/RedesignShell"
import AdCard, { useAds } from "@/components/redesign/AdCard"
import { FeedRightRail } from "@/components/redesign/FeedParts"

const CATEGORIES = ["All", "Digital", "Traditional", "Pixel Art", "3D", "Anime/Manga", "Sketch", "Watercolor", "Comics"] as const
type SortOrder = "trending" | "newest" | "mostLiked"

type ArtworkSummary = { id: string; image: string; description: string | null; user: { username: string | null }; _count?: { likes: number } }

export default function ExplorePage() {
  const { status } = useSession()
  if (status === "loading") return null
  return (
    <RedesignShell wrapperClass="gx-explore">
      <div className="desktop-layout explore-layout">
        <GallerySidebar note={"Follow your curiosity.\nSee where it takes you."} />
        <Suspense fallback={<main className="explore-main" />}><ExploreMain /></Suspense>
        <FeedRightRail />
      </div>
    </RedesignShell>
  )
}

function ExploreMain() {
  const router = useRouter()
  const query = useSearchParams().get("q")?.trim() ?? ""
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState<SortOrder>("trending")
  const setQuery = (value: string) => router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search")
  const activeCategory = CATEGORIES.find((category) => category.toLowerCase() === query.toLowerCase()) ?? (query ? null : "All")

  return (
    <main className="explore-main" aria-label="Explore discovery content">
      <section className="explore-toolbar" aria-label="Explore categories and filters">
        <div className="toolbar-heading">
          <h1>Explore <span>✦</span></h1>
          {query && (
            <button className={`filter-toggle ${showFilters ? "selected" : ""}`} onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
              <SlidersHorizontal size={16} /><span>Filters</span>
            </button>
          )}
        </div>
        <div className="category-chips" aria-label="Artwork categories">
          {CATEGORIES.map((category) => (
            <button key={category} aria-pressed={activeCategory === category} className={activeCategory === category ? "selected" : ""} onClick={() => setQuery(category === "All" ? "" : category)}>{category}</button>
          ))}
        </div>
        {query && (
          <div className="active-query">
            <span>Results for <strong>“{query}”</strong></span>
            <button aria-label="Clear search" onClick={() => setQuery("")}><X size={13} /> Clear</button>
          </div>
        )}
        {query && showFilters && (
          <div className="filter-panel">
            <label><ArrowDownWideNarrow size={15} />Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value as SortOrder)}>
                <option value="trending">Trending this week</option>
                <option value="newest">Newest</option>
                <option value="mostLiked">Most loved</option>
              </select>
            </label>
          </div>
        )}
      </section>
      {query ? <SearchResults query={query} sort={sort} /> : <Discover />}
      <p className="explore-end">Stay curious. Your next favorite artist is out there. <span>✦</span></p>
    </main>
  )
}

function Discover() {
  const exploreAd = useAds("EXPLORE")[0]
  const { data: risingStars } = trpc.discovery.risingStars.useQuery({ limit: 12 })
  const { data: forYou, isLoading } = trpc.discovery.forYou.useQuery({ limit: 24 })
  const artworks = forYou?.items ?? []
  return (
    <>
      <ArtistRow title="Rising Stars" subtitle="A little ahead of the curve. A lot worth following." artists={risingStars?.items ?? []} />
      {exploreAd && <AdCard ad={exploreAd} variant="banner" />}
      <ArtworkGrid title="Highlights" subtitle="Extraordinary work. Fresh perspectives." artworks={artworks.slice(0, 4)} loading={isLoading} />
      <ArtworkGrid title="For You" subtitle={`${Math.max(artworks.length - 4, 0)} discoveries to spark your next idea`} artworks={artworks.slice(4)} loading={isLoading} />
    </>
  )
}

function SearchResults({ query, sort }: { query: string; sort: SortOrder }) {
  const { data: artists } = trpc.search.artists.useQuery({ query: query.replace(/^#/, ""), limit: 12 })
  const { data: posts, isLoading } = trpc.search.posts.useQuery({ query: query.replace(/^#/, ""), limit: 40, sort })
  return (
    <>
      {!!artists?.items.length && <ArtistRow title="Artists" artists={artists.items} />}
      <ArtworkGrid title="Artwork" subtitle={posts ? `${posts.total} result${posts.total === 1 ? "" : "s"}` : undefined} artworks={posts?.items ?? []} loading={isLoading} />
    </>
  )
}

function ArtistRow({ title, subtitle, artists }: { title: string; subtitle?: string; artists: { id: string; username: string | null; name: string | null; image: string | null }[] }) {
  if (!artists.length) return null
  return (
    <section className="rising-stars">
      <div className="section-heading">
        <div><h2>{title} <span className="tiny-star">✧</span></h2>{subtitle && <p>{subtitle}</p>}</div>
        <button onClick={(e) => e.currentTarget.closest("section")?.querySelector(".stars-track")?.scrollBy({ left: 330, behavior: "smooth" })}>See All <ArrowRight size={14} /></button>
      </div>
      <div className="stars-track">
        {artists.map((artist) => (
          <Link className="star-artist" key={artist.id} href={`/@${artist.username}`}>
            <span className="star-ring"><Avatar src={artist.image} name={artist.name ?? artist.username ?? "?"} className="" /></span>
            <span>{artist.username}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function ArtworkGrid({ title, subtitle, artworks, loading }: { title: string; subtitle?: string; artworks: ArtworkSummary[]; loading: boolean }) {
  return (
    <section className="explore-section">
      <div className="section-heading grid-heading">
        <div><h2>{title}{title === "Highlights" && <span className="tiny-star">✦</span>}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {title === "Highlights" && <span className="curated-label">HANDPICKED INSPIRATION<ArrowUpRight size={12} /></span>}
      </div>
      {loading ? <p className="gx-empty-note">Loading…</p> : artworks.length ? (
        <div className="art-grid">
          {artworks.map((artwork) => {
            const href = `/@${artwork.user.username}/${artwork.id}`
            const caption = artwork.description?.split("\n")[0] || "Untitled"
            return (
              <article className="art-card" key={artwork.id}>
                <Link className="art-card-image" href={href} aria-label={`View ${caption}`}>
                  <ProtectedArtwork src={artwork.image} alt={caption} />
                  <span className="image-view">Take a closer look ↗</span>
                </Link>
                <div className="art-card-body">
                  <Link className="art-title" href={href}>{caption}</Link>
                  <div className="art-artist-row">
                    <Link className="art-artist" href={`/@${artwork.user.username}`}><span>@{artwork.user.username}</span></Link>
                  </div>
                  {artwork._count && <div className="art-stats"><Link href={href}><Heart size={15} />{artwork._count.likes.toLocaleString()}</Link></div>}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="discovery-empty panel">
          <Sparkles size={25} />
          <h3>A new direction is just a search away.</h3>
          <p>Nothing here yet. Try another category or artist.</p>
        </div>
      )}
    </section>
  )
}
