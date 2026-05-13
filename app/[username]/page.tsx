"use client"

import { useState, use } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { trpc } from "@/components/providers"
import PostModal from "@/components/PostModal"
import CommissionRequestModal from "@/components/CommissionRequestModal"

const statusColors = {
  OPEN: "bg-green-100 text-green-700",
  LIMITED: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-gray-100 text-gray-500",
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
  const { data: profileUser, isLoading: userLoading } = trpc.user.getByUsername.useQuery({ username })
  const { data: posts, isLoading: postsLoading } = trpc.post.getByUsername.useQuery({ username })
  const { data: commissions, isLoading: commissionsLoading } = trpc.post.getCommissionsByUsername.useQuery({ username })
  const { data: shopItems, isLoading: shopLoading } = trpc.shop.getByUsername.useQuery({ username })
  const { data: commissionProfile } = trpc.commission.getProfile.useQuery({ username })
  const { data: commissionCategories } = trpc.commission.getCategories.useQuery({ username })
  const { data: completedWork } = trpc.commission.getCompletedWork.useQuery({ username })
  const utils = trpc.useUtils()

  const [tab, setTab] = useState("Posts")
  const [viewPost, setViewPost] = useState<PostItem | null>(null)
  const [showCommissionRequest, setShowCommissionRequest] = useState(false)

  // ── New post modal state ──────────────────────────────────────
  const [showUpload, setShowUpload] = useState(false)
  const [uploadImage, setUploadImage] = useState<string | null>(null)
  const [uploadDesc, setUploadDesc] = useState("")
  const [uploadIsAi, setUploadIsAi] = useState(false)
  const [uploadIsCommission, setUploadIsCommission] = useState(false)
  const [imgProcessing, setImgProcessing] = useState(false)

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
    return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">Loading…</div></div>
  }

  if (!profileUser) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">User not found</div></div>
  }

  const isOwn = session?.user?.id === profileUser.id

  const initials = (profileUser.name ?? profileUser.username ?? "?")
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {showCommissionRequest && commissionProfile && commissionCategories && (
        <CommissionRequestModal
          artistId={commissionProfile.id}
          artistUsername={username}
          categories={commissionCategories}
          onClose={() => setShowCommissionRequest(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        {profileUser.image ? (
          <img src={profileUser.image} alt={profileUser.name ?? profileUser.username ?? "Profile"} className="w-20 h-20 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold flex-shrink-0">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">@{profileUser.username}</h1>
            {isOwn && (
              <Link href="/settings" className="text-sm px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                Edit profile
              </Link>
            )}
          </div>

          {profileUser.name && (
            <p className="text-gray-700 text-sm font-medium mt-0.5">{profileUser.name}</p>
          )}

          {profileUser.bio && (
            <p className="text-gray-700 text-sm mt-3">{profileUser.bio}</p>
          )}

          {(profileUser.websiteUrl || profileUser.twitterHandle || profileUser.instagramHandle || profileUser.artstationHandle) && (
            <div className="flex flex-wrap gap-3 mt-3">
              {profileUser.websiteUrl && (
                <a href={profileUser.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">🌐 Website</a>
              )}
              {profileUser.twitterHandle && (
                <a href={`https://x.com/${profileUser.twitterHandle.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">𝕏 {profileUser.twitterHandle}</a>
              )}
              {profileUser.instagramHandle && (
                <a href={`https://instagram.com/${profileUser.instagramHandle.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">📸 {profileUser.instagramHandle}</a>
              )}
              {profileUser.artstationHandle && (
                <a href={`https://artstation.com/${profileUser.artstationHandle}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">🎨 {profileUser.artstationHandle}</a>
              )}
            </div>
          )}

          {profileUser.sellingEnabled && (
            <div className="mt-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColors[profileUser.commissionStatus as keyof typeof statusColors] ?? "bg-gray-100 text-gray-500"}`}>
                {statusLabels[profileUser.commissionStatus as keyof typeof statusLabels] ?? "Closed for commissions"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {["Posts", "Shop", "Commissions", ...(completedWork && completedWork.length > 0 ? ["Completed Work"] : []), "About"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
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
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
                + New post
              </button>
            </div>
          )}

          {postsLoading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : posts && posts.length > 0 ? (
            <div className="grid grid-cols-3 gap-0.5">
              {posts.map((post) => (
                <button key={post.id} onClick={() => setViewPost(post as PostItem)}
                  className="relative aspect-square overflow-hidden bg-gray-100 group">
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
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🖼️</div>
              <p className="font-medium text-gray-500">No posts yet</p>
              {isOwn && <p className="text-sm mt-1">Share your first piece of art</p>}
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
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
                + Add item
              </button>
            </div>
          )}

          {shopLoading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : shopItems && shopItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {shopItems.map((item) => (
                <div key={item.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-gray-900">${item.price.toFixed(2)}</span>
                      {isOwn ? (
                        <button
                          onClick={() => deleteShopItem.mutate({ id: item.id })}
                          disabled={deleteShopItem.isPending}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      ) : (
                        <a
                          href={`mailto:${profileUser.email ?? ""}?subject=Shop inquiry: ${encodeURIComponent(item.title)}`}
                          className="text-xs bg-gray-900 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors"
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
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🛍️</div>
              <p className="font-medium text-gray-500">No items for sale yet</p>
              {isOwn && <p className="text-sm mt-1">Add prints, stickers, or other work</p>}
            </div>
          )}
        </>
      )}

      {/* ── Commissions tab ───────────────────────────────────── */}
      {tab === "Commissions" && (
        <>
          {/* Request Commission button — show to non-owners when artist is open */}
          {!isOwn && commissionProfile && commissionProfile.commissionStatus !== "CLOSED" && (
            <div className="mb-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    commissionProfile.commissionStatus === "OPEN"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {commissionProfile.commissionStatus === "OPEN" ? "Open for commissions" : "Limited slots"}
                  </span>
                  {commissionProfile.commissionTurnaround && (
                    <p className="text-xs text-gray-400 mt-1">Turnaround: {commissionProfile.commissionTurnaround}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowCommissionRequest(true)}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Request Commission
                </button>
              </div>
              {commissionProfile.commissionDescription && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
                  {commissionProfile.commissionDescription}
                </p>
              )}
            </div>
          )}

          {commissionsLoading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : commissions && commissions.length > 0 ? (
            <>
              <p className="text-xs text-gray-400 mb-4">Finished commission work — click to view</p>
              <div className="grid grid-cols-3 gap-0.5">
                {commissions.map((post) => (
                  <button key={post.id} onClick={() => setViewPost(post as PostItem)}
                    className="relative aspect-square overflow-hidden bg-gray-100 group">
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
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🎨</div>
              <p className="font-medium text-gray-500">No finished commissions posted yet</p>
              {isOwn && (
                <p className="text-sm mt-1">
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
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Bio</p>
              <p className="text-sm text-gray-700">{profileUser.bio}</p>
            </div>
          ) : null}

          {(profileUser.websiteUrl || profileUser.twitterHandle || profileUser.instagramHandle || profileUser.artstationHandle) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Links</p>
              <div className="flex flex-col gap-2">
                {profileUser.websiteUrl && (
                  <a href={profileUser.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <span>🌐</span> {profileUser.websiteUrl}
                  </a>
                )}
                {profileUser.twitterHandle && (
                  <a href={`https://x.com/${profileUser.twitterHandle.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <span>𝕏</span> {profileUser.twitterHandle}
                  </a>
                )}
                {profileUser.instagramHandle && (
                  <a href={`https://instagram.com/${profileUser.instagramHandle.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <span>📸</span> {profileUser.instagramHandle}
                  </a>
                )}
                {profileUser.artstationHandle && (
                  <a href={`https://artstation.com/${profileUser.artstationHandle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <span>🎨</span> ArtStation — {profileUser.artstationHandle}
                  </a>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Joined</p>
            <p className="text-sm text-gray-700">
              {new Date(profileUser.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>

          {isOwn && (
            <Link href="/settings" className="mt-2 text-sm text-blue-600 hover:underline">
              Edit profile →
            </Link>
          )}
        </div>
      )}

      {/* ── Completed Work tab ───────────────────────────────── */}
      {tab === "Completed Work" && (
        <div>
          {!completedWork || completedWork.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No completed commissions yet</div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {completedWork.map(item => (
                <div key={item.id} className="aspect-square overflow-hidden bg-gray-100">
                  <img src={item.fileUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── New post modal ────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md flex flex-col gap-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New post</h2>
              <button onClick={() => { setShowUpload(false); setUploadImage(null); setUploadDesc(""); setUploadIsAi(false); setUploadIsCommission(false) }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
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
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl h-48 cursor-pointer hover:border-gray-400 transition-colors">
                <span className="text-3xl mb-2">🖼️</span>
                <span className="text-sm text-gray-500">{imgProcessing ? "Processing…" : "Click to choose image"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} disabled={imgProcessing} />
              </label>
            )}

            <textarea value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="Write a caption…" maxLength={500} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />

            {/* Toggles */}
            {[
              { label: "AI generated", sub: "Let others know this was made with AI", value: uploadIsAi, set: setUploadIsAi },
              { label: "This is a commission", sub: "Show in your Commissions tab", value: uploadIsCommission, set: setUploadIsCommission },
            ].map(({ label, sub, value, set }) => (
              <div key={label} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{sub}</p>
                </div>
                <button
                  onClick={() => set((v: boolean) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${value ? "bg-blue-600" : "bg-gray-200"}`}
                  role="switch" aria-checked={value}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            ))}

            {createPost.error && <p className="text-sm text-red-500">{createPost.error.message}</p>}

            <button
              onClick={() => { if (uploadImage) createPost.mutate({ image: uploadImage, description: uploadDesc.trim() || undefined, isAiGenerated: uploadIsAi, isCommission: uploadIsCommission }) }}
              disabled={createPost.isPending || !uploadImage || imgProcessing}
              className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {createPost.isPending ? "Posting…" : "Share"}
            </button>
          </div>
        </div>
      )}

      {/* ── New shop item modal ───────────────────────────────── */}
      {showShopUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md flex flex-col gap-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Add shop item</h2>
              <button onClick={() => { setShowShopUpload(false); setShopImage(null); setShopTitle(""); setShopDesc(""); setShopPrice("") }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
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
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl h-48 cursor-pointer hover:border-gray-400 transition-colors">
                <span className="text-3xl mb-2">🛍️</span>
                <span className="text-sm text-gray-500">{shopImgProcessing ? "Processing…" : "Click to choose image"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleShopImageFile} disabled={shopImgProcessing} />
              </label>
            )}

            <input
              type="text"
              value={shopTitle}
              onChange={(e) => setShopTitle(e.target.value)}
              placeholder="Item title"
              maxLength={100}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <textarea
              value={shopDesc}
              onChange={(e) => setShopDesc(e.target.value)}
              placeholder="Description (optional)"
              maxLength={500}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">$</span>
              <input
                type="number"
                value={shopPrice}
                onChange={(e) => setShopPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {createShopItem.error && <p className="text-sm text-red-500">{createShopItem.error.message}</p>}

            <button
              onClick={() => {
                const price = parseFloat(shopPrice)
                if (shopImage && shopTitle.trim() && !isNaN(price) && price > 0) {
                  createShopItem.mutate({ image: shopImage, title: shopTitle.trim(), description: shopDesc.trim() || undefined, price })
                }
              }}
              disabled={createShopItem.isPending || !shopImage || !shopTitle.trim() || !shopPrice || shopImgProcessing}
              className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
