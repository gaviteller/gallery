"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

function VerifyEmailInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const token = searchParams.get("token")
  const email = searchParams.get("email")

  const [state, setState] = useState<"verifying" | "success" | "error">("verifying")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    // No token/email → just show "check inbox" screen
    if (!token || !email) {
      setState("error")
      setErrorMsg("Invalid verification link.")
      return
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setState("success")
          // Auto-redirect to sign-in after 2s
          setTimeout(() => {
            router.push(`/signin?verified=1&email=${encodeURIComponent(email)}`)
          }, 2000)
        } else {
          setState("error")
          setErrorMsg(data.error ?? "Verification failed.")
        }
      })
      .catch(() => {
        setState("error")
        setErrorMsg("Something went wrong. Please try again.")
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-2xl border border-white/10 p-8 text-center" style={{ background: "#0D1640" }}>
      <div className="flex flex-col items-center mb-6">
        <Image src="/logo.png" alt="Gallery" width={80} height={80} className="mb-3" />
      </div>

      {state === "verifying" && (
        <>
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mx-auto mb-4" />
          <p className="text-white font-semibold">Verifying your email…</p>
        </>
      )}

      {state === "success" && (
        <>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Email verified!</h2>
          <p className="text-sm text-white/50 mb-4">Taking you to sign in…</p>
          <Link
            href={`/signin?verified=1&email=${encodeURIComponent(email ?? "")}`}
            className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}
          >
            Sign in now
          </Link>
        </>
      )}

      {state === "error" && (
        <>
          <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Verification failed</h2>
          <p className="text-sm text-white/50 mb-4">{errorMsg}</p>
          <Link href="/signup" className="text-sm text-sky-400 hover:text-sky-300 underline">
            Sign up again
          </Link>
        </>
      )}
    </div>
  )
}

// Shown when user has just signed up (no token yet — just the "check inbox" landing)
function CheckInboxScreen() {
  return (
    <div className="rounded-2xl border border-white/10 p-8 text-center" style={{ background: "#0D1640" }}>
      <div className="flex flex-col items-center mb-6">
        <Image src="/logo.png" alt="Gallery" width={80} height={80} className="mb-3" />
      </div>
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(107,94,255,0.15)", border: "1px solid rgba(107,94,255,0.3)" }}>
        <svg className="w-7 h-7 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-white mb-2">Check your inbox</h2>
      <p className="text-sm text-white/50 mb-4">We sent a verification link to your email address. Click it to activate your account.</p>
      <p className="text-xs text-white/30">Didn&apos;t get it? Check your spam folder or <Link href="/signup" className="text-sky-400 hover:underline">try again</Link>.</p>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="rounded-2xl border border-white/10 p-8 text-center" style={{ background: "#0D1640" }}>
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mx-auto" />
      </div>
    }>
      <VerifyEmailRouter />
    </Suspense>
  )
}

function VerifyEmailRouter() {
  const searchParams = useSearchParams()
  const hasToken = !!searchParams.get("token")
  if (!hasToken) return <CheckInboxScreen />
  return <VerifyEmailInner />
}
