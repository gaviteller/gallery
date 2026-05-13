"use client"

import { useState, use, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
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
}

const statusColor: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  ACCEPTED: "bg-blue-50 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  DELIVERED: "bg-purple-50 text-purple-700 border-purple-200",
  COMPLETE: "bg-green-50 text-green-700 border-green-200",
  DECLINED: "bg-gray-50 text-gray-500 border-gray-200",
  CANCELLED: "bg-gray-50 text-gray-500 border-gray-200",
}

const CLOSED = ["COMPLETE", "DECLINED", "CANCELLED"]

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
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
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

  // Check auto-release on mount for DELIVERED commissions
  const autoRelease = trpc.commission.checkAutoRelease.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })
  const [autoReleaseChecked, setAutoReleaseChecked] = useState(false)

  useEffect(() => {
    if (commission?.status === "DELIVERED" && !autoReleaseChecked) {
      setAutoReleaseChecked(true)
      autoRelease.mutate({ id })
    }
  }, [commission?.status])

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

  // Accept + price
  const [showAcceptForm, setShowAcceptForm] = useState(false)
  const [acceptPrice, setAcceptPrice] = useState("")
  const acceptMutation = trpc.commission.accept.useMutation({
    onSuccess: () => {
      utils.commission.getById.invalidate({ id })
      setShowAcceptForm(false)
      setAcceptPrice("")
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

  // Cancel (buyer)
  const cancelMutation = trpc.commission.cancel.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
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

  async function handleDeliveryFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setDeliveryUploadError("")
    setUploadingDelivery(true)
    try {
      const processed = await processImage(file)
      setDeliveryFile(processed)
    } catch {
      setDeliveryUploadError("Failed to process image. Please try a different file.")
    } finally {
      setUploadingDelivery(false)
    }
  }

  function sendText() {
    if (!messageText.trim()) return
    sendMessage.mutate({ commissionId: id, text: messageText.trim() })
  }

  if (isLoading || !commission) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  const isArtist = commission.artistId === userId
  const isBuyer = commission.buyerId === userId
  const isClosed = CLOSED.includes(commission.status)
  const refPhotos = commission.referencePhotos as string[]
  const dropdownSelections = commission.dropdownSelections as Record<string, string>
  const otherParty = isArtist ? commission.buyer : commission.artist

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-screen pb-16">

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <button onClick={() => router.push("/professional-dms")} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Avatar src={otherParty?.image} name={otherParty?.name} username={otherParty?.username} size={32} />
          <p className="text-sm font-semibold text-gray-900 truncate">@{otherParty?.username}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${statusColor[commission.status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
          {statusLabel[commission.status] ?? commission.status}
        </span>
      </div>

      {/* Scrollable messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">

        {/* Pinned request card */}
        <div className="bg-gray-50 rounded-2xl border border-gray-100 mb-4 overflow-hidden">
          <button
            onClick={() => setRequestCardOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Brief</p>
              {commission.agreedPrice !== null && commission.agreedPrice !== undefined && (
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">${commission.agreedPrice}</span>
              )}
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${requestCardOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {requestCardOpen && (
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-800 mb-3 leading-relaxed">{commission.description}</p>
              {Object.entries(dropdownSelections).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(dropdownSelections).map(([k, v]) => (
                    <span key={k} className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-600">
                      <span className="text-gray-400">{k}: </span>{v}
                    </span>
                  ))}
                </div>
              )}
              {refPhotos.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Reference Images</p>
                  <div className="flex gap-2 flex-wrap">
                    {refPhotos.map((p, i) => (
                      <img key={i} src={p} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Closed banners */}
        {commission.status === "COMPLETE" && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-green-700">Commission complete ✓</p>
            <p className="text-xs text-green-600 mt-1">Payment has been released to the artist.</p>
          </div>
        )}
        {commission.status === "DECLINED" && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-gray-600">This request was declined</p>
          </div>
        )}
        {commission.status === "CANCELLED" && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-gray-600">This commission was cancelled</p>
          </div>
        )}

        {/* Messages */}
        {commission.messages.map(msg => {
          // System messages: centred status pill
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-3">
                <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
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
                    className={`max-w-full rounded-2xl border border-gray-200 ${isMe ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                  />
                )}
                {msg.text && (
                  <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                    isMe
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-gray-100 text-gray-800 rounded-tl-sm"
                  }`}>
                    {msg.text}
                  </div>
                )}
                <p className="text-[10px] text-gray-400 px-1">{timeAgo(msg.createdAt)}</p>
              </div>
            </div>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Action bar — status-specific, fixed at bottom */}
      {!isClosed && (
        <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3">

          {/* Artist: accept or decline a PENDING commission */}
          {isArtist && commission.status === "PENDING" && (
            <div>
              {showAcceptForm ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-600">Set your price</p>
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-gray-600">$</span>
                    <input
                      type="number"
                      value={acceptPrice}
                      onChange={e => setAcceptPrice(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        const price = parseFloat(acceptPrice)
                        if (!isNaN(price) && price > 0) acceptMutation.mutate({ id, price })
                      }}
                      disabled={acceptMutation.isPending}
                      className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {acceptMutation.isPending ? "…" : "Accept"}
                    </button>
                    <button onClick={() => setShowAcceptForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
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
                    className="flex-1 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
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
                  <span className="text-xs text-gray-500">New price: $</span>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      const price = parseFloat(newPrice)
                      if (!isNaN(price) && price > 0) updatePriceMutation.mutate({ id, price })
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Update
                  </button>
                  <button onClick={() => setShowUpdatePrice(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Price: <span className="font-semibold text-gray-900">${commission.agreedPrice}</span> · Awaiting Payment</p>
                  <button
                    onClick={() => { setNewPrice(String(commission.agreedPrice ?? "")); setShowUpdatePrice(true) }}
                    className="text-xs text-blue-600 underline hover:text-blue-800"
                  >
                    Update price
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Buyer: confirm payment on ACCEPTED */}
          {isBuyer && commission.status === "ACCEPTED" && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => confirmPaymentMutation.mutate({ id })}
                disabled={confirmPaymentMutation.isPending}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {confirmPaymentMutation.isPending ? "Processing…" : `Confirm payment · $${commission.agreedPrice}`}
              </button>
              <button
                onClick={() => cancelMutation.mutate({ id })}
                disabled={cancelMutation.isPending}
                className="text-xs text-red-400 hover:text-red-600 underline transition-colors disabled:opacity-50 flex-shrink-0"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Buyer: cancel PENDING */}
          {isBuyer && commission.status === "PENDING" && (
            <div className="flex justify-end">
              <button
                onClick={() => cancelMutation.mutate({ id })}
                disabled={cancelMutation.isPending}
                className="text-xs text-red-400 hover:text-red-600 underline transition-colors disabled:opacity-50"
              >
                {cancelMutation.isPending ? "Withdrawing…" : "Withdraw Request"}
              </button>
            </div>
          )}

          {/* Artist: mark delivered on IN_PROGRESS */}
          {isArtist && commission.status === "IN_PROGRESS" && (
            <div>
              {deliveryUploadError && <p className="text-xs text-red-500 mb-2">{deliveryUploadError}</p>}
              {deliveryFile ? (
                <div className="flex gap-2 items-center">
                  <img src={deliveryFile} alt="" className="w-10 h-10 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
                  <button
                    onClick={() => markDeliveredMutation.mutate({ id, fileUrl: deliveryFile })}
                    disabled={markDeliveredMutation.isPending}
                    className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {markDeliveredMutation.isPending ? "Delivering…" : "Submit Delivery"}
                  </button>
                  <button onClick={() => setDeliveryFile(null)} className="text-xs text-gray-400 hover:text-gray-600">Remove</button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full py-2.5 border border-dashed border-purple-300 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-colors">
                  <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm text-purple-600">{uploadingDelivery ? "Processing…" : "Upload & Submit Delivery"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleDeliveryFileUpload} disabled={uploadingDelivery} />
                </label>
              )}
            </div>
          )}

          {/* Buyer: confirm delivery on DELIVERED */}
          {isBuyer && commission.status === "DELIVERED" && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-gray-500">Work delivered — auto-releases in 5 days if no response</p>
              <button
                onClick={() => confirmDeliveryMutation.mutate({ id })}
                disabled={confirmDeliveryMutation.isPending}
                className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {confirmDeliveryMutation.isPending ? "Confirming…" : "Approve & Release Payment"}
              </button>
            </div>
          )}

        </div>
      )}

      {/* Message input — hidden for closed threads */}
      {!isClosed && (
        <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 bg-white flex gap-2 items-end">
          <textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText() } }}
            placeholder="Message…"
            rows={1}
            className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl text-sm text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 resize-none max-h-32"
          />
          <button
            onClick={sendText}
            disabled={!messageText.trim() || sendMessage.isPending}
            className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
      {isClosed && (
        <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 bg-gray-50 text-center">
          <p className="text-xs text-gray-400">This commission is closed</p>
        </div>
      )}
    </div>
  )
}
