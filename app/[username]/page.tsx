"use client"

import { useState, use, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/components/providers"
import PostModal from "@/components/PostModal"
import ReportModal from "@/components/ReportModal"
import CommissionRequestModal from "@/components/CommissionRequestModal"
import StoryViewer from "@/components/StoryViewer"
import StoryUpload from "@/components/StoryUpload"
import ImageCropEditor from "@/components/ImageCropEditor"
import ShopListingModal from "@/components/ShopListingModal"
import { TIER_LABELS, TIER_COLORS } from "@/server/lib/trustScore"
import { applyWatermark } from "@/lib/watermark"
import { uploadImage as uploadToCloudinary } from "@/lib/upload"

const CANCEL_RATE_WARNING_THRESHOLD = 20

type PostItem = {
  id: string
  image: string
  title: string | null
  description: string | null
  isAiGenerated: boolean
  isCommission: boolean
  pinned: boolean
  createdAt: Date
  status: string
  removedAt?: string | Date | null
  removalReason?: string | null
}

function processImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
          else { width = Math.round((width * maxSize) / height); height = maxSize }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width; canvas.height = height
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.9))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  return String(n)
}

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username: rawUsername } = use(params)
  const decoded = decodeURIComponent(rawUsername)
  const username = decoded.startsWith("@") ? decoded.slice(1) : decoded

  const { data: session } = useSession()
  const router = useRouter()
  const { data: profileUser, isLoading: userLoading } = trpc.user.getByUsername.useQuery({ username })
  const { data: posts, isLoading: postsLoading } = trpc.post.getByUsername.useQuery({ username, viewerUserId: session?.user?.id })
  const { data: commissions, isLoading: commissionsLoading } = trpc.post.getCommissionsByUsername.useQuery({ username })
  const { data: shopItems, isLoading: shopLoading } = trpc.shop.getByUsername.useQuery({ username })
  const { data: commissionProfile } = trpc.commission.getProfile.useQuery({ username })
  const { data: trustScore } = trpc.commission.getTrustScore.useQuery({ username })
  const { data: approvedWork } = trpc.commission.getApprovedWork.useQuery({ username })
  const { data: commissionCategories } = trpc.commission.getCategories.useQuery({ username })
  const { data: followStatus, refetch: refetchFollow } = trpc.follow.status.useQuery(
    { username },
    { enabled: !!profileUser }
  )
  const { data: mutualData } = trpc.follow.mutuals.useQuery(
    { username },
    { enabled: !!profileUser && !!session && session.user.id !== profileUser?.id }
  )
  const followMutation = trpc.follow.follow.useMutation({ onSuccess: () => refetchFollow() })
  const unfollowMutation = trpc.follow.unfollow.useMutation({ onSuccess: () => refetchFollow() })
  const { data: blockStatus, refetch: refetchBlock } = trpc.block.status.useQuery(
    { username },
    { enabled: !!profileUser && !!session && session?.user?.id !== profileUser?.id }
  )
  const blockToggle = trpc.block.toggle.useMutation({
    onSuccess: (data) => {
      refetchBlock()
      if (data.blocked) router.push("/")
    },
  })
  const utils = trpc.useUtils()
  const { data: userStories = [] } = trpc.story.getByUsername.useQuery({ username })

  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [tab, setTab] = useState("Posts")
  const [viewPost, setViewPost] = useState<PostItem | null>(null)
  const [reportingPostId, setReportingPostId] = useState<string | null>(null)
  const [localReported, setLocalReported] = useState<Set<string>>(new Set())
  const [showCommissionRequest, setShowCommissionRequest] = useState(false)
  const [showMutuals, setShowMutuals] = useState(false)
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false)
  const [viewingStory, setViewingStory] = useState(false)
  const [addingStory, setAddingStory] = useState(false)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [showShopModal, setShowShopModal] = useState(false)

  const [showUpload, setShowUpload] = useState(false)
  const [rawImage, setRawImage] = useState<string | null>(null)
  const [uploadImage, setUploadImage] = useState<string | null>(null)
  const [uploadDesc, setUploadDesc] = useState("")
  const [uploadIsAi, setUploadIsAi] = useState(false)
  const [uploadIsCommission, setUploadIsCommission] = useState(false)
  const [imgProcessing, setImgProcessing] = useState(false)
  const [postUploadError, setPostUploadError] = useState<string | null>(null)
  const [isWatermarking, setIsWatermarking] = useState(false)
  const [isUploadingPost, setIsUploadingPost] = useState(false)

  const getOrCreateDM = trpc.dm.getOrCreate.useMutation({
    onSuccess: (convo) => router.push(`/messages/${convo.id}`),
  })

  const createPost = trpc.post.create.useMutation({
    onSuccess: () => {
      utils.post.getByUsername.invalidate({ username })
      utils.post.getCommissionsByUsername.invalidate({ username })
      setShowUpload(false)
      setRawImage(null)
      setUploadImage(null)
      setUploadDesc("")
      setUploadIsAi(false)
      setUploadIsCommission(false)
      setPostUploadError(null)
    },
  })

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImgProcessing(true)
    const result = await processImage(file, 1200)
    setRawImage(result)
    setImgProcessing(false)
  }

  useEffect(() => { setShowScoreBreakdown(false) }, [username])
  useEffect(() => {
    function handleClick() { setMoreMenuOpen(false) }
    if (moreMenuOpen) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [moreMenuOpen])

  const deleteShopItem = trpc.shop.delete.useMutation({
    onSuccess: () => utils.shop.getByUsername.invalidate({ username }),
  })

  if (userLoading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>Loading…</div>
  }

  if (!profileUser) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>User not found</div>
  }

  const isOwn = session?.user?.id === profileUser.id

  const galleryImages: { src: string; key: string }[] = [
    ...(approvedWork ?? []).map(w => ({ src: w.fileUrl, key: `approved-${w.commissionId}` })),
    ...(commissionProfile?.commissionCardImages ?? []).map(img => ({ src: img, key: `manual-${img}` })),
  ]

  const initials = (profileUser.name ?? profileUser.username ?? "?")
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)

  const pu = profileUser as any

  return (
    <>
      {showCommissionRequest && commissionProfile && commissionCategories && (
        <CommissionRequestModal
          artistId={commissionProfile.id}
          artistUsername={username}
          categories={commissionCategories}
          onClose={() => setShowCommissionRequest(false)}
        />
      )}

      {showMutuals && !isOwn && mutualData && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowMutuals(false)}>
          <div style={{ width: "100%", maxWidth: 480, borderRadius: "16px 16px 0 0", paddingBottom: 32, background: "var(--surface)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(240,235,248,0.07)" }} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", padding: "0 16px 12px", borderBottom: "1px solid var(--border)" }}>
              Mutual followers
            </p>
            <div style={{ maxHeight: 288, overflowY: "auto" }}>
              {mutualData.users.map(u => (
                <button key={u.id} onClick={() => { setShowMutuals(false); router.push(`/@${u.username}`) }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  {u.image
                    ? <img src={u.image} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} alt="" />
                    : <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, flexShrink: 0 }}>{(u.name ?? u.username ?? "?")[0].toUpperCase()}</div>
                  }
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>@{u.username}</p>
                    {u.name && <p style={{ fontSize: 11, color: "var(--muted)" }}>{u.name}</p>}
                  </div>
                </button>
              ))}
              {mutualData.users.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: "24px 0" }}>No mutual followers</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Profile ─────────────────────────────────────────────── */}
      <div style={{ width: "100%", paddingBottom: "5rem" }}>

        {/* Banner + overlapping avatar/buttons row */}
        <div style={{ position: "relative", overflow: "visible" }}>
          <div style={{
            width: "100%", height: 120,
            background: pu.bannerImage ? undefined : "linear-gradient(135deg, #241E30, #1E2838)",
          }}>
            {pu.bannerImage && (
              <img src={pu.bannerImage} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt="" />
            )}
          </div>

          {/* Avatar + action row overlapping bottom of banner */}
          <div style={{ position: "absolute", bottom: -32, left: 16, right: 16, display: "flex", alignItems: "flex-end", justifyContent: "space-between", zIndex: 2 }}>
            {/* Avatar */}
            <button
              onClick={() => {
                if (isOwn) setAddingStory(true)
                else if (userStories.length > 0) setViewingStory(true)
              }}
              style={{ cursor: isOwn || userStories.length > 0 ? "pointer" : "default", background: "none", border: "none", padding: 0 }}
            >
              <div style={{
                padding: 3,
                background: "linear-gradient(135deg, #FF3CAC, #784BA0, #2B86C5)",
                borderRadius: "50%",
                opacity: userStories.length > 0 || isOwn ? 1 : 0.5,
              }}>
                <div style={{ padding: 2.5, background: "var(--bg)", borderRadius: "50%" }}>
                  {profileUser.image ? (
                    <img src={profileUser.image} alt={profileUser.name ?? profileUser.username ?? ""}
                      style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(135deg, #FF3CAC, #784BA0, #2B86C5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 24, fontWeight: 700 }}>
                      {initials}
                    </div>
                  )}
                </div>
              </div>
            </button>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, paddingBottom: 6 }}>
              {isOwn ? (
                <>
                  <Link href="/settings" style={{ fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--muted)", background: "var(--surface)", textDecoration: "none" }}>
                    Edit profile
                  </Link>
                  <button onClick={() => setAddingStory(true)} style={{ fontSize: 12, fontWeight: 700, padding: "8px 12px", borderRadius: 10, background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", color: "white", border: "none", cursor: "pointer" }}>
                    + Story
                  </button>
                </>
              ) : session && (
                <>
                  <button
                    onClick={() => followStatus?.following ? unfollowMutation.mutate({ username }) : followMutation.mutate({ username })}
                    disabled={followMutation.isPending || unfollowMutation.isPending}
                    style={{ padding: "8px 20px", borderRadius: 10, fontWeight: 600, fontSize: 12, color: "white", background: followStatus?.following ? "rgba(240,235,248,0.08)" : "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", border: followStatus?.following ? "1px solid var(--border)" : "none", cursor: "pointer" }}
                  >
                    {followMutation.isPending || unfollowMutation.isPending ? "…" : followStatus?.following ? "Following" : "Follow"}
                  </button>
                  <button
                    onClick={() => getOrCreateDM.mutate({ otherUserId: profileUser.id })}
                    disabled={getOrCreateDM.isPending}
                    style={{ padding: "8px 14px", borderRadius: 10, fontWeight: 500, fontSize: 12, color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer" }}
                  >
                    {getOrCreateDM.isPending ? "…" : "Message"}
                  </button>
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setMoreMenuOpen(v => !v)}
                      style={{ padding: "8px 10px", borderRadius: 10, fontWeight: 600, fontSize: 13, color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", lineHeight: 1 }}
                      aria-label="More options"
                    >
                      ···
                    </button>
                    {moreMenuOpen && (
                      <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", minWidth: 180, zIndex: 50 }}>
                        <button
                          onClick={() => {
                            setMoreMenuOpen(false)
                            if (confirm(blockStatus?.blocked ? `Unblock @${username}?` : `Block @${username}? They won't be able to see your profile or posts.`)) {
                              blockToggle.mutate({ username })
                            }
                          }}
                          disabled={blockToggle.isPending}
                          style={{ width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 13, color: blockStatus?.blocked ? "var(--muted)" : "#ef4444", background: "none", border: "none", cursor: "pointer", display: "block" }}
                        >
                          {blockStatus?.blocked ? `Unblock @${username}` : `Block @${username}`}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Profile header */}
        <div style={{ padding: "48px 16px 16px", borderBottom: "1px solid var(--border)" }}>
          {/* Name + PRO badge */}
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>
            {profileUser.name ?? `@${profileUser.username}`}
            {pu.sellingEnabled && (
              <span style={{ display: "inline-block", fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, marginLeft: 7, letterSpacing: "0.05em", background: "linear-gradient(90deg, #FF3CAC, #784BA0)", color: "white", verticalAlign: "middle" }}>
                PRO
              </span>
            )}
          </div>
          {/* Handle */}
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
            @{profileUser.username}
            {commissionProfile && commissionProfile.commissionStatus !== "CLOSED" && " · Artist"}
          </div>
          {/* Bio */}
          {profileUser.bio && (
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#9080B8", marginTop: 8, lineHeight: 1.5 }}>
              {profileUser.bio}
            </div>
          )}
          {/* Website */}
          {pu.websiteUrl && (
            <div style={{ marginTop: 6, fontFamily: "Inter, sans-serif", fontSize: 12, color: "#784BA0" }}>
              🔗 {pu.websiteUrl}
            </div>
          )}
          {/* Mutual followers link */}
          {!isOwn && mutualData && mutualData.count > 0 && (
            <button onClick={() => setShowMutuals(true)} style={{ marginTop: 6, fontSize: 12, color: "#2B86C5", background: "none", border: "none", cursor: "pointer", padding: 0, display: "block" }}>
              {mutualData.count} mutual follower{mutualData.count !== 1 ? "s" : ""}
            </button>
          )}

          {/* Stats bar */}
          <div style={{ display: "flex", marginTop: 14 }}>
            {[
              { n: formatCount(followStatus?.followerCount ?? 0), label: "Followers" },
              { n: formatCount(followStatus?.followingCount ?? 0), label: "Following" },
              { n: String(posts?.length ?? 0), label: "Posts" },
              ...(trustScore && trustScore.finalScore !== null ? [{ n: trustScore.finalScore.toFixed(1), label: "Rating" }] : []),
            ].map((stat, i, arr) => (
              <div key={stat.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none", padding: "6px 0" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{stat.n}</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "var(--muted)", marginTop: 2, letterSpacing: "0.05em", textTransform: "uppercase" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs — gradient underline on active */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {(["Posts", "Shop", "Commissions", "About"] as const)
            .filter(t => {
              if (isOwn) return true
              if (t === "Shop" && (!shopItems || shopItems.length === 0)) return false
              if (t === "Commissions" && commissionProfile?.commissionStatus === "CLOSED") return false
              return true
            })
            .map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{ flex: 1, padding: "12px 4px 14px", textAlign: "center", fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 500, color: tab === t ? "var(--text)" : "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", position: "relative" }}
              >
                {t}
                {tab === t && <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #FF3CAC, #2B86C5)" }} />}
              </button>
            ))}
        </div>

        {/* + New dropdown for own profile */}
        {isOwn && (
          <div style={{ padding: "10px 14px 0", display: "flex", justifyContent: "flex-end", position: "relative" }}>
            {showNewMenu && (
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowNewMenu(false)} />
            )}
            <button
              onClick={() => setShowNewMenu(v => !v)}
              style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", color: "white", fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", position: "relative", zIndex: 41 }}
            >
              + New
            </button>
            {showNewMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", minWidth: 160, zIndex: 50 }}>
                {([
                  { label: "Post", action: () => { setShowUpload(true); setShowNewMenu(false) } },
                  { label: "Story", action: () => { setAddingStory(true); setShowNewMenu(false) } },
                  { label: "Commission", action: () => { setUploadIsCommission(true); setShowUpload(true); setShowNewMenu(false) } },
                  { label: "Shop listing", action: () => { setShowShopModal(true); setShowNewMenu(false) } },
                ] as { label: string; action: () => void }[]).map(item => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{ width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 12, color: "var(--text)", background: "none", border: "none", cursor: "pointer", display: "block" }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab content */}
        <div style={{ padding: "14px 14px 0" }}>

          {/* ── Posts tab ─────────────────────────────────────────── */}
          {tab === "Posts" && (
            <>
              {postsLoading ? (
                <div style={{ textAlign: "center", padding: "64px 0", color: "var(--muted)" }}>Loading…</div>
              ) : posts && posts.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, margin: "0 -14px" }}>
                  {posts.map((post) => (
                    <div key={post.id} style={{ position: "relative" }}>
                      <Link
                        href={(post as PostItem).status === "REMOVED" ? "#" : `/@${username}/${post.id}`}
                        style={{ position: "relative", aspectRatio: "1", overflow: "hidden", width: "100%", borderRadius: 0, display: "block", background: "var(--border)" }}
                        onClick={(e) => { if ((post as PostItem).status === "REMOVED") e.preventDefault() }}
                      >
                        <img src={post.image} alt={post.description ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        <div style={{ position: "absolute", top: 5, left: 5, display: "flex", gap: 3 }}>
                          {post.isAiGenerated && (
                            <span style={{ fontSize: 9, fontWeight: 600, background: "rgba(120,75,160,0.8)", color: "white", padding: "1px 5px", borderRadius: 4 }}>AI</span>
                          )}
                          {(post as PostItem).isCommission && (
                            <span style={{ fontSize: 9, fontWeight: 600, background: "rgba(43,134,197,0.8)", color: "white", padding: "1px 5px", borderRadius: 4 }}>Comm</span>
                          )}
                        </div>
                        {isOwn && (post as PostItem).pinned && (
                          <div style={{ position: "absolute", top: 5, right: 5 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>
                              <path d="M16 12V4h1a1 1 0 000-2H7a1 1 0 000 2h1v8l-2 2v2h5v5l1 1 1-1v-5h5v-2l-2-2z"/>
                            </svg>
                          </div>
                        )}
                        {(post as PostItem).status === "PENDING_REVIEW" && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}>
                            <span style={{ background: "#854d0e", color: "#fef08a", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "1px solid #a16207" }}>Under Review</span>
                          </div>
                        )}
                        {isOwn && (post as PostItem).status === "REMOVED" && (
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6px 4px", gap: 4 }}>
                            <span style={{ color: "#f87171", fontSize: 9, fontWeight: 700, textAlign: "center" }}>Removed</span>
                            {(post as PostItem).removalReason && (
                              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 7, textAlign: "center", lineHeight: 1.3, wordBreak: "break-word", maxWidth: "90%" }}>{(post as PostItem).removalReason}</span>
                            )}
                            <a href={`/appeal?postId=${post.id}`} onClick={e => e.stopPropagation()} style={{ color: "#a78bfa", fontSize: 8, fontWeight: 600, textDecoration: "underline" }}>Appeal →</a>
                          </div>
                        )}
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "64px 0" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🖼️</div>
                  <p style={{ fontWeight: 500, color: "var(--muted)" }}>No posts yet</p>
                  {isOwn && <p style={{ fontSize: 11, marginTop: 4, color: "var(--muted)" }}>Share your first piece of art</p>}
                </div>
              )}
            </>
          )}

          {/* ── Shop tab ──────────────────────────────────────────── */}
          {tab === "Shop" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <Link href={`/@${profileUser.username}/shop`} style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none" }}>
                  Browse all →
                </Link>
                {isOwn && (
                  <Link href={`/@${profileUser.username}/shop/new`} style={{ fontSize: 11, fontWeight: 500, padding: "6px 12px", borderRadius: 10, background: "rgba(120,75,160,0.15)", color: "#784BA0", border: "1px solid rgba(120,75,160,0.3)", textDecoration: "none" }}>
                    + Add listing
                  </Link>
                )}
              </div>
              {shopLoading ? (
                <div style={{ textAlign: "center", padding: "64px 0", color: "var(--muted)" }}>Loading…</div>
              ) : shopItems && shopItems.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {shopItems.map(item => (
                    <div key={item.id} style={{ borderRadius: 16, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div style={{ aspectRatio: "1", overflow: "hidden" }}>
                        <img src={item.image} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <p style={{ fontSize: 10, color: "var(--muted)" }}>@{profileUser.username}</p>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>${item.price.toFixed(2)}</span>
                        </div>
                        {isOwn ? (
                          <button onClick={() => deleteShopItem.mutate({ id: item.id })} disabled={deleteShopItem.isPending} style={{ fontSize: 10, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
                            Remove
                          </button>
                        ) : (
                          <Link href={`/@${profileUser.username}/shop/${item.id}`} style={{ fontSize: 10, fontWeight: 500, padding: "5px 10px", borderRadius: 8, background: "rgba(120,75,160,0.15)", color: "#784BA0", border: "1px solid rgba(120,75,160,0.3)", textDecoration: "none" }}>
                            View
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "64px 0" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🛍️</div>
                  <p style={{ fontWeight: 500, color: "var(--muted)" }}>No items for sale yet</p>
                  {isOwn && <p style={{ fontSize: 11, marginTop: 4, color: "var(--muted)" }}>Add prints, stickers, or other work</p>}
                </div>
              )}
            </>
          )}

          {/* ── Commissions tab ───────────────────────────────────── */}
          {tab === "Commissions" && (
            <>
              {!commissionProfile ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>Loading…</div>
              ) : (
                <>
                  <div style={{ borderRadius: 16, padding: 16, marginBottom: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
                    {trustScore && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Trust Score</span>
                        <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: "rgba(240,235,248,0.06)", display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: TIER_COLORS[trustScore.tier], display: "inline-block" }} />
                          <span style={{ color: TIER_COLORS[trustScore.tier], fontWeight: 700 }}>{TIER_LABELS[trustScore.tier]}</span>
                          {trustScore.finalScore !== null && <span style={{ color: "var(--muted)" }}>{trustScore.finalScore.toFixed(1)}</span>}
                        </span>
                      </div>
                    )}
                    {commissionProfile.commissionDescription && (
                      <p style={{ fontSize: 12, color: "rgba(240,235,248,0.7)", marginBottom: 14, lineHeight: 1.6 }}>{commissionProfile.commissionDescription}</p>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
                      {commissionProfile.commissionTurnaround && (
                        <div>
                          <p style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2 }}>Turnaround</p>
                          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{commissionProfile.commissionTurnaround}</p>
                        </div>
                      )}
                      {commissionProfile.priceRanges && (() => {
                        const ranges = commissionProfile.priceRanges as { label: string; price: number }[]
                        return ranges.length > 0 && (
                          <div>
                            <p style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>Price ranges</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {ranges.map(r => (
                                <span key={r.label + r.price} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, color: "rgba(240,235,248,0.7)", background: "rgba(240,235,248,0.06)" }}>
                                  {r.label} — ${r.price}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                    {!isOwn && commissionProfile.commissionStatus !== "CLOSED" && (
                      <button
                        onClick={() => setShowCommissionRequest(true)}
                        style={{ width: "100%", padding: "10px 0", color: "white", borderRadius: 12, fontSize: 12, fontWeight: 600, background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", border: "none", cursor: "pointer" }}
                      >
                        Request Commission
                      </button>
                    )}
                  </div>
                  {galleryImages.length > 0 ? (
                    <>
                      <p style={{ fontSize: 10, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Example work</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
                        {galleryImages.map(({ src, key }) => (
                          <div key={key} style={{ aspectRatio: "1", overflow: "hidden", background: "rgba(240,235,248,0.04)" }}>
                            <img src={src} alt="Example work" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", padding: "48px 0" }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>🎨</div>
                      <p style={{ fontWeight: 500, color: "var(--muted)" }}>No example work yet</p>
                      {isOwn && <p style={{ fontSize: 11, marginTop: 4, color: "var(--muted)" }}>Add images in your Artist Dashboard</p>}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── About tab ─────────────────────────────────────────── */}
          {tab === "About" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 20 }}>
              {commissionProfile && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 7 }}>Commission status</p>
                  <span style={{
                    display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                    ...(commissionProfile.commissionStatus === "OPEN"
                      ? { background: "rgba(72,200,120,0.15)", color: "#48C878" }
                      : commissionProfile.commissionStatus === "LIMITED"
                        ? { background: "rgba(251,191,36,0.15)", color: "#FBBF24" }
                        : { background: "rgba(240,235,248,0.06)", color: "var(--muted)" })
                  }}>
                    {({ OPEN: "Open for commissions", LIMITED: "Limited slots", CLOSED: "Closed for commissions" } as Record<string, string>)[commissionProfile.commissionStatus] ?? "Closed for commissions"}
                  </span>
                </div>
              )}
              {profileUser.bio && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 5 }}>Bio</p>
                  <p style={{ fontSize: 12, color: "rgba(240,235,248,0.7)", lineHeight: 1.6 }}>{profileUser.bio}</p>
                </div>
              )}
              {(pu.websiteUrl || pu.twitterHandle || pu.instagramHandle || pu.artstationHandle) && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 7 }}>Links</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pu.websiteUrl && (
                      <a href={pu.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#2B86C5", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>🌐 {pu.websiteUrl}</a>
                    )}
                    {pu.twitterHandle && (
                      <a href={`https://x.com/${pu.twitterHandle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#2B86C5", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>𝕏 {pu.twitterHandle}</a>
                    )}
                    {pu.instagramHandle && (
                      <a href={`https://instagram.com/${pu.instagramHandle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#2B86C5", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>📸 {pu.instagramHandle}</a>
                    )}
                    {pu.artstationHandle && (
                      <a href={`https://artstation.com/${pu.artstationHandle}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#2B86C5", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>🎨 ArtStation — {pu.artstationHandle}</a>
                    )}
                  </div>
                </div>
              )}
              {isOwn && (
                <Link href="/settings" style={{ fontSize: 12, color: "#2B86C5", textDecoration: "none" }}>Edit profile →</Link>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── New post modal ────────────────────────────────────── */}
      {showUpload && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ borderRadius: 16, width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 14, padding: 24, maxHeight: "90vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{uploadIsCommission ? "New commission post" : "New post"}</h2>
              <button onClick={() => { setShowUpload(false); setRawImage(null); setUploadImage(null); setUploadDesc(""); setUploadIsAi(false); setUploadIsCommission(false); setPostUploadError(null) }}
                style={{ color: "var(--muted)", fontSize: 20, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>

            {rawImage && !uploadImage ? (
              <ImageCropEditor
                src={rawImage}
                onConfirm={(cropped) => { setUploadImage(cropped); setRawImage(null) }}
                onCancel={() => setRawImage(null)}
              />
            ) : uploadImage ? (
              <div style={{ position: "relative" }}>
                <img src={uploadImage} alt="Preview" style={{ width: "100%", borderRadius: 12, aspectRatio: "1/1", objectFit: "cover" }} />
                <button onClick={() => setUploadImage(null)}
                  style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", color: "white", fontSize: 10, padding: "4px 8px", borderRadius: 8, border: "none", cursor: "pointer" }}>
                  Change
                </button>
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 12, height: 192, cursor: "pointer", border: "2px dashed var(--border)" }}>
                <span style={{ fontSize: 32, marginBottom: 8 }}>🖼️</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{imgProcessing ? "Processing…" : "Click to choose image"}</span>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageFile} disabled={imgProcessing} />
              </label>
            )}

            {!rawImage && <textarea value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="Write a caption…" maxLength={500} rows={3}
              style={{ width: "100%", borderRadius: 12, padding: "8px 12px", fontSize: 13, color: "var(--text)", background: "rgba(240,235,248,0.07)", border: "1px solid var(--border)", resize: "none", outline: "none" }} />}

            {!rawImage && [
              { label: "AI generated", sub: "Let others know this was made with AI", value: uploadIsAi, set: setUploadIsAi },
              { label: "This is a commission", sub: "Show in your Commissions tab", value: uploadIsCommission, set: setUploadIsCommission },
            ].map(({ label, sub, value, set }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{label}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</p>
                </div>
                <button
                  onClick={() => set((v: boolean) => !v)}
                  style={{ position: "relative", display: "inline-flex", height: 24, width: 44, alignItems: "center", borderRadius: 12, background: value ? "#7C3AED" : "rgba(240,235,248,0.2)", border: "none", cursor: "pointer", flexShrink: 0 }}
                  role="switch" aria-checked={value}
                >
                  <span style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "white", transition: "transform 0.2s", transform: value ? "translateX(24px)" : "translateX(4px)" }} />
                </button>
              </div>
            ))}

            {!rawImage && createPost.error && <p style={{ fontSize: 12, color: "#f87171" }}>{createPost.error.message}</p>}
            {!rawImage && postUploadError && <p style={{ fontSize: 12, color: "#f87171" }}>{postUploadError}</p>}

            {!rawImage && <button
              onClick={async () => {
                if (!uploadImage) return
                setPostUploadError(null)
                setIsUploadingPost(true)
                try {
                  const imageToPost = uploadImage
                  setIsWatermarking(true)
                  try {
                    const watermarked = await applyWatermark(imageToPost, session?.user?.username ?? "gallery")
                    const url = await uploadToCloudinary(watermarked, "posts")
                    createPost.mutate({ image: url, description: uploadDesc.trim() || undefined, isAiGenerated: uploadIsAi, isCommission: uploadIsCommission })
                  } catch (err) {
                    console.warn("[watermark/upload] failed, posting without watermark/cloudinary", err)
                    try {
                      const url = await uploadToCloudinary(imageToPost, "posts")
                      createPost.mutate({ image: url, description: uploadDesc.trim() || undefined, isAiGenerated: uploadIsAi, isCommission: uploadIsCommission })
                    } catch (uploadErr) {
                      console.error("[post] cloudinary upload failed:", uploadErr)
                      setPostUploadError("Failed to upload image. Please try again.")
                    } finally {
                      setIsWatermarking(false)
                    }
                    return
                  } finally {
                    setIsWatermarking(false)
                  }
                } finally {
                  setIsUploadingPost(false)
                }
              }}
              disabled={createPost.isPending || !uploadImage || imgProcessing || isWatermarking || isUploadingPost}
              style={{ width: "100%", padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "white", background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", border: "none", cursor: "pointer", opacity: createPost.isPending || !uploadImage || imgProcessing || isWatermarking || isUploadingPost ? 0.5 : 1 }}
            >
              {createPost.isPending || isWatermarking || isUploadingPost ? (isUploadingPost ? "Uploading…" : "Posting…") : "Share"}
            </button>}
          </div>
        </div>
      )}

      {viewingStory && userStories.length > 0 && (
        <StoryViewer
          user={{
            userId: profileUser.id,
            username: profileUser.username,
            name: profileUser.name,
            image: profileUser.image,
            stories: userStories,
          }}
          onClose={() => setViewingStory(false)}
        />
      )}

      {addingStory && (
        <StoryUpload
          onClose={() => setAddingStory(false)}
          onSuccess={() => setAddingStory(false)}
        />
      )}

      {showShopModal && (
        <ShopListingModal
          username={username}
          onClose={() => setShowShopModal(false)}
        />
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
          post={viewPost}
          profileUser={{ username: profileUser.username, name: profileUser.name, image: profileUser.image }}
          isOwn={isOwn}
          onClose={() => setViewPost(null)}
          onDelete={() => {
            utils.post.getByUsername.invalidate({ username })
            utils.post.getCommissionsByUsername.invalidate({ username })
            setViewPost(null)
          }}
          onPinToggle={isOwn ? () => {
            utils.post.getByUsername.invalidate({ username })
            setViewPost(null)
          } : undefined}
        />
      )}
    </>
  )
}
