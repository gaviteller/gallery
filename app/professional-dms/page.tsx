"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"
import MessagesTabs from "@/components/MessagesTabs"

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
  PENDING: "bg-yellow-500/20 text-yellow-400",
  ACCEPTED: "bg-blue-500/20 text-blue-400",
  IN_PROGRESS: "bg-blue-500/20 text-blue-400",
  DELIVERED: "bg-purple-500/20 text-purple-400",
  COMPLETE: "bg-green-500/20 text-green-400",
  DECLINED: "bg-white/10 text-white/40",
  CANCELLED: "bg-white/10 text-white/40",
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

  return (
    <button
      onClick={() => router.push(`/professional-dms/${commission.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left"
      style={{ borderBottom: "1px solid #ffffff08" }}
    >
      <Avatar src={otherParty?.image} name={otherParty?.name} username={otherParty?.username} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-white truncate">
            @{otherParty?.username ?? "unknown"}
          </p>
          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: role === "artist" ? "rgba(176,68,248,0.2)" : "rgba(255,255,255,0.08)", color: role === "artist" ? "#B044F8" : "rgba(255,255,255,0.4)" }}>
            {role === "artist" ? "client" : "you commissioned"}
          </span>
        </div>
        <p className="text-xs text-white/30 mt-0.5">{timeAgo(commission.updatedAt)}</p>
      </div>
      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColor[commission.status] ?? "bg-white/10 text-white/40"}`}>
        {statusLabel[commission.status] ?? commission.status}
      </span>
    </button>
  )
}

export default function ProfessionalDMsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
  }, [status, router])

  if (status === "unauthenticated" || status === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-white/40">Loading…</p></div>
  }

  return <ProfessionalDMsInner />
}

function ProfessionalDMsInner() {
  const { data, isLoading } = trpc.commission.getMine.useQuery()

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-white/40">Loading…</p></div>
  }

  const asBuyer = data?.asBuyer ?? []
  const asArtist = data?.asArtist ?? []

  type ThreadItem = { commission: CommissionItem; otherParty: CommissionItem["artist"] | CommissionItem["buyer"]; role: "buyer" | "artist" }
  const threads: ThreadItem[] = [
    ...asArtist.map(c => ({ commission: c, otherParty: c.buyer, role: "artist" as const })),
    ...asBuyer.map(c => ({ commission: c, otherParty: c.artist, role: "buyer" as const })),
  ].sort((a, b) => new Date(b.commission.updatedAt).getTime() - new Date(a.commission.updatedAt).getTime())

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <MessagesTabs />
      <div className="px-4 py-6">
        {threads.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/50 font-medium">No commission threads yet</p>
            <p className="text-xs text-white/30 mt-1">Request a commission from the Commissions tab to get started</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: "#160b30", border: "1px solid #ffffff10" }}>
            {threads.map(({ commission, otherParty, role }) => (
              <CommissionRow key={commission.id} commission={commission} otherParty={otherParty} role={role} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
