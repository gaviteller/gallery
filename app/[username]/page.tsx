"use client"

import { useState, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/components/providers"
import PostModal from "@/components/PostModal"
import CommissionRequestModal from "@/components/CommissionRequestModal"
import StoryViewer from "@/components/StoryViewer"
import StoryUpload from "@/components/StoryUpload"
import ImageCropEditor from "@/components/ImageCropEditor"

const statusColors = {
  OPEN: "bg-green-500/20 text-green-400",
  LIMITED: "bg-yellow-500/20 text-yellow-400",
  CLOSED: "bg-white/10 text-white/30",
}

const statusLabels = {
  OPEN: "Open for commissions",
  LIMITED: "Limited slots",
  CLOSED: "Closed for commissions",
}

type PostItem = {
  id: string
  image: string
  title: string | null
  description: string | null
  isAiGenerated: boolean
  isCommission: boolean
  pinned: boolean
  createdAt: Date
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

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username: rawUsername } = use(params)
  const decoded = decodeURIComponent(rawUsername)
  const username = decoded.startsWith("@") ? decoded.slice(1) : decoded

  const { data: session } = useSession()
  const router = useRouter()
  const { data: profileUser, isLoading: userLoading } = trpc.user.getByUsername.useQuery({ username })
  const { data: posts, isLoading: postsLoading } = trpc.post.getByUsername.useQuery({ username })
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
  const utils = trpc.useUtils()
  const { data: userStories = [] } = trpc.story.getByUsername.useQuery({ username })

  const [tab, setTab] = useState("Posts")
  const [viewPost, setViewPost] = useState<PostItem | null>(null)
  const [showCommissionRequest, setShowCommissionRequest] = useState(false)
  const [showMutuals, setShowMutuals] = useState(false)
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false)
  const [viewingStory, setViewingStory] = useState(false)
  const [addingStory, setAddingStory] = useState(false)

  // ── New post modal state ──────────────────────────────────────
  const [showUpload, setShowUpload] = useState(false)
  const [rawImage, setRawImage] = useState<string | null>(null)   // before crop
  const [uploadImage, setUploadImage] = useState<string | null>(null) // after crop
  const [uploadDesc, setUploadDesc] = useState("")
  const [uploadIsAi, setUploadIsAi] = useState(false)
  const [uploadIsCommission, setUploadIsCommission] = useState(false)
  const [imgProcessing, setImgProcessing] = useState(false)

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
    },
  })

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImgProcessing(true)
    const result = await processImage(file, 1200)
    setRawImage(result)   // show crop editor
    setImgProcessing(false)
  }

  // ── New shop item modal state ─────────────────────────────────
  const [showShopUpload, setShowShopUpload] = useState(false)
  const [shopImage, setShopImage] = useState<string | null>(null)
  const [shopTitle, setShopTitle] = useState("")
  const [shopDesc, setShopDesc] = useState("")
  const [shopPrice, setShopPrice] = useState("")
  const [shopImgProcessing, setShopImgProcessing] = useState(false)
  const [viewShopItem, setViewShopItem] = useState<{ id: string; image: string; title: string; description: string | null; price: number; createdAt: Date } | null>(null)

  const createShopItem = trpc.shop.create.useMutation({
    onSuccess: () => {
      utils.shop.getByUsername.invalidate({ username })
      setShowShopUpload(false)
      setShopImage(null)
      setShopTitle("")
      setShopDesc("")
      setShopPrice("")
    },
  })

  const deleteShopItem = trpc.shop.delete.useMutation({
    onSuccess: () => utils.shop.getByUsername.invalidate({ username }),
  })

  async function handleShopImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setShopImgProcessing(true)
    const result = await processImage(file, 1200)
    setShopImage(result)
    setShopImgProcessing(false)
  }

  if (userLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-white/40">Loading…</div></div>
  }

  if (!profileUser) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-white/40">User not found</div></div>
  }

  const isOwn = session?.user?.id === profileUser.id

  const galleryImages: { src: string; key: string }[] = [
    ...(approvedWork ?? []).map(w => ({ src: w.fileUrl, key: `approved-${w.commissionId}` })),
    ...(commissionProfile?.commissionCardImages ?? []).map(img => ({ src: img, key: `manual-${img}` })),
  ]

  const initials = (profileUser.name ?? profileUser.username ?? "?")
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)

  const inputClass = "w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
  const inputStyle = { background: "#ffffff10", border: "1px solid #ffffff15" }

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

      {/* Mutual followers modal */}
      {showMutuals && !isOwn && mutualData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowMutuals(false)}>
          <div className="w-full max-w-lg rounded-t-2xl pb-8" style={{ background: "#1e0d3f", border: "1px solid #ffffff15" }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "#ffffff20" }} />
            </div>
            <p className="text-sm font-semibold text-white px-4 pb-3" style={{ borderBottom: "1px solid #ffffff10" }}>
              Mutual followers
            </p>
            <div className="max-h-72 overflow-y-auto">
              {mutualData.users.map(u => (
                <button key={u.id} onClick={() => { setShowMutuals(false); router.push(`/@${u.username}`) }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
                  {u.image
                    ? <img src={u.image} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
                    : <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm" style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>{(u.name ?? u.username ?? "?")[0].toUpperCase()}</div>
                  }
                  <div>
                    <p className="text-sm font-semibold text-white">@{u.username}</p>
                    {u.name && <p className="text-xs text-white/40">{u.name}</p>}
                  </div>
                </button>
              ))}
              {mutualData.users.length === 0 && (
                <p className="text-sm text-white/40 text-center py-6">No mutual followers</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Profile card ───────────────────────────────────────── */}
      <div style={{ width: "100%", paddingBottom: "5rem" }}>

        {/* Banner */}
        <div style={{
          width: "100%", height: 160, position: "relative",
          background: (profileUser as { bannerImage?: string | null }).bannerImage
            ? undefined : "linear-gradient(135deg, #1a0535 0%, #0d1a35 50%, #0a1a20 100%)",
        }}>
          {(profileUser as { bannerImage?: string | null }).bannerImage && (
            <img src={(profileUser as { bannerImage?: string | null }).bannerImage!}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt="" />
          )}
        </div>

      {/* ── Profile identity block ─────────────────────────────── */}
      <div style={{ paddingLeft: "1rem", paddingRight: "1rem" }}>
        {/* Avatar — overlapping banner by 40px */}
        <div style={{ marginTop: -44, marginBottom: 12, position: "relative", zIndex: 2 }}>
          <button
            onClick={() => {
              if (isOwn) setAddingStory(true)
              else if (userStories.length > 0) setViewingStory(true)
            }}
            className="focus:outline-none"
            style={{ cursor: isOwn || userStories.length > 0 ? "pointer" : "default" }}
          >
            {/* Gradient ring — always on, brighter if has story */}
            <div
              style={{
                padding: userStories.length > 0 ? 2.5 : 1.5,
                background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                borderRadius: "50%",
                opacity: userStories.length > 0 ? 1 : 0.4,
              }}
            >
              <div
                style={{ padding: 2, background: "#0D0D0F", borderRadius: "50%" }}
              >
                {profileUser.image ? (
                  <img
                    src={profileUser.image}
                    alt={profileUser.name ?? profileUser.username ?? "Profile"}
                    className="rounded-full object-cover"
                    style={{ width: 80, height: 80 }}
                  />
                ) : (
                  <div
                    className="rounded-full flex items-center justify-center text-white text-2xl font-bold"
                    style={{
                      width: 80,
                      height: 80,
                      background:
                        "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                    }}
                  >
                    {initials}
                  </div>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Name */}
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 700, color: "white", lineHeight: 1.2 }}>
          {profileUser.name ?? profileUser.username}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 2 }}>@{profileUser.username}</p>

        {/* Commission badge */}
        {commissionProfile && (commissionProfile.commissionStatus === "OPEN" || commissionProfile.commissionStatus === "LIMITED") && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(176,68,248,0.15)", border: "1px solid rgba(176,68,248,0.3)", borderRadius: 20, padding: "3px 10px", marginTop: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "linear-gradient(135deg, #FF1CF7, #B044F8)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Commission open</span>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}><strong style={{ color: "white" }}>{posts?.length ?? 0}</strong> posts</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}><strong style={{ color: "white" }}>{followStatus?.followerCount ?? 0}</strong> followers</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}><strong style={{ color: "white" }}>{followStatus?.followingCount ?? 0}</strong> following</span>
          {!isOwn && mutualData && mutualData.count > 0 && (
            <button onClick={() => setShowMutuals(true)} style={{ fontSize: 14, color: "#22d3ee" }}>{mutualData.count} mutual</button>
          )}
        </div>

        {/* Trust Score */}
        {trustScore && (commissionProfile?.commissionStatus === "OPEN" || commissionProfile?.commissionStatus === "LIMITED" || (isOwn && commissionProfile)) && (
          <div style={{ marginTop: 10 }}>
            {trustScore.hasScore ? (
              <div>
                <button
                  onClick={() => setShowScoreBreakdown(prev => !prev)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "5px 12px", cursor: "pointer" }}
                >
                  {/* Stars */}
                  <span style={{ color: "#facc15", fontSize: 13 }}>
                    {"★".repeat(Math.round(trustScore.avgRating ?? 0))}{"☆".repeat(5 - Math.round(trustScore.avgRating ?? 0))}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>
                    {trustScore.avgRating?.toFixed(1) ?? "—"} / 5.0
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
                    ({trustScore.ratingCount} {trustScore.ratingCount === 1 ? "rating" : "ratings"})
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                    {showScoreBreakdown ? "▲" : "▼"}
                  </span>
                </button>

                {/* Breakdown panel */}
                {showScoreBreakdown && (
                  <div style={{ marginTop: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Average rating</span>
                      <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>{trustScore.avgRating?.toFixed(1) ?? "—"} / 5.0</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Completed commissions</span>
                      <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>{trustScore.completedCount}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Artist cancel rate</span>
                      <span style={{ color: trustScore.cancelRate > 20 ? "#f87171" : "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>{trustScore.cancelRate}%</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                ✦ New Artist
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, marginBottom: 20 }}>
          {isOwn ? (
            <>
              <Link href="/settings" style={{ fontSize: 13, padding: "7px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" }}>
                Edit profile
              </Link>
              <div style={{ padding: 1.5, background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)", borderRadius: 20 }}>
                <button onClick={() => setAddingStory(true)} style={{ fontSize: 12, fontWeight: 600, color: "white", padding: "6px 14px", borderRadius: 20, background: "#0D0D0F" }}>
                  + Story
                </button>
              </div>
            </>
          ) : session && (
            <>
              <button
                onClick={() => followStatus?.following ? unfollowMutation.mutate({ username }) : followMutation.mutate({ username })}
                disabled={followMutation.isPending || unfollowMutation.isPending}
                style={{ padding: "8px 24px", borderRadius: 12, fontWeight: 600, fontSize: 14, color: "white", background: followStatus?.following ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)", border: followStatus?.following ? "1px solid rgba(255,255,255,0.2)" : "none" }}
              >
                {followMutation.isPending || unfollowMutation.isPending ? "…" : followStatus?.following ? "Following" : "Follow"}
              </button>
              <button
                onClick={() => getOrCreateDM.mutate({ otherUserId: profileUser.id })}
                disabled={getOrCreateDM.isPending}
                style={{ padding: "8px 18px", borderRadius: 12, fontWeight: 600, fontSize: 14, color: "white", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                {getOrCreateDM.isPending ? "…" : "Message"}
              </button>
            </>
          )}
        </div>

      {/* ── Pill tabs + New post button ───────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {(["Posts", "Shop", "Commissions", "About"] as const)
          .filter((t) => {
            if (isOwn) return true
            if (t === "Shop" && (!shopItems || shopItems.length === 0))
              return false
            if (
              t === "Commissions" &&
              commissionProfile?.commissionStatus === "CLOSED"
            )
              return false
            return true
          })
          .map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-sm font-medium px-4 py-1.5 rounded-full transition-all"
              style={
                tab === t
                  ? {
                      background:
                        "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                      color: "white",
                    }
                  : {
                      background: "transparent",
                      color: "rgba(255,255,255,0.4)",
                    }
              }
            >
              {t}
            </button>
          ))}
        {isOwn && tab === "Posts" && (
          <button onClick={() => setShowUpload(true)}
            style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)", color: "white", fontSize: 13, fontWeight: 500, padding: "6px 14px", borderRadius: 10 }}>
            + New post
          </button>
        )}
      </div>

      {/* ── Posts tab ─────────────────────────────────────────── */}
      {tab === "Posts" && (
        <>

          {postsLoading ? (
            <div className="text-center py-16 text-white/40">Loading…</div>
          ) : posts && posts.length > 0 ? (
            <div className="grid grid-cols-3" style={{ gap: 2 }}>
              {posts.map((post) => (
                <button key={post.id} onClick={() => setViewPost(post as PostItem)}
                  className="relative aspect-square overflow-hidden group" style={{ background: "#ffffff08", borderRadius: 4 }}>
                  <img src={post.image} alt={post.description ?? ""} className="w-full h-full object-cover" />
                  <div className="absolute top-1.5 left-1.5 flex gap-1">
                    {post.isAiGenerated && (
                      <span className="text-xs font-medium bg-purple-600/80 text-white px-1.5 py-0.5 rounded-md">AI</span>
                    )}
                    {(post as PostItem).isCommission && (
                      <span className="text-xs font-medium bg-blue-600/80 text-white px-1.5 py-0.5 rounded-md">Comm</span>
                    )}
                  </div>
                  {isOwn && (post as PostItem).pinned && (
                    <div className="absolute top-1.5 right-1.5">
                      <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 12V4h1a1 1 0 000-2H7a1 1 0 000 2h1v8l-2 2v2h5v5l1 1 1-1v-5h5v-2l-2-2z"/>
                      </svg>
                    </div>
                  )}
                  {post.description && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity px-2 text-center line-clamp-2">
                        {post.description}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🖼️</div>
              <p className="font-medium text-white/50">No posts yet</p>
              {isOwn && <p className="text-sm mt-1 text-white/30">Share your first piece of art</p>}
            </div>
          )}
        </>
      )}

      {/* ── Shop tab ──────────────────────────────────────────── */}
      {tab === "Shop" && (
        <>
          {isOwn && (
            <div className="mb-4 flex justify-end">
              <button onClick={() => setShowShopUpload(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-xl hover:opacity-80 transition-opacity"
                style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>
                + Add item
              </button>
            </div>
          )}

          {shopLoading ? (
            <div className="text-center py-16 text-white/40">Loading…</div>
          ) : shopItems && shopItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {shopItems.map((item) => (
                <div key={item.id} className="rounded-2xl overflow-hidden" style={{ background: "#1e0d3f", border: "1px solid #ffffff15" }}>
                  <div className="aspect-square overflow-hidden" style={{ background: "#ffffff08" }}>
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-white line-clamp-1">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-white">${item.price.toFixed(2)}</span>
                      {isOwn ? (
                        <button
                          onClick={() => deleteShopItem.mutate({ id: item.id })}
                          disabled={deleteShopItem.isPending}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      ) : (
                        <a
                          href={`mailto:${profileUser.email ?? ""}?subject=Shop inquiry: ${encodeURIComponent(item.title)}`}
                          className="text-xs text-white px-3 py-1 rounded-lg hover:opacity-80 transition-opacity"
                          style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
                        >
                          Inquire
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🛍️</div>
              <p className="font-medium text-white/50">No items for sale yet</p>
              {isOwn && <p className="text-sm mt-1 text-white/30">Add prints, stickers, or other work</p>}
            </div>
          )}
        </>
      )}

      {/* ── Commissions tab ───────────────────────────────────── */}
      {tab === "Commissions" && (
        <>
          {!commissionProfile ? (
            <div className="text-center py-12">
              <p className="text-white/30 text-sm">Loading…</p>
            </div>
          ) : (
            <>
              {/* Info card */}
              <div className="rounded-2xl p-5 mb-6" style={{ background: "#1e0d3f", border: "1px solid #ffffff15" }}>
                {/* Trust score */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">Trust Score</span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full text-white/40" style={{ background: "#ffffff10" }}>
                    New Artist
                  </span>
                </div>

                {commissionProfile.commissionDescription && (
                  <p className="text-sm text-white/70 mb-4">{commissionProfile.commissionDescription}</p>
                )}

                <div className="flex flex-wrap gap-4 mb-4">
                  {commissionProfile.commissionTurnaround && (
                    <div>
                      <p className="text-xs text-white/40 mb-0.5">Turnaround</p>
                      <p className="text-sm font-medium text-white">{commissionProfile.commissionTurnaround}</p>
                    </div>
                  )}
                  {commissionProfile.priceRanges && (() => {
                    const ranges = commissionProfile.priceRanges as { label: string; price: number }[]
                    return ranges.length > 0 && (
                      <div>
                        <p className="text-xs text-white/40 mb-0.5">Price ranges</p>
                        <div className="flex flex-wrap gap-1.5">
                          {ranges.map((r) => (
                            <span key={r.label + '-' + r.price} className="text-xs px-2 py-0.5 rounded-full text-white/70" style={{ background: "#ffffff10" }}>
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
                    className="w-full py-3 text-white rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
                    style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
                  >
                    Request Commission
                  </button>
                )}
              </div>

              {/* Example work gallery */}
              {galleryImages.length > 0 ? (
                <>
                  <p className="text-xs text-white/40 mb-3 uppercase tracking-wide font-semibold">Example work</p>
                  <div className="grid grid-cols-3 gap-0.5">
                    {galleryImages.map(({ src, key }) => (
                      <div key={key} className="relative aspect-square overflow-hidden" style={{ background: "#ffffff08" }}>
                        <img src={src} alt="Example work" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🎨</div>
                  <p className="font-medium text-white/50">No example work yet</p>
                  {isOwn && (
                    <p className="text-sm mt-1 text-white/30">Add images in your Artist Dashboard</p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── About tab ─────────────────────────────────────────── */}
      {tab === "About" && (
        <div className="flex flex-col gap-5 max-w-sm">
          {/* Commission status badge */}
          {commissionProfile && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Commission status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColors[commissionProfile.commissionStatus as keyof typeof statusColors] ?? "bg-white/10 text-white/30"}`}>
                {statusLabels[commissionProfile.commissionStatus as keyof typeof statusLabels] ?? "Closed for commissions"}
              </span>
            </div>
          )}

          {profileUser.bio && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-1">Bio</p>
              <p className="text-sm text-white/70">{profileUser.bio}</p>
            </div>
          )}

          {(profileUser.websiteUrl || profileUser.twitterHandle || profileUser.instagramHandle || profileUser.artstationHandle) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">Links</p>
              <div className="flex flex-col gap-2">
                {profileUser.websiteUrl && (
                  <a href={profileUser.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
                    <span>🌐</span> {profileUser.websiteUrl}
                  </a>
                )}
                {profileUser.twitterHandle && (
                  <a href={`https://x.com/${profileUser.twitterHandle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
                    <span>𝕏</span> {profileUser.twitterHandle}
                  </a>
                )}
                {profileUser.instagramHandle && (
                  <a href={`https://instagram.com/${profileUser.instagramHandle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
                    <span>📸</span> {profileUser.instagramHandle}
                  </a>
                )}
                {profileUser.artstationHandle && (
                  <a href={`https://artstation.com/${profileUser.artstationHandle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
                    <span>🎨</span> ArtStation — {profileUser.artstationHandle}
                  </a>
                )}
              </div>
            </div>
          )}

          {isOwn && (
            <Link href="/settings" className="mt-2 text-sm text-cyan-400 hover:underline">
              Edit profile →
            </Link>
          )}
        </div>
      )}

      </div> {/* end profile identity block */}
      </div> {/* end profile card */}

      {/* ── New post modal ────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl w-full max-w-md flex flex-col gap-4 p-6 max-h-[90vh] overflow-y-auto" style={{ background: "#1e0d3f", border: "1px solid #ffffff15" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">New post</h2>
              <button onClick={() => { setShowUpload(false); setRawImage(null); setUploadImage(null); setUploadDesc(""); setUploadIsAi(false); setUploadIsCommission(false) }}
                className="text-white/40 hover:text-white text-xl leading-none transition-colors">✕</button>
            </div>

            {rawImage && !uploadImage ? (
              <ImageCropEditor
                src={rawImage}
                onConfirm={(cropped) => { setUploadImage(cropped); setRawImage(null) }}
                onCancel={() => setRawImage(null)}
              />
            ) : uploadImage ? (
              <div className="relative">
                <img src={uploadImage} alt="Preview" className="w-full rounded-xl" style={{ aspectRatio: "1/1", objectFit: "cover" }} />
                <button onClick={() => { setUploadImage(null) }}
                  className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/70">
                  Change
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-xl h-48 cursor-pointer hover:bg-white/5 transition-colors" style={{ border: "2px dashed #ffffff20" }}>
                <span className="text-3xl mb-2">🖼️</span>
                <span className="text-sm text-white/40">{imgProcessing ? "Processing…" : "Click to choose image"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} disabled={imgProcessing} />
              </label>
            )}

            {!rawImage && <textarea value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="Write a caption…" maxLength={500} rows={3}
              className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={{ background: "#ffffff10", border: "1px solid #ffffff15" }} />}

            {!rawImage && [
              { label: "AI generated", sub: "Let others know this was made with AI", value: uploadIsAi, set: setUploadIsAi },
              { label: "This is a commission", sub: "Show in your Commissions tab", value: uploadIsCommission, set: setUploadIsCommission },
            ].map(({ label, sub, value, set }) => (
              <div key={label} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-white/40">{sub}</p>
                </div>
                <button
                  onClick={() => set((v: boolean) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${value ? "bg-purple-600" : "bg-white/20"}`}
                  role="switch" aria-checked={value}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            ))}

            {!rawImage && createPost.error && <p className="text-sm text-red-400">{createPost.error.message}</p>}

            {!rawImage && <button
              onClick={() => { if (uploadImage) createPost.mutate({ image: uploadImage, description: uploadDesc.trim() || undefined, isAiGenerated: uploadIsAi, isCommission: uploadIsCommission }) }}
              disabled={createPost.isPending || !uploadImage || imgProcessing}
              className="w-full text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>
              {createPost.isPending ? "Posting…" : "Share"}
            </button>}
          </div>
        </div>
      )}

      {/* ── New shop item modal ───────────────────────────────── */}
      {showShopUpload && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl w-full max-w-md flex flex-col gap-4 p-6 max-h-[90vh] overflow-y-auto" style={{ background: "#1e0d3f", border: "1px solid #ffffff15" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add shop item</h2>
              <button onClick={() => { setShowShopUpload(false); setShopImage(null); setShopTitle(""); setShopDesc(""); setShopPrice("") }}
                className="text-white/40 hover:text-white text-xl leading-none transition-colors">✕</button>
            </div>

            {shopImage ? (
              <div className="relative">
                <img src={shopImage} alt="Preview" className="w-full rounded-xl object-cover max-h-72" />
                <button onClick={() => setShopImage(null)}
                  className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/70">
                  Change
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-xl h-48 cursor-pointer hover:bg-white/5 transition-colors" style={{ border: "2px dashed #ffffff20" }}>
                <span className="text-3xl mb-2">🛍️</span>
                <span className="text-sm text-white/40">{shopImgProcessing ? "Processing…" : "Click to choose image"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleShopImageFile} disabled={shopImgProcessing} />
              </label>
            )}

            <input type="text" value={shopTitle} onChange={(e) => setShopTitle(e.target.value)}
              placeholder="Item title" maxLength={100} className={inputClass} style={inputStyle} />

            <textarea value={shopDesc} onChange={(e) => setShopDesc(e.target.value)}
              placeholder="Description (optional)" maxLength={500} rows={2}
              className={`${inputClass} resize-none`} style={inputStyle} />

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/60">$</span>
              <input type="number" value={shopPrice} onChange={(e) => setShopPrice(e.target.value)}
                placeholder="0.00" min="0" step="0.01" className={inputClass} style={inputStyle} />
            </div>

            {createShopItem.error && <p className="text-sm text-red-400">{createShopItem.error.message}</p>}

            <button
              onClick={() => {
                const price = parseFloat(shopPrice)
                if (shopImage && shopTitle.trim() && !isNaN(price) && price > 0) {
                  createShopItem.mutate({ image: shopImage, title: shopTitle.trim(), description: shopDesc.trim() || undefined, price })
                }
              }}
              disabled={createShopItem.isPending || !shopImage || !shopTitle.trim() || !shopPrice || shopImgProcessing}
              className="w-full text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>
              {createShopItem.isPending ? "Adding…" : "Add to shop"}
            </button>
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
