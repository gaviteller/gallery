# Commission System — Plan 3: Professional DMs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Professional DMs list page and commission thread page where the full commission lifecycle plays out — accept/decline, simulated payment, delivery, and confirmation.

**Architecture:** Two pages: `/professional-dms` lists all the user's commissions (as buyer and artist). `/professional-dms/[id]` is the thread view: a pinned request header, a chat log, and action buttons that change based on commission status. Both are client components using tRPC queries.

**Tech Stack:** Prisma 5 + PostgreSQL (Neon), tRPC v11, Next.js 16 App Router, Tailwind CSS, React 19.

**Prerequisite:** Plans 1 and 2 must be complete.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `app/professional-dms/page.tsx` | Create | List of all commission threads |
| `app/professional-dms/[id]/page.tsx` | Create | Single commission thread + lifecycle actions |

---

## Task 1: Professional DMs list page

**Files:**
- Create: `app/professional-dms/page.tsx`

Shows two sections: commissions where the user is the buyer, and commissions where they are the artist. Each row shows the other party, the commission status, and the last updated time. Clicking a row navigates to the thread.

- [ ] **Step 1: Create the page**

Create `app/professional-dms/page.tsx`:

```typescript
"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

const statusLabel: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In progress",
  DELIVERED: "Delivered",
  COMPLETE: "Complete",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
}

const statusColor: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  ACCEPTED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-purple-100 text-purple-700",
  COMPLETE: "bg-green-100 text-green-700",
  DECLINED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-500",
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

type CommissionRow = {
  id: string
  status: string
  updatedAt: Date
  artist?: { id: string; username: string | null; name: string | null; image: string | null }
  buyer?: { id: string; username: string | null; name: string | null; image: string | null }
}

function CommissionRow({ commission, otherParty, role }: {
  commission: CommissionRow
  otherParty: { username: string | null; name: string | null; image: string | null } | undefined
  role: "buyer" | "artist"
}) {
  const router = useRouter()
  const initials = ((otherParty?.name ?? otherParty?.username ?? "?")[0] ?? "?").toUpperCase()

  return (
    <button
      onClick={() => router.push(`/professional-dms/${commission.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
    >
      {otherParty?.image ? (
        <img src={otherParty.image} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold flex-shrink-0">
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          @{otherParty?.username ?? "unknown"}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {role === "buyer" ? "You commissioned" : "Commission request"} · {timeAgo(commission.updatedAt)}
        </p>
      </div>
      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColor[commission.status] ?? "bg-gray-100 text-gray-500"}`}>
        {statusLabel[commission.status] ?? commission.status}
      </span>
    </button>
  )
}

export default function ProfessionalDMsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === "unauthenticated") {
    router.push("/signin")
    return null
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    )
  }

  return <ProfessionalDMsInner />
}

function ProfessionalDMsInner() {
  const { data, isLoading } = trpc.commission.getMine.useQuery()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    )
  }

  const asBuyer = data?.asBuyer ?? []
  const asArtist = data?.asArtist ?? []
  const hasAny = asBuyer.length > 0 || asArtist.length > 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Professional DMs</h1>

      {!hasAny ? (
        <div className="text-center py-20">
          <p className="text-gray-500 font-medium">No commission threads yet</p>
          <p className="text-xs text-gray-400 mt-1">Request a commission from the Commissions tab to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {asArtist.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">As artist</p>
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {asArtist.map(c => (
                  <CommissionRow
                    key={c.id}
                    commission={c}
                    otherParty={c.buyer}
                    role="artist"
                  />
                ))}
              </div>
            </section>
          )}

          {asBuyer.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">As buyer</p>
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {asBuyer.map(c => (
                  <CommissionRow
                    key={c.id}
                    commission={c}
                    otherParty={c.artist}
                    role="buyer"
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the list page**

Navigate to `http://localhost:3000/professional-dms`. Expected: page renders. If no commissions exist, shows "No commission threads yet." After submitting a commission request (via the discovery feed or profile page), the thread appears in the list.

- [ ] **Step 3: Commit**

```bash
git add app/professional-dms/page.tsx
git commit -m "feat: add Professional DMs list page"
```

---

## Task 2: Professional DM thread page

**Files:**
- Create: `app/professional-dms/[id]/page.tsx`

This is the core of the commission system. The page shows:
- A pinned header with the original request (description, dropdown selections, reference photos)
- A scrollable chat log of messages
- A text input to send messages
- Status-specific action buttons (accept+price, decline, pay, deliver file, confirm)
- Auto-release check when opening a DELIVERED commission

- [ ] **Step 1: Create the page**

Create `app/professional-dms/[id]/page.tsx`:

```typescript
"use client"

import { useState, use, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

function processImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        const maxSize = 1400
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

  if (authStatus === "unauthenticated") {
    router.push("/signin")
    return null
  }

  if (authStatus === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  return <CommissionThread id={id} userId={session!.user.id} />
}

function CommissionThread({ id, userId }: { id: string; userId: string }) {
  const utils = trpc.useUtils()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: commission, isLoading } = trpc.commission.getById.useQuery({ id })

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

  // Confirm payment
  const confirmPaymentMutation = trpc.commission.confirmPayment.useMutation({
    onSuccess: () => utils.commission.getById.invalidate({ id }),
  })

  // Mark delivered
  const [deliveryFile, setDeliveryFile] = useState<string | null>(null)
  const [uploadingDelivery, setUploadingDelivery] = useState(false)
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
    setUploadingDelivery(true)
    const processed = await processImage(file)
    setDeliveryFile(processed)
    setUploadingDelivery(false)
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
          {otherParty?.image ? (
            <img src={otherParty.image} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
              {((otherParty?.name ?? otherParty?.username ?? "?")[0] ?? "?").toUpperCase()}
            </div>
          )}
          <p className="text-sm font-semibold text-gray-900 truncate">@{otherParty?.username}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${statusColor[commission.status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
          {statusLabel[commission.status] ?? commission.status}
        </span>
      </div>

      {/* Scrollable messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">

        {/* Pinned request card */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Commission request</p>
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
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Reference photos</p>
              <div className="flex gap-2 flex-wrap">
                {refPhotos.map((p, i) => (
                  <img key={i} src={p} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                ))}
              </div>
            </div>
          )}
          {commission.agreedPrice !== null && commission.agreedPrice !== undefined && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-sm font-semibold text-gray-900">
                Agreed price: <span className="text-blue-600">${commission.agreedPrice}</span>
              </p>
            </div>
          )}
        </div>

        {/* Action panel — status-specific */}
        {!isClosed && (
          <div className="mb-4">

            {/* Artist: accept or decline a PENDING commission */}
            {isArtist && commission.status === "PENDING" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-yellow-800 mb-3">New commission request</p>
                {showAcceptForm ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                      <span className="text-sm text-gray-600">Price: $</span>
                      <input
                        type="number"
                        value={acceptPrice}
                        onChange={e => setAcceptPrice(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const price = parseFloat(acceptPrice)
                          if (!isNaN(price) && price > 0) {
                            acceptMutation.mutate({ id, price })
                          }
                        }}
                        disabled={acceptMutation.isPending}
                        className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {acceptMutation.isPending ? "Accepting…" : "Accept & set price"}
                      </button>
                      <button
                        onClick={() => setShowAcceptForm(false)}
                        className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAcceptForm(true)}
                      className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => declineMutation.mutate({ id })}
                      disabled={declineMutation.isPending}
                      className="flex-1 py-2 border border-red-200 text-red-500 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {declineMutation.isPending ? "Declining…" : "Decline"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Artist: update price on ACCEPTED commission */}
            {isArtist && commission.status === "ACCEPTED" && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">Waiting for buyer payment</p>
                <p className="text-xs text-blue-600 mb-3">
                  Price set to <strong>${commission.agreedPrice}</strong>.
                  You can update it before the buyer pays.
                </p>
                {showUpdatePrice ? (
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-gray-600">New price: $</span>
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
                    <button onClick={() => setShowUpdatePrice(false)} className="text-sm text-gray-400 hover:text-gray-600">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setNewPrice(String(commission.agreedPrice ?? "")); setShowUpdatePrice(true) }}
                    className="text-xs text-blue-600 underline hover:text-blue-800"
                  >
                    Update price
                  </button>
                )}
              </div>
            )}

            {/* Buyer: confirm payment on ACCEPTED commission */}
            {isBuyer && commission.status === "ACCEPTED" && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">Ready to pay</p>
                <p className="text-xs text-blue-600 mb-3">
                  The artist has set the price at <strong>${commission.agreedPrice}</strong>.
                  Confirm payment to start the commission.
                </p>
                <button
                  onClick={() => confirmPaymentMutation.mutate({ id })}
                  disabled={confirmPaymentMutation.isPending}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {confirmPaymentMutation.isPending ? "Processing…" : `Confirm payment · $${commission.agreedPrice}`}
                </button>
              </div>
            )}

            {/* Artist: mark delivered on IN_PROGRESS commission */}
            {isArtist && commission.status === "IN_PROGRESS" && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-purple-800 mb-3">Upload your finished work</p>
                {deliveryFile ? (
                  <div className="flex flex-col gap-3">
                    <div className="relative w-full rounded-xl overflow-hidden border border-gray-200">
                      <img src={deliveryFile} alt="Delivery preview" className="w-full max-h-64 object-contain bg-gray-50" />
                      <button
                        onClick={() => setDeliveryFile(null)}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center text-sm hover:bg-black/80 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                    <button
                      onClick={() => markDeliveredMutation.mutate({ id, fileUrl: deliveryFile })}
                      disabled={markDeliveredMutation.isPending}
                      className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {markDeliveredMutation.isPending ? "Delivering…" : "Mark as delivered"}
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-purple-300 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-colors">
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm text-purple-600">{uploadingDelivery ? "Processing…" : "Upload finished artwork"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleDeliveryFileUpload} disabled={uploadingDelivery} />
                  </label>
                )}
              </div>
            )}

            {/* Buyer: confirm delivery on DELIVERED commission */}
            {isBuyer && commission.status === "DELIVERED" && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-purple-800 mb-1">Work delivered!</p>
                <p className="text-xs text-purple-600 mb-3">
                  Review the delivered file below. Confirm receipt to release payment to the artist.
                  If you don&apos;t respond within 5 days, payment releases automatically.
                </p>
                <button
                  onClick={() => confirmDeliveryMutation.mutate({ id })}
                  disabled={confirmDeliveryMutation.isPending}
                  className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {confirmDeliveryMutation.isPending ? "Confirming…" : "Confirm receipt & release payment"}
                </button>
              </div>
            )}

            {/* Complete banner */}
            {commission.status === "COMPLETE" && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <p className="text-sm font-semibold text-green-700">Commission complete ✓</p>
                <p className="text-xs text-green-600 mt-1">Payment has been released to the artist.</p>
              </div>
            )}

          </div>
        )}

        {/* Closed banners */}
        {commission.status === "DECLINED" && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-gray-600">This request was declined</p>
          </div>
        )}

        {/* Messages */}
        {commission.messages.map(msg => {
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
          <p className="text-xs text-gray-400">This thread is closed</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the full lifecycle end-to-end**

Using two different browser sessions (or incognito for the second user):

1. **User A** (buyer): go to `/commissions`, tap "Request" on an artist card → fill out the form → submit → should land on the thread
2. **User B** (artist): go to `/professional-dms` → see the new request → open it → tap Accept → set a price
3. **User A** (buyer): refresh the thread → see "Confirm payment · $X" button → tap it → status changes to IN_PROGRESS
4. **User B** (artist): thread shows "Upload finished artwork" → upload an image → tap "Mark as delivered"
5. **User A** (buyer): thread shows "Confirm receipt" → tap it → status changes to COMPLETE → thread input is replaced with "This thread is closed"

- [ ] **Step 3: Commit and push**

```bash
git add app/professional-dms/page.tsx app/professional-dms/[id]/page.tsx
git commit -m "feat: add Professional DMs list and commission thread pages"
git push
```

---

## Commission system complete

All three plans together deliver:
- ✅ Artist professional profile dashboard (status, description, turnaround, price ranges, custom form dropdowns, business overview)
- ✅ Commission discovery feed with search by name, style, and price
- ✅ Commission request modal (description + mandatory artist dropdowns + optional reference photos)
- ✅ "Request Commission" button on artist profile Commissions tab
- ✅ Professional DM threads — full lifecycle from PENDING → COMPLETE
- ✅ Auto-release after 5 days if buyer doesn't confirm delivery
- ✅ All accessible from the hamburger menu
