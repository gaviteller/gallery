"use client"

import { trpc } from "@/components/providers"

export default function AdminDashboard() {
  const { data: pendingAppeals } = trpc.admin.listAppeals.useQuery({ status: "PENDING" })

  return (
    <div>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
        <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 20px" }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 4 }}>Pending Appeals</p>
          <p style={{ color: "white", fontSize: 28, fontWeight: 700 }}>{pendingAppeals?.length ?? "…"}</p>
        </div>
      </div>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
        Use the navigation above to manage users and review appeals.
      </p>
    </div>
  )
}
