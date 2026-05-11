"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
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
  const { data: posts, isLoading, error } = trpc.post.getFeed.useQuery()
  const [viewPost, setViewPost] = useState<FeedPost | null>(null)

  const followMutation = trpc.follow.follow.useMutation({
    onSuccess: () => utils.post.getFeed.invalidate(),
  })
  const unfollowMutation = trpc.follow.unfollow.useMutation({
    onSuccess: () => utils.post.getFeed.invalidate(),
  })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
    if (status === "authenticated" && (!session.user.onboardingComplete || !session.user.username)) {
      router.push("/onboarding")
    }
  }, [status, session, router])

  if (status === "loading" || status === "unauthenticated") return null

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {isLoading ? (
        <div className="text-center py-20 text-gray-400">Loading…</div>
      ) : error ? (
        <div className="text-center py-20 text-red-400 text-sm">{error.message}</div>
      ) : !posts || posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">🖼️</div>
          <p className="font-medium text-gray-500">No posts yet</p>
          <p className="text-sm text-gray-400 mt-1">Follow artists to see their work here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <article key={post.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
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
                  <Link href={`/@${post.user.username}`} className="text-sm font-semibold text-gray-900 hover:underline">
                    @{post.user.username}
                  </Link>
                  {post.user.name && (
                    <p className="text-xs text-gray-500 truncate">{post.user.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {post.isAiGenerated && (
                    <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">AI</span>
                  )}
                  {!post.isOwnPost && (
                    <button
                      onClick={() =>
                        post.isFollowing
                          ? unfollowMutation.mutate({ username: post.user.username! })
                          : followMutation.mutate({ username: post.user.username! })
                      }
                      disabled={followMutation.isPending || unfollowMutation.isPending}
                      className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                        post.isFollowing
                          ? "border border-gray-300 text-gray-600 hover:bg-gray-50"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {post.isFollowing ? "Following" : "Follow"}
                    </button>
                  )}
                </div>
              </div>

              {/* Image — click to open modal */}
              <button className="w-full text-left" onClick={() => setViewPost(post)}>
                <img
                  src={post.image}
                  alt={post.description ?? ""}
                  className="w-full object-cover"
                />
              </button>

              {/* Like / comment counts */}
              <div className="flex items-center gap-4 px-4 pt-3">
                <button onClick={() => setViewPost(post)} className="flex items-center gap-1.5 text-gray-500 hover:text-red-400 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                  <span className="text-sm font-medium">{post._count.likes}</span>
                </button>
                <button onClick={() => setViewPost(post)} className="flex items-center gap-1.5 text-gray-500 hover:text-blue-500 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                  <span className="text-sm font-medium">{post._count.comments}</span>
                </button>
              </div>

              {/* Caption */}
              {post.description && (
                <div className="px-4 py-2 pb-3">
                  <p className="text-sm text-gray-800">
                    <Link href={`/@${post.user.username}`} className="font-semibold text-gray-900 hover:underline mr-1">
                      @{post.user.username}
                    </Link>
                    <MentionText text={post.description} />
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
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
          onClose={() => setViewPost(null)}
          onDelete={() => {
            utils.post.getFeed.invalidate()
            setViewPost(null)
          }}
        />
      )}
    </div>
  )
}
