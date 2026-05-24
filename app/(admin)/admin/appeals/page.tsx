"use client"

import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

export default function AdminAppealsPage() {
  const router = useRouter()
  const { data: appeals, isLoading } = trpc.admin.listAppeals.useQuery({ status: "PENDING" })

  return (
    <div>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Appeals</h1>
      {isLoading ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Loading…</p>
      ) : appeals?.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No pending appeals.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {appeals?.map(a => (
            <button
              key={a.id}
              onClick={() => router.push(`/admin/appeals/${a.id}`)}
              style={{
                padding: "14px 16px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ color: "white", fontSize: 14, fontWeight: 600 }}>@{a.user.username ?? "—"}</span>
                  {a.strike && (
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginLeft: 8 }}>
                      {a.strike.level} · {a.strike.violation.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.text}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
