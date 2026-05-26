"use client"

import { useState } from "react"
import { trpc } from "@/components/providers"

const REASON_LABELS: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  HATE_SPEECH: "Hate Speech",
  GORE: "Gore / Graphic Violence",
  CSAM: "Child Safety",
  COPYRIGHT: "Copyright Violation",
  UNLABELLED_AI: "Unlabelled AI-Generated Content",
  OTHER: "Other",
}

interface ReportModalProps {
  postId: string
  onClose: () => void
  onReported: () => void
}

export default function ReportModal({ postId, onClose, onReported }: ReportModalProps) {
  const [reason, setReason] = useState("SPAM")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  const report = trpc.post.report.useMutation({
    onSuccess: () => {
      onReported()
      onClose()
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        setError("You have already reported this post.")
      } else {
        setError("Something went wrong. Please try again.")
      }
    },
  })

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: "#1a1a2e", borderRadius: 12, padding: 24, width: 360,
        border: "1px solid rgba(255,255,255,0.12)",
      }}>
        <h3 style={{ color: "white", fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>
          Report Post
        </h3>

        <label style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, display: "block", marginBottom: 6 }}>
          Reason
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{
            width: "100%", background: "#0d0d1a", color: "white", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8, padding: "8px 10px", fontSize: 13, marginBottom: 14,
          }}
        >
          {Object.entries(REASON_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <label style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, display: "block", marginBottom: 6 }}>
          Additional notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Describe the issue..."
          style={{
            width: "100%", background: "#0d0d1a", color: "white", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "none", marginBottom: 14,
            boxSizing: "border-box",
          }}
        />
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "right", marginTop: -10, marginBottom: 14 }}>
          {notes.length}/500
        </div>

        {error && (
          <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
              borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => report.mutate({ postId, reason: reason as never, notes: notes || undefined })}
            disabled={report.isPending}
            style={{
              background: "#7c3aed", border: "none", color: "white",
              borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer",
              opacity: report.isPending ? 0.6 : 1,
            }}
          >
            {report.isPending ? "Submitting..." : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  )
}
