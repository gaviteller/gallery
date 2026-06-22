"use client"

import { useState, useRef, Suspense } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { trpc } from "@/components/providers"
import TermsContent from "@/components/TermsContent"
import { isAtLeast13 } from "@/lib/age"

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function TermsModal({ onAgree, onClose }: { onAgree: () => void; onClose: () => void }) {
  const [hasReachedBottom, setHasReachedBottom] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20
    if (atBottom) setHasReachedBottom(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
      <div className="w-full sm:max-w-2xl sm:rounded-2xl flex flex-col max-h-screen sm:max-h-[90vh] shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-base font-bold text-white">Terms of Service</h2>
            <p className="text-xs text-white/40 mt-0.5">Read to the end to continue</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable terms body */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          {/* Terms header */}
          <div className="text-center mb-8">
            <p className="text-xs text-white/30">Effective Date: 2026 · Version 1.0</p>
            <p className="text-xs text-white/30">Gallery, operated by Shomron Industries · Atlanta, Georgia, USA</p>
            <p className="text-sm text-white/60 mt-3">
              These Terms of Service govern your use of the Gallery platform. By creating an account or using Gallery, you agree to these terms.
            </p>
          </div>

          <TermsContent />

          {/* Bottom spacer so the last section is clearly visible */}
          <div className="h-4" />
        </div>

        {/* Sticky agree footer */}
        <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          {!hasReachedBottom && (
            <p className="text-xs text-center mb-3" style={{ color: "var(--muted)" }}>
              Scroll to the bottom to enable the agree button
            </p>
          )}
          <button
            onClick={onAgree}
            disabled={!hasReachedBottom}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
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

  const usernameValid =
    /^[a-zA-Z0-9_]+$/.test(form.username) &&
    form.username.length >= 3 &&
    form.username.length <= 30
  const usernameAvailable = usernameValid && usernameCheck?.available === true

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
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

    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    })

    if (result?.error) {
      setError("Account created but sign-in failed. Try signing in manually.")
      setLoading(false)
      return
    }

    router.push("/onboarding")
  }

  return (
    <>
      {showTerms && (
        <TermsModal
          onAgree={() => { setAgreed(true); setShowTerms(false) }}
          onClose={() => setShowTerms(false)}
        />
      )}

      <div className="rounded-2xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="Gallery" width={100} height={100} className="mb-3" />
          <p className="text-sm" style={{ color: "var(--muted)" }}>Sign up to discover art from creators you love.</p>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium transition hover:opacity-80 mb-4"
          style={{ background: "rgba(240,235,248,0.07)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          <GoogleIcon />
          Sign up with Google
        </button>

        <div className="relative flex items-center mb-4">
          <div className="flex-1" style={{ borderTop: "1px solid var(--border)" }} />
          <span className="px-3 text-xs" style={{ color: "var(--muted)" }}>or sign up with email</span>
          <div className="flex-1" style={{ borderTop: "1px solid var(--border)" }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Full name"
            value={form.name}
            onChange={set("name")}
            required
            className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 transition"
          />

          <input
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={set("email")}
            required
            className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 transition"
          />

          <div>
            <div
              className="flex items-center rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-purple-500 transition"
              style={{ background: "rgba(240,235,248,0.05)", border: "1px solid var(--border)" }}
            >
              <span className="pl-4 text-white/30 text-sm">@</span>
              <input
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  }))
                }
                maxLength={30}
                required
                className="flex-1 px-2 py-3 text-sm text-white placeholder-white/30 bg-transparent focus:outline-none"
              />
            </div>
            <div className="mt-1 h-4">
              {form.username.length >= 3 &&
                (checkingUsername ? (
                  <p className="text-xs text-white/40">Checking…</p>
                ) : usernameAvailable ? (
                  <p className="text-xs text-green-400">✓ Available</p>
                ) : (
                  <p className="text-xs text-red-400">✗ Already taken</p>
                ))}
            </div>
          </div>

          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={set("password")}
            required
            minLength={6}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 transition"
          />

          <div>
            <label className="block text-xs mb-1 pl-1" style={{ color: "var(--muted)" }}>Date of birth</label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={set("dateOfBirth")}
              max={new Date().toISOString().split("T")[0]}
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 transition"
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* Terms */}
          <div className="pt-1">
            {agreed ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(43,134,197,0.1)", border: "1px solid rgba(43,134,197,0.3)" }}>
                <svg className="w-4 h-4 flex-shrink-0" style={{ color: "#2B86C5" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs flex-1" style={{ color: "var(--muted)" }}>You&apos;ve agreed to the Terms of Service</span>
                <button type="button" onClick={() => setShowTerms(true)} className="text-xs underline hover:opacity-80" style={{ color: "#2B86C5" }}>Review</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition hover:opacity-80"
                style={{ background: "rgba(240,235,248,0.05)", border: "1px solid var(--border)", color: "var(--muted)" }}
              >
                <span>Review &amp; agree to Terms of Service</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !form.name || !form.email || !form.password || !form.dateOfBirth || !agreed}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "var(--muted)" }}>
          Already have an account?{" "}
          <Link href="/signin" className="font-semibold hover:opacity-80 transition" style={{ color: "var(--text)" }}>
            Log in
          </Link>
        </p>
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
