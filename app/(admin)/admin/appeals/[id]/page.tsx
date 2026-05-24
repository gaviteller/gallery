"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

const LEVEL_COLORS: Record<string, string> = {
  MINOR: "#facc15", MODERATE: "#fb923c", SEVERE: "#f87171", ZERO_TOLERANCE: "#dc2626",
}

export default function AdminAppealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: appeal, isLoading, error } = trpc.admin.getAppeal.useQuery({ appealId: id })

  const approveAppeal = trpc.admin.approveAppeal.useMutation({
    onSuccess: () => router.push("/admin/appeals"),
    onError: (err) => alert(err.message),
  })
  const denyAppeal = trpc.admin.denyAppeal.useMutation({
    onSuccess: () => router.push("/admin/appeals"),
    onError: (err) => alert(err.message),
  })

  if (isLoading) return <div style={{ color: "rgba(255,255,255,0.4)", padding: 24 }}>Loading…</div>
  if (error || !appeal) return <div style={{ color: "#f87171", padding: 24 }}>Appeal not found.</div>

  const isPending = appeal.status === "PENDING"

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push("/admin/appeals")} style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>← Back</button>
        <h1 style={{ color: "white", fontSize: 20, fontWeight: 700 }}>Appeal</h1>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>by @{appeal.user.username}</span>
      </div>

      {/* Appeal text */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Appeal</p>
        <p style={{ color: "white", fontSize: 14, lineHeight: 1.6 }}>{appeal.text}</p>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 8 }}>Submitted {new Date(appeal.createdAt).toLocaleDateString()}</p>
      </div>

      {/* Referenced strike */}
      {appeal.strike && (
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Referenced Strike</p>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ color: LEVEL_COLORS[appeal.strike.level] ?? "white", fontWeight: 700, fontSize: 13 }}>{appeal.strike.level}</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{appeal.strike.violation.replace(/_/g, " ")}</span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{new Date(appeal.strike.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* User's strike history */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>User's Full Strike History</p>
        {appeal.user.receivedStrikes.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No strikes.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {appeal.user.receivedStrikes.map(s => (
              <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", opacity: s.reversed ? 0.5 : 1 }}>
                <span style={{ color: LEVEL_COLORS[s.level] ?? "white", fontSize: 12, fontWeight: 700, minWidth: 80 }}>{s.level}</span>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{s.violation.replace(/_/g, " ")}</span>
                {s.reversed && <span style={{ color: "#4ade80", fontSize: 11 }}>reversed</span>}
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginLeft: "auto" }}>{new Date(s.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {isPending ? (
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => approveAppeal.mutate({ appealId: id })}
            disabled={approveAppeal.isPending || denyAppeal.isPending}
            style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", cursor: "pointer" }}
          >
            {approveAppeal.isPending ? "Approving…" : "✓ Approve — Reverse strike & lift ban"}
          </button>
          <button
            onClick={() => denyAppeal.mutate({ appealId: id })}
            disabled={approveAppeal.isPending || denyAppeal.isPending}
            style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171", cursor: "pointer" }}
          >
            {denyAppeal.isPending ? "Denying…" : "✕ Deny"}
          </button>
        </div>
      ) : (
        <div style={{ padding: 16, borderRadius: 12, background: appeal.status === "APPROVED" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${appeal.status === "APPROVED" ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}` }}>
          <p style={{ color: appeal.status === "APPROVED" ? "#4ade80" : "#f87171", fontSize: 14, fontWeight: 600 }}>
            {appeal.status === "APPROVED" ? "Appeal approved" : "Appeal denied"}
          </p>
        </div>
      )}
    </div>
  )
}
