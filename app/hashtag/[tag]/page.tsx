"use client"

import { use, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import PostModal from "@/components/PostModal"

type Post = {
  id: string
  image: string
  title: string | null
  description: string | null
  isAiGenerated: boolean
  createdAt: Date
  _count: { likes: number; comments: number }
  user: { id: string; username: string | null; name: string | null; image: string | null }
}

export default function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: rawTag } = use(params)
  const tag = decodeURIComponent(rawTag).toLowerCase().replace(/^#/, "")

  const { data: session } = useSession()
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data: posts, isLoading } = trpc.hashtag.getPosts.useQuery({ tag })
  const [viewPost, setViewPost] = useState<Post | null>(null)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-6"
      >
        ← Back
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">#{tag}</h1>
        {posts && (
          <p className="text-sm text-white/40 mt-1">{posts.length} {posts.length === 1 ? "post" : "posts"}</p>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-white/40">Loading…</div>
      ) : !posts || posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🏷️</div>
          <p className="font-medium text-white/50">No posts yet for #{tag}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {posts.map((post) => (
            <button key={post.id} onClick={() => setViewPost(post)}
              className="relative aspect-square overflow-hidden group" style={{ background: "#ffffff08" }}>
              <img src={post.image} alt={post.description ?? ""} className="w-full h-full object-cover" />
              {post.isAiGenerated && (
                <span className="absolute top-1.5 left-1.5 text-xs font-medium bg-purple-600/80 text-white px-1.5 py-0.5 rounded-md">AI</span>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-3">
                <span className="text-white text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  ♡ {post._count.likes}
                </span>
                <span className="text-white text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  💬 {post._count.comments}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {viewPost && (
        <PostModal
          post={{ ...viewPost, pinned: false }}
          profileUser={{
            username: viewPost.user.username,
            name: viewPost.user.name,
            image: viewPost.user.image,
          }}
          isOwn={session?.user?.id === viewPost.user.id}
          onClose={() => setViewPost(null)}
          onDelete={() => {
            utils.hashtag.getPosts.invalidate({ tag })
            setViewPost(null)
          }}
        />
      )}
    </div>
  )
}
