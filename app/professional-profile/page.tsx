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
        const maxSize = 1200
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
          else { width = Math.round((width * maxSize) / height); height = maxSize }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("Canvas not available")); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.85))
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
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
    updateProfile.mutate({ commissionStatus: status, commissionDescription: description, commissionTurnaround: turnaround, priceRanges, commissionCardImages: cardImages, artStyles })
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
      setCardImages(prev => [...prev, ...processed].slice(0, 5))
    } catch {
      setCardUploadError("Failed to process image. Please try a different file.")
    } finally {
      setUploadingCard(false)
    }
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
    OPEN: "bg-green-100 text-green-700 border-green-200",
    LIMITED: "bg-yellow-100 text-yellow-700 border-yellow-200",
    CLOSED: "bg-gray-100 text-gray-600 border-gray-200",
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Artist Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">Manage your commission settings and track your business.</p>

      {/* ── Active Commissions ── */}
      {myCommissions?.asArtist && myCommissions.asArtist.filter(c => !["COMPLETE","DECLINED","CANCELLED"].includes(c.status)).length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Active Commissions</h2>
          </div>
          {myCommissions.asArtist
            .filter(c => !["COMPLETE","DECLINED","CANCELLED"].includes(c.status))
            .map(c => {
              const statusColors: Record<string, string> = {
                PENDING: "bg-yellow-100 text-yellow-700",
                ACCEPTED: "bg-blue-100 text-blue-700",
                IN_PROGRESS: "bg-blue-100 text-blue-700",
                DELIVERED: "bg-purple-100 text-purple-700",
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
                  className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <Avatar src={c.buyer?.image} name={c.buyer?.name} username={c.buyer?.username} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">@{c.buyer?.username ?? "unknown"}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{c.description}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {statusLabels[c.status] ?? c.status}
                  </span>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              )
            })}
        </section>
      )}

      {/* ── Business Overview ── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Business Overview</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats?.activeCount ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Active commissions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">${(stats?.escrowHeld ?? 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">In escrow</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">${(stats?.totalEarned ?? 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Total earned</p>
          </div>
        </div>
      </section>

      {/* ── Commission Settings ── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Commission Settings</h2>

        {/* Status */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 block mb-2">Status</label>
          <div className="flex gap-2">
            {(["OPEN", "LIMITED", "CLOSED"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  status === s ? statusColors[s] : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {s === "OPEN" ? "Open" : s === "LIMITED" ? "Limited" : "Closed"}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 block mb-2">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Tell buyers what you offer, your style, any terms…"
            rows={4}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Turnaround */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-gray-600 block mb-2">Turnaround time</label>
          <input
            type="text"
            value={turnaround}
            onChange={e => setTurnaround(e.target.value)}
            placeholder="e.g. 1–2 weeks"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Price ranges */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 block mb-2">Price ranges</label>
          {priceRanges.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {priceRanges.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-sm text-gray-700">{r.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">${r.price}</span>
                    <button
                      onClick={() => removePriceRange(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors text-xs"
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
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={newRangePrice}
              onChange={e => setNewRangePrice(e.target.value)}
              placeholder="Price ($)"
              min="0"
              className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addPriceRange}
              className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={updateProfile.isPending}
          className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {updateProfile.isPending ? "Saving…" : settingsSaved ? "✓ Saved" : "Save settings"}
        </button>
      </section>

      {/* ── Commission Card Images ── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">Commission Card Images</h2>
        <p className="text-xs text-gray-400 mb-4">Up to 5 images shown on your commission card in the discovery feed. Separate from your portfolio.</p>

        {cardImages.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            {cardImages.map((img, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setCardImages(prev => prev.filter((_, idx) => idx !== i))}
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
          <label className="flex items-center gap-2 cursor-pointer px-4 py-3 border border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm text-gray-500">{uploadingCard ? "Processing…" : `Add image (${cardImages.length}/5)`}</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleCardImageUpload} disabled={uploadingCard} />
          </label>
        )}

        <p className="text-xs text-gray-400 mt-3">Changes are saved when you click "Save settings" above.</p>
      </section>

      {/* ── Art Styles ── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">Art Styles</h2>
        <p className="text-xs text-gray-400 mb-3">Tags shown on your commission card to help clients find you.</p>

        {artStyles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {artStyles.map(s => (
              <span key={s} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                {s}
                <button type="button" onClick={() => setArtStyles(prev => prev.filter(x => x !== s))} className="text-blue-400 hover:text-blue-700 ml-0.5">×</button>
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
            placeholder="Add style, press Enter (e.g. Anime, Realistic)"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">Changes are saved when you click "Save settings" above.</p>
      </section>

      {/* ── Dropdown Categories ── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">Commission Form Options</h2>
        <p className="text-xs text-gray-400 mb-4">These dropdowns appear on your commission request form. Each is mandatory for buyers.</p>

        {categories && categories.length > 0 && (
          <div className="flex flex-col gap-3 mb-4">
            {categories.map(cat => (
              <div key={cat.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                {editingCat === cat.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      value={editCatName}
                      onChange={e => setEditCatName(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Category name"
                    />
                    {editCatOptionsList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {editCatOptionsList.map(opt => (
                          <span key={opt} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                            {opt}
                            <button type="button" onClick={() => setEditCatOptionsList(prev => prev.filter(o => o !== opt))} className="text-blue-400 hover:text-blue-700 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={editCatOptionInput}
                        onChange={e => setEditCatOptionInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addEditChip() } }}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Add option, press Enter"
                      />
                      <button type="button" onClick={addEditChip} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors">Add</button>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => saveEditCat(cat.id)}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCat(null)}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 mb-1.5">{cat.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.options.map(opt => (
                          <span key={opt} className="text-xs bg-white border border-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full">{opt}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => startEditCat(cat.id, cat.name, cat.options)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteCategory.mutate({ id: cat.id })}
                        className="text-xs text-red-500 hover:underline"
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
        <div className="flex flex-col gap-2 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-600">Add a category</p>
          <input
            type="text"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Category name (e.g. Art Style)"
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {newCatOptionsList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {newCatOptionsList.map(opt => (
                <span key={opt} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                  {opt}
                  <button type="button" onClick={() => setNewCatOptionsList(prev => prev.filter(o => o !== opt))} className="text-blue-400 hover:text-blue-700 ml-0.5">×</button>
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
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="button" onClick={addNewChip} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors">Add</button>
          </div>
          <button
            onClick={addCategory}
            disabled={createCategory.isPending || !newCatName.trim() || newCatOptionsList.length === 0}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-40"
          >
            {createCategory.isPending ? "Adding…" : "Save category"}
          </button>
        </div>
      </section>
    </div>
  )
}
