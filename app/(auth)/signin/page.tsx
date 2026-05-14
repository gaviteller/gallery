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
  const verifiedParam = searchParams.get("verified")
  const emailParam = searchParams.get("email") ?? ""
  const [email, setEmail] = useState(emailParam)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState("")

  const error = localError || (authError === "CredentialsSignin" ? "Incorrect email or password. If you haven't verified your email yet, check your inbox." : "")

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
    <div className="space-y-3">
      {/* Card */}
      <div className="rounded-2xl border border-white/10 p-8" style={{ background: "#0D1640" }}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="Gallery" width={100} height={100} className="mb-3" />
          <p className="text-white/50 text-sm">Sign in to your account</p>
        </div>

        {verifiedParam === "1" && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4" style={{ background: "rgba(0,180,238,0.1)", border: "1px solid rgba(0,180,238,0.3)" }}>
            <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-cyan-300">Email verified! Sign in to continue.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-sky-500 transition"
            style={{ background: "#ffffff12", border: "1px solid #ffffff18" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-sky-500 transition"
            style={{ background: "#ffffff12", border: "1px solid #ffffff18" }}
          />

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="text-center mt-4">
          <a href="#" className="text-xs text-white/40 hover:text-white/70 transition">Forgot password?</a>
        </p>
      </div>

      {/* Sign up link */}
      <div className="rounded-2xl border border-white/10 p-5 text-center" style={{ background: "#0D1640" }}>
        <p className="text-sm text-white/50">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-white hover:opacity-80 transition">
            Sign up
          </Link>
        </p>
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
