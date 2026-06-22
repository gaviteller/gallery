"use client"

import { useState } from "react"
import { trpc } from "@/components/providers"

export default function DmcaPage() {
  const [claimantName, setClaimantName] = useState("")
  const [claimantEmail, setClaimantEmail] = useState("")
  const [postUrl, setPostUrl] = useState("")
  const [description, setDescription] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = trpc.dmca.submit.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => setError(err.message),
  })

  if (submitted) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--bg)", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ maxWidth: 480, textAlign: "center", padding: "0 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
            Request Received
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, lineHeight: 1.6 }}>
            Your DMCA request has been received. We will respond within 14 days as required by law.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ color: "white", fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
          DMCA Takedown Request
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
          Use this form to report content you believe infringes your copyright. We review all requests
          and respond within 14 days as required by the Digital Millennium Copyright Act.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Field label="Your full name *">
            <input
              type="text"
              value={claimantName}
              onChange={(e) => setClaimantName(e.target.value)}
              placeholder="Jane Smith"
              style={inputStyle}
            />
          </Field>

          <Field label="Your email address *">
            <input
              type="email"
              value={claimantEmail}
              onChange={(e) => setClaimantEmail(e.target.value)}
              placeholder="jane@example.com"
              style={inputStyle}
            />
          </Field>

          <Field label="Link to the post you believe infringes your copyright *">
            <input
              type="url"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://gallery.example.com/posts/abc123"
              style={inputStyle}
            />
          </Field>

          <Field label="Describe your original work and how it is being infringed *">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Describe the original work you own and how the post infringes it. Include as much detail as possible."
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "right", marginTop: 4 }}>
              {description.length}/5000 (minimum 50 characters)
            </div>
          </Field>

          {error && (
            <div style={{ color: "#f87171", fontSize: 13 }}>{error}</div>
          )}

          <button
            onClick={() => submit.mutate({ claimantName, claimantEmail, postUrl, description })}
            disabled={submit.isPending}
            style={{
              background: "#7c3aed", color: "white", border: "none", borderRadius: 10,
              padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
              opacity: submit.isPending ? 0.6 : 1,
            }}
          >
            {submit.isPending ? "Submitting..." : "Submit DMCA Takedown Request"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, display: "block", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--surface)", color: "white",
  border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
  padding: "10px 12px", fontSize: 14, boxSizing: "border-box",
}
