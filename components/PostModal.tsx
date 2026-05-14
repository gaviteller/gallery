"use client"

import { useState, useEffect, useRef } from "react"
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
  pinned: boolean
}

type ProfileUser = {
  username: string | null
  name: string | null
  image: string | null
}

function Avatar({ image, name, username, size = 8 }: { image?: string | null; name?: string | null; username?: string | null; size?: number }) {
  if (image) return <img src={image} className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} alt="" />
  return (
    <div className={`w-${size} h-${size} rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0`}>
      {(name ?? username ?? "?")[0].toUpperCase()}
    </div>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24"
      fill={filled ? "#ef4444" : "none"}
      stroke={filled ? "#ef4444" : "currentColor"}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  )
}

type CommentData = {
  id: string
  text: string
  createdAt: Date
  parentId: string | null
  likedByMe: boolean
  user: { username: string | null; name: string | null; image: string | null }
  _count: { likes: number; replies: number }
  replies?: Omit<CommentData, "replies">[]
}

function CommentRow({
  comment,
  postId,
  sessionUsername,
  onClose,
  onReply,
  onDelete,
  onToggleLike,
  isReply = false,
}: {
  comment: CommentData
  postId: string
  sessionUsername?: string | null
  onClose: () => void
  onReply: (commentId: string, username: string) => void
  onDelete: (id: string) => void
  onToggleLike: (id: string) => void
  isReply?: boolean
}) {
  return (
    <div className={`flex items-start gap-2 py-1.5 group ${isReply ? "pl-8" : ""}`}>
      <Link href={`/@${comment.user.username}`} onClick={onClose}>
        <Avatar image={comment.user.image} name={comment.user.name} username={comment.user.username} size={isReply ? 6 : 7} />
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 leading-snug">
          <Link href={`/@${comment.user.username}`} onClick={onClose} className="font-semibold mr-1 hover:underline">
            @{comment.user.username}
          </Link>
          <MentionText text={comment.text} />
        </p>
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={() => onToggleLike(comment.id)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            <HeartIcon filled={comment.likedByMe} />
            {comment._count.likes > 0 && <span>{comment._count.likes}</span>}
          </button>
          {!isReply && (
            <button
              onClick={() => onReply(comment.id, comment.user.username ?? "")}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors font-medium"
            >
              Reply
            </button>
          )}
          {comment.user.username === sessionUsername && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PostModal({
  post,
  profileUser,
  isOwn,
  onClose,
  onDelete,
  onPinToggle,
  autoFocusComment = false,
}: {
  post: Post
  profileUser: ProfileUser
  isOwn: boolean
  onClose: () => void
  onDelete: (id: string) => void
  onPinToggle?: () => void
  autoFocusComment?: boolean
}) {
  const { data: session } = useSession()
  const [comment, setComment] = useState("")
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null)
  const commentInputRef = useRef<HTMLInputElement>(null)
  const utils = trpc.useUtils()

  useEffect(() => {
    if (autoFocusComment) {
      setTimeout(() => commentInputRef.current?.focus(), 100)
    }
  }, [autoFocusComment])

  const { data: postData, isLoading } = trpc.interaction.getPostData.useQuery({ postId: post.id })

  const invalidate = () => utils.interaction.getPostData.invalidate({ postId: post.id })

  const toggleLike = trpc.interaction.toggleLike.useMutation({ onSuccess: invalidate })
  const toggleCommentLike = trpc.interaction.toggleCommentLike.useMutation({ onSuccess: invalidate })

  const addComment = trpc.interaction.addComment.useMutation({
    onSuccess: () => { invalidate(); setComment(""); setReplyTo(null) },
  })

  const deleteComment = trpc.interaction.deleteComment.useMutation({ onSuccess: invalidate })
  const deletePost = trpc.post.delete.useMutation({ onSuccess: () => onDelete(post.id) })
  const pinPost = trpc.post.pin.useMutation({ onSuccess: () => onPinToggle?.() })
  const unpinPost = trpc.post.unpin.useMutation({ onSuccess: () => onPinToggle?.() })

  function submitComment() {
    const text = comment.trim()
    if (!text) return
    addComment.mutate({ postId: post.id, text, parentId: replyTo?.id })
  }

  const initials = (profileUser.name ?? profileUser.username ?? "?")[0].toUpperCase()

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/70 hover:text-white text-2xl leading-none z-10">✕</button>

        <div className="bg-white rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Image */}
          <img src={post.image} alt={post.description ?? ""} className="w-full object-contain max-h-[50vh] bg-black flex-shrink-0" />

          <div className="flex flex-col flex-1 min-h-0">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <Link href={`/@${profileUser.username}`} onClick={onClose}>
                  <Avatar image={profileUser.image} name={profileUser.name} username={profileUser.username} size={8} />
                </Link>
                <Link href={`/@${profileUser.username}`} onClick={onClose} className="text-sm font-semibold text-gray-900 hover:underline">
                  @{profileUser.username}
                </Link>
                {post.isAiGenerated && (
                  <span className="text-xs font-medium bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">AI</span>
                )}
              </div>
              {isOwn && (
                <div className="flex items-center gap-3">
                  {onPinToggle && (
                    <button
                      onClick={() => post.pinned
                        ? unpinPost.mutate({ id: post.id })
                        : pinPost.mutate({ id: post.id })
                      }
                      disabled={pinPost.isPending || unpinPost.isPending}
                      className="text-xs text-gray-500 hover:text-gray-800 font-medium disabled:opacity-50 px-2 py-1 rounded-lg transition-colors bg-gray-100 hover:bg-gray-200"
                    >
                      {pinPost.isPending || unpinPost.isPending
                        ? "…"
                        : post.pinned ? "Unpin" : "Pin"}
                    </button>
                  )}
                  <button onClick={() => deletePost.mutate({ id: post.id })} disabled={deletePost.isPending}
                    className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-50">
                    {deletePost.isPending ? "Deleting…" : "Delete"}
                  </button>
                </div>
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
              ) : !postData?.comments.length ? (
                <p className="text-xs text-gray-400 text-center py-4">No comments yet</p>
              ) : (
                postData.comments.map((c) => (
                  <div key={c.id}>
                    <CommentRow
                      comment={c}
                      postId={post.id}
                      sessionUsername={session?.user?.username}
                      onClose={onClose}
                      onReply={(id, username) => setReplyTo({ id, username })}
                      onDelete={(id) => deleteComment.mutate({ id })}
                      onToggleLike={(id) => session && toggleCommentLike.mutate({ commentId: id })}
                    />
                    {c.replies?.map((r) => (
                      <CommentRow
                        key={r.id}
                        comment={r as CommentData}
                        postId={post.id}
                        sessionUsername={session?.user?.username}
                        onClose={onClose}
                        onReply={() => {}}
                        onDelete={(id) => deleteComment.mutate({ id })}
                        onToggleLike={(id) => session && toggleCommentLike.mutate({ commentId: id })}
                        isReply
                      />
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Like row + comment input */}
            <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0">
              {/* Like */}
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => session && toggleLike.mutate({ postId: post.id })}
                  disabled={!session || toggleLike.isPending}
                  className="flex items-center gap-1.5 disabled:opacity-40"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24"
                    fill={postData?.liked ? "#ef4444" : "none"}
                    stroke={postData?.liked ? "#ef4444" : "currentColor"}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                  <span className="text-sm font-medium text-gray-700">{postData?.likeCount ?? 0}</span>
                </button>
              </div>

              {/* Reply indicator */}
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5">
                  <span>Replying to <span className="font-semibold">@{replyTo.username}</span></span>
                  <button onClick={() => setReplyTo(null)} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}

              {/* Comment input */}
              {session && (
                <>
                  {addComment.error && (
                    <p className="text-xs text-red-500 mb-1">{addComment.error.message}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") submitComment() }}
                      placeholder={replyTo ? `Reply to @${replyTo.username}…` : "Add a comment…"}
                      maxLength={500}
                      className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
                      ref={commentInputRef}
                    />
                    <button
                      onClick={submitComment}
                      disabled={!comment.trim() || addComment.isPending}
                      className="text-sm font-semibold text-blue-500 hover:text-blue-700 disabled:opacity-40"
                    >
                      {addComment.isPending ? "…" : replyTo ? "Reply" : "Post"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
