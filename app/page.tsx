"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { trpc } from "@/components/providers"
import MentionText from "@/components/MentionText"
import PostModal from "@/components/PostModal"
import ReportModal from "@/components/ReportModal"
import ProtectedArtwork from "@/components/ProtectedArtwork"
import StoriesRow from "@/components/StoriesRow"
import GalleryRightRail from "@/components/GalleryRightRail"

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

async function sharePost(path: string, title: string) {
  const url = `${window.location.origin}${path}`
  if (navigator.share) {
    try { await navigator.share({ title, url }); return } catch { /* cancelled or unsupported */ }
  }
  try { await navigator.clipboard.writeText(url) } catch { /* no-op fallback */ }
}

type FeedPost = {
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
  status: string
  _count: { likes: number; comments: number }
  user: {
    id: string
    username: string | null
    name: string | null
    image: string | null
    commissionStatus: "OPEN" | "LIMITED" | "CLOSED"
  }
}

export default function FeedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const utils = trpc.useUtils()
  const [viewPost, setViewPost] = useState<FeedPost | null>(null)
  const [focusComment, setFocusComment] = useState(false)
  const [reportingPostId, setReportingPostId] = useState<string | null>(null)
  const [localReported, setLocalReported] = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // The feed's ranking is frozen to the moment this page opened, so it doesn't
  // reshuffle while you scroll or like things. Opening/refreshing the page re-ranks it.
  const [feedSnapshotTime] = useState(() => Date.now())
  const feedQueryInput = { asOf: feedSnapshotTime }

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.post.getFeed.useInfiniteQuery(
    feedQueryInput,
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialCursor: 0,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    }
  )

  // Likes update instantly on screen (optimistic) without re-fetching the feed,
  // so the order stays put. Rolls back if the server rejects the like.
  const toggleLike = trpc.interaction.toggleLike.useMutation({
    onMutate: async ({ postId }) => {
      await utils.post.getFeed.cancel()
      const previous = utils.post.getFeed.getInfiniteData(feedQueryInput)
      utils.post.getFeed.setInfiniteData(feedQueryInput, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((post) => {
              if (post.id !== postId) return post
              const wasLiked = post.likedByMe
              return {
                ...post,
                likedByMe: !wasLiked,
                _count: { ...post._count, likes: post._count.likes + (wasLiked ? -1 : 1) },
              }
            }),
          })),
        }
      })
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) utils.post.getFeed.setInfiniteData(feedQueryInput, context.previous)
    },
  })

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: "400px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
    if (status === "authenticated" && (!session.user.onboardingComplete || !session.user.username)) {
      router.push("/onboarding")
    }
  }, [status, session, router])

  if (status === "loading" || status === "unauthenticated") return null

  const posts = data?.pages.flatMap((p) => p.posts) ?? []
  const username = session?.user?.username ?? ""
  const userImage = session?.user?.image ?? null
  const userInitials = (session?.user?.name ?? username ?? "?")[0]?.toUpperCase() ?? "?"


  return (
    <div className="gallery-feed-page">
      <div className="feed-wide-wrap">
        <div className="feed-main-col">

          {/* Functional Stories row — uses the existing story viewer/upload logic. */}
          <section className="gallery-card gallery-stories-card">
            <StoriesRow />
          </section>

          {/* Composer */}
          <section className="gallery-card gallery-composer">
            <div className="gallery-composer-top">
              <Link href={username ? `/@${username}` : "/"} className="gallery-composer-avatar">
                {userImage ? (
                  <img src={userImage} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  userInitials
                )}
              </Link>
              <Link href={username ? `/@${username}` : "/"} className="gallery-composer-input">What are you creating today?</Link>
            </div>
            <div className="gallery-composer-tools">
              <Link href={username ? `/@${username}` : "/"}>▣ <span>Image</span></Link>
              <Link href={username ? `/@${username}` : "/"}>▹ <span>Video</span></Link>
              <Link href={username ? `/@${username}` : "/"}>☷ <span>Poll</span></Link>
              <Link href={username ? `/@${username}` : "/"}>✎ <span>Sketch</span></Link>
            </div>
          </section>

          {/* Feed posts */}
          {isLoading ? (
            <div className="text-center py-20 text-gray-400">Loading…</div>
          ) : error ? (
            <div className="text-center py-20 text-red-400 text-sm">{error.message}</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-3">🖼️</div>
              <p className="font-medium text-white/60">No posts yet</p>
              <p className="text-sm text-white/40 mt-1 mb-5">Follow artists to see their work here</p>
              <Link
                href="/commissions"
                className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80"
                style={{ background: "var(--grad)" }}
              >
                Find artists →
              </Link>
            </div>
          ) : (
            <>
              {posts.map((post) => {
                const tags = Array.from(new Set((post.description ?? "").match(/#[a-zA-Z0-9_]+/g) ?? [])).slice(0, 5)
                return (
                  <article key={post.id} className="gallery-card gallery-post">
                    {/* Post header */}
                    <div className="gallery-post-head">
                      <Link href={`/@${post.user.username}`} className="gallery-author-avatar">
                        {post.user.image ? (
                          <img src={post.user.image} alt="" />
                        ) : (
                          <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "linear-gradient(135deg,#ff28b7,#a34dff)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 16, fontWeight: 800 }}>
                            {(post.user.name ?? post.user.username ?? "?")[0]?.toUpperCase()}
                          </div>
                        )}
                      </Link>

                      <div className="gallery-author-meta">
                        <Link href={`/@${post.user.username}`} className="gallery-author-name">
                          {post.user.name ?? post.user.username}
                        </Link>
                        <span>@{post.user.username} · {timeAgo(post.createdAt)}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {!post.isOwnPost && !post.isFollowing && (
                          <Link href={`/@${post.user.username}`} style={{ fontSize: 11, fontWeight: 700, color: "#ff60da", border: "1px solid #dc2dd3", borderRadius: 8, padding: "3px 10px", textDecoration: "none", flexShrink: 0 }}>
                            Follow
                          </Link>
                        )}
                        <div style={{ position: "relative" }}>
                          <button
                            className="gallery-post-menu"
                            onClick={() => setOpenMenuId(openMenuId === post.id ? null : post.id)}
                          >
                            ⋮
                          </button>
                          {openMenuId === post.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                              <div style={{ position: "absolute", right: 0, top: 32, zIndex: 50, width: 140, borderRadius: 12, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)" }}>
                                {post.isOwnPost ? (
                                  <button onClick={() => { setOpenMenuId(null); setViewPost(post as FeedPost) }} style={{ width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 12, color: "var(--text)", background: "none", border: "none", cursor: "pointer" }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                    View post
                                  </button>
                                ) : localReported.has(post.id) || post.viewerHasReported ? (
                                  <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>Reported</div>
                                ) : (
                                  <button onClick={() => { setOpenMenuId(null); setReportingPostId(post.id) }} style={{ width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#F06060", background: "none", border: "none", cursor: "pointer" }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                    Report
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Artwork */}
                    <Link href={`/@${post.user.username}/${post.id}`} className="gallery-art-button">
                      <ProtectedArtwork
                        src={post.image}
                        alt={post.description ?? ""}
                        className="gallery-post-art"
                        style={{ width: "100%", borderRadius: 0, display: "block" }}
                      />
                    </Link>

                    {/* Footer */}
                    <div className="gallery-post-footer">
                      <div className="gallery-engagement">
                        <button
                          className={post.likedByMe ? "gallery-like" : ""}
                          onClick={() => toggleLike.mutate({ postId: post.id })}
                          disabled={toggleLike.isPending}
                          style={{ opacity: toggleLike.isPending ? 0.5 : 1 }}
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                          </svg>
                          <span>{post._count.likes}</span>
                        </button>

                        <button onClick={() => { setFocusComment(true); setViewPost(post as FeedPost) }}>
                          <svg viewBox="0 0 24 24">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                          </svg>
                          <span>{post._count.comments}</span>
                        </button>

                        <button onClick={() => sharePost(`/@${post.user.username}/${post.id}`, post.title ?? `Artwork by ${post.user.name ?? post.user.username}`)}>
                          <svg viewBox="0 0 24 24">
                            <path d="m22 2-8 20-4-8-8-4z"/><path d="M10 14 22 2"/>
                          </svg>
                        </button>

                        <button className="gallery-save">
                          <svg viewBox="0 0 24 24">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                          </svg>
                        </button>
                      </div>

                      {/* Caption */}
                      {post.description && (
                        <div className="gallery-post-caption">
                          <Link href={`/@${post.user.username}`} className="gallery-post-caption-name">
                            {post.user.name ?? post.user.username}
                          </Link>
                          <MentionText text={post.description} />
                        </div>
                      )}

                      {/* Hashtag pills */}
                      {tags.length > 0 && (
                        <div className="gallery-tags">
                          {tags.map(tag => (
                            <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`}>{tag}</Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="py-6 flex justify-center">
                {isFetchingNextPage && (
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                )}
                {!hasNextPage && posts.length > 0 && (
                  <p className="text-xs text-gray-300">You're all caught up</p>
                )}
              </div>
            </>
          )}
        </div>{/* /feed-main-col */}

        <GalleryRightRail variant="combined" />
      </div>{/* /feed-wide-wrap */}

      {reportingPostId && (
        <ReportModal
          postId={reportingPostId}
          onClose={() => setReportingPostId(null)}
          onReported={() => {
            setLocalReported(prev => new Set([...prev, reportingPostId!]))
            setReportingPostId(null)
          }}
        />
      )}

      {viewPost && (
        <PostModal
          post={{ ...viewPost, pinned: false }}
          profileUser={{
            username: viewPost.user.username,
            name: viewPost.user.name,
            image: viewPost.user.image,
          }}
          isOwn={viewPost.isOwnPost}
          autoFocusComment={focusComment}
          onClose={() => { setViewPost(null); setFocusComment(false) }}
          onDelete={() => {
            utils.post.getFeed.invalidate()
            setViewPost(null)
            setFocusComment(false)
          }}
        />
      )}
    </div>
  )
}
