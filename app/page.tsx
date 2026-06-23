"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { trpc } from "@/components/providers"
import MentionText from "@/components/MentionText"
import PostModal from "@/components/PostModal"
import FeaturedArtistsStrip from "@/components/FeaturedArtistsStrip"
import ReportModal from "@/components/ReportModal"

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
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

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.post.getFeed.useInfiniteQuery(
    {},
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialCursor: 0,
    }
  )

  const toggleLike = trpc.interaction.toggleLike.useMutation({
    onMutate: async ({ postId }) => {
      // Cancel any in-flight refetch so it doesn't overwrite our optimistic update
      await utils.post.getFeed.cancel()

      // Snapshot the current cache so we can roll back on error
      const previous = utils.post.getFeed.getInfiniteData({})

      // Optimistically update the cache
      utils.post.getFeed.setInfiniteData({}, (old) => {
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
                _count: {
                  ...post._count,
                  likes: post._count.likes + (wasLiked ? -1 : 1),
                },
              }
            }),
          })),
        }
      })

      return { previous }
    },

    onError: (_err, _input, context) => {
      // Roll back to the snapshot on failure
      if (context?.previous) {
        utils.post.getFeed.setInfiniteData({}, context.previous)
      }
    },

    onSettled: () => {
      // Background sync with server after mutation completes
      utils.post.getFeed.invalidate()
    },
  })

  // Infinite scroll — fire when sentinel div enters viewport
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
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

  return (
    <div className="feed-container mx-auto pb-24 max-w-lg">
      <FeaturedArtistsStrip />
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
            style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
          >
            Find artists →
          </Link>
        </div>
      ) : (
        <>
          <div>
            {posts.map((post) => (
              <article key={post.id} style={{ borderBottom: "1px solid var(--border)" }}>

                {/* Post header — matches mockup: 9px 12px padding, 9px gap, 28px avatar */}
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px" }}>
                  <Link href={`/@${post.user.username}`} style={{ flexShrink: 0 }}>
                    <div style={{ padding: 1.5, background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", borderRadius: "50%" }}>
                      <div style={{ padding: 1.5, background: "var(--bg)", borderRadius: "50%" }}>
                        {post.user.image ? (
                          <img src={post.user.image} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", display: "block" }} />
                        ) : (
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700 }}>
                            {(post.user.name ?? post.user.username ?? "?")[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/@${post.user.username}`} style={{ fontFamily: "'Playfair Display', serif", fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>
                      {post.user.name ?? post.user.username}
                    </Link>
                    <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 1 }}>
                      @{post.user.username} · {timeAgo(post.createdAt)}
                    </div>
                  </div>

                  {/* 3-dot menu — 16×16, dots 3px */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === post.id ? null : post.id)}
                      style={{ width: 24, height: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--muted)", display: "block" }} />
                      <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--muted)", display: "block" }} />
                      <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--muted)", display: "block" }} />
                    </button>
                    {openMenuId === post.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                        <div style={{ position: "absolute", right: 0, top: 28, zIndex: 50, width: 140, borderRadius: 12, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)" }}>
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

                {/* Image — natural height, NO aspect ratio forcing, 0px radius */}
                <button style={{ display: "block", width: "100%", padding: 0, border: "none", background: "none", cursor: "pointer" }} onClick={() => setViewPost(post as FeedPost)}>
                  <img src={post.image} alt={post.description ?? ""} style={{ display: "block", width: "100%", borderRadius: 0 }} />
                </button>

                {/* Actions row — 8px 12px padding, space-between */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => toggleLike.mutate({ postId: post.id })} disabled={toggleLike.isPending} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, opacity: toggleLike.isPending ? 0.5 : 1 }}>
                      <span style={post.likedByMe ? {
                        fontSize: 10, fontWeight: 600,
                        background: "linear-gradient(90deg, #FF3CAC, #784BA0)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                      } : { fontSize: 10, color: "var(--muted)" }}>
                        ♥ {post._count.likes}
                      </span>
                    </button>
                    <button onClick={() => { setFocusComment(true); setViewPost(post as FeedPost) }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--muted)", fontSize: 10 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                      </svg>
                      {post._count.comments}
                    </button>
                  </div>
                  <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--muted)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                    </svg>
                  </button>
                </div>

                {/* Caption — 10px Inter, name 11px Playfair */}
                {post.description && (
                  <div style={{ padding: "0 12px 9px", fontSize: 10, color: "var(--muted)", lineHeight: 1.4 }}>
                    <Link href={`/@${post.user.username}`} style={{ fontFamily: "'Playfair Display', serif", fontSize: 11, fontWeight: 700, color: "var(--text)", marginRight: 4, textDecoration: "none" }}>
                      {post.user.name ?? post.user.username}
                    </Link>
                    <MentionText text={post.description} />
                  </div>
                )}

                {/* Hashtag pills — 9px, 2px 7px padding */}
                {(() => {
                  const tags = Array.from(new Set((post.description ?? "").match(/#[a-zA-Z0-9_]+/g) ?? [])).slice(0, 5)
                  if (!tags.length) return null
                  return (
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, padding: "0 12px 9px" }}>
                      {tags.map(tag => (
                        <span key={tag} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 99, background: "var(--surface)", color: "#9080B8", border: "1px solid var(--border)" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )
                })()}

                {!post.description && <div style={{ height: 9 }} />}
              </article>
            ))}
          </div>

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
