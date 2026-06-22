"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

const STORAGE_KEY = "cookie_consent"

function isEuTimezone(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz.startsWith("Europe/")
  } catch {
    return false // fail open — don't show banner if detection fails
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Only show if EU timezone AND no prior choice stored
    if (isEuTimezone() && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted")
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, "declined")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: "fixed",
        bottom: 72, // above BottomNav (h-16 = 64px + a little breathing room)
        left: 0,
        right: 0,
        zIndex: 200,
        display: "flex",
        justifyContent: "center",
        padding: "0 16px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          pointerEvents: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
          We use essential cookies to keep you signed in and make the platform work. We don&rsquo;t
          use tracking or advertising cookies.{" "}
          <Link href="/terms" style={{ color: "#784BA0", textDecoration: "underline" }}>
            Learn more
          </Link>
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={decline}
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Decline
          </button>
          <button
            onClick={accept}
            style={{
              background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
