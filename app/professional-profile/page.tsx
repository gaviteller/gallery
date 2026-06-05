"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"
import { PageSkeleton } from "@/components/Skeleton"
import { uploadImage } from "@/lib/upload"

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
    return <PageSkeleton />
  }

  return <ProfessionalProfileInner username={session.user.username!} />
}

function ProfessionalProfileInner({ username }: { username: string }) {
  const utils = trpc.useUtils()
  const { data: profile, isLoading } = trpc.commission.getProfile.useQuery({ username })
  const { data: stats } = trpc.commission.getMyStats.useQuery()
  const { data: categories } = trpc.commission.getCategories.useQuery({ username })
  const { data: myCommissions } = trpc.commission.getMine.useQuery()

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

  async function doSaveCardImages(images: string[]) {
    try {
      const urls = await Promise.all(
        images.map(img =>
          img.startsWith("data:") ? uploadImage(img, "commissions") : Promise.resolve(img)
        )
      )
      saveCardImages.mutate({
        commissionStatus: status,
        commissionCardImages: urls,
      })
    } catch (err) {
      setCardUploadError("Failed to upload images. Please try again.")
    }
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
    return <PageSkeleton />
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
      <h1 className="text-2xl font-bold text-white mb-1">Artist Dashboard</h1>
      <p className="text-sm text-white/50 mb-8">Manage your commission settings and track your business.</p>

      {/* ── Active Commissions ── */}
      {myCommissions?.asArtist && myCommissions.asArtist.filter(c => !["COMPLETE","DECLINED","CANCELLED"].includes(c.status)).length > 0 && (
        <section className="rounded-2xl overflow-hidden mb-6" style={{ background: "#111118", border: "1px solid #ffffff10" }}>
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
                DELIVERED: "bg-purple-500/20 text-purple-400",
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
      <section className="rounded-2xl p-6 mb-6" style={{ background: "#111118", border: "1px solid #ffffff10" }}>
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
      <section className="rounded-2xl p-6 mb-6" style={{ background: "#111118", border: "1px solid #ffffff10" }}>
        <h2 className="text-sm font-bold text-white/70 uppercase tracking-wide mb-4">Commission Settings</h2>

        {/* Status */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 block mb-2">Status</label>
          <div className="flex gap-2">
            {(["OPEN", "LIMITED", "CLOSED"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
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
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
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
          style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
        >
          {updateProfile.isPending ? "Saving…" : settingsSaved ? "✓ Saved" : "Save settings"}
        </button>
      </section>

      {/* ── Dropdown Categories ── */}
      <section className="rounded-2xl p-6" style={{ background: "#111118", border: "1px solid #ffffff10" }}>
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
                        style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
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
            style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
          >
            {createCategory.isPending ? "Adding…" : "Save category"}
          </button>
        </div>
      </section>
    </div>
  )
}
