"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { trpc } from "@/components/providers"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  const mutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      setSubmitted(true)
      setCooldown(true)
      setTimeout(() => setCooldown(false), 60_000)
    },
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate({ email })
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 p-8" style={{ background: "#1a1a2e" }}>
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="Gallery" width={100} height={100} className="mb-3" />
          <p className="text-white/50 text-sm">Reset your password</p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-white/70 leading-relaxed">
              If that email is registered, you&apos;ll receive a reset link shortly.
            </p>
            <button
              onClick={() => { setSubmitted(false); setEmail("") }}
              disabled={cooldown}
              className="text-xs text-white/40 hover:text-white/70 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {cooldown ? "Wait 60s before requesting again" : "Send another link"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500 transition"
              style={{ background: "#ffffff12", border: "1px solid #ffffff18" }}
            />
            <button
              type="submit"
              disabled={mutation.isPending || !email || cooldown}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
            >
              {mutation.isPending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 p-5 text-center" style={{ background: "#1a1a2e" }}>
        <p className="text-sm text-white/50">
          <Link href="/signin" className="font-semibold text-white hover:opacity-80 transition">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
