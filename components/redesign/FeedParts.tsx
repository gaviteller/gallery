"use client"
/** Pieces of the redesigned Feed page (Codex design), each wired to real data. */
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Heart, MessageCircle, Send, MoreHorizontal, Check, Flag, Link as LinkIcon, Plus, ArrowRight, ArrowUpRight, Image as ImageIcon, Sparkles, Eye, ChevronsRight, ChevronsLeft, X } from "lucide-react"
import { trpc } from "@/components/providers"
import MentionText from "@/components/MentionText"
import ProtectedArtwork from "@/components/ProtectedArtwork"
import StoryViewer from "@/components/StoryViewer"
import { useShell, Avatar } from "./RedesignShell"
import GalleryPaintDrips from "./GalleryPaintDrips"
import AdCard, { useAds } from "./AdCard"

export type FeedPostData = {
  id: string
  image: string
  title: string | null
  description: string | null
  isAiGenerated: boolean
  createdAt: Date
  isFollowing: boolean
  isOwnPost: boolean
  likedByMe: boolean
  viewerHasReported: boolean
  _count: { likes: number; comments: number }
  user: { id: string; username: string | null; name: string | null; image: string | null }
}

export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

/** The stories row: real stories from you and the people you follow. */
export function StoriesPanel() {
  const { me, openCreate } = useShell()
  const utils = trpc.useUtils()
  const { data: groups = [] } = trpc.story.getFeed.useQuery(undefined, { enabled: !!me })
  const [viewing, setViewing] = useState<(typeof groups)[number] | null>(null)

  return (
    <section className="stories-panel panel">
      <div className="section-heading">
        <h2>Stories <span className="tiny-star">✦</span></h2>
        <button onClick={() => document.querySelector(".stories-track")?.scrollBy({ left: 270, behavior: "smooth" })}>See All <ArrowRight size={13} /></button>
      </div>
      <div className="stories-track">
        {groups.map((group) => {
          const isMe = group.userId === me?.username || group.username === me?.username
          const hasStory = group.stories.length > 0
          const label = isMe ? "Your Story" : (group.username ?? group.name ?? "Artist")
          return (
            <button key={group.userId} className={`story ${isMe ? "your-story" : ""}`} onClick={() => (hasStory ? setViewing(group) : openCreate("Story"))}>
              <span className="story-ring">
                <Avatar src={group.image} name={group.name ?? group.username ?? "?"} className="" />
                {isMe && !hasStory && <i><Plus size={14} /></i>}
              </span>
              <span>{label}</span>
            </button>
          )
        })}
      </div>
      {viewing && <StoryViewer user={viewing} onClose={() => { setViewing(null); utils.story.getFeed.invalidate() }} />}
    </section>
  )
}

/** "What are you creating today?" box — opens the real create dialog. */
export function PostComposer() {
  const { me, openCreate } = useShell()
  return (
    <section className="composer panel">
      <div className="composer-input">
        <Avatar src={me?.image} name={me?.name ?? "You"} />
        <button onClick={() => openCreate()}>What are you creating today?<ArrowUpRight size={18} /></button>
      </div>
      <div className="composer-tools">
        <button onClick={() => openCreate()}><ImageIcon size={16} />Image</button>
        <button onClick={() => openCreate("Story")}><Sparkles size={16} />Story</button>
        <span>Let your creativity out.</span>
      </div>
    </section>
  )
}

/** One post card. Likes are handled by the page (optimistic); follow/report/link/comments here. */
export function FeedPost({ post, onLike, onOpen, onReport }: {
  post: FeedPostData
  onLike: () => void
  onOpen: () => void
  onReport: () => void
}) {
  const { toast } = useShell()
  const [following, setFollowing] = useState(post.isFollowing)
  const [menuOpen, setMenuOpen] = useState(false)
  const follow = trpc.follow.follow.useMutation({ onSuccess: () => setFollowing(true) })
  const unfollow = trpc.follow.unfollow.useMutation({ onSuccess: () => setFollowing(false) })
  const username = post.user.username ?? ""
  const displayName = post.user.name ?? username
  const postUrl = `/@${username}/${post.id}`
  const hashtags = Array.from(new Set(post.description?.match(/#[a-zA-Z0-9_]+/g) ?? [])).slice(0, 5)

  function copyLink() {
    navigator.clipboard?.writeText(`${location.origin}${postUrl}`)
    toast("Post link copied")
    setMenuOpen(false)
  }

  return (
    <article className="feed-post panel">
      <div className="post-header">
        <Link href={`/@${username}`}><Avatar src={post.user.image} name={displayName} /></Link>
        <div className="post-author">
          <Link href={`/@${username}`}><strong>{displayName}</strong></Link>
          <span>@{username}<b>·</b>{timeAgo(post.createdAt)}</span>
        </div>
        {!post.isOwnPost && (
          <button className="follow-text" disabled={follow.isPending || unfollow.isPending} onClick={() => (following ? unfollow : follow).mutate({ username })}>
            {following ? <><Check size={13} /> Following</> : "+ Follow"}
          </button>
        )}
        <div className="menu-wrap">
          <button className="icon-button" aria-label={`More options for ${displayName}'s post`} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={20} /></button>
          {menuOpen && <>
            <button className="menu-dismiss" aria-label="Close post menu" onClick={() => setMenuOpen(false)} />
            <div className="post-menu">
              <Link href={postUrl}><Eye size={14} />View post</Link>
              <button onClick={copyLink}><LinkIcon size={14} />Copy link</button>
              {!post.isOwnPost && (post.viewerHasReported
                ? <button disabled><Flag size={14} />Reported</button>
                : <button onClick={() => { setMenuOpen(false); onReport() }}><Flag size={14} />Report post</button>)}
            </div>
          </>}
        </div>
      </div>
      {post.description && <p className="post-caption"><MentionText text={post.description} /></p>}
      <div className="artwork-wrap">
        <Link href={postUrl}><ProtectedArtwork src={post.image} alt={post.title ?? post.description ?? `Artwork by ${displayName}`} className="artwork" /></Link>
        <span className="artwork-label">{post.title}<span>{post.isAiGenerated ? "AI-GENERATED" : "ORIGINAL ARTWORK"}</span></span>
      </div>
      <div className="post-actions">
        <button className={post.likedByMe ? "is-liked" : ""} aria-label={post.likedByMe ? "Unlike post" : "Like post"} aria-pressed={post.likedByMe} onClick={onLike}>
          <Heart size={20} fill={post.likedByMe ? "currentColor" : "none"} />{post._count.likes.toLocaleString()}
        </button>
        <button aria-label="Comments" onClick={onOpen}><MessageCircle size={20} />{post._count.comments}</button>
        <button aria-label="Share post" onClick={copyLink}><Send size={19} /><span className="share-label">Share</span></button>
      </div>
      {hashtags.length > 0 && (
        <div className="tags">{hashtags.map((tag) => <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`}>{tag}</Link>)}</div>
      )}
    </article>
  )
}

/** Right column: suggested artists, trending tags, and the "Anyone can be an artist" card. */
export function FeedRightRail() {
  const { theme, openCreate } = useShell()
  const [showAll, setShowAll] = useState(false)
  const { data: suggested } = trpc.discovery.risingStars.useQuery({ limit: showAll ? 8 : 3, excludeFollowed: true })
  const { data: trending } = trpc.discovery.trendingTags.useQuery({ limit: 5 })
  const sidebarAd = useAds("SIDEBAR")[0]
  // The viewer can shrink the rail to a thin strip or remove it; remembered on this device.
  const railRef = useRef<HTMLElement>(null)
  const [mode, setMode] = useState<"open" | "collapsed" | "hidden">("open")
  useEffect(() => { try { const saved = localStorage.getItem("gx.rightRail"); if (saved === "collapsed" || saved === "hidden") setMode(saved) } catch {} }, [])
  useEffect(() => {
    const root = railRef.current?.closest(".gx")
    root?.classList.toggle("rail-collapsed", mode === "collapsed")
    root?.classList.toggle("rail-hidden", mode === "hidden")
    try { localStorage.setItem("gx.rightRail", mode) } catch {}
    return () => { root?.classList.remove("rail-collapsed", "rail-hidden") }
  }, [mode])

  if (mode !== "open") {
    return (
      <aside ref={railRef} className={`right-rail gx-rail-${mode}`}>
        <button className="gx-rail-toggle" onClick={() => setMode("open")} aria-label="Show suggestions sidebar" title="Show sidebar"><ChevronsLeft size={16} /></button>
      </aside>
    )
  }

  return (
    <aside ref={railRef} className="right-rail">
      <div className="gx-rail-controls">
        <button onClick={() => setMode("collapsed")} aria-label="Shrink sidebar" title="Shrink"><ChevronsRight size={15} /></button>
        <button onClick={() => setMode("hidden")} aria-label="Remove sidebar" title="Remove"><X size={15} /></button>
      </div>
      <section className="suggested">
        <div className="section-heading"><h2>Suggested for you</h2><button onClick={() => setShowAll(!showAll)}>{showAll ? "Show less" : "See All"}</button></div>
        {!suggested?.items.length && <p className="gx-empty-note">New artists will show up here.</p>}
        {suggested?.items.map((artist) => <SuggestedArtist key={artist.id} artist={artist} />)}
      </section>
      <section className="trending">
        <div className="section-heading"><h2><Sparkles size={16} /> Trending now</h2><span className="eyebrow">THIS MONTH</span></div>
        {!trending?.items.length && <p className="gx-empty-note">Add #tags to your captions to start a trend.</p>}
        {trending?.items.slice(0, 5).map((item, index) => (
          <Link className="trend-row" key={item.tag} href={`/search?q=${encodeURIComponent("#" + item.tag)}`}>
            <span className="trend-number">0{index + 1}</span><strong>#{item.tag}</strong>
            <span>{item.count}<ArrowUpRight size={11} /></span>
          </Link>
        ))}
      </section>
      {sidebarAd && <AdCard ad={sidebarAd} />}
      <section className="promo panel">
        <GalleryPaintDrips theme={theme} small />
        <span className="promo-caption">THAT IDEA IN YOUR HEAD?</span>
        <p>Anyone<br />can be<br /><em>an artist.</em></p>
        <span className="promo-star">✧</span>
        <span className="promo-note">The world needs your kind of art.</span>
        <button className="gradient-button" onClick={() => openCreate()}>Create Something<ArrowUpRight size={16} /></button>
      </section>
      <footer>
        <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/dmca">DMCA</Link>
        <br /><span>© 2026 Gallery. Made for the makers. ✦</span>
      </footer>
    </aside>
  )
}

function SuggestedArtist({ artist }: { artist: { username: string | null; name: string | null; image: string | null; followerCount: number } }) {
  const [following, setFollowing] = useState(false)
  const follow = trpc.follow.follow.useMutation({ onSuccess: () => setFollowing(true) })
  const unfollow = trpc.follow.unfollow.useMutation({ onSuccess: () => setFollowing(false) })
  const username = artist.username ?? ""
  const name = artist.name ?? username
  return (
    <div className="artist-row">
      <Link href={`/@${username}`}><Avatar src={artist.image} name={name} /></Link>
      <Link href={`/@${username}`}><strong>{name}</strong><span>{artist.followerCount} followers</span></Link>
      <button className={`follow-button ${following ? "followed" : ""}`} disabled={follow.isPending || unfollow.isPending} onClick={() => (following ? unfollow : follow).mutate({ username })}>
        {following ? <Check size={14} /> : "Follow"}
      </button>
    </div>
  )
}
