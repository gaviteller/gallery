"use client"

import { use, useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"

const GRADIENT = "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)"

function timeAgo(date: Date | string): string {
  const d = new Date(date)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function PostDetailPage({ params }: { params: Promise<{ username: string; postId: string }> }) {
  const { postId } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const utils = trpc.useUtils()

  const { data: post, isLoading: postLoading } = trpc.post.getOne.useQuery({ id: postId })
  const { data: postData, isLoading: dataLoading } = trpc.interaction.getPostData.useQuery({ postId })

  const [commentText, setCommentText] = useState("")
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [following, setFollowing] = useState(false)

  useEffect(() => {
    if (postData) {
      setLiked(postData.liked)
      setLikeCount(postData.likeCount)
    }
  }, [postData])

  const toggleLike = trpc.interaction.toggleLike.useMutation({
    onMutate: () => {
      setLiked(p => !p)
      setLikeCount(p => liked ? p - 1 : p + 1)
    },
    onSuccess: () => utils.interaction.getPostData.invalidate({ postId }),
  })

  const addComment = trpc.interaction.addComment.useMutation({
    onSuccess: () => {
      setCommentText("")
      utils.interaction.getPostData.invalidate({ postId })
    },
  })

  const followMutation = trpc.follow.follow.useMutation({
    onSuccess: () => setFollowing(true),
  })

  if (postLoading || dataLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Loading…</p>
      </div>
    )
  }

  if (!post) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Post not found</p>
      </div>
    )
  }

  const tags = post.hashtags.map(h => h.tag)
  const comments = postData?.comments ?? []
  const isOwn = session?.user?.id === post.userId

  function handleLike() {
    if (!session) { router.push("/signin"); return }
    toggleLike.mutate({ postId })
  }

  function handleComment() {
    if (!commentText.trim()) return
    if (!session) { router.push("/signin"); return }
    addComment.mutate({ postId, text: commentText.trim() })
  }

  function handleFollow() {
    if (!session || !post?.user.username || following) return
    followMutation.mutate({ username: post.user.username })
  }

  return (
    <div style={{ maxWidth: 512, margin: "0 auto", minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>

      {/* Full-bleed art zone */}
      <div style={{ position: "relative", height: 320 }}>
        <div style={{ position: "absolute", inset: 0, background: "#241830", overflow: "hidden" }}>
          {post.image && <img src={post.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>

        {/* Top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(rgba(8,6,15,0.75), transparent)" }}>
          <button
            onClick={() => router.back()}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(240,235,248,0.85)", fontFamily: "Inter,sans-serif", fontSize: 12, display: "flex", alignItems: "center", gap: 4, padding: 0 }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: 4 }}>
            <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(240,235,248,0.6)" }} />
            <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(240,235,248,0.6)" }} />
            <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(240,235,248,0.6)" }} />
          </div>
        </div>

        {/* Bottom overlay — actions + artist row */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "28px 14px 15px", background: "linear-gradient(transparent, rgba(8,6,15,0.65) 40%, rgba(8,6,15,0.97))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 11 }}>
            <button
              onClick={handleLike}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter,sans-serif", fontSize: 14, fontWeight: 700, color: liked ? "#FF3CAC" : "rgba(240,235,248,0.65)" }}
            >
              ♥ {likeCount}
            </button>
            <span style={{ fontSize: 11, color: "rgba(240,235,248,0.65)", fontFamily: "Inter,sans-serif" }}>
              💬 {comments.length}
            </span>
            <span style={{ fontSize: 13, color: "rgba(240,235,248,0.65)", marginLeft: "auto" }}>🔖</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => router.push(`/@${post.user.username}`)}
              style={{ background: GRADIENT, borderRadius: "50%", padding: 2, display: "inline-flex", flexShrink: 0, border: "none", cursor: "pointer" }}
            >
              <div style={{ background: "#2A2040", borderRadius: "50%", overflow: "hidden", width: 30, height: 30 }}>
                <Avatar src={post.user.image} name={post.user.name} username={post.user.username} size={30} />
              </div>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 12, fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {post.user.name ?? `@${post.user.username}`}
              </div>
              <div style={{ fontFamily: "Inter,sans-serif", fontSize: 9, color: "rgba(240,235,248,0.55)", marginTop: 1 }}>
                @{post.user.username} · {timeAgo(post.createdAt)}
              </div>
            </div>
            {!isOwn && (
              <button
                onClick={handleFollow}
                disabled={following || followMutation.isPending}
                style={{ flexShrink: 0, fontSize: 9, fontWeight: 600, padding: "5px 12px", borderRadius: 7, border: "none", cursor: following ? "default" : "pointer", background: following ? "rgba(240,235,248,0.15)" : GRADIENT, color: "white", fontFamily: "Inter,sans-serif" }}
              >
                {following ? "Following" : "Follow"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comment panel */}
      <div style={{ background: "var(--surface)" }}>

        {/* Caption zone */}
        <div style={{ padding: "13px 14px 11px", borderBottom: "1px solid var(--border)" }}>
          {(post as any).title && (
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 700, color: "var(--text)", lineHeight: 1.3, marginBottom: 4 }}>
              {(post as any).title}
            </div>
          )}
          {post.description && (
            <div style={{ fontFamily: "Inter,sans-serif", fontSize: 10, color: "#9080B8", lineHeight: 1.5 }}>
              {post.description}
            </div>
          )}
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
              {tags.map(tag => (
                <span key={tag} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 99, background: "var(--bg)", color: "#9080B8", border: "1px solid var(--border)", fontFamily: "Inter,sans-serif" }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {!post.description && tags.length === 0 && (
            <div style={{ fontFamily: "Inter,sans-serif", fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>No caption</div>
          )}
        </div>

        {/* Comments zone */}
        <div style={{ padding: "11px 14px 7px" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
            Comments
          </div>
          {comments.length === 0 && (
            <p style={{ fontSize: 10, color: "var(--muted)", fontFamily: "Inter,sans-serif", padding: "2px 0 8px" }}>
              No comments yet
            </p>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 9 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--border)", flexShrink: 0, marginTop: 1, overflow: "hidden" }}>
                <Avatar src={c.user.image} name={c.user.name} username={c.user.username} size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: "var(--text)", fontFamily: "Inter,sans-serif" }}>
                  {c.user.name ?? `@${c.user.username}`}
                </div>
                <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2, lineHeight: 1.4, fontFamily: "Inter,sans-serif" }}>{c.text}</div>
                <div style={{ fontSize: 8, color: "#4A3F68", marginTop: 3, fontFamily: "Inter,sans-serif" }}>{timeAgo(c.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Comment input */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px 14px", borderTop: "1px solid var(--border)" }}>
          <div style={{ background: "linear-gradient(135deg,#FF3CAC,#784BA0,#2B86C5)", borderRadius: "50%", padding: 1.5, display: "inline-flex", flexShrink: 0 }}>
            <div style={{ background: "#2A2040", borderRadius: "50%", overflow: "hidden", width: 22, height: 22 }}>
              {session
                ? <Avatar src={session.user?.image ?? null} name={session.user?.name ?? null} username={session.user?.username ?? null} size={22} />
                : <div style={{ width: "100%", height: "100%", background: "#2A2040" }} />
              }
            </div>
          </div>
          <div style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 99, padding: "5px 10px" }}>
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleComment()}
              placeholder={session ? "Add a comment…" : "Sign in to comment"}
              onClick={() => !session && router.push("/signin")}
              readOnly={!session}
              style={{ background: "none", border: "none", outline: "none", width: "100%", fontSize: 10, color: "var(--text)", fontFamily: "Inter,sans-serif" }}
            />
          </div>
          <button
            onClick={handleComment}
            disabled={!commentText.trim() || addComment.isPending}
            style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, border: "none", cursor: commentText.trim() ? "pointer" : "default", background: "linear-gradient(135deg,#FF3CAC,#2B86C5)", opacity: commentText.trim() ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
