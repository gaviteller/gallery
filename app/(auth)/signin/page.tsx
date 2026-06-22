"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

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
    <div className="space-y-3">
      {/* Card */}
      <div className="rounded-2xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="Gallery" width={100} height={100} className="mb-3" />
          <p className="text-sm" style={{ color: "var(--muted)" }}>Sign in to your account</p>
        </div>

        {resetSuccess && (
          <p className="text-sm text-green-400 text-center mb-4">
            Password reset — please sign in with your new password.
          </p>
        )}

        {/* Google OAuth */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium transition hover:opacity-80 mb-4"
          style={{ background: "rgba(240,235,248,0.07)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="relative flex items-center mb-4">
          <div className="flex-1" style={{ borderTop: "1px solid var(--border)" }} />
          <span className="px-3 text-xs" style={{ color: "var(--muted)" }}>or</span>
          <div className="flex-1" style={{ borderTop: "1px solid var(--border)" }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 transition"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 transition"
          />

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="text-center mt-4">
          <Link href="/forgot-password" className="text-xs hover:opacity-80 transition" style={{ color: "var(--muted)" }}>Forgot password?</Link>
        </p>
      </div>

      {/* Sign up link */}
      <div className="rounded-2xl p-5 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold hover:opacity-80 transition" style={{ color: "var(--text)" }}>
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
