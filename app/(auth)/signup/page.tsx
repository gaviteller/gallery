"use client"

import { useState, useRef, Suspense } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { trpc } from "@/components/providers"
import TermsContent from "@/components/TermsContent"
import { isAtLeast13 } from "@/lib/age"

function TermsModal({ onAgree, onClose }: { onAgree: () => void; onClose: () => void }) {
  const [hasReachedBottom, setHasReachedBottom] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setHasReachedBottom(true)
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px 16px 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Terms of Service</div>
            <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>Read to the end to continue</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: "rgba(240,235,248,.3)" }}>Effective Date: 2026 · Version 1.0</div>
            <div style={{ fontSize: 9, color: "rgba(240,235,248,.3)", marginTop: 2 }}>Gallery, operated by Shomron Industries · Atlanta, Georgia, USA</div>
            <div style={{ fontSize: 11, color: "rgba(240,235,248,.55)", marginTop: 10, lineHeight: 1.5 }}>These Terms of Service govern your use of the Gallery platform. By creating an account or using Gallery, you agree to these terms.</div>
          </div>
          <TermsContent />
          <div style={{ height: 16 }} />
        </div>
        <div style={{ flexShrink: 0, padding: "12px 18px 18px", borderTop: "1px solid var(--border)" }}>
          {!hasReachedBottom && (
            <div style={{ fontSize: 9, color: "var(--muted)", textAlign: "center", marginBottom: 10 }}>Scroll to the bottom to enable the agree button</div>
          )}
          <button
            onClick={onAgree}
            disabled={!hasReachedBottom}
            style={{ width: "100%", padding: "10px 0", borderRadius: 8, background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", color: "white", fontSize: 10, fontWeight: 600, border: "none", cursor: hasReachedBottom ? "pointer" : "not-allowed", opacity: hasReachedBottom ? 1 : 0.4 }}
          >
            I Agree to the Terms of Service
          </button>
        </div>
      </div>
    </div>
  )
}

function SignUpForm() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", username: "", password: "", dateOfBirth: "" })
  const [agreed, setAgreed] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const { data: usernameCheck, isFetching: checkingUsername } = trpc.user.checkUsername.useQuery(
    { username: form.username },
    { enabled: form.username.length >= 3 }
  )

  const usernameValid = /^[a-zA-Z0-9_]+$/.test(form.username) && form.username.length >= 3 && form.username.length <= 30
  const usernameAvailable = usernameValid && usernameCheck?.available === true

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) { setError("You must agree to the Terms of Service"); return }
    if (!usernameAvailable) { setError("Please choose a valid, available username"); return }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return }
    if (!form.dateOfBirth) { setError("Date of birth is required"); return }
    if (!isAtLeast13(form.dateOfBirth)) { setError("You must be at least 13 years old to create an account."); return }

    setLoading(true)
    setError("")

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? "Something went wrong")
      setLoading(false)
      return
    }

    const result = await signIn("credentials", { email: form.email, password: form.password, redirect: false })

    if (result?.error) {
      setError("Account created but sign-in failed. Try signing in manually.")
      setLoading(false)
      return
    }

    router.push("/onboarding")
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 10,
    color: "var(--text)",
    outline: "none",
    fontFamily: "Inter, sans-serif",
    marginBottom: 8,
  }

  return (
    <>
      {showTerms && (
        <TermsModal
          onAgree={() => { setAgreed(true); setShowTerms(false) }}
          onClose={() => setShowTerms(false)}
        />
      )}

      <div style={{ background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "28px 24px 32px" }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <Image src="/logo.png" alt="Gallery" width={58} height={58} style={{ borderRadius: 14 }} />
        </div>

        {/* Title */}
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "var(--text)", textAlign: "center", marginBottom: 4 }}>
          Create your account
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", textAlign: "center", marginBottom: 20 }}>
          Anyone can be an artist
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 10, fontWeight: 500, cursor: "pointer", marginBottom: 14 }}
        >
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "conic-gradient(#4285F4 0deg 90deg, #EA4335 90deg 180deg, #FBBC05 180deg 270deg, #34A853 270deg 360deg)", flexShrink: 0 }} />
          Sign up with Google
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 8, color: "var(--muted)" }}>or sign up with email</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Full name" value={form.name} onChange={set("name")} required style={inputStyle} />
          <input type="email" placeholder="Email address" value={form.email} onChange={set("email")} required style={inputStyle} />

          {/* Username */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <span style={{ padding: "8px 0 8px 10px", fontSize: 10, color: "rgba(240,235,248,0.3)", fontFamily: "Inter, sans-serif" }}>@</span>
              <input
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                maxLength={30}
                required
                style={{ flex: 1, background: "transparent", border: "none", padding: "8px 10px 8px 4px", fontSize: 10, color: "var(--text)", outline: "none", fontFamily: "Inter, sans-serif" }}
              />
              {form.username.length >= 3 && (
                <span style={{ paddingRight: 8, fontSize: 9, color: checkingUsername ? "var(--muted)" : usernameAvailable ? "#48C878" : "#f87171", flexShrink: 0 }}>
                  {checkingUsername ? "…" : usernameAvailable ? "✓" : "✗"}
                </span>
              )}
            </div>
          </div>

          <input type="password" placeholder="Password" value={form.password} onChange={set("password")} required minLength={6} style={inputStyle} />

          <input
            type="date"
            value={form.dateOfBirth}
            onChange={set("dateOfBirth")}
            max={new Date().toISOString().split("T")[0]}
            required
            style={{ ...inputStyle, colorScheme: "dark", marginBottom: 12 }}
          />

          {/* Terms */}
          {agreed ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(43,134,197,0.1)", border: "1px solid rgba(43,134,197,0.3)", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "#2B86C5", flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 9, color: "var(--muted)", flex: 1 }}>Agreed to Terms of Service</span>
              <button type="button" onClick={() => setShowTerms(true)} style={{ fontSize: 9, color: "#2B86C5", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Review</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", marginBottom: 12 }}
            >
              <div style={{ width: 13, height: 13, borderRadius: 3, border: "1px solid var(--border)", background: "var(--bg)", flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: "var(--muted)", textAlign: "left", flex: 1 }}>I agree to the <span style={{ color: "#9080B8" }}>Terms of Service</span> and confirm I am 13 or older</span>
            </button>
          )}

          {error && <div style={{ fontSize: 10, color: "#f87171", textAlign: "center", marginBottom: 10 }}>{error}</div>}

          <button
            type="submit"
            disabled={loading || !form.name || !form.email || !form.password || !form.dateOfBirth || !agreed}
            style={{ width: "100%", padding: "9px 0", borderRadius: 8, background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", color: "white", fontSize: 10, fontWeight: 600, border: "none", cursor: "pointer", opacity: loading || !form.name || !form.email || !form.password || !form.dateOfBirth || !agreed ? 0.5 : 1 }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />

        {/* Sign in link */}
        <div style={{ textAlign: "center", fontSize: 9, color: "var(--muted)" }}>
          Already have an account?{" "}
          <Link href="/signin" style={{ color: "#9080B8", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    </>
  )
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  )
}
