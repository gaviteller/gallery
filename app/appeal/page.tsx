"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

export default function AppealPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [text, setText] = useState("")
  const [selectedStrikeId, setSelectedStrikeId] = useState<string | undefined>()

  const { data: strikes } = trpc.admin.getMyStrikes.useQuery(undefined, { enabled: !!session })
  const { data: appeals } = trpc.admin.getMyAppeals.useQuery(undefined, { enabled: !!session })

  const submitAppeal = trpc.admin.submitAppeal.useMutation({
    onSuccess: () => {
      setText("")
      setSelectedStrikeId(undefined)
    },
  })

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Please sign in to submit an appeal.</p>
      </div>
    )
  }

  const pendingAppeal = appeals?.find(a => a.status === "PENDING")

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Appeal</h1>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 24 }}>
        If you believe a moderation action was incorrect, submit an appeal below.
      </p>

      {/* Strike history */}
      {strikes && strikes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Your strikes</p>
          {strikes.map(s => (
            <div
              key={s.id}
              onClick={() => setSelectedStrikeId(prev => prev === s.id ? undefined : s.id)}
              style={{
                padding: "10px 12px", borderRadius: 10, marginBottom: 6, cursor: "pointer",
                background: selectedStrikeId === s.id ? "rgba(176,68,248,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${selectedStrikeId === s.id ? "rgba(176,68,248,0.4)" : "rgba(255,255,255,0.08)"}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <span style={{ color: "white", fontSize: 13, fontWeight: 600 }}>{s.level}</span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginLeft: 8 }}>{s.violation.replace(/_/g, " ")}</span>
              </div>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                {new Date(s.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {selectedStrikeId && (
            <p style={{ color: "rgba(176,68,248,0.8)", fontSize: 12, marginTop: 4 }}>Strike selected — your appeal will reference this strike.</p>
          )}
        </div>
      )}

      {/* Appeal form or pending state */}
      {pendingAppeal ? (
        <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>Your appeal is under review. You'll be notified of the decision.</p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 6 }}>
            Submitted {new Date(pendingAppeal.createdAt).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Explain why you believe this action was incorrect… (minimum 20 characters)"
            minLength={20}
            maxLength={2000}
            rows={5}
            style={{
              width: "100%", borderRadius: 12, padding: "12px 14px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
              color: "white", fontSize: 14, resize: "vertical",
              outline: "none", boxSizing: "border-box",
            }}
          />
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "right", marginTop: 4 }}>
            {text.length} / 2000
          </p>
          {submitAppeal.error && (
            <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{submitAppeal.error.message}</p>
          )}
          <button
            onClick={() => submitAppeal.mutate({ text, strikeId: selectedStrikeId })}
            disabled={submitAppeal.isPending || text.length < 20}
            style={{
              marginTop: 12, width: "100%", padding: "12px", borderRadius: 12,
              background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
              color: "white", fontSize: 14, fontWeight: 600,
              opacity: submitAppeal.isPending || text.length < 20 ? 0.5 : 1,
              cursor: submitAppeal.isPending || text.length < 20 ? "not-allowed" : "pointer",
              border: "none",
            }}
          >
            {submitAppeal.isPending ? "Submitting…" : "Submit Appeal"}
          </button>
        </>
      )}

      {/* Past appeals */}
      {appeals && appeals.filter(a => a.status !== "PENDING").length > 0 && (
        <div style={{ marginTop: 32 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Past appeals</p>
          {appeals.filter(a => a.status !== "PENDING").map(a => (
            <div key={a.id} style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: a.status === "APPROVED" ? "#4ade80" : "#f87171", fontSize: 13, fontWeight: 600 }}>
                  {a.status === "APPROVED" ? "Approved" : "Denied"}
                </span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                  {a.reviewedAt ? new Date(a.reviewedAt).toLocaleDateString() : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
