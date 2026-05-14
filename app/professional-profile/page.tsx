"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"

type PriceRange = { label: string; price: number }

function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.onload = (e) => {
      const img = new window.Image()
      img.onerror = () => reject(new Error("Failed to load image"))
      img.onload = () => {
        let { width, height } = img
        const maxSize = 600 // cards are small — 600px is plenty, keeps base64 size tiny
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
          else { width = Math.round((width * maxSize) / height); height = maxSize }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("Canvas not available")); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.75))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function ProfessionalProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin")
    }
  }, [status, router])

  if (status === "unauthenticated" || status === "loading" || !session?.user?.username) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#070C1C" }}>
        <p className="text-white/50">Loading…</p>
      </div>
    )
  }

  return <ProfessionalProfileInner username={session.user.username!} />
}

function ProfessionalProfileInner({ username }: { username: string }) {
  const utils = trpc.useUtils()
  const { data: profile, isLoading } = trpc.commission.getProfile.useQuery({ username })
  const { data: stats } = trpc.commission.getMyStats.useQuery()
  const { data: categories } = trpc.commission.getCategories.useQuery({ username })
  const { data: myCommissions } = trpc.commission.getMine.useQuery()
  const { data: postStats } = trpc.post.getMyPostStats.useQuery()

  const [dashTab, setDashTab] = useState<"dashboard" | "stats">("dashboard")

  // First-time commission setup modal
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<"OPEN" | "LIMITED">("OPEN")
  const [setupImage, setSetupImage] = useState<string | null>(null)
  const [setupProcessing, setSetupProcessing] = useState(false)
  const [setupStyle, setSetupStyle] = useState("")
  const [setupPrice, setSetupPrice] = useState("")
  const [setupTurnaround, setSetupTurnaround] = useState("")
  const [setupError, setSetupError] = useState("")

  async function handleSetupImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSetupProcessing(true)
    try { setSetupImage(await processImage(file)) }
    catch { setSetupError("Failed to process image.") }
    finally { setSetupProcessing(false) }
  }

  function handleStatusClick(s: "OPEN" | "LIMITED" | "CLOSED") {
    // First-time setup: no card images yet + switching to open/limited
    if ((s === "OPEN" || s === "LIMITED") && cardImages.length === 0 && !initialized) return // still loading
    if ((s === "OPEN" || s === "LIMITED") && cardImages.length === 0) {
      setPendingStatus(s)
      setShowSetupModal(true)
      return
    }
    setStatus(s)
  }

  // Settings form state
  const [status, setStatus] = useState<"OPEN" | "LIMITED" | "CLOSED">("CLOSED")
  const [description, setDescription] = useState("")
  const [turnaround, setTurnaround] = useState("")
  const [priceRanges, setPriceRanges] = useState<PriceRange[]>([])
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [cardImages, setCardImages] = useState<string[]>([])
  const [uploadingCard, setUploadingCard] = useState(false)
  const [cardUploadError, setCardUploadError] = useState("")
  const [cardImagesSaved, setCardImagesSaved] = useState(false)
  const [artStyles, setArtStyles] = useState<string[]>([])
  const [artStyleInput, setArtStyleInput] = useState("")

  // Initialize form from loaded profile
  useEffect(() => {
    if (profile && !initialized) {
      setStatus(profile.commissionStatus as "OPEN" | "LIMITED" | "CLOSED")
      setDescription(profile.commissionDescription ?? "")
      setTurnaround(profile.commissionTurnaround ?? "")
      setPriceRanges((profile.priceRanges as PriceRange[]) ?? [])
      setCardImages((profile.commissionCardImages as string[]) ?? [])
      setArtStyles((profile.artStyles as string[]) ?? [])
      setInitialized(true)
    }
  }, [profile, initialized])

  // New price range inputs
  const [newRangeLabel, setNewRangeLabel] = useState("")
  const [newRangePrice, setNewRangePrice] = useState("")

  // New category inputs
  const [newCatName, setNewCatName] = useState("")
  const [newCatOptionsList, setNewCatOptionsList] = useState<string[]>([])
  const [newCatOptionInput, setNewCatOptionInput] = useState("")
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState("")
  const [editCatOptionsList, setEditCatOptionsList] = useState<string[]>([])
  const [editCatOptionInput, setEditCatOptionInput] = useState("")

  const updateProfile = trpc.commission.updateProfile.useMutation({
    onSuccess: () => {
      utils.commission.getProfile.invalidate({ username })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    },
    onError: () => {
      alert("Failed to save settings. Please try again.")
    },
  })

  // Separate mutation for card images so it doesn't bundle large base64 with other settings
  const saveCardImages = trpc.commission.updateProfile.useMutation({
    onSuccess: () => {
      utils.commission.getProfile.invalidate({ username })
      setCardImagesSaved(true)
      setTimeout(() => setCardImagesSaved(false), 2000)
    },
    onError: () => {
      setCardUploadError("Failed to save images. Please try again.")
    },
  })

  function doSaveCardImages(images: string[]) {
    saveCardImages.mutate({
      commissionStatus: status,
      commissionCardImages: images,
    })
  }

  const createCategory = trpc.commission.createCategory.useMutation({
    onSuccess: () => {
      utils.commission.getCategories.invalidate({ username })
      setNewCatName("")
      setNewCatOptionsList([])
      setNewCatOptionInput("")
    },
  })

  const updateCategory = trpc.commission.updateCategory.useMutation({
    onSuccess: () => {
      utils.commission.getCategories.invalidate({ username })
      setEditingCat(null)
    },
  })

  const deleteCategory = trpc.commission.deleteCategory.useMutation({
    onSuccess: () => utils.commission.getCategories.invalidate({ username }),
  })

  function addPriceRange() {
    const price = parseFloat(newRangePrice)
    if (!newRangeLabel.trim() || isNaN(price) || price <= 0) return
    setPriceRanges(prev => [...prev, { label: newRangeLabel.trim(), price }])
    setNewRangeLabel("")
    setNewRangePrice("")
  }

  function removePriceRange(i: number) {
    setPriceRanges(prev => prev.filter((_, idx) => idx !== i))
  }

  function saveSettings() {
    // Card images save separately — don't bundle large base64 here
    updateProfile.mutate({ commissionStatus: status, commissionDescription: description, commissionTurnaround: turnaround, priceRanges, artStyles })
  }

  async function handleCardImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    if (cardImages.length + files.length > 5) {
      setCardUploadError("Maximum 5 commission card images")
      return
    }
    setCardUploadError("")
    setUploadingCard(true)
    try {
      const processed = await Promise.all(files.map(processImage))
      const next = [...cardImages, ...processed].slice(0, 5)
      setCardImages(next)
      doSaveCardImages(next) // auto-save immediately after upload
    } catch {
      setCardUploadError("Failed to process image. Please try a different file.")
    } finally {
      setUploadingCard(false)
    }
  }

  function removeCardImage(i: number) {
    const next = cardImages.filter((_, idx) => idx !== i)
    setCardImages(next)
    doSaveCardImages(next) // auto-save immediately after removal
  }

  function startEditCat(id: string, name: string, options: string[]) {
    setEditingCat(id)
    setEditCatName(name)
    setEditCatOptionsList(options)
    setEditCatOptionInput("")
  }

  function saveEditCat(id: string) {
    if (!editCatName.trim() || editCatOptionsList.length === 0) return
    updateCategory.mutate({ id, name: editCatName.trim(), options: editCatOptionsList })
  }

  function addCategory() {
    if (!newCatName.trim() || newCatOptionsList.length === 0) return
    createCategory.mutate({ name: newCatName.trim(), options: newCatOptionsList })
    setNewCatOptionsList([])
    setNewCatOptionInput("")
  }

  function addNewChip() {
    const trimmed = newCatOptionInput.trim()
    if (trimmed && !newCatOptionsList.includes(trimmed)) {
      setNewCatOptionsList(prev => [...prev, trimmed])
    }
    setNewCatOptionInput("")
  }

  function addEditChip() {
    const trimmed = editCatOptionInput.trim()
    if (trimmed && !editCatOptionsList.includes(trimmed)) {
      setEditCatOptionsList(prev => [...prev, trimmed])
    }
    setEditCatOptionInput("")
  }

  const statusColors = {
    OPEN: "bg-green-500/20 text-green-400 border-green-500/30",
    LIMITED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    CLOSED: "bg-white/10 text-white/30 border-white/15",
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#070C1C" }}>
        <p className="text-white/50">Loading…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
      <h1 className="text-2xl font-bold text-white mb-1">Artist Dashboard</h1>
      <p className="text-sm text-white/50 mb-5">Manage your commission settings and track your business.</p>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 p-1 rounded-xl" style={{ background: "#ffffff08" }}>
        {([["dashboard", "Dashboard"], ["stats", "Post Stats"]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setDashTab(val)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={dashTab === val
              ? { background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)", color: "#fff" }
              : { color: "rgba(255,255,255,0.4)" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Post Stats tab ── */}
      {dashTab === "stats" && (
        <div className="flex flex-col gap-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Posts", value: postStats?.totalPosts ?? 0 },
              { label: "Total Likes", value: postStats?.totalLikes ?? 0 },
              { label: "Total Comments", value: postStats?.totalComments ?? 0 },
              { label: "Avg Likes / Post", value: postStats?.avgLikes ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: "#0A1030", border: "1px solid #ffffff10" }}>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-white/50">{label}</p>
              </div>
            ))}
          </div>

          {/* Per-post breakdown */}
          {postStats && postStats.posts.length > 0 ? (
            <section className="rounded-2xl overflow-hidden" style={{ background: "#0A1030", border: "1px solid #ffffff10" }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #ffffff10" }}>
                <h2 className="text-sm font-bold text-white/70 uppercase tracking-wide">Posts by Likes</h2>
                <p className="text-xs text-white/30">{postStats.posts.length} posts</p>
              </div>
              {[...postStats.posts]
                .sort((a, b) => b.likes - a.likes)
                .map((post, i) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 px-5 py-3"
                    style={{ borderBottom: "1px solid #ffffff08" }}
                  >
                    {/* Rank */}
                    <span className="text-xs font-bold w-5 text-center flex-shrink-0" style={{ color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "rgba(255,255,255,0.2)" }}>
                      {i + 1}
                    </span>
                    {/* Thumbnail */}
                    <img src={post.image} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                    {/* Caption */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{post.description ?? <span className="text-white/30 italic">No caption</span>}</p>
                      <p className="text-xs text-white/30 mt-0.5">
                        {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {post.isAiGenerated && " · AI"}
                        {post.isCommission && " · Commission"}
                      </p>
                    </div>
                    {/* Stats */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-sm font-semibold text-white flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                        {post.likes}
                      </span>
                      <span className="text-xs text-white/40 flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        {post.comments}
                      </span>
                    </div>
                  </div>
                ))}
            </section>
          ) : (
            <div className="text-center py-16 rounded-2xl" style={{ background: "#0A1030", border: "1px solid #ffffff10" }}>
              <div className="text-4xl mb-3">🖼️</div>
              <p className="font-medium text-white/50">No posts yet</p>
              <p className="text-sm text-white/30 mt-1">Post some art to start tracking stats</p>
            </div>
          )}
        </div>
      )}

      {dashTab === "dashboard" && (<>

      {/* ── Active Commissions ── */}
      {myCommissions?.asArtist && myCommissions.asArtist.filter(c => !["COMPLETE","DECLINED","CANCELLED"].includes(c.status)).length > 0 && (
        <section className="rounded-2xl overflow-hidden mb-6" style={{ background: "#0A1030", border: "1px solid #ffffff10" }}>
          <div className="px-6 py-4" style={{ borderBottom: "1px solid #ffffff10" }}>
            <h2 className="text-sm font-bold text-white/70 uppercase tracking-wide">Active Commissions</h2>
          </div>
          {myCommissions.asArtist
            .filter(c => !["COMPLETE","DECLINED","CANCELLED"].includes(c.status))
            .map(c => {
              const commissionStatusColors: Record<string, string> = {
                PENDING: "bg-yellow-500/20 text-yellow-400",
                ACCEPTED: "bg-blue-500/20 text-blue-400",
                IN_PROGRESS: "bg-blue-500/20 text-blue-400",
                DELIVERED: "bg-sky-500/20 text-sky-400",
              }
              const statusLabels: Record<string, string> = {
                PENDING: "Pending",
                ACCEPTED: "Accepted",
                IN_PROGRESS: "In progress",
                DELIVERED: "Delivered",
              }
              return (
                <a
                  key={c.id}
                  href={`/professional-dms/${c.id}`}
                  className="flex items-center gap-3 px-6 py-3.5 hover:bg-white/5 transition-colors last:border-0"
                  style={{ borderBottom: "1px solid #ffffff08" }}
                >
                  <Avatar src={c.buyer?.image} name={c.buyer?.name} username={c.buyer?.username} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">@{c.buyer?.username ?? "unknown"}</p>
                    <p className="text-xs text-white/40 truncate mt-0.5">{c.description}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${commissionStatusColors[c.status] ?? "bg-white/10 text-white/40"}`}>
                    {statusLabels[c.status] ?? c.status}
                  </span>
                  <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              )
            })}
        </section>
      )}

      {/* ── Business Overview ── */}
      <section className="rounded-2xl p-6 mb-6" style={{ background: "#0A1030", border: "1px solid #ffffff10" }}>
        <h2 className="text-sm font-bold text-white/70 uppercase tracking-wide mb-4">Business Overview</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{stats?.activeCount ?? 0}</p>
            <p className="text-xs text-white/50 mt-1">Active commissions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">${(stats?.escrowHeld ?? 0).toFixed(2)}</p>
            <p className="text-xs text-white/50 mt-1">In escrow</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">${(stats?.totalEarned ?? 0).toFixed(2)}</p>
            <p className="text-xs text-white/50 mt-1">Total earned</p>
          </div>
        </div>
      </section>

      {/* ── Commission Settings ── */}
      <section className="rounded-2xl p-6 mb-6" style={{ background: "#0A1030", border: "1px solid #ffffff10" }}>
        <h2 className="text-sm font-bold text-white/70 uppercase tracking-wide mb-4">Commission Settings</h2>

        {/* Status */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 block mb-2">Status</label>
          <div className="flex gap-2">
            {(["OPEN", "LIMITED", "CLOSED"] as const).map(s => (
              <button
                key={s}
                onClick={() => handleStatusClick(s)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  status === s ? statusColors[s] : "bg-white/5 text-white/40 hover:bg-white/10"
                }`}
                style={status !== s ? { borderColor: "#ffffff10" } : undefined}
              >
                {s === "OPEN" ? "Open" : s === "LIMITED" ? "Limited" : "Closed"}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 block mb-2">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Tell buyers what you offer, your style, any terms…"
            rows={4}
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
            style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
          />
        </div>

        {/* Turnaround */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-white/60 block mb-2">Turnaround time</label>
          <input
            type="text"
            value={turnaround}
            onChange={e => setTurnaround(e.target.value)}
            placeholder="e.g. 1–2 weeks"
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
          />
        </div>

        {/* Price ranges */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 block mb-2">Price ranges</label>
          {priceRanges.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {priceRanges.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "#ffffff10", border: "1px solid #ffffff10" }}>
                  <span className="text-sm text-white/70">{r.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">${r.price}</span>
                    <button
                      onClick={() => removePriceRange(i)}
                      className="text-white/40 hover:text-red-500 transition-colors text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newRangeLabel}
              onChange={e => setNewRangeLabel(e.target.value)}
              placeholder="Label (e.g. Bust)"
              className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
            />
            <input
              type="number"
              value={newRangePrice}
              onChange={e => setNewRangePrice(e.target.value)}
              placeholder="Price ($)"
              min="0"
              className="w-28 px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
            />
            <button
              onClick={addPriceRange}
              className="px-4 py-2 text-white rounded-xl text-sm font-medium transition-colors"
              style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}
            >
              Add
            </button>
          </div>
        </div>

        {/* ── Commission Card Images ── */}
        <div className="mt-6 pt-6" style={{ borderTop: "1px solid #ffffff10" }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-white/70">Commission Card Images</h3>
            {saveCardImages.isPending && <span className="text-xs text-white/40">Saving…</span>}
            {cardImagesSaved && !saveCardImages.isPending && <span className="text-xs text-green-400 font-medium">✓ Saved</span>}
          </div>
          <p className="text-xs text-white/40 mb-3">Up to 5 images shown on your commission card in the discovery feed. Separate from your portfolio.</p>

          {cardImages.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {cardImages.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1px solid #ffffff10" }}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeCardImage(i)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {cardUploadError && <p className="text-xs text-red-500 mb-2">{cardUploadError}</p>}

          {cardImages.length < 5 && (
            <label className="flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl hover:bg-white/5 transition-colors" style={{ border: "1px dashed #ffffff30" }}>
              <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm text-white/50">{uploadingCard ? "Processing…" : `Add image (${cardImages.length}/5)`}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleCardImageUpload} disabled={uploadingCard} />
            </label>
          )}
        </div>

        {/* ── Art Styles ── */}
        <div className="mt-6 pt-6" style={{ borderTop: "1px solid #ffffff10" }}>
          <h3 className="text-sm font-bold text-white/70 mb-1">Art Styles</h3>
          <p className="text-xs text-white/40 mb-3">Tags shown on your commission card to help buyers find you (e.g. Anime, Realistic, Chibi).</p>

          {artStyles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {artStyles.map(s => (
                <span key={s} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(176, 68, 248, 0.15)", color: "#d580ff", border: "1px solid rgba(176, 68, 248, 0.3)" }}>
                  {s}
                  <button type="button" onClick={() => setArtStyles(prev => prev.filter(x => x !== s))} className="ml-0.5 opacity-70 hover:opacity-100">×</button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={artStyleInput}
              onChange={e => setArtStyleInput(e.target.value)}
              onKeyDown={e => {
                if ((e.key === "Enter" || e.key === ",") && artStyleInput.trim()) {
                  e.preventDefault()
                  const trimmed = artStyleInput.trim().replace(/,$/, "")
                  if (trimmed && !artStyles.includes(trimmed) && artStyles.length < 20) {
                    setArtStyles(prev => [...prev, trimmed])
                  }
                  setArtStyleInput("")
                }
              }}
              placeholder="Type a style, press Enter…"
              className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = artStyleInput.trim()
                if (trimmed && !artStyles.includes(trimmed) && artStyles.length < 20) {
                  setArtStyles(prev => [...prev, trimmed])
                  setArtStyleInput("")
                }
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-white/60 hover:bg-white/10 transition-colors"
              style={{ background: "#ffffff10" }}
            >
              Add
            </button>
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={updateProfile.isPending}
          className="w-full mt-6 text-white py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}
        >
          {updateProfile.isPending ? "Saving…" : settingsSaved ? "✓ Saved" : "Save settings"}
        </button>
      </section>

      {/* ── Dropdown Categories ── */}
      <section className="rounded-2xl p-6" style={{ background: "#0A1030", border: "1px solid #ffffff10" }}>
        <h2 className="text-sm font-bold text-white/70 uppercase tracking-wide mb-1">Commission Form Options</h2>
        <p className="text-xs text-white/40 mb-4">These dropdowns appear on your commission request form. Each is mandatory for buyers.</p>

        {categories && categories.length > 0 && (
          <div className="flex flex-col gap-3 mb-4">
            {categories.map(cat => (
              <div key={cat.id} className="rounded-xl p-4" style={{ background: "#ffffff08", border: "1px solid #ffffff10" }}>
                {editingCat === cat.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      value={editCatName}
                      onChange={e => setEditCatName(e.target.value)}
                      className="px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                      style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
                      placeholder="Category name"
                    />
                    {editCatOptionsList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {editCatOptionsList.map(opt => (
                          <span key={opt} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(176, 68, 248, 0.15)", color: "#d580ff", border: "1px solid rgba(176, 68, 248, 0.3)" }}>
                            {opt}
                            <button type="button" onClick={() => setEditCatOptionsList(prev => prev.filter(o => o !== opt))} className="ml-0.5 opacity-70 hover:opacity-100">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={editCatOptionInput}
                        onChange={e => setEditCatOptionInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addEditChip() } }}
                        className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                        style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
                        placeholder="Add option, press Enter"
                      />
                      <button
                        type="button"
                        onClick={addEditChip}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-white/60 hover:bg-white/10 transition-colors"
                        style={{ background: "#ffffff10" }}
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => saveEditCat(cat.id)}
                        className="flex-1 px-3 py-2 text-white rounded-xl text-xs font-semibold transition-opacity"
                        style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCat(null)}
                        className="px-3 py-2 rounded-xl text-xs text-white/50 hover:bg-white/5 transition-colors"
                        style={{ border: "1px solid #ffffff10" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white mb-1.5">{cat.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.options.map(opt => (
                          <span key={opt} className="text-xs text-white/60 px-2.5 py-0.5 rounded-full" style={{ background: "#ffffff10", border: "1px solid #ffffff10" }}>{opt}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => startEditCat(cat.id, cat.name, cat.options)}
                        className="text-xs text-white/50 hover:text-white transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteCategory.mutate({ id: cat.id })}
                        className="text-xs text-red-500 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new category */}
        <div className="flex flex-col gap-2 pt-3" style={{ borderTop: "1px solid #ffffff10" }}>
          <p className="text-xs font-semibold text-white/60">Add a category</p>
          <input
            type="text"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Category name (e.g. Art Style)"
            className="px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
          />
          {newCatOptionsList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {newCatOptionsList.map(opt => (
                <span key={opt} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(176, 68, 248, 0.15)", color: "#d580ff", border: "1px solid rgba(176, 68, 248, 0.3)" }}>
                  {opt}
                  <button type="button" onClick={() => setNewCatOptionsList(prev => prev.filter(o => o !== opt))} className="ml-0.5 opacity-70 hover:opacity-100">×</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newCatOptionInput}
              onChange={e => setNewCatOptionInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addNewChip() } }}
              placeholder="Add option, press Enter (e.g. Anime)"
              className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
            />
            <button
              type="button"
              onClick={addNewChip}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-white/60 hover:bg-white/10 transition-colors"
              style={{ background: "#ffffff10" }}
            >
              Add
            </button>
          </div>
          <button
            onClick={addCategory}
            disabled={createCategory.isPending || !newCatName.trim() || newCatOptionsList.length === 0}
            className="px-4 py-2 text-white rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}
          >
            {createCategory.isPending ? "Adding…" : "Save category"}
          </button>
        </div>
      </section>
      </>)}

      {/* ── First-time commission setup modal ── */}
      {showSetupModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto" style={{ background: "#0D1640", border: "1px solid #ffffff15" }}>
            {/* Header */}
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Set up your commission profile</h2>
              <p className="text-sm text-white/50">Fill this out before opening — buyers will see this on your card.</p>
            </div>

            {/* Image */}
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-2">Example artwork <span className="text-red-400">*</span></label>
              {setupImage ? (
                <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "3/4" }}>
                  <img src={setupImage} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setSetupImage(null)}
                    className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/80"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center rounded-xl h-40 cursor-pointer hover:bg-white/5 transition-colors" style={{ border: "2px dashed #ffffff25" }}>
                  <svg className="w-6 h-6 text-white/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-white/40">{setupProcessing ? "Processing…" : "Click to upload image"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleSetupImageFile} disabled={setupProcessing} />
                </label>
              )}
            </div>

            {/* Art style */}
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-2">Art style <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={setupStyle}
                onChange={e => setSetupStyle(e.target.value)}
                placeholder="e.g. Anime, Realistic, Chibi…"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sky-500"
                style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
              />
            </div>

            {/* Average price */}
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-2">Average price <span className="text-red-400">*</span></label>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}>
                <span className="text-white/50 text-sm">$</span>
                <input
                  type="number"
                  value={setupPrice}
                  onChange={e => setSetupPrice(e.target.value)}
                  placeholder="50"
                  min="1"
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"
                />
              </div>
            </div>

            {/* Average turnaround */}
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-2">Average turnaround <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={setupTurnaround}
                onChange={e => setSetupTurnaround(e.target.value)}
                placeholder="e.g. 1–2 weeks"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sky-500"
                style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
              />
            </div>

            {setupError && <p className="text-sm text-red-400">{setupError}</p>}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowSetupModal(false); setSetupError("") }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/50 hover:text-white transition-colors"
                style={{ border: "1px solid #ffffff20" }}
              >
                Cancel
              </button>
              <button
                disabled={!setupImage || !setupStyle.trim() || !setupPrice || !setupTurnaround.trim() || updateProfile.isPending || setupProcessing}
                onClick={() => {
                  const price = parseFloat(setupPrice)
                  if (!setupImage || !setupStyle.trim() || isNaN(price) || price <= 0 || !setupTurnaround.trim()) {
                    setSetupError("Please fill out all fields.")
                    return
                  }
                  setSetupError("")
                  updateProfile.mutate({
                    commissionStatus: pendingStatus,
                    commissionDescription: description,
                    commissionTurnaround: setupTurnaround.trim(),
                    priceRanges: [{ label: "Standard", price }],
                    commissionCardImages: [setupImage],
                    artStyles: [setupStyle.trim()],
                  }, {
                    onSuccess: () => {
                      setStatus(pendingStatus)
                      setCardImages([setupImage])
                      setArtStyles([setupStyle.trim()])
                      setPriceRanges([{ label: "Standard", price }])
                      setTurnaround(setupTurnaround.trim())
                      setShowSetupModal(false)
                      setSetupImage(null)
                      setSetupStyle("")
                      setSetupPrice("")
                      setSetupTurnaround("")
                    },
                    onError: () => setSetupError("Failed to save. Please try again."),
                  })
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}
              >
                {updateProfile.isPending ? "Saving…" : `Open for commissions`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
