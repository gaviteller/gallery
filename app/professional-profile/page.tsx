"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

type PriceRange = { label: string; price: number }

export default function ProfessionalProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === "unauthenticated") {
    router.push("/signin")
    return null
  }

  if (status === "loading" || !session?.user?.username) {
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

  // Settings form state
  const [status, setStatus] = useState<"OPEN" | "LIMITED" | "CLOSED">("CLOSED")
  const [description, setDescription] = useState("")
  const [turnaround, setTurnaround] = useState("")
  const [priceRanges, setPriceRanges] = useState<PriceRange[]>([])
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Initialize form from loaded profile
  if (profile && !initialized) {
    setStatus(profile.commissionStatus as "OPEN" | "LIMITED" | "CLOSED")
    setDescription(profile.commissionDescription ?? "")
    setTurnaround(profile.commissionTurnaround ?? "")
    setPriceRanges((profile.priceRanges as PriceRange[]) ?? [])
    setInitialized(true)
  }

  // New price range inputs
  const [newRangeLabel, setNewRangeLabel] = useState("")
  const [newRangePrice, setNewRangePrice] = useState("")

  // New category inputs
  const [newCatName, setNewCatName] = useState("")
  const [newCatOptions, setNewCatOptions] = useState("")
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState("")
  const [editCatOptions, setEditCatOptions] = useState("")

  const updateProfile = trpc.commission.updateProfile.useMutation({
    onSuccess: () => {
      utils.commission.getProfile.invalidate({ username })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    },
  })

  const createCategory = trpc.commission.createCategory.useMutation({
    onSuccess: () => {
      utils.commission.getCategories.invalidate({ username })
      setNewCatName("")
      setNewCatOptions("")
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
    updateProfile.mutate({ commissionStatus: status, commissionDescription: description, commissionTurnaround: turnaround, priceRanges })
  }

  function startEditCat(id: string, name: string, options: string[]) {
    setEditingCat(id)
    setEditCatName(name)
    setEditCatOptions(options.join(", "))
  }

  function saveEditCat(id: string) {
    const opts = editCatOptions.split(",").map(o => o.trim()).filter(Boolean)
    if (!editCatName.trim() || opts.length === 0) return
    updateCategory.mutate({ id, name: editCatName.trim(), options: opts })
  }

  function addCategory() {
    const opts = newCatOptions.split(",").map(o => o.trim()).filter(Boolean)
    if (!newCatName.trim() || opts.length === 0) return
    createCategory.mutate({ name: newCatName.trim(), options: opts })
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
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Professional Profile</h1>
      <p className="text-sm text-gray-500 mb-8">Manage your commission settings and view your business overview.</p>

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
                    <input
                      value={editCatOptions}
                      onChange={e => setEditCatOptions(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Options, comma separated"
                    />
                    <div className="flex gap-2">
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
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{cat.options.join(", ")}</p>
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
          <p className="text-xs font-semibold text-gray-600">Add a dropdown category</p>
          <input
            type="text"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Category name (e.g. Art Style)"
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={newCatOptions}
            onChange={e => setNewCatOptions(e.target.value)}
            placeholder="Options, comma separated (e.g. Anime, Realistic, Chibi)"
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addCategory}
            disabled={createCategory.isPending}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {createCategory.isPending ? "Adding…" : "Add category"}
          </button>
        </div>
      </section>
    </div>
  )
}
