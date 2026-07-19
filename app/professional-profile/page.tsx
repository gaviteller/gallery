"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"
import { uploadImage } from "@/lib/upload"

type PriceRange = { label: string; price: number }

const GRADIENT = "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)"

function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.onload = (e) => {
      const img = new window.Image()
      img.onerror = () => reject(new Error("Failed to load image"))
      img.onload = () => {
        let { width, height } = img
        const maxSize = 600
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
    if (status === "unauthenticated") router.push("/signin")
  }, [status, router])

  if (status === "unauthenticated" || status === "loading" || !session?.user?.username) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Loading…</p>
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
  const { data: mySales } = trpc.shop.getMySales.useQuery()

  const [commStatus, setCommStatus] = useState<"OPEN" | "LIMITED" | "CLOSED">("CLOSED")
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
  const [newRangeLabel, setNewRangeLabel] = useState("")
  const [newRangePrice, setNewRangePrice] = useState("")
  const [newCatName, setNewCatName] = useState("")
  const [newCatOptionsList, setNewCatOptionsList] = useState<string[]>([])
  const [newCatOptionInput, setNewCatOptionInput] = useState("")
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState("")
  const [editCatOptionsList, setEditCatOptionsList] = useState<string[]>([])
  const [editCatOptionInput, setEditCatOptionInput] = useState("")

  useEffect(() => {
    if (profile && !initialized) {
      setCommStatus(profile.commissionStatus as "OPEN" | "LIMITED" | "CLOSED")
      setDescription(profile.commissionDescription ?? "")
      setTurnaround(profile.commissionTurnaround ?? "")
      setPriceRanges((profile.priceRanges as PriceRange[]) ?? [])
      setCardImages((profile.commissionCardImages as string[]) ?? [])
      setArtStyles((profile.artStyles as string[]) ?? [])
      setInitialized(true)
    }
  }, [profile, initialized])

  const updateProfile = trpc.commission.updateProfile.useMutation({
    onSuccess: () => {
      utils.commission.getProfile.invalidate({ username })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    },
    onError: () => alert("Failed to save settings. Please try again."),
  })

  const saveCardImages = trpc.commission.updateProfile.useMutation({
    onSuccess: () => utils.commission.getProfile.invalidate({ username }),
    onError: () => setCardUploadError("Failed to save images. Please try again."),
  })

  async function doSaveCardImages(images: string[]) {
    try {
      const urls = await Promise.all(
        images.map(img => img.startsWith("data:") ? uploadImage(img, "commissions") : Promise.resolve(img))
      )
      saveCardImages.mutate({ commissionStatus: commStatus, commissionCardImages: urls })
    } catch {
      setCardUploadError("Failed to upload images. Please try again.")
    }
  }

  const createCategory = trpc.commission.createCategory.useMutation({
    onSuccess: () => {
      utils.commission.getCategories.invalidate({ username })
      setNewCatName(""); setNewCatOptionsList([]); setNewCatOptionInput("")
    },
  })

  const updateCategory = trpc.commission.updateCategory.useMutation({
    onSuccess: () => { utils.commission.getCategories.invalidate({ username }); setEditingCat(null) },
  })

  const deleteCategory = trpc.commission.deleteCategory.useMutation({
    onSuccess: () => utils.commission.getCategories.invalidate({ username }),
  })

  function addPriceRange() {
    const price = parseFloat(newRangePrice)
    if (!newRangeLabel.trim() || isNaN(price) || price <= 0) return
    setPriceRanges(prev => [...prev, { label: newRangeLabel.trim(), price }])
    setNewRangeLabel(""); setNewRangePrice("")
  }

  function saveSettings() {
    updateProfile.mutate({ commissionStatus: commStatus, commissionDescription: description, commissionTurnaround: turnaround, priceRanges, artStyles })
  }

  async function handleCardImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    if (cardImages.length + files.length > 5) { setCardUploadError("Maximum 5 commission card images"); return }
    setCardUploadError(""); setUploadingCard(true)
    try {
      const processed = await Promise.all(files.map(processImage))
      const next = [...cardImages, ...processed].slice(0, 5)
      setCardImages(next)
      await doSaveCardImages(next)
    } catch {
      setCardUploadError("Failed to process image. Please try a different file.")
    } finally {
      setUploadingCard(false)
    }
  }

  function removeCardImage(i: number) {
    const next = cardImages.filter((_, idx) => idx !== i)
    setCardImages(next); doSaveCardImages(next)
  }

  function startEditCat(id: string, name: string, options: string[]) {
    setEditingCat(id); setEditCatName(name); setEditCatOptionsList(options); setEditCatOptionInput("")
  }

  function saveEditCat(id: string) {
    if (!editCatName.trim() || editCatOptionsList.length === 0) return
    updateCategory.mutate({ id, name: editCatName.trim(), options: editCatOptionsList })
  }

  function addCategory() {
    if (!newCatName.trim() || newCatOptionsList.length === 0) return
    createCategory.mutate({ name: newCatName.trim(), options: newCatOptionsList })
  }

  function addNewChip() {
    const t = newCatOptionInput.trim()
    if (t && !newCatOptionsList.includes(t)) setNewCatOptionsList(prev => [...prev, t])
    setNewCatOptionInput("")
  }

  function addEditChip() {
    const t = editCatOptionInput.trim()
    if (t && !editCatOptionsList.includes(t)) setEditCatOptionsList(prev => [...prev, t])
    setEditCatOptionInput("")
  }

  // Compute 7-day bar chart data
  const salesByDay = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dayStr = d.toISOString().slice(0, 10)
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3),
      total: (mySales ?? []).filter(s => new Date(s.createdAt).toISOString().slice(0, 10) === dayStr)
        .reduce((sum, s) => sum + s.sellerPayout, 0),
    }
  })
  const maxDay = Math.max(...salesByDay.map(d => d.total), 1)

  // Compute trust rating from completed commissions
  const completedWithRating = (myCommissions?.asArtist ?? []).filter(c => c.status === "COMPLETE" && (c as any).rating != null)
  const avgRating = completedWithRating.length > 0
    ? (completedWithRating.reduce((s, c) => s + ((c as any).rating ?? 0), 0) / completedWithRating.length).toFixed(1)
    : null

  // Active commissions (artist side, non-terminal)
  const activeWork = (myCommissions?.asArtist ?? []).filter(c => !["COMPLETE", "DECLINED", "CANCELLED"].includes(c.status))

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Loading…</p>
      </div>
    )
  }

  const S: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: "var(--bg)", paddingBottom: 100 },
    inner: { maxWidth: 480, margin: "0 auto", padding: "20px 16px" },
    secHead: { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: 8, fontFamily: "Inter,sans-serif" },
    fieldLabel: { fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 7, fontFamily: "Inter,sans-serif" },
    inp: { width: "100%", boxSizing: "border-box", background: "rgba(240,235,248,0.05)", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 11, color: "var(--text)", fontFamily: "Inter,sans-serif", outline: "none" },
    chipBtn: { fontSize: 10, fontWeight: 600, padding: "7px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "rgba(240,235,248,0.05)", color: "var(--muted)", cursor: "pointer", fontFamily: "Inter,sans-serif" },
  }

  return (
    <div style={S.page}>
      {/* Nav */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--nav)", borderBottom: "1px solid var(--border)", padding: "11px 16px" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Artist Dashboard</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2, fontFamily: "Inter,sans-serif" }}>Manage commissions and track your business.</div>
      </div>

      <div style={S.inner}>

        {/* Status toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {(["OPEN", "LIMITED", "CLOSED"] as const).map(s => (
            <button
              key={s}
              onClick={() => setCommStatus(s)}
              style={{
                flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 8, fontSize: 10, fontWeight: 700,
                fontFamily: "Inter,sans-serif", cursor: "pointer",
                ...(commStatus === s
                  ? s === "OPEN"
                    ? { background: "rgba(72,200,120,0.12)", color: "#48C878", border: "1px solid rgba(72,200,120,0.3)" }
                    : s === "LIMITED"
                      ? { background: "rgba(255,180,60,0.12)", color: "#FFB43C", border: "1px solid rgba(255,180,60,0.28)" }
                      : { background: "rgba(240,60,60,0.08)", color: "#F06060", border: "1px solid rgba(240,60,60,0.2)" }
                  : { background: "rgba(240,235,248,0.03)", color: "var(--muted)", border: "1px solid var(--border)" }),
              }}
            >
              {s === "OPEN" && commStatus === "OPEN" && (
                <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#48C878", marginRight: 4, verticalAlign: "middle" }} />
              )}
              {s === "OPEN" ? "Open" : s === "LIMITED" ? "Limited" : "Closed"}
            </button>
          ))}
        </div>

        {/* 2×2 metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
          {/* Total earned — gradient accent */}
          <div style={{ background: "var(--surface)", borderRadius: 10, padding: "13px 14px", backgroundImage: "linear-gradient(var(--surface),var(--surface))", backgroundClip: "padding-box", border: "1px solid rgba(120,75,160,0.35)", position: "relative" }}>
            <p style={{ fontSize: 8.5, color: "var(--muted)", marginBottom: 5, fontFamily: "Inter,sans-serif" }}>Total earned</p>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>${(stats?.totalEarned ?? 0).toFixed(0)}</p>
            <p style={{ fontSize: 8, color: "var(--muted)", marginTop: 3, fontFamily: "Inter,sans-serif" }}>all time</p>
          </div>
          {/* In escrow */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "13px 14px" }}>
            <p style={{ fontSize: 8.5, color: "var(--muted)", marginBottom: 5, fontFamily: "Inter,sans-serif" }}>In escrow</p>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>${(stats?.escrowHeld ?? 0).toFixed(0)}</p>
            <p style={{ fontSize: 8, color: "var(--muted)", marginTop: 3, fontFamily: "Inter,sans-serif" }}>{activeWork.length} active</p>
          </div>
          {/* Shop revenue */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "13px 14px" }}>
            <p style={{ fontSize: 8.5, color: "var(--muted)", marginBottom: 5, fontFamily: "Inter,sans-serif" }}>Shop revenue</p>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>${(mySales ?? []).reduce((s, o) => s + o.sellerPayout, 0).toFixed(0)}</p>
            <p style={{ fontSize: 8, color: "var(--muted)", marginTop: 3, fontFamily: "Inter,sans-serif" }}>{(mySales ?? []).length} sales</p>
          </div>
          {/* Trust rating */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "13px 14px" }}>
            <p style={{ fontSize: 8.5, color: "var(--muted)", marginBottom: 5, fontFamily: "Inter,sans-serif" }}>Trust rating</p>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{avgRating ?? "—"}</p>
            <p style={{ fontSize: 8, color: "var(--muted)", marginTop: 3, fontFamily: "Inter,sans-serif" }}>{completedWithRating.length > 0 ? "Verified Artist" : "No reviews yet"}</p>
          </div>
        </div>

        {/* Active work */}
        {activeWork.length > 0 && (
          <>
            <p style={S.secHead as React.CSSProperties}>Active work</p>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 18 }}>
              {activeWork.map((c, i, arr) => {
                const isInProgress = c.status === "IN_PROGRESS"
                const isPending = c.status === "PENDING" || c.status === "ACCEPTED"
                const isDelivered = c.status === "DELIVERED"
                return (
                  <a
                    key={c.id}
                    href={`/professional-dms/${c.id}`}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", textDecoration: "none", borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--border)" }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: GRADIENT, padding: 1.5, flexShrink: 0 }}>
                      <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "var(--surface)", overflow: "hidden" }}>
                        <Avatar src={c.buyer?.image} name={c.buyer?.name} username={c.buyer?.username} size={25} />
                      </div>
                    </div>
                    <div style={{ fontFamily: "Inter,sans-serif", fontSize: 11, fontWeight: 600, color: "var(--text)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      @{c.buyer?.username ?? "unknown"}
                    </div>
                    {isInProgress && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                        <div style={{ width: 44, height: 3, borderRadius: 2, background: "var(--border)" }}>
                          <div style={{ width: "50%", height: "100%", borderRadius: 2, background: GRADIENT }} />
                        </div>
                        <span style={{ fontSize: 8, color: "var(--muted)", width: 22, textAlign: "right", fontFamily: "Inter,sans-serif" }}>50%</span>
                      </div>
                    )}
                    {isPending && (
                      <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 4, flexShrink: 0, background: "rgba(255,180,60,0.12)", color: "#FFB43C", border: "1px solid rgba(255,180,60,0.25)", fontFamily: "Inter,sans-serif" }}>
                        Pending
                      </span>
                    )}
                    {isDelivered && (
                      <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 4, flexShrink: 0, background: "rgba(120,75,160,0.15)", color: "#B090D8", border: "1px solid rgba(120,75,160,0.3)", fontFamily: "Inter,sans-serif" }}>
                        Delivered
                      </span>
                    )}
                  </a>
                )
              })}
            </div>
          </>
        )}

        {/* Shop sales — 7-day bar chart */}
        <p style={S.secHead as React.CSSProperties}>Shop sales — last 7 days</p>
        {salesByDay.some(d => d.total > 0) ? (
          <>
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 36, marginBottom: 4 }}>
              {salesByDay.map((d, i) => {
                const pct = (d.total / maxDay) * 100
                const isHi = pct >= 70
                return (
                  <div key={i} style={{ flex: 1, borderRadius: "2px 2px 0 0", height: `${Math.max(pct, 6)}%`, background: isHi ? GRADIENT : "rgba(120,75,160,0.25)" }} />
                )
              })}
            </div>
            <div style={{ display: "flex", gap: 3, marginBottom: 18 }}>
              {salesByDay.map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>{d.label}</div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "18px 0 22px", color: "rgba(240,235,248,0.3)", fontSize: 13, fontFamily: "Inter,sans-serif", marginBottom: 4 }}>
            No sales in the last 7 days
          </div>
        )}

        {/* Recent shop sales */}
        <p style={S.secHead as React.CSSProperties}>Recent shop sales</p>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 18 }}>
          {(!mySales || mySales.length === 0) ? (
            <div style={{ padding: "22px 14px", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "rgba(240,235,248,0.3)", fontFamily: "Inter,sans-serif" }}>No sales yet</p>
            </div>
          ) : (
            mySales.slice(0, 10).map((order, i, arr) => (
              <div key={order.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderBottom: i === Math.min(arr.length, 10) - 1 ? "none" : "1px solid var(--border)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 7, overflow: "hidden", flexShrink: 0, border: "1px solid var(--border)", background: "rgba(240,235,248,0.07)" }}>
                  <img src={order.item.image} alt={order.item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "Inter,sans-serif" }}>{order.item.title}</p>
                  <p style={{ fontSize: 9, color: "var(--muted)", marginTop: 2, fontFamily: "Inter,sans-serif" }}>@{order.buyer.username ?? order.buyer.name ?? "unknown"}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>${order.sellerPayout.toFixed(0)}</p>
                  <p style={{ fontSize: 9, color: "var(--muted)", marginTop: 2, fontFamily: "Inter,sans-serif" }}>
                    {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Commission settings */}
        <p style={S.secHead as React.CSSProperties}>Commission settings</p>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 18 }}>

          <div style={{ marginBottom: 12 }}>
            <p style={S.fieldLabel as React.CSSProperties}>Description</p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Tell buyers what you offer, your style, any terms…"
              rows={3}
              style={{ ...(S.inp as React.CSSProperties), resize: "none" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <p style={S.fieldLabel as React.CSSProperties}>Turnaround time</p>
            <input type="text" value={turnaround} onChange={e => setTurnaround(e.target.value)} placeholder="e.g. 7–14 days" style={S.inp as React.CSSProperties} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <p style={S.fieldLabel as React.CSSProperties}>Price ranges</p>
            {priceRanges.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                {priceRanges.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 7, background: "rgba(240,235,248,0.04)", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>{r.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>${r.price}</span>
                      <button onClick={() => setPriceRanges(prev => prev.filter((_, idx) => idx !== i))} style={{ fontSize: 9, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 5 }}>
              <input type="text" value={newRangeLabel} onChange={e => setNewRangeLabel(e.target.value)} placeholder="Label" style={{ ...(S.inp as React.CSSProperties), flex: 1 }} />
              <input type="number" value={newRangePrice} onChange={e => setNewRangePrice(e.target.value)} placeholder="Price" min="0" style={{ ...(S.inp as React.CSSProperties), width: 72 }} />
              <button onClick={addPriceRange} style={{ padding: "9px 13px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "white", background: GRADIENT, fontFamily: "Inter,sans-serif", flexShrink: 0 }}>Add</button>
            </div>
          </div>

          {/* Commission card images */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginBottom: 12 }}>
            <p style={S.fieldLabel as React.CSSProperties}>Commission card images</p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: cardImages.length > 0 ? 8 : 0 }}>
              {cardImages.map((img, i) => (
                <div key={i} style={{ position: "relative", width: 50, height: 50, borderRadius: 7, overflow: "hidden", flexShrink: 0, border: "1px solid var(--border)" }}>
                  <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => removeCardImage(i)} style={{ position: "absolute", top: -4, right: -4, width: 13, height: 13, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer", fontSize: 7.5, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
              ))}
              {cardImages.length < 5 && (
                <label style={{ width: 50, height: 50, borderRadius: 7, border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--muted)", cursor: "pointer", flexShrink: 0 }}>
                  {uploadingCard ? "…" : "+"}
                  <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleCardImageUpload} disabled={uploadingCard} />
                </label>
              )}
            </div>
            {cardUploadError && <p style={{ fontSize: 11, color: "#f87171", fontFamily: "Inter,sans-serif" }}>{cardUploadError}</p>}
          </div>

          {/* Art styles */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <p style={S.fieldLabel as React.CSSProperties}>Art styles</p>
            {artStyles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {artStyles.map(s => (
                  <span key={s} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(120,75,160,0.14)", color: "#B090D8", border: "1px solid rgba(120,75,160,0.28)", fontFamily: "Inter,sans-serif" }}>
                    {s}
                    <button type="button" onClick={() => setArtStyles(prev => prev.filter(x => x !== s))} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 5 }}>
              <input
                type="text"
                value={artStyleInput}
                onChange={e => setArtStyleInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === "Enter" || e.key === ",") && artStyleInput.trim()) {
                    e.preventDefault()
                    const t = artStyleInput.trim().replace(/,$/, "")
                    if (t && !artStyles.includes(t) && artStyles.length < 20) setArtStyles(prev => [...prev, t])
                    setArtStyleInput("")
                  }
                }}
                placeholder="Type a style…"
                style={{ ...(S.inp as React.CSSProperties), flex: 1 }}
              />
              <button
                type="button"
                onClick={() => {
                  const t = artStyleInput.trim()
                  if (t && !artStyles.includes(t) && artStyles.length < 20) { setArtStyles(prev => [...prev, t]); setArtStyleInput("") }
                }}
                style={{ ...(S.chipBtn as React.CSSProperties) }}
              >
                Add
              </button>
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={updateProfile.isPending}
            style={{ width: "100%", marginTop: 14, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "white", background: GRADIENT, fontFamily: "Inter,sans-serif", opacity: updateProfile.isPending ? 0.5 : 1 }}
          >
            {updateProfile.isPending ? "Saving…" : settingsSaved ? "✓ Saved" : "Save settings"}
          </button>
        </div>

        {/* Commission form options */}
        <p style={S.secHead as React.CSSProperties}>Commission form options</p>
        {categories && categories.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {categories.map(cat => (
              <div key={cat.id} style={{ background: "rgba(240,235,248,0.03)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                {editingCat === cat.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input value={editCatName} onChange={e => setEditCatName(e.target.value)} placeholder="Category name" style={S.inp as React.CSSProperties} />
                    {editCatOptionsList.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {editCatOptionsList.map(opt => (
                          <span key={opt} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(120,75,160,0.14)", color: "#B090D8", border: "1px solid rgba(120,75,160,0.28)", fontFamily: "Inter,sans-serif" }}>
                            {opt}
                            <button type="button" onClick={() => setEditCatOptionsList(prev => prev.filter(o => o !== opt))} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 5 }}>
                      <input value={editCatOptionInput} onChange={e => setEditCatOptionInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addEditChip() } }} placeholder="Add option, press Enter" style={{ ...(S.inp as React.CSSProperties), flex: 1 }} />
                      <button type="button" onClick={addEditChip} style={S.chipBtn as React.CSSProperties}>Add</button>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => saveEditCat(cat.id)} style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "white", background: GRADIENT, fontFamily: "Inter,sans-serif" }}>Save</button>
                      <button onClick={() => setEditingCat(null)} style={{ padding: "8px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: 11, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", marginBottom: 6, fontFamily: "Inter,sans-serif" }}>{cat.name}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {cat.options.map(opt => (
                        <span key={opt} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 99, background: "rgba(240,235,248,0.07)", color: "rgba(240,235,248,0.5)", border: "1px solid var(--border)", fontFamily: "Inter,sans-serif" }}>{opt}</span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => startEditCat(cat.id, cat.name, cat.options)} style={{ fontSize: 9, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Edit</button>
                      <button onClick={() => deleteCategory.mutate({ id: cat.id })} style={{ fontSize: 9, color: "#F06060", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new category */}
        <div style={{ background: "rgba(240,235,248,0.03)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 12px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8, fontFamily: "Inter,sans-serif" }}>Add a category</p>
          <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name (e.g. Art Style)" style={{ ...(S.inp as React.CSSProperties), marginBottom: 8 }} />
          {newCatOptionsList.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {newCatOptionsList.map(opt => (
                <span key={opt} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(120,75,160,0.14)", color: "#B090D8", border: "1px solid rgba(120,75,160,0.28)", fontFamily: "Inter,sans-serif" }}>
                  {opt}
                  <button type="button" onClick={() => setNewCatOptionsList(prev => prev.filter(o => o !== opt))} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
            <input type="text" value={newCatOptionInput} onChange={e => setNewCatOptionInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addNewChip() } }} placeholder="Add option, press Enter" style={{ ...(S.inp as React.CSSProperties), flex: 1 }} />
            <button type="button" onClick={addNewChip} style={S.chipBtn as React.CSSProperties}>Add</button>
          </div>
          <button
            onClick={addCategory}
            disabled={createCategory.isPending || !newCatName.trim() || newCatOptionsList.length === 0}
            style={{ width: "100%", padding: "9px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "white", background: GRADIENT, fontFamily: "Inter,sans-serif", opacity: (createCategory.isPending || !newCatName.trim() || newCatOptionsList.length === 0) ? 0.4 : 1 }}
          >
            {createCategory.isPending ? "Adding…" : "Save category"}
          </button>
        </div>

      </div>
    </div>
  )
}
