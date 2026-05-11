"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { trpc } from "@/components/providers"
import MentionText from "@/components/MentionText"

type Post = {
  id: string
  image: string
  title: string | null
  description: string | null
  isAiGenerated: boolean
  createdAt: Date
}

type ProfileUser = {
  username: string | null
  name: string | null
  image: string | null
}

export default function PostModal({
  post,
  profileUser,
  isOwn,
  onClose,
  onDelete,
}: {
  post: Post
  profileUser: ProfileUser
  isOwn: boolean
  onClose: () => void
  onDelete: (id: string) => void
}) {
  const { data: session } = useSession()
  const [comment, setComment] = useState("")
  const utils = trpc.useUtils()

  const { data: postData, isLoading } = trpc.interaction.getPostData.useQuery({ postId: post.id })

  const toggleLike = trpc.interaction.toggleLike.useMutation({
    onSuccess: () => utils.interaction.getPostData.invalidate({ postId: post.id }),
  })

  const addComment = trpc.interaction.addComment.useMutation({
    onSuccess: () => {
      utils.interaction.getPostData.invalidate({ postId: post.id })
      setComment("")
    },
  })

  const deleteComment = trpc.interaction.deleteComment.useMutation({
    onSuccess: () => utils.interaction.getPostData.invalidate({ postId: post.id }),
  })

  const deletePost = trpc.post.delete.useMutation({
    onSuccess: () => onDelete(post.id),
  })

  const initials = (profileUser.name ?? profileUser.username ?? "?")[0].toUpperCase()

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/70 hover:text-white text-2xl leading-none z-10">✕</button>

        <div className="bg-white rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Image */}
          <img src={post.image} alt={post.description ?? ""} className="w-full object-contain max-h-[50vh] bg-black flex-shrink-0" />

          {/* Info + comments */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <Link href={`/@${profileUser.username}`} onClick={onClose}>
                  {profileUser.image ? (
                    <img src={profileUser.image} className="w-8 h-8 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">{initials}</div>
                  )}
                </Link>
                <Link href={`/@${profileUser.username}`} onClick={onClose} className="text-sm font-semibold text-gray-900 hover:underline">
                  @{profileUser.username}
                </Link>
                {post.isAiGenerated && (
                  <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">AI</span>
                )}
              </div>
              {isOwn && (
                <button onClick={() => deletePost.mutate({ id: post.id })} disabled={deletePost.isPending}
                  className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-50">
                  {deletePost.isPending ? "Deleting…" : "Delete"}
                </button>
              )}
            </div>

            {/* Caption */}
            {post.description && (
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <p className="text-sm text-gray-800">
                  <span className="font-semibold mr-1">@{profileUser.username}</span>
                  <MentionText text={post.description} />
                </p>
              </div>
            )}

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
              {isLoading ? (
                <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
              ) : postData?.comments.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No comments yet</p>
              ) : (
                postData?.comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 py-2 group">
                    <Link href={`/@${c.user.username}`} onClick={onClose}>
                      {c.user.image ? (
                        <img src={c.user.image} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                          {(c.user.name ?? c.user.username ?? "?")[0].toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">
                        <Link href={`/@${c.user.username}`} onClick={onClose} className="font-semibold mr-1 hover:underline">@{c.user.username}</Link>
                        <MentionText text={c.text} />
                      </p>
                    </div>
                    {c.user.username === session?.user?.username && (
                      <button onClick={() => deleteComment.mutate({ id: c.id })}
                        className="text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        ✕
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Like + comment input */}
            <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0">
              {/* Like row */}
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => session && toggleLike.mutate({ postId: post.id })}
                  disabled={!session || toggleLike.isPending}
                  className="flex items-center gap-1.5 disabled:opacity-40"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill={postData?.liked ? "#ef4444" : "none"}
                    stroke={postData?.liked ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                  <span className="text-sm font-medium text-gray-700">{postData?.likeCount ?? 0}</span>
                </button>
              </div>

              {/* Comment input */}
              {session && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) addComment.mutate({ postId: post.id, text: comment.trim() }) }}
                    placeholder="Add a comment…"
                    maxLength={500}
                    className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
                  />
                  <button
                    onClick={() => { if (comment.trim()) addComment.mutate({ postId: post.id, text: comment.trim() }) }}
                    disabled={!comment.trim() || addComment.isPending}
                    className="text-sm font-semibold text-blue-500 hover:text-blue-700 disabled:opacity-40"
                  >
                    Post
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
