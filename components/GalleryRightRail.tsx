"use client"

import { useState } from "react"
import Link from "next/link"
import { trpc } from "@/components/providers"

type Variant = "combined" | "split"

/**
 * Follow / unfollow toggle for a suggested artist.
 * The sidebar only suggests artists you don't follow yet, so it starts as "Follow";
 * after following, clicking "Following" undoes it.
 */
function FollowButton({ username }: { username: string | null }) {
  const [isFollowing, setIsFollowing] = useState(false)
  const follow = trpc.follow.follow.useMutation({ onSuccess: () => setIsFollowing(true) })
  const unfollow = trpc.follow.unfollow.useMutation({ onSuccess: () => setIsFollowing(false) })
  const isSaving = follow.isPending || unfollow.isPending
  if (!username) return null
  return (
    <button
      type="button"
      className={`gallery-follow${isFollowing ? " is-following" : ""}`}
      disabled={isSaving}
      onClick={() => (isFollowing ? unfollow : follow).mutate({ username })}
    >
      {isSaving ? "…" : isFollowing ? "Following" : "Follow"}
    </button>
  )
}

export function GalleryPromoCard() {
  return (
    <section className="gallery-card gallery-promo-card" aria-label="Create something">
      <div className="gallery-promo-paint" aria-hidden="true" />
      <div className="gallery-promo-side-drip gallery-promo-side-drip-one" aria-hidden="true" />
      <div className="gallery-promo-side-drip gallery-promo-side-drip-two" aria-hidden="true" />
      <div className="gallery-promo-copy"><span>Anyone</span><span>can be</span><span>an artist!</span></div>
      <Link href="/professional-profile" className="gallery-promo-button">Create Something <span>›</span></Link>
      <div className="gallery-promo-bottom-paint" aria-hidden="true" />
    </section>
  )
}

export default function GalleryRightRail({ variant = "combined", showPromo = true }: { variant?: Variant; showPromo?: boolean }) {
  const { data: suggested } = trpc.discovery.risingStars.useQuery({ limit: 5, excludeFollowed: true })
  const { data: trending } = trpc.discovery.trendingTags.useQuery({ limit: 5 })

  const suggestedBlock = (
    <>
      <div className="gallery-section-title"><h2>{variant === "split" ? "Suggested Artists" : "Suggested"}</h2><Link href="/search?filter=rising-stars">See All</Link></div>
      <div className="gallery-suggested-list">
        {(suggested?.items ?? []).slice(0, 5).map(artist => (
          <div className="gallery-suggested-person" key={artist.id}>
            <Link href={artist.username ? `/@${artist.username}` : "#"} className="gallery-suggested-avatar-link">
              {artist.image ? <img src={artist.image} alt="" /> : <span className="gallery-suggested-avatar">{(artist.name ?? artist.username ?? "?")[0]?.toUpperCase()}</span>}
            </Link>
            <Link href={artist.username ? `/@${artist.username}` : "#"} className="gallery-suggested-meta"><b>{artist.name ?? artist.username}</b><span>@{artist.username}</span></Link>
            <FollowButton username={artist.username} />
          </div>
        ))}
        {!suggested?.items?.length && <p className="gallery-right-empty">No suggestions yet</p>}
      </div>
    </>
  )

  const trendingBlock = (
    <>
      <div className="gallery-section-title gallery-trending-head"><h2>{variant === "split" ? "Trending Tags" : "Trending"}</h2>{variant === "split" && <Link href="/search">See All</Link>}</div>
      <div className="gallery-trending-list">
        {(trending?.items ?? []).map(item => (
          <Link key={item.tag} href={`/search?q=${encodeURIComponent(item.tag)}`} className="gallery-trend">
            <span>{item.tag.startsWith("#") ? item.tag : `#${item.tag}`}</span>
            <em>{item.count >= 1000 ? `${(item.count / 1000).toFixed(item.count >= 10000 ? 0 : 1)}k` : item.count}</em>
          </Link>
        ))}
        {!trending?.items?.length && <p className="gallery-right-empty">Trending tags will appear here.</p>}
      </div>
    </>
  )

  return (
    <aside className="gallery-right-rail">
      {variant === "combined" ? (
        <section className="gallery-card gallery-discovery gallery-right-combined">
          {suggestedBlock}
          <div className="gallery-right-rule" />
          {trendingBlock}
        </section>
      ) : (
        <>
          <section className="gallery-card gallery-discovery gallery-explore-suggested">{suggestedBlock}</section>
          <section className="gallery-card gallery-discovery gallery-explore-trends">{trendingBlock}</section>
        </>
      )}
      {showPromo && <GalleryPromoCard />}
    </aside>
  )
}
