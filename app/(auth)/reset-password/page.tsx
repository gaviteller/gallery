"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { trpc } from "@/components/providers"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [matchError, setMatchError] = useState("")

  useEffect(() => {
    if (!token) router.replace("/forgot-password")
  }, [token, router])

  const mutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      router.push("/signin?reset=success")
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setMatchError("Passwords don't match.")
      return
    }
    setMatchError("")
    mutation.mutate({ token: token!, password })
  }

  if (!token) return null

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 p-8" style={{ background: "#1a1a2e" }}>
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="Gallery" width={100} height={100} className="mb-3" />
          <p className="text-white/50 text-sm">Choose a new password</p>
        </div>

        {!mutation.isSuccess && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500 transition"
              style={{ background: "#ffffff12", border: "1px solid #ffffff18" }}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500 transition"
              style={{ background: "#ffffff12", border: "1px solid #ffffff18" }}
            />

            {matchError && <p className="text-sm text-red-400 text-center">{matchError}</p>}
            {mutation.isError && (
              <p className="text-sm text-red-400 text-center">
                {mutation.error.message}
              </p>
            )}

            <button
              type="submit"
              disabled={mutation.isPending || !password || !confirm}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
            >
              {mutation.isPending ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}

        {mutation.isError && (
          <p className="mt-4 text-center text-sm text-white/50">
            <Link href="/forgot-password" className="text-purple-400 hover:underline">
              Request a new reset link
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
