"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { trpc } from "@/components/providers"
import MentionText from "@/components/MentionText"
import PostModal from "@/components/PostModal"

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
  _count: { likes: number; comments: number }
  user: {
    id: string
    username: string | null
    name: string | null
    image: string | null
  }
}

export default function FeedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const utils = trpc.useUtils()
  const [viewPost, setViewPost] = useState<FeedPost | null>(null)
  const [focusComment, setFocusComment] = useState(false)
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
    onSuccess: () => utils.post.getFeed.invalidate(),
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
    <div className="max-w-lg mx-auto pb-24">
      {isLoading ? (
        <div className="text-center py-20 text-gray-400">Loading…</div>
      ) : error ? (
        <div className="text-center py-20 text-red-400 text-sm">{error.message}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">🖼️</div>
          <p className="font-medium text-gray-500">No posts yet</p>
          <p className="text-sm text-gray-400 mt-1">Follow artists to see their work here</p>
        </div>
      ) : (
        <>
          <div style={{ borderTop: "1px solid #ffffff08" }}>
            {posts.map((post) => (
              <article key={post.id} style={{ borderBottom: "1px solid #ffffff08" }}>
                {/* Post header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Link href={`/@${post.user.username}`}>
                    {post.user.image ? (
                      <img src={post.user.image} alt={post.user.username ?? ""} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">
                        {(post.user.name ?? post.user.username ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/@${post.user.username}`} className="text-sm font-semibold text-white">
                      @{post.user.username}
                    </Link>
                    {post.user.name && (
                      <p className="text-xs text-white/50 truncate">{post.user.name}</p>
                    )}
                  </div>
                  {post.isAiGenerated && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(176,68,248,0.2)", color: "#B044F8" }}>AI</span>
                  )}
                </div>

                {/* Full-bleed image */}
                <button className="w-full block" onClick={() => setViewPost(post as FeedPost)}>
                  <img
                    src={post.image}
                    alt={post.description ?? ""}
                    className="w-full object-cover"
                  />
                </button>

                {/* Actions */}
                <div className="flex items-center gap-4 px-4 pt-3 pb-1">
                  <button
                    onClick={() => toggleLike.mutate({ postId: post.id })}
                    disabled={toggleLike.isPending}
                    className="flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24"
                      fill={post.likedByMe ? "#ef4444" : "none"}
                      stroke={post.likedByMe ? "#ef4444" : "white"}
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                    </svg>
                    <span className={`text-sm font-semibold ${post.likedByMe ? "text-red-500" : "text-white"}`}>
                      {post._count.likes}
                    </span>
                  </button>
                  <button
                    onClick={() => { setFocusComment(true); setViewPost(post as FeedPost) }}
                    className="flex items-center gap-1.5 text-white transition-colors"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                    <span className="text-sm font-semibold">{post._count.comments}</span>
                  </button>
                </div>

                {/* Caption */}
                {post.description && (
                  <div className="px-4 py-1.5 pb-3">
                    <p className="text-sm text-white/90 leading-snug">
                      <Link href={`/@${post.user.username}`} className="font-semibold mr-1">
                        @{post.user.username}
                      </Link>
                      <MentionText text={post.description} />
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="py-6 flex justify-center">
            {isFetchingNextPage && (
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
            )}
            {!hasNextPage && posts.length > 0 && (
              <p className="text-xs text-gray-300">You're all caught up</p>
            )}
          </div>
        </>
      )}

      {viewPost && (
        <PostModal
          post={viewPost}
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
