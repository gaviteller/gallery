"use client"

import { useEffect } from "react"
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

type CommissionItem = {
  id: string
  status: string
  updatedAt: Date
  artist?: { id: string; username: string | null; name: string | null; image: string | null }
  buyer?: { id: string; username: string | null; name: string | null; image: string | null }
}

function CommissionRow({ commission, otherParty, role }: {
  commission: CommissionItem
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin")
    }
  }, [status, router])

  if (status === "unauthenticated" || status === "loading") {
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
