"use client"

import { useState, useRef, Suspense } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { trpc } from "@/components/providers"
import TermsContent from "@/components/TermsContent"

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
      <div className="w-full sm:max-w-2xl sm:rounded-2xl flex flex-col max-h-screen sm:max-h-[90vh] shadow-2xl" style={{ background: "#1a1a2e", border: "1px solid #ffffff15" }}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #ffffff10" }}>
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
        <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: "1px solid #ffffff10" }}>
          {!hasReachedBottom && (
            <p className="text-xs text-center text-white/40 mb-3">
              Scroll to the bottom to enable the agree button
            </p>
          )}
          <button
            onClick={onAgree}
            disabled={!hasReachedBottom}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #FF1493 0%, #CC33AA 50%, #AAFF00 100%)" }}
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
  const [form, setForm] = useState({ name: "", email: "", username: "", password: "" })
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

      <div className="rounded-2xl border border-white/10 p-8" style={{ background: "#1a1a2e" }}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="Gallery" width={100} height={100} className="mb-3" />
          <p className="text-white/50 text-sm">Sign up to discover art from creators you love.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Full name"
            value={form.name}
            onChange={set("name")}
            required
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-pink-500 transition"
            style={{ background: "#ffffff12", border: "1px solid #ffffff18" }}
          />

          <input
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={set("email")}
            required
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-pink-500 transition"
            style={{ background: "#ffffff12", border: "1px solid #ffffff18" }}
          />

          <div>
            <div
              className="flex items-center rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-pink-500 transition"
              style={{ background: "#ffffff12", border: "1px solid #ffffff18" }}
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
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-pink-500 transition"
            style={{ background: "#ffffff12", border: "1px solid #ffffff18" }}
          />

          {/* Terms */}
          <div className="pt-1">
            {agreed ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "#ffffff10", border: "1px solid #00B4EE40" }}>
                <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs text-white/60 flex-1">You&apos;ve agreed to the Terms of Service</span>
                <button type="button" onClick={() => setShowTerms(true)} className="text-xs text-cyan-400 underline hover:text-cyan-300">Review</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm text-white/50 hover:text-white/80 transition"
                style={{ background: "#ffffff10", border: "1px solid #ffffff18" }}
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
            disabled={loading || !form.name || !form.email || !form.password || !agreed}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #FF1493 0%, #CC33AA 50%, #AAFF00 100%)" }}
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="text-center text-xs text-white/40 mt-6">
          Already have an account?{" "}
          <Link href="/signin" className="font-semibold text-white hover:opacity-80 transition">
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
