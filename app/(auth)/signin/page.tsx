"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

function SignInForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"
  const authError = searchParams.get("error")
  const resetSuccess = searchParams.get("reset") === "success"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState("")

  const error = localError || (authError === "CredentialsSignin" ? "Incorrect email or password." : "")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLocalError("")
    try {
      const result = await signIn("credentials", { email, password, redirect: false })
      if (result?.error) {
        setLocalError("Incorrect email or password.")
        setLoading(false)
      } else {
        window.location.href = "/"
      }
    } catch {
      window.location.href = callbackUrl
    }
  }

  return (
    <div style={{ background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "28px 24px 32px" }}>
      {/* Logo */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <Image src="/logo.png" alt="Gallery" width={58} height={58} style={{ borderRadius: 14 }} />
      </div>

      {/* Title */}
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "var(--text)", textAlign: "center", marginBottom: 4 }}>
        Sign in to Gallery
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", textAlign: "center", marginBottom: 20 }}>
        Anyone can be an artist
      </div>

      {resetSuccess && (
        <p style={{ fontSize: 11, color: "#48C878", textAlign: "center", marginBottom: 12 }}>
          Password reset — sign in with your new password.
        </p>
      )}

      {/* Google button */}
      <button
        onClick={() => signIn("google", { callbackUrl: "/" })}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 10, fontWeight: 500, cursor: "pointer", marginBottom: 14 }}
      >
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "conic-gradient(#4285F4 0deg 90deg, #EA4335 90deg 180deg, #FBBC05 180deg 270deg, #34A853 270deg 360deg)", flexShrink: 0 }} />
        Continue with Google
      </button>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 8, color: "var(--muted)" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      {/* Inputs */}
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 10, color: "var(--text)", outline: "none", marginBottom: 8, fontFamily: "Inter, sans-serif" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 10, color: "var(--text)", outline: "none", marginBottom: 12, fontFamily: "Inter, sans-serif" }}
        />

        {error && (
          <p style={{ fontSize: 10, color: "#f87171", textAlign: "center", marginBottom: 10 }}>{error}</p>
        )}

        {/* Log in button */}
        <button
          type="submit"
          disabled={loading || !email || !password}
          style={{ width: "100%", padding: "9px 0", borderRadius: 8, background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", color: "white", fontSize: 10, fontWeight: 600, cursor: "pointer", border: "none", opacity: loading || !email || !password ? 0.5 : 1 }}
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      {/* Forgot password */}
      <div style={{ textAlign: "center", marginTop: 10, marginBottom: 16 }}>
        <Link href="/forgot-password" style={{ fontSize: 9, color: "var(--muted)", textDecoration: "none" }}>
          Forgot password?
        </Link>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border)", marginBottom: 14 }} />

      {/* Sign up */}
      <div style={{ textAlign: "center", fontSize: 9, color: "var(--muted)" }}>
        No account?{" "}
        <Link href="/signup" style={{ color: "#9080B8", fontWeight: 600, textDecoration: "none" }}>
          Sign up
        </Link>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
