"use client"

import { useState, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/components/providers"
import PostModal from "@/components/PostModal"
import CommissionRequestModal from "@/components/CommissionRequestModal"

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

  const [tab, setTab] = useState("Posts")
  const [viewPost, setViewPost] = useState<PostItem | null>(null)
  const [showCommissionRequest, setShowCommissionRequest] = useState(false)
  const [showMutuals, setShowMutuals] = useState(false)

  // ── New post modal state ──────────────────────────────────────
  const [showUpload, setShowUpload] = useState(false)
  const [uploadImage, setUploadImage] = useState<string | null>(null)
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
    setUploadImage(result)
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

  const initials = (profileUser.name ?? profileUser.username ?? "?")
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)

  const inputClass = "w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
  const inputStyle = { background: "#ffffff10", border: "1px solid #ffffff15" }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
      {showCommissionRequest && commissionProfile && commissionCategories && (
        <CommissionRequestModal
          artistId={commissionProfile.id}
          artistUsername={username}
          categories={commissionCategories}
          onClose={() => setShowCommissionRequest(false)}
        />
      )}

      {/* Mutual followers modal */}
      {showMutuals && mutualData && (
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

      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        {profileUser.image ? (
          <img src={profileUser.image} alt={profileUser.name ?? profileUser.username ?? "Profile"} className="w-20 h-20 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white">@{profileUser.username}</h1>
            {isOwn ? (
              <Link href="/settings" className="text-sm px-3 py-1 rounded-lg text-white/60 hover:text-white transition-colors" style={{ border: "1px solid #ffffff20" }}>
                Edit profile
              </Link>
            ) : session && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => followStatus?.following
                    ? unfollowMutation.mutate({ username })
                    : followMutation.mutate({ username })
                  }
                  disabled={followMutation.isPending || unfollowMutation.isPending}
                  className="text-sm px-4 py-1.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                  style={followStatus?.following
                    ? { background: "#ffffff15", border: "1px solid #ffffff30" }
                    : { background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }
                  }
                >
                  {followMutation.isPending || unfollowMutation.isPending
                    ? "…"
                    : followStatus?.following ? "Following" : "Follow"}
                </button>
                <button
                  onClick={() => getOrCreateDM.mutate({ otherUserId: profileUser.id })}
                  disabled={getOrCreateDM.isPending}
                  className="text-sm px-3 py-1.5 rounded-lg text-white/60 hover:text-white transition-colors disabled:opacity-50"
                  style={{ border: "1px solid #ffffff20" }}
                >
                  {getOrCreateDM.isPending ? "Opening…" : "Message"}
                </button>
              </div>
            )}
          </div>

          {profileUser.name && (
            <p className="text-white/60 text-sm font-medium mt-0.5">{profileUser.name}</p>
          )}

          {/* Follower / following counts */}
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-white/70">
              <span className="font-bold text-white">{followStatus?.followerCount ?? 0}</span> followers
            </span>
            <span className="text-sm text-white/70">
              <span className="font-bold text-white">{followStatus?.followingCount ?? 0}</span> following
            </span>
            {!isOwn && mutualData && mutualData.count > 0 && (
              <button onClick={() => setShowMutuals(true)} className="text-sm text-cyan-400 hover:underline">
                {mutualData.count} mutual
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6" style={{ borderBottom: "1px solid #ffffff10" }}>
        <nav className="flex gap-6">
          {["Posts", "Shop", "Commissions", "About"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? "border-white text-white" : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Posts tab ─────────────────────────────────────────── */}
      {tab === "Posts" && (
        <>
          {isOwn && (
            <div className="mb-4 flex justify-end">
              <button onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-xl hover:opacity-80 transition-opacity"
                style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>
                + New post
              </button>
            </div>
          )}

          {postsLoading ? (
            <div className="text-center py-16 text-white/40">Loading…</div>
          ) : posts && posts.length > 0 ? (
            <div className="grid grid-cols-3 gap-0.5">
              {posts.map((post) => (
                <button key={post.id} onClick={() => setViewPost(post as PostItem)}
                  className="relative aspect-square overflow-hidden group" style={{ background: "#ffffff08" }}>
                  <img src={post.image} alt={post.description ?? ""} className="w-full h-full object-cover" />
                  <div className="absolute top-1.5 left-1.5 flex gap-1">
                    {post.isAiGenerated && (
                      <span className="text-xs font-medium bg-purple-600/80 text-white px-1.5 py-0.5 rounded-md">AI</span>
                    )}
                    {(post as PostItem).isCommission && (
                      <span className="text-xs font-medium bg-blue-600/80 text-white px-1.5 py-0.5 rounded-md">Comm</span>
                    )}
                  </div>
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
          {!isOwn && commissionProfile && commissionProfile.commissionStatus !== "CLOSED" && (
            <div className="mb-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    commissionProfile.commissionStatus === "OPEN"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {commissionProfile.commissionStatus === "OPEN" ? "Open for commissions" : "Limited slots"}
                  </span>
                  {commissionProfile.commissionTurnaround && (
                    <p className="text-xs text-white/40 mt-1">Turnaround: {commissionProfile.commissionTurnaround}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowCommissionRequest(true)}
                  className="px-5 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
                  style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
                >
                  Request Commission
                </button>
              </div>
              {commissionProfile.commissionDescription && (
                <p className="text-sm text-white/60 rounded-xl px-4 py-3" style={{ background: "#ffffff08", border: "1px solid #ffffff10" }}>
                  {commissionProfile.commissionDescription}
                </p>
              )}
            </div>
          )}

          {commissionsLoading ? (
            <div className="text-center py-16 text-white/40">Loading…</div>
          ) : commissions && commissions.length > 0 ? (
            <>
              <p className="text-xs text-white/40 mb-4">Finished commission work — click to view</p>
              <div className="grid grid-cols-3 gap-0.5">
                {commissions.map((post) => (
                  <button key={post.id} onClick={() => setViewPost(post as PostItem)}
                    className="relative aspect-square overflow-hidden group" style={{ background: "#ffffff08" }}>
                    <img src={post.image} alt={post.description ?? ""} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity px-2 text-center line-clamp-2">
                        {post.description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🎨</div>
              <p className="font-medium text-white/50">No finished commissions posted yet</p>
              {isOwn && (
                <p className="text-sm mt-1 text-white/30">
                  When posting, tick &ldquo;This is a commission&rdquo; to show it here
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── About tab ─────────────────────────────────────────── */}
      {tab === "About" && (
        <div className="flex flex-col gap-4 max-w-sm">
          {profileUser.bio ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-1">Bio</p>
              <p className="text-sm text-white/70">{profileUser.bio}</p>
            </div>
          ) : null}

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
                  <a href={`https://x.com/${profileUser.twitterHandle.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
                    <span>𝕏</span> {profileUser.twitterHandle}
                  </a>
                )}
                {profileUser.instagramHandle && (
                  <a href={`https://instagram.com/${profileUser.instagramHandle.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
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

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-1">Joined</p>
            <p className="text-sm text-white/70">
              {new Date(profileUser.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>

          {isOwn && (
            <Link href="/settings" className="mt-2 text-sm text-cyan-400 hover:underline">
              Edit profile →
            </Link>
          )}
        </div>
      )}

      {/* ── New post modal ────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl w-full max-w-md flex flex-col gap-4 p-6 max-h-[90vh] overflow-y-auto" style={{ background: "#1e0d3f", border: "1px solid #ffffff15" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">New post</h2>
              <button onClick={() => { setShowUpload(false); setUploadImage(null); setUploadDesc(""); setUploadIsAi(false); setUploadIsCommission(false) }}
                className="text-white/40 hover:text-white text-xl leading-none transition-colors">✕</button>
            </div>

            {uploadImage ? (
              <div className="relative">
                <img src={uploadImage} alt="Preview" className="w-full rounded-xl object-cover max-h-72" />
                <button onClick={() => setUploadImage(null)}
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

            <textarea value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="Write a caption…" maxLength={500} rows={3}
              className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={{ background: "#ffffff10", border: "1px solid #ffffff15" }} />

            {[
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

            {createPost.error && <p className="text-sm text-red-400">{createPost.error.message}</p>}

            <button
              onClick={() => { if (uploadImage) createPost.mutate({ image: uploadImage, description: uploadDesc.trim() || undefined, isAiGenerated: uploadIsAi, isCommission: uploadIsCommission }) }}
              disabled={createPost.isPending || !uploadImage || imgProcessing}
              className="w-full text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>
              {createPost.isPending ? "Posting…" : "Share"}
            </button>
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
        />
      )}
    </div>
  )
}
