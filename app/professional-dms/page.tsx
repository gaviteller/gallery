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

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  PENDING:     { background: "rgba(255,180,60,0.15)",  color: "#FFB43C" },
  ACCEPTED:    { background: "rgba(43,134,197,0.15)",  color: "#5BAEE0" },
  IN_PROGRESS: { background: "rgba(43,134,197,0.15)",  color: "#5BAEE0" },
  DELIVERED:   { background: "rgba(120,75,160,0.18)",  color: "#B090D8" },
  COMPLETE:    { background: "rgba(72,200,120,0.15)",  color: "#48C878" },
  DECLINED:    { background: "rgba(255,255,255,0.08)", color: "rgba(240,235,248,0.4)" },
  CANCELLED:   { background: "rgba(255,255,255,0.08)", color: "rgba(240,235,248,0.4)" },
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
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "13px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "left" }}
    >
      <Avatar src={otherParty?.image} name={otherParty?.name} username={otherParty?.username} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <p style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 13.5, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {otherParty?.name ?? `@${otherParty?.username ?? "unknown"}`}
          </p>
          <span style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 99, fontFamily: "Inter,sans-serif", background: role === "artist" ? "rgba(120,75,160,0.2)" : "rgba(255,255,255,0.08)", color: role === "artist" ? "#B090D8" : "rgba(255,255,255,0.4)" }}>
            {role === "artist" ? "client" : "commissioned"}
          </span>
        </div>
        {otherParty?.name && (
          <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>@{otherParty.username}</p>
        )}
        <p style={{ fontSize: 10, color: "rgba(107,95,136,0.6)", marginTop: 1, fontFamily: "Inter,sans-serif" }}>{timeAgo(commission.updatedAt)}</p>
      </div>
      <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, padding: "4px 10px", borderRadius: 99, fontFamily: "Inter,sans-serif", ...(STATUS_STYLE[commission.status] ?? { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }) }}>
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
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}><p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Loading…</p></div>
  }

  return <ProfessionalDMsInner />
}

function ProfessionalDMsInner() {
  const { data, isLoading } = trpc.commission.getMine.useQuery()

  if (isLoading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}><p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Loading…</p></div>
  }

  const asBuyer = data?.asBuyer ?? []
  const asArtist = data?.asArtist ?? []

  type ThreadItem = { commission: CommissionItem; otherParty: CommissionItem["artist"] | CommissionItem["buyer"]; role: "buyer" | "artist" }
  const threads: ThreadItem[] = [
    ...asArtist.map(c => ({ commission: c, otherParty: c.buyer, role: "artist" as const })),
    ...asBuyer.map(c => ({ commission: c, otherParty: c.artist, role: "buyer" as const })),
  ].sort((a, b) => new Date(b.commission.updatedAt).getTime() - new Date(a.commission.updatedAt).getTime())

  return (
    <div style={{ maxWidth: 512, margin: "0 auto", paddingBottom: 96, background: "var(--bg)", minHeight: "100vh" }}>
      <MessagesTabs />
      {threads.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 32px" }}>
          <p style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>No commission threads yet</p>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 5, fontFamily: "Inter,sans-serif" }}>Request a commission from the Commissions tab to get started</p>
        </div>
      ) : (
        <div>
          {threads.map(({ commission, otherParty, role }) => (
            <CommissionRow key={commission.id} commission={commission} otherParty={otherParty} role={role} />
          ))}
        </div>
      )}
    </div>
  )
}
