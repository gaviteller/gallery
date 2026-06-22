"use client"

import { useState, use, useRef, useEffect } from "react"
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

const statusLabel: Record<string, string> = {
  PENDING: "Pending artist response",
  ACCEPTED: "Accepted — awaiting payment",
  IN_PROGRESS: "In progress",
  DELIVERED: "Delivered — awaiting confirmation",
  COMPLETE: "Complete",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed — under moderation review",
}

const statusColor: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  ACCEPTED: "bg-blue-500/20 text-blue-400",
  IN_PROGRESS: "bg-blue-500/20 text-blue-400",
  DELIVERED: "bg-purple-500/20 text-purple-400",
  COMPLETE: "bg-green-500/20 text-green-400",
  DECLINED: "bg-white/10 text-white/40",
  CANCELLED: "bg-white/10 text-white/40",
  DISPUTED: "bg-red-500/20 text-red-400",
}

const CLOSED = ["COMPLETE", "DECLINED", "CANCELLED", "DISPUTED"]

export default function CommissionThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/signin")
    }
  }, [authStatus, router])

  if (authStatus === "unauthenticated" || authStatus === "loading") {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}><p className="text-white/50">Loading…</p></div>
  }

  return <CommissionThread id={id} userId={session!.user.id} />
}

function CommissionThread({ id, userId }: { id: string; userId: string }) {
  const utils = trpc.useUtils()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [requestCardOpen, setRequestCardOpen] = useState(true)

  const { data: commission, isLoading } = trpc.commission.getById.useQuery({ id }, {
    refetchInterval: 8000,
    refetchIntervalInBackground: false,
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [commission?.messages?.length])

  // Message input
  const [messageText, setMessageText] = useState("")
  const sendMessage = trpc.commissionMessage.send.useMutation({
    onSuccess: () => {
      utils.commission.getById.invalidate({ id })
      setMessageText("")
    },
  })

  // Accept + price + deadline
  const [showAcceptForm, setShowAcceptForm] = useState(false)
  const [acceptPrice, setAcceptPrice] = useState("")
  const [acceptDeadline, setAcceptDeadline] = useState("")
  const [acceptError, setAcceptError] = useState("")
  const acceptMutation = trpc.commission.accept.useMutation({
    onSuccess: () => {
      utils.commission.getById.invalidate({ id })
      setShowAcceptForm(false)
      setAcceptPrice("")
      setAcceptDeadline("")
      setAcceptError("")
    },
    onError: (err) => {
      setAcceptError(err.message ?? "Failed to accept commission")
    },
  })

  // Update price
  const [showUpdatePrice, setShowUpdatePrice] = useState(false)
  const [newPrice, setNewPrice] = useState("")
  const updatePriceMutation = trpc.commission.updatePrice.useMutation({
    onSuccess: () => {
      utils.commission.getById.invalidate({ id })
      setShowUpdatePrice(false)
      setNewPrice("")
    },
  })

  // Decline
  const declineMutation = trpc.commission.decline.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  // Cancel (buyer or artist)
  const cancelMutation = trpc.commission.cancel.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  // Dispute
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState("")
  const disputeMutation = trpc.commission.dispute.useMutation({
    onSuccess: () => {
      utils.commission.getById.invalidate({ id })
      setShowDisputeModal(false)
      setDisputeReason("")
    },
  })

  // Confirm payment
  const confirmPaymentMutation = trpc.commission.confirmPayment.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  // Mark delivered
  const [deliveryFile, setDeliveryFile] = useState<string | null>(null)
  const [uploadingDelivery, setUploadingDelivery] = useState(false)
  const [deliveryUploadError, setDeliveryUploadError] = useState("")
  const markDeliveredMutation = trpc.commission.markDelivered.useMutation({
    onSuccess: () => {
      utils.commission.getById.invalidate({ id })
      setDeliveryFile(null)
    },
  })

  // Confirm delivery
  const confirmDeliveryMutation = trpc.commission.confirmDelivery.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  // Rating
  const [selectedRating, setSelectedRating] = useState(0)
  const submitRatingMutation = trpc.commission.submitRating.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  // Flag rating
  const flagRatingMutation = trpc.commission.flagRating.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  // Display permission
  const setDisplayPermissionMutation = trpc.commission.setDisplayPermission.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  // Share to feed
  const shareToFeedMutation = trpc.commission.shareToFeed.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })
  const dismissFeedShareMutation = trpc.commission.dismissFeedShare.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  // Deadline
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false)
  const [deadlineInput, setDeadlineInput] = useState("")

  const setDeadlineMutation = trpc.commission.setDeadline.useMutation({
    onSuccess: () => {
      utils.commission.getById.invalidate({ id })
      setShowDeadlinePicker(false)
      setDeadlineInput("")
    },
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

  function sendText() {
    if (!messageText.trim()) return
    sendMessage.mutate({ commissionId: id, text: messageText.trim() })
  }

  if (isLoading || !commission) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}><p className="text-white/50">Loading…</p></div>
  }

  const isArtist = commission.artistId === userId
  const isBuyer = commission.buyerId === userId
  const isClosed = CLOSED.includes(commission.status)
  const refPhotos = commission.referencePhotos as string[]
  const dropdownSelections = commission.dropdownSelections as Record<string, string>
  const otherParty = isArtist ? commission.buyer : commission.artist

  const deliveredFileUrl = commission.messages
    .filter(m => m.fileUrl)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.fileUrl ?? null

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-screen pb-16" style={{ background: "var(--bg)" }}>

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-4 flex-shrink-0" style={{ background: "var(--nav)", borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => router.push("/professional-dms")} className="p-1 transition-colors" style={{ color: "var(--muted)" }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Avatar src={otherParty?.image} name={otherParty?.name} username={otherParty?.username} size={36} />
          <div className="min-w-0">
            <p className="text-sm font-bold truncate font-playfair" style={{ color: "var(--text)" }}>
              {otherParty?.name ?? `@${otherParty?.username}`}
            </p>
            {otherParty?.name && (
              <p className="text-[11px] truncate" style={{ color: "var(--muted)" }}>@{otherParty.username}</p>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColor[commission.status] ?? "bg-white/10 text-white/40"}`}>
          {statusLabel[commission.status] ?? commission.status}
        </span>
      </div>

      {/* Scrollable messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">

        {/* Pinned request card */}
        <div className="rounded-2xl mb-4 overflow-hidden" style={{ background: "#160b30", border: "1px solid var(--border)" }}>
          <button
            onClick={() => setRequestCardOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Brief</p>
              {commission.agreedPrice !== null && commission.agreedPrice !== undefined && (
                <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full">${commission.agreedPrice}</span>
              )}
            </div>
            <svg className={`w-4 h-4 text-white/40 transition-transform ${requestCardOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {requestCardOpen && (
            <div className="px-4 pb-4">
              <p className="text-sm text-white/90 mb-3 leading-relaxed">{commission.description}</p>
              {Object.entries(dropdownSelections).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(dropdownSelections).map(([k, v]) => (
                    <span key={k} className="text-xs rounded-full px-3 py-1 text-white/70" style={{ background: "rgba(240,235,248,0.07)", border: "1px solid var(--border)" }}>
                      <span className="text-white/40">{k}: </span>{v}
                    </span>
                  ))}
                </div>
              )}
              {refPhotos.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-2">Reference Images</p>
                  <div className="flex gap-2 flex-wrap">
                    {refPhotos.map((p, i) => (
                      <img key={i} src={p} alt="" className="w-16 h-16 rounded-xl object-cover" style={{ border: "1px solid var(--border)" }} />
                    ))}
                  </div>
                </div>
              )}
              {isArtist && commission.status === "PENDING" && (commission.buyer as { buyerCancellationCount: number }).buyerCancellationCount > 0 && (
                <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>
                    ⚠ This buyer has {(commission.buyer as { buyerCancellationCount: number }).buyerCancellationCount} previous cancellation{(commission.buyer as { buyerCancellationCount: number }).buyerCancellationCount !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
              {commission.deadline && (
                <div className="mt-2 pt-2 flex items-center gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <svg className="w-3.5 h-3.5 text-white/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-white/70">
                    Deadline: <span className="font-semibold">{new Date(commission.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </p>
                  {(() => {
                    const msLeft = new Date(commission.deadline).getTime() - Date.now()
                    if (msLeft < 0) return <span className="text-[10px] font-semibold text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded-full">Overdue</span>
                    if (msLeft < 48 * 60 * 60 * 1000) return <span className="text-[10px] font-semibold text-orange-400 bg-orange-500/20 px-1.5 py-0.5 rounded-full">Due soon</span>
                    return null
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Closed banners */}
        {commission.status === "COMPLETE" && (
          <div className="mb-4 bg-green-500/20 rounded-2xl p-4 text-center" style={{ border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold text-green-400">Commission complete ✓</p>
            <p className="text-xs text-green-400/70 mt-1">Payment has been released to the artist.</p>
          </div>
        )}

        {/* Flag rating button — artist only, shown when rating exists and not yet flagged */}
        {isArtist && commission.status === "COMPLETE" && commission.buyerRating !== null && !(commission as { ratingFlagged: boolean }).ratingFlagged && (
          <div className="mb-2 flex justify-end">
            <button
              onClick={() => {
                if (!confirm("Flag this rating as retaliatory? It will be queued for human review.")) return
                flagRatingMutation.mutate({ id })
              }}
              disabled={flagRatingMutation.isPending}
              style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
            >
              {flagRatingMutation.isPending ? "Flagging…" : "Flag rating as retaliatory"}
            </button>
          </div>
        )}

        {/* Card 1: Rating (buyer only, shown while buyerRating is null) */}
        {commission.status === "COMPLETE" && isBuyer && commission.buyerRating === null && (
          <div className="mb-4 rounded-2xl p-4" style={{ background: "#1e0d3f", border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold text-white mb-1">How was your experience?</p>
            <p className="text-xs text-white/40 mb-3">Rate your commission with @{commission.artist.username}</p>
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setSelectedRating(star)}
                  className="text-2xl transition-transform hover:scale-110"
                >
                  {star <= selectedRating ? "★" : "☆"}
                </button>
              ))}
            </div>
            <button
              onClick={() => { if (selectedRating > 0) submitRatingMutation.mutate({ id, rating: selectedRating }) }}
              disabled={selectedRating === 0 || submitRatingMutation.isPending}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
            >
              {submitRatingMutation.isPending ? "Submitting…" : "Submit rating"}
            </button>
          </div>
        )}

        {/* Card 2: Display permission (buyer only, shown after rating, before permission answered) */}
        {commission.status === "COMPLETE" && isBuyer && commission.buyerRating !== null && !commission.displayPermissionAnswered && (
          <div className="mb-4 rounded-2xl p-4" style={{ background: "#1e0d3f", border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold text-white mb-1">Portfolio permission</p>
            <p className="text-xs text-white/50 mb-4">
              Can <span className="text-white">@{commission.artist.username}</span> display this work in their public portfolio?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDisplayPermissionMutation.mutate({ id, allow: true })}
                disabled={setDisplayPermissionMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
              >
                Yes
              </button>
              <button
                onClick={() => setDisplayPermissionMutation.mutate({ id, allow: false })}
                disabled={setDisplayPermissionMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors disabled:opacity-50"
                style={{ border: "1px solid var(--border)" }}
              >
                No
              </button>
            </div>
          </div>
        )}

        {/* Card 3: Share to feed (artist only, shown when buyer approved and artist hasn't responded) */}
        {commission.status === "COMPLETE" && isArtist && commission.displayAsExample && !commission.artistFeedShareOffered && (
          <div className="mb-4 rounded-2xl p-4" style={{ background: "#1e0d3f", border: "1px solid var(--border)" }}>
            {deliveredFileUrl && (
              <img
                src={deliveredFileUrl}
                alt="Completed commission"
                className="w-full rounded-xl object-cover max-h-48 mb-3"
                style={{ border: "1px solid var(--border)" }}
              />
            )}
            <p className="text-sm font-semibold text-white mb-1">Your buyer approved this work!</p>
            <p className="text-xs text-white/50 mb-4">It will appear in your portfolio. Want to also post it to your feed?</p>
            <div className="flex gap-3">
              <button
                onClick={() => shareToFeedMutation.mutate({ id })}
                disabled={shareToFeedMutation.isPending || dismissFeedShareMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
              >
                {shareToFeedMutation.isPending ? "Posting…" : "Post to feed"}
              </button>
              <button
                onClick={() => dismissFeedShareMutation.mutate({ id })}
                disabled={shareToFeedMutation.isPending || dismissFeedShareMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors disabled:opacity-50"
                style={{ border: "1px solid var(--border)" }}
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {commission.status === "DECLINED" && (
          <div className="mb-4 rounded-2xl p-4 text-center" style={{ background: "#160b30", border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold text-white/50">This request was declined</p>
          </div>
        )}
        {commission.status === "CANCELLED" && (
          <div className="mb-4 rounded-2xl p-4 text-center" style={{ background: "#160b30", border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold text-white/50">This commission was cancelled</p>
          </div>
        )}
        {commission.status === "DISPUTED" && (
          <div className="mb-4 rounded-2xl p-4 text-center" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p className="text-sm font-semibold text-red-400">This commission is under dispute</p>
            <p className="text-xs text-red-400/70 mt-1">Frozen pending moderation review. Escrow will not be released until resolved.</p>
          </div>
        )}

        {/* Messages */}
        {commission.messages.map(msg => {
          // System messages: centred status pill
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-3">
                <span className="text-xs text-white/50 bg-white/10 px-3 py-1 rounded-full">
                  {msg.text}
                </span>
              </div>
            )
          }

          const isMe = msg.senderId === userId
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
              <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                {msg.fileUrl && (
                  <img
                    src={msg.fileUrl}
                    alt="Delivered file"
                    className={`max-w-full rounded-2xl ${isMe ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                    style={{ border: "1px solid var(--border)" }}
                  />
                )}
                {msg.text && (
                  isMe ? (
                    <div className="px-4 py-2.5 rounded-2xl text-sm text-white rounded-tr-sm" style={{ background: "linear-gradient(135deg, #FF3CAC, #784BA0)" }}>
                      {msg.text}
                    </div>
                  ) : (
                    <div className="px-4 py-2.5 rounded-2xl text-sm rounded-tl-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                      {msg.text}
                    </div>
                  )
                )}
                <p className="text-[10px] text-white/30 px-1">{timeAgo(msg.createdAt)}</p>
              </div>
            </div>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Action bar — status-specific, fixed at bottom */}
      {!isClosed && (
        <div className="flex-shrink-0 px-4 py-3" style={{ borderTop: "1px solid var(--border)", background: "#160b30" }}>

          {/* Artist: accept or decline a PENDING commission */}
          {isArtist && commission.status === "PENDING" && (
            <div>
              {showAcceptForm ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-white/70">Set price and deadline to accept</p>
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-white/70">$</span>
                    <input
                      type="number"
                      value={acceptPrice}
                      onChange={e => setAcceptPrice(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ background: "rgba(240,235,248,0.07)", border: "1px solid var(--border)" }}
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-white/50 flex-shrink-0">Deadline</span>
                    <input
                      type="date"
                      value={acceptDeadline}
                      onChange={e => setAcceptDeadline(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="flex-1 px-3 py-2 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ background: "rgba(240,235,248,0.07)", border: "1px solid var(--border)" }}
                    />
                  </div>
                  {acceptError && <p className="text-xs text-red-400">{acceptError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const price = parseFloat(acceptPrice)
                        if (!isNaN(price) && price > 0 && acceptDeadline) {
                          acceptMutation.mutate({ id, price, deadline: new Date(acceptDeadline).toISOString() })
                        }
                      }}
                      disabled={acceptMutation.isPending || !acceptPrice || parseFloat(acceptPrice) <= 0 || !acceptDeadline}
                      className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {acceptMutation.isPending ? "…" : "Accept"}
                    </button>
                    <button onClick={() => setShowAcceptForm(false)} className="text-xs text-white/40 hover:text-white/70 px-3">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAcceptForm(true)}
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineMutation.mutate({ id })}
                    disabled={declineMutation.isPending}
                    className="flex-1 py-2.5 text-red-400 rounded-xl text-sm font-semibold hover:bg-white/5 transition-colors disabled:opacity-50"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    {declineMutation.isPending ? "…" : "Decline"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Artist: update price on ACCEPTED commission */}
          {isArtist && commission.status === "ACCEPTED" && (
            <div>
              {showUpdatePrice ? (
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-white/50">New price: $</span>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    style={{ background: "rgba(240,235,248,0.07)", border: "1px solid var(--border)" }}
                  />
                  <button
                    onClick={() => {
                      const price = parseFloat(newPrice)
                      if (!isNaN(price) && price > 0) updatePriceMutation.mutate({ id, price })
                    }}
                    className="px-4 py-2 text-white rounded-xl text-sm font-semibold transition-colors"
                    style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
                  >
                    Update
                  </button>
                  <button onClick={() => setShowUpdatePrice(false)} className="text-xs text-white/40 hover:text-white/70">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/50">Price: <span className="font-semibold text-white">${commission.agreedPrice}</span> · Awaiting Payment</p>
                  <button
                    onClick={() => { setNewPrice(String(commission.agreedPrice ?? "")); setShowUpdatePrice(true) }}
                    className="text-xs text-purple-400 underline hover:text-purple-300"
                  >
                    Update price
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Buyer: confirm payment on ACCEPTED */}
          {isBuyer && commission.status === "ACCEPTED" && (
            <div className="flex flex-col gap-2">
              {commission.agreedPrice !== null && commission.deadline && (
                <p className="text-xs text-white/50">
                  Price: <span className="font-semibold text-white">${commission.agreedPrice}</span>
                  {" · "}
                  Deadline: <span className="font-semibold text-white">
                    {new Date(commission.deadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => confirmPaymentMutation.mutate({ id })}
                  disabled={confirmPaymentMutation.isPending}
                  className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
                >
                  {confirmPaymentMutation.isPending ? "Processing…" : `Confirm payment · $${commission.agreedPrice}`}
                </button>
                <button
                  onClick={() => {
                    if (!confirm("Cancel this commission? If payment has been made, a cancellation will be recorded on your account.")) return
                    cancelMutation.mutate({ id })
                  }}
                  disabled={cancelMutation.isPending}
                  className="text-xs text-red-400 hover:text-red-300 underline transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Buyer: cancel PENDING */}
          {isBuyer && commission.status === "PENDING" && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (!confirm("Cancel this commission? If payment has been made, a cancellation will be recorded on your account.")) return
                  cancelMutation.mutate({ id })
                }}
                disabled={cancelMutation.isPending}
                className="text-xs text-red-400 hover:text-red-300 underline transition-colors disabled:opacity-50"
              >
                {cancelMutation.isPending ? "Withdrawing…" : "Withdraw Request"}
              </button>
            </div>
          )}

          {/* Cancel — artist side: PENDING, ACCEPTED, IN_PROGRESS */}
          {isArtist && ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(commission.status) && (
            <div className="flex justify-end mt-2">
              <button
                onClick={() => {
                  if (!confirm(
                    commission.status === "IN_PROGRESS"
                      ? "Cancel this commission? Since payment has been made, a strike will be recorded against you and the buyer will be refunded."
                      : "Cancel this commission?"
                  )) return
                  cancelMutation.mutate({ id })
                }}
                disabled={cancelMutation.isPending}
                style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 14, border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}
              >
                {cancelMutation.isPending ? "Cancelling…" : "Cancel commission"}
              </button>
            </div>
          )}

          {/* Cancel — buyer side: IN_PROGRESS */}
          {isBuyer && commission.status === "IN_PROGRESS" && (
            <div className="flex justify-end mt-2">
              <button
                onClick={() => {
                  if (!confirm("Cancel this commission? Since payment has been made, a cancellation will be recorded on your account.")) return
                  cancelMutation.mutate({ id })
                }}
                disabled={cancelMutation.isPending}
                style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 14, border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}
              >
                {cancelMutation.isPending ? "Cancelling…" : "Cancel commission"}
              </button>
            </div>
          )}

          {/* Dispute — buyer only, DELIVERED stage */}
          {isBuyer && commission.status === "DELIVERED" && (
            <div className="flex justify-end mt-2">
              <button
                onClick={() => setShowDisputeModal(true)}
                style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 14, border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}
              >
                Raise a dispute
              </button>
            </div>
          )}

          {/* Artist: mark delivered on IN_PROGRESS */}
          {isArtist && commission.status === "IN_PROGRESS" && (
            <div>
              {deliveryUploadError && <p className="text-xs text-red-500 mb-2">{deliveryUploadError}</p>}
              {deliveryFile ? (
                <div className="flex gap-2 items-center">
                  <img src={deliveryFile} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" style={{ border: "1px solid var(--border)" }} />
                  <button
                    onClick={() => markDeliveredMutation.mutate({ id, fileUrl: deliveryFile })}
                    disabled={markDeliveredMutation.isPending}
                    className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {markDeliveredMutation.isPending ? "Delivering…" : "Submit Delivery"}
                  </button>
                  <button onClick={() => setDeliveryFile(null)} className="text-xs text-white/40 hover:text-white/70">Remove</button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full py-2.5 border border-dashed border-purple-500/40 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-white/5 transition-colors">
                  <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm text-purple-400">{uploadingDelivery ? "Processing…" : "Upload & Submit Delivery"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleDeliveryFileUpload} disabled={uploadingDelivery} />
                </label>
              )}
            </div>
          )}

          {/* Buyer: confirm delivery on DELIVERED */}
          {isBuyer && commission.status === "DELIVERED" && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-white/50">Work delivered — auto-releases in 5 days if no response</p>
              <button
                onClick={() => confirmDeliveryMutation.mutate({ id })}
                disabled={confirmDeliveryMutation.isPending}
                className="w-full py-2.5 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
              >
                {confirmDeliveryMutation.isPending ? "Confirming…" : "Approve & Release Payment"}
              </button>
            </div>
          )}

          {/* Deadline control */}
          {isArtist && !isClosed && commission.status !== "ACCEPTED" && (
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
              {showDeadlinePicker ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={deadlineInput}
                    onChange={e => setDeadlineInput(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="flex-1 px-3 py-2 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    style={{ background: "rgba(240,235,248,0.07)", border: "1px solid var(--border)" }}
                  />
                  <button
                    onClick={() => {
                      if (!deadlineInput) return
                      setDeadlineMutation.mutate({ id, deadline: new Date(deadlineInput).toISOString() })
                    }}
                    disabled={setDeadlineMutation.isPending || !deadlineInput}
                    className="px-3 py-2 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                    style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
                  >
                    {setDeadlineMutation.isPending ? "…" : "Set"}
                  </button>
                  <button onClick={() => setShowDeadlinePicker(false)} className="text-xs text-white/40 hover:text-white/70">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (commission.deadline) {
                      setDeadlineInput(new Date(commission.deadline).toISOString().split("T")[0])
                    }
                    setShowDeadlinePicker(true)
                  }}
                  className="text-xs text-purple-400 hover:underline"
                >
                  {commission.deadline ? "Update deadline" : "Set deadline"}
                </button>
              )}
            </div>
          )}

        </div>
      )}

      {/* Message input — hidden for closed threads */}
      {!isClosed && (
        <div className="flex-shrink-0 px-4 py-3 flex gap-2 items-end" style={{ borderTop: "1px solid var(--border)", background: "#160b30" }}>
          <textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText() } }}
            placeholder="Message…"
            rows={1}
            className="flex-1 px-4 py-3 rounded-2xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500 resize-none max-h-32"
            style={{ background: "rgba(240,235,248,0.07)", border: "1px solid var(--border)" }}
          />
          <button
            onClick={sendText}
            disabled={!messageText.trim() || sendMessage.isPending}
            className="w-10 h-10 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-40 flex-shrink-0"
            style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
      {isClosed && (
        <div className="flex-shrink-0 px-4 py-3 text-center" style={{ borderTop: "1px solid var(--border)", background: "#160b30" }}>
          <p className="text-xs text-white/40">This commission is closed</p>
        </div>
      )}

      {/* Dispute modal */}
      {showDisputeModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setShowDisputeModal(false)}
        >
          <div
            style={{ background: "#1a1a1f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ color: "#fff", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Raise a Dispute</h3>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 16 }}>
              Explain the issue. This will freeze the commission and escrow pending moderation review. Only raise a dispute for clear ToS violations — Gallery does not mediate subjective quality disagreements.
            </p>
            <textarea
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              placeholder="Describe the violation clearly…"
              rows={5}
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setShowDisputeModal(false)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "none", cursor: "pointer", fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                onClick={() => disputeMutation.mutate({ id, reason: disputeReason })}
                disabled={disputeReason.trim().length < 10 || disputeMutation.isPending}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "rgba(239,68,68,0.3)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)", cursor: "pointer", fontSize: 14, opacity: disputeReason.trim().length < 10 ? 0.4 : 1 }}
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
