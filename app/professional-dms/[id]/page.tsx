"use client"

import { use, useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import { uploadImage } from "@/lib/upload"
import Avatar from "@/components/Avatar"

function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.onload = (e) => {
      const img = new window.Image()
      img.onerror = () => reject(new Error("Failed to load image"))
      img.onload = () => {
        let { width, height } = img
        const maxSize = 1400
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
          else { width = Math.round((width * maxSize) / height); height = maxSize }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("Canvas not available")); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.9))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

function timeAgo(date: Date): string {
  const d = new Date(date)
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return d.toLocaleDateString()
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  PENDING:     { background: "rgba(255,180,60,0.15)",  color: "#FFB43C" },
  ACCEPTED:    { background: "rgba(43,134,197,0.15)",  color: "#5BAEE0" },
  IN_PROGRESS: { background: "rgba(43,134,197,0.15)",  color: "#5BAEE0" },
  DELIVERED:   { background: "rgba(120,75,160,0.18)",  color: "#B090D8" },
  COMPLETE:    { background: "rgba(72,200,120,0.15)",  color: "#48C878" },
  DECLINED:    { background: "rgba(255,255,255,0.08)", color: "rgba(240,235,248,0.4)" },
  CANCELLED:   { background: "rgba(255,255,255,0.08)", color: "rgba(240,235,248,0.4)" },
  DISPUTED:    { background: "rgba(224,96,96,0.15)",   color: "#E06060" },
}

const statusLabel: Record<string, string> = {
  PENDING: "Pending", ACCEPTED: "Accepted", IN_PROGRESS: "In progress",
  DELIVERED: "Delivered", COMPLETE: "Complete", DECLINED: "Declined",
  CANCELLED: "Cancelled", DISPUTED: "Disputed",
}

const CLOSED = ["COMPLETE", "DECLINED", "CANCELLED", "DISPUTED"]
const GRADIENT = "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)"

const MOOD_GRADIENTS = [
  "radial-gradient(ellipse at 65% 35%, rgba(140,60,200,0.6), transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(255,60,172,0.25), transparent 50%), linear-gradient(160deg,#1E0D30,#120820)",
  "radial-gradient(ellipse at 70% 30%, rgba(220,130,40,0.5), transparent 55%), radial-gradient(ellipse at 10% 70%, rgba(30,160,140,0.3), transparent 55%), linear-gradient(160deg,#1A1208,#081818)",
  "radial-gradient(ellipse at 30% 30%, rgba(60,140,220,0.5), transparent 55%), radial-gradient(ellipse at 80% 75%, rgba(120,60,200,0.3), transparent 55%), linear-gradient(160deg,#0C1830,#100A20)",
  "radial-gradient(ellipse at 60% 25%, rgba(220,60,90,0.5), transparent 55%), radial-gradient(ellipse at 15% 75%, rgba(200,140,40,0.25), transparent 55%), linear-gradient(160deg,#20100C,#180A14)",
  "radial-gradient(ellipse at 40% 30%, rgba(40,180,140,0.45), transparent 55%), radial-gradient(ellipse at 85% 70%, rgba(60,100,220,0.3), transparent 55%), linear-gradient(160deg,#081C18,#0A1020)",
]

function moodFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return MOOD_GRADIENTS[hash % MOOD_GRADIENTS.length]!
}

const actionBtn: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 10, border: "none",
  cursor: "pointer", fontFamily: "Inter,sans-serif", color: "white", background: GRADIENT,
}
const ghostBtn: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 10, cursor: "pointer",
  fontFamily: "Inter,sans-serif", color: "var(--muted)", background: "none", border: "1px solid var(--border)",
}
const dangerBtn: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 9, cursor: "pointer",
  fontFamily: "Inter,sans-serif", color: "#f87171", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
}
const fieldStyle: React.CSSProperties = {
  background: "rgba(240,235,248,0.07)", border: "1px solid var(--border)", borderRadius: 9,
  padding: "8px 12px", fontSize: 13, color: "var(--text)", fontFamily: "Inter,sans-serif", outline: "none",
}

export default function CommissionThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/signin")
  }, [authStatus, router])

  if (authStatus === "unauthenticated" || authStatus === "loading") {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}><p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Loading…</p></div>
  }

  return <CommissionThread id={id} userId={session!.user.id} />
}

function CommissionThread({ id, userId }: { id: string; userId: string }) {
  const utils = trpc.useUtils()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [briefOpen, setBriefOpen] = useState(true)

  const { data: commission, isLoading } = trpc.commission.getById.useQuery({ id }, {
    refetchInterval: 8000,
    refetchIntervalInBackground: false,
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [commission?.messages?.length])

  const [messageText, setMessageText] = useState("")
  const sendMessage = trpc.commissionMessage.send.useMutation({
    onSuccess: () => {
      utils.commission.getById.invalidate({ id })
      setMessageText("")
    },
  })

  function sendText() {
    if (!messageText.trim()) return
    sendMessage.mutate({ commissionId: id, text: messageText.trim() })
  }

  // Accept + price + deadline
  const [showAcceptForm, setShowAcceptForm] = useState(false)
  const [acceptPrice, setAcceptPrice] = useState("")
  const [acceptDeadline, setAcceptDeadline] = useState("")
  const [acceptError, setAcceptError] = useState("")
  const acceptMutation = trpc.commission.accept.useMutation({
    onSuccess: () => {
      utils.commission.getById.invalidate({ id })
      setShowAcceptForm(false); setAcceptPrice(""); setAcceptDeadline(""); setAcceptError("")
    },
    onError: (err) => setAcceptError(err.message ?? "Failed to accept commission"),
  })

  const declineMutation = trpc.commission.decline.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  const cancelMutation = trpc.commission.cancel.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  const confirmPaymentMutation = trpc.commission.confirmPayment.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  const [deliveryFile, setDeliveryFile] = useState<string | null>(null)
  const [uploadingDelivery, setUploadingDelivery] = useState(false)
  const [deliveryUploadError, setDeliveryUploadError] = useState("")
  const markDeliveredMutation = trpc.commission.markDelivered.useMutation({
    onSuccess: () => { utils.commission.getById.invalidate({ id }); setDeliveryFile(null) },
  })

  const confirmDeliveryMutation = trpc.commission.confirmDelivery.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState("")
  const disputeMutation = trpc.commission.dispute.useMutation({
    onSuccess: () => {
      utils.commission.getById.invalidate({ id })
      setShowDisputeModal(false); setDisputeReason("")
    },
  })

  const [selectedRating, setSelectedRating] = useState(0)
  const submitRatingMutation = trpc.commission.submitRating.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  async function handleDeliveryFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setDeliveryUploadError("")
    setUploadingDelivery(true)
    try {
      const processed = await processImage(file)
      const url = await uploadImage(processed, "commissions")
      setDeliveryFile(url)
    } catch {
      setDeliveryUploadError("Failed to upload image. Please try a different file.")
    } finally {
      setUploadingDelivery(false)
    }
  }

  if (isLoading || !commission) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}><p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Loading…</p></div>
  }

  const isArtist = commission.artistId === userId
  const isBuyer = commission.buyerId === userId
  const otherParty = isArtist ? commission.buyer : commission.artist
  const isClosed = CLOSED.includes(commission.status)
  const refPhotos = commission.referencePhotos as string[]
  const dropdownSelections = commission.dropdownSelections as Record<string, string>
  const heroBg = otherParty?.bannerImage
    ? `url(${otherParty.bannerImage})`
    : moodFor(otherParty?.id ?? id)

  return (
    <div style={{ maxWidth: 512, margin: "0 auto", display: "flex", flexDirection: "column", height: "100vh", paddingBottom: 64, background: "var(--bg)" }}>

      {/* Immersive backdrop header */}
      <div style={{ position: "relative", flexShrink: 0, height: 80, overflow: "hidden", background: heroBg, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 50, background: "linear-gradient(transparent, rgba(8,6,15,0.98))", pointerEvents: "none" }} />
        <button onClick={() => router.push("/professional-dms")} style={{ position: "absolute", top: 11, left: 12, background: "none", border: "none", cursor: "pointer", color: "rgba(240,235,248,0.7)", display: "flex" }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ position: "absolute", top: 10, right: 12, display: "flex", alignItems: "center", gap: 8 }}>
          {commission.agreedPrice !== null && commission.agreedPrice !== undefined && (
            <span style={{ fontSize: 13, fontWeight: 700, color: "white", fontFamily: "'Playfair Display',serif" }}>${commission.agreedPrice}</span>
          )}
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 99, fontFamily: "Inter,sans-serif", ...(STATUS_STYLE[commission.status] ?? {}) }}>
            {statusLabel[commission.status] ?? commission.status}
          </span>
        </div>
        <button
          onClick={() => router.push(`/@${otherParty?.username}`)}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 14px 9px", display: "flex", alignItems: "flex-end", gap: 9, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
        >
          <Avatar src={otherParty?.image} name={otherParty?.name} username={otherParty?.username} size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 15, color: "white", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {otherParty?.name ?? `@${otherParty?.username}`}
            </div>
          </div>
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 4 }}>

        {/* Brief — shown as a collapsible block, not a heavy card */}
        <div style={{ marginBottom: 10, border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <button
            onClick={() => setBriefOpen(v => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: "var(--surface)", border: "none", cursor: "pointer" }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>Request brief</span>
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>{briefOpen ? "Hide ▲" : "Show ▼"}</span>
          </button>
          {briefOpen && (
            <div style={{ padding: "11px 12px", background: "rgba(240,235,248,0.02)" }}>
              <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, fontFamily: "Inter,sans-serif", marginBottom: refPhotos.length || Object.keys(dropdownSelections).length ? 10 : 0 }}>{commission.description}</p>
              {Object.keys(dropdownSelections).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: refPhotos.length ? 10 : 0 }}>
                  {Object.entries(dropdownSelections).map(([k, v]) => (
                    <span key={k} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 99, color: "rgba(240,235,248,0.7)", background: "rgba(240,235,248,0.06)", border: "1px solid var(--border)", fontFamily: "Inter,sans-serif" }}>
                      <span style={{ color: "var(--muted)" }}>{k}: </span>{v}
                    </span>
                  ))}
                </div>
              )}
              {refPhotos.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {refPhotos.map((p, i) => (
                    <img key={i} src={p} alt="" style={{ width: 56, height: 56, borderRadius: 9, objectFit: "cover", border: "1px solid var(--border)" }} />
                  ))}
                </div>
              )}
              {commission.deadline && (
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, fontFamily: "Inter,sans-serif" }}>
                  Deadline: <span style={{ color: "var(--text)", fontWeight: 600 }}>{new Date(commission.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {commission.messages.length === 0 && (
          <p style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", padding: "16px 0", fontFamily: "Inter,sans-serif" }}>Send a message to start the conversation</p>
        )}
        {commission.messages.map(msg => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface)", padding: "5px 12px", borderRadius: 99, fontFamily: "Inter,sans-serif" }}>{msg.text}</span>
              </div>
            )
          }
          const isMe = msg.senderId === userId
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 2 }}>
              <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 4 }}>
                {msg.fileUrl && (
                  <img src={msg.fileUrl} alt="" style={{ maxWidth: "100%", borderRadius: 16, border: "1px solid var(--border)" }} />
                )}
                {msg.text && (
                  <div style={{
                    padding: "9px 14px", borderRadius: 18, fontSize: 13, fontFamily: "Inter,sans-serif", lineHeight: 1.4,
                    ...(isMe
                      ? { background: "linear-gradient(135deg,#784BA0,#2B86C5)", color: "white", borderBottomRightRadius: 5 }
                      : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderBottomLeftRadius: 5 }),
                  }}>
                    {msg.text}
                  </div>
                )}
                <p style={{ fontSize: 9, color: "rgba(107,95,136,0.6)", padding: "0 3px", fontFamily: "Inter,sans-serif" }}>{timeAgo(msg.createdAt)}</p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Action bar — compact, status-specific */}
      {!isClosed && (
        <div style={{ flexShrink: 0, padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--nav)" }}>

          {/* Artist: accept or decline PENDING */}
          {isArtist && commission.status === "PENDING" && (
            showAcceptForm ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="number" value={acceptPrice} onChange={e => setAcceptPrice(e.target.value)} placeholder="Price ($)" min="0" step="0.01" style={{ ...fieldStyle, flex: 1 }} />
                  <input type="date" value={acceptDeadline} onChange={e => setAcceptDeadline(e.target.value)} min={new Date().toISOString().split("T")[0]} style={{ ...fieldStyle, flex: 1 }} />
                </div>
                {acceptError && <p style={{ fontSize: 11, color: "#f87171", fontFamily: "Inter,sans-serif" }}>{acceptError}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      const price = parseFloat(acceptPrice)
                      if (!isNaN(price) && price > 0 && acceptDeadline) acceptMutation.mutate({ id, price, deadline: new Date(acceptDeadline).toISOString() })
                    }}
                    disabled={acceptMutation.isPending || !acceptPrice || parseFloat(acceptPrice) <= 0 || !acceptDeadline}
                    style={{ ...actionBtn, flex: 1, opacity: (!acceptPrice || parseFloat(acceptPrice) <= 0 || !acceptDeadline) ? 0.5 : 1 }}
                  >
                    {acceptMutation.isPending ? "…" : "Confirm accept"}
                  </button>
                  <button onClick={() => setShowAcceptForm(false)} style={ghostBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowAcceptForm(true)} style={{ ...actionBtn, flex: 1 }}>Accept request</button>
                <button onClick={() => declineMutation.mutate({ id })} disabled={declineMutation.isPending} style={dangerBtn}>
                  {declineMutation.isPending ? "…" : "Decline"}
                </button>
              </div>
            )
          )}

          {/* Buyer: confirm payment on ACCEPTED */}
          {isBuyer && commission.status === "ACCEPTED" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => confirmPaymentMutation.mutate({ id })} disabled={confirmPaymentMutation.isPending} style={{ ...actionBtn, flex: 1 }}>
                {confirmPaymentMutation.isPending ? "Processing…" : `Confirm payment · $${commission.agreedPrice}`}
              </button>
              <button onClick={() => { if (confirm("Cancel this commission?")) cancelMutation.mutate({ id }) }} disabled={cancelMutation.isPending} style={dangerBtn}>Cancel</button>
            </div>
          )}
          {isArtist && commission.status === "ACCEPTED" && (
            <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>Waiting on buyer to confirm payment of <span style={{ color: "var(--text)", fontWeight: 600 }}>${commission.agreedPrice}</span>.</p>
          )}

          {/* Buyer: withdraw PENDING */}
          {isBuyer && commission.status === "PENDING" && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => { if (confirm("Withdraw this request?")) cancelMutation.mutate({ id }) }} disabled={cancelMutation.isPending} style={dangerBtn}>
                {cancelMutation.isPending ? "Withdrawing…" : "Withdraw request"}
              </button>
            </div>
          )}

          {/* Artist: mark delivered on IN_PROGRESS */}
          {isArtist && commission.status === "IN_PROGRESS" && (
            <div>
              {deliveryUploadError && <p style={{ fontSize: 11, color: "#f87171", marginBottom: 6, fontFamily: "Inter,sans-serif" }}>{deliveryUploadError}</p>}
              {deliveryFile ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <img src={deliveryFile} alt="" style={{ width: 36, height: 36, borderRadius: 9, objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 }} />
                  <button onClick={() => markDeliveredMutation.mutate({ id, fileUrl: deliveryFile })} disabled={markDeliveredMutation.isPending} style={{ ...actionBtn, flex: 1 }}>
                    {markDeliveredMutation.isPending ? "Delivering…" : "Submit delivery"}
                  </button>
                  <button onClick={() => setDeliveryFile(null)} style={ghostBtn}>Remove</button>
                </div>
              ) : (
                <label style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", boxSizing: "border-box", padding: "9px 0", borderRadius: 10, border: "1px dashed var(--border)", cursor: "pointer", justifyContent: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>{uploadingDelivery ? "Processing…" : "+ Upload & submit delivery"}</span>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleDeliveryFileUpload} disabled={uploadingDelivery} />
                </label>
              )}
            </div>
          )}

          {/* Buyer: confirm delivery on DELIVERED */}
          {isBuyer && commission.status === "DELIVERED" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>Work delivered — auto-releases in 5 days if no response.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => confirmDeliveryMutation.mutate({ id })} disabled={confirmDeliveryMutation.isPending} style={{ ...actionBtn, flex: 1 }}>
                  {confirmDeliveryMutation.isPending ? "Confirming…" : "Approve & release payment"}
                </button>
                <button onClick={() => setShowDisputeModal(true)} style={dangerBtn}>Dispute</button>
              </div>
            </div>
          )}

          {/* Cancel — IN_PROGRESS, either side */}
          {(isArtist || isBuyer) && commission.status === "IN_PROGRESS" && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <button
                onClick={() => {
                  if (confirm(isArtist ? "Cancel? Since payment has been made, a strike will be recorded against you and the buyer refunded." : "Cancel this commission?")) cancelMutation.mutate({ id })
                }}
                disabled={cancelMutation.isPending}
                style={dangerBtn}
              >
                {cancelMutation.isPending ? "Cancelling…" : "Cancel commission"}
              </button>
            </div>
          )}

          {/* Rating — buyer, COMPLETE, not yet rated */}
          {isBuyer && commission.status === "COMPLETE" && commission.buyerRating === null && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", gap: 3 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setSelectedRating(star)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: star <= selectedRating ? "#FFB43C" : "var(--border)", padding: 0 }}>★</button>
                ))}
              </div>
              <button
                onClick={() => { if (selectedRating > 0) submitRatingMutation.mutate({ id, rating: selectedRating }) }}
                disabled={selectedRating === 0 || submitRatingMutation.isPending}
                style={{ ...actionBtn, flex: 1, opacity: selectedRating === 0 ? 0.5 : 1 }}
              >
                {submitRatingMutation.isPending ? "Submitting…" : "Submit rating"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Message input */}
      {isClosed ? (
        <div style={{ flexShrink: 0, padding: "12px 14px", textAlign: "center", borderTop: "1px solid var(--border)", background: "var(--nav)" }}>
          <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>This commission is closed</p>
        </div>
      ) : (
        <div style={{ flexShrink: 0, padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-end", borderTop: "1px solid var(--border)", background: "var(--nav)" }}>
          <textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText() } }}
            placeholder="Message…"
            rows={1}
            style={{ flex: 1, padding: "10px 14px", borderRadius: 18, fontSize: 13, color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)", outline: "none", resize: "none", maxHeight: 128, fontFamily: "Inter,sans-serif" }}
          />
          <button
            onClick={sendText}
            disabled={!messageText.trim() || sendMessage.isPending}
            style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: messageText.trim() ? "pointer" : "default", background: GRADIENT, color: "white", opacity: messageText.trim() ? 1 : 0.4 }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}

      {/* Dispute modal */}
      {showDisputeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowDisputeModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "var(--text)", fontSize: 15, fontWeight: 700, marginBottom: 6, fontFamily: "'Playfair Display',serif" }}>Raise a dispute</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12, fontFamily: "Inter,sans-serif", lineHeight: 1.5 }}>
              This freezes the commission and escrow pending moderation review. Only raise a dispute for clear ToS violations.
            </p>
            <textarea
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              placeholder="Describe the violation clearly…"
              rows={4}
              style={{ ...fieldStyle, width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowDisputeModal(false)} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
              <button
                onClick={() => disputeMutation.mutate({ id, reason: disputeReason })}
                disabled={disputeReason.trim().length < 10 || disputeMutation.isPending}
                style={{ ...dangerBtn, flex: 1, opacity: disputeReason.trim().length < 10 ? 0.4 : 1 }}
              >
                {disputeMutation.isPending ? "Submitting…" : "Submit dispute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
