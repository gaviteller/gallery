"use client"

import { useState, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { trpc } from "@/components/providers"

function CounterNoticeInner() {
  const { data: session, status: sessionStatus } = useSession()
  const searchParams = useSearchParams()
  const dmcaRequestId = searchParams.get("id") ?? ""

  const [statement, setStatement] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const fileCounterNotice = trpc.dmca.fileCounterNotice.useMutation({
    onSuccess: () => setSubmitted(true),
  })

  if (sessionStatus === "loading") return null
  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          Please sign in to file a counter-notice.
        </p>
      </div>
    )
  }

  if (!dmcaRequestId) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
        <p style={{ color: "#f87171", fontSize: 14 }}>
          Invalid link — no DMCA request ID found. Please use the link from your removal email.
        </p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
        <div style={{
          padding: 24, borderRadius: 16,
          background: "rgba(0,200,100,0.08)",
          border: "1px solid rgba(0,200,100,0.25)",
        }}>
          <p style={{ color: "#4ade80", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            Counter-notice filed
          </p>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Your counter-notice has been received. We are required to forward it to the claimant.
            If no legal action is initiated within 14 days, your post will be automatically restored.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        File a DMCA Counter-Notice
      </h1>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        If you believe your post was removed in error, you may file a counter-notice under the DMCA.
        We will forward your statement to the claimant. If they do not initiate legal proceedings within
        14 days, your post will be restored.
      </p>

      <div style={{
        padding: "14px 16px", borderRadius: 10, marginBottom: 24,
        background: "rgba(255,180,0,0.08)",
        border: "1px solid rgba(255,180,0,0.25)",
      }}>
        <p style={{ color: "rgba(255,180,0,0.9)", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          <strong>Legal declaration:</strong> By submitting this form, you declare under penalty of perjury
          that you have a good-faith belief the content was removed as a result of a mistake or
          misidentification, and that you consent to the jurisdiction of the federal district court
          for your judicial district.
        </p>
      </div>

      <label style={{ display: "block", color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 8 }}>
        Your statement <span style={{ color: "rgba(255,255,255,0.3)" }}>(min 20 characters)</span>
      </label>
      <textarea
        value={statement}
        onChange={e => setStatement(e.target.value)}
        placeholder="Explain why you believe this removal was made in error. Include any evidence that you own or have the right to use this content."
        minLength={20}
        maxLength={5000}
        rows={7}
        style={{
          width: "100%", borderRadius: 12, padding: "12px 14px",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
          color: "white", fontSize: 14, resize: "vertical",
          outline: "none", boxSizing: "border-box",
        }}
      />
      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "right", marginTop: 4 }}>
        {statement.length} / 5000
      </p>

      {fileCounterNotice.error && (
        <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>
          {fileCounterNotice.error.message}
        </p>
      )}

      <button
        onClick={() => fileCounterNotice.mutate({ dmcaRequestId, statement })}
        disabled={fileCounterNotice.isPending || statement.length < 20}
        style={{
          marginTop: 12, width: "100%", padding: "12px",
          borderRadius: 12,
          background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)",
          color: "white", fontSize: 14, fontWeight: 600,
          opacity: fileCounterNotice.isPending || statement.length < 20 ? 0.5 : 1,
          cursor: fileCounterNotice.isPending || statement.length < 20 ? "not-allowed" : "pointer",
          border: "none",
        }}
      >
        {fileCounterNotice.isPending ? "Submitting…" : "Submit Counter-Notice"}
      </button>
    </div>
  )
}

export default function CounterNoticePage() {
  return (
    <Suspense>
      <CounterNoticeInner />
    </Suspense>
  )
}
