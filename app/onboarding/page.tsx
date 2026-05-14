"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { trpc } from "@/components/providers"

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [selected, setSelected] = useState<boolean | null>(null)

  const completeOnboarding = trpc.user.completeOnboarding.useMutation({
    onSuccess: async () => {
      await update()
      router.push("/")
    },
  })

  function handleContinue() {
    if (selected === null) return
    completeOnboarding.mutate({ sellingEnabled: selected })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#000000" }}>
      <div className="w-full max-w-lg rounded-2xl p-8" style={{ background: "#1a1a2e", border: "1px solid #ffffff15" }}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">
            Welcome{session?.user?.username ? `, @${session.user.username}` : ""}
          </h1>
          <p className="text-white/50 mt-2">One quick question before we get started</p>
        </div>

        <p className="text-center text-white/80 font-medium mb-6">
          Do you want to sell art or take commissions?
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setSelected(true)}
            className="p-6 rounded-xl text-left transition-all"
            style={{
              border: selected === true ? "2px solid #CC33AA" : "2px solid #ffffff15",
              background: selected === true ? "rgba(255,20,147,0.1)" : "transparent",
            }}
          >
            <div className="text-2xl mb-2">🎨</div>
            <div className="font-semibold text-white">Yes</div>
            <div className="text-sm text-white/50 mt-1">Enable shop and commission features</div>
          </button>

          <button
            onClick={() => setSelected(false)}
            className="p-6 rounded-xl text-left transition-all"
            style={{
              border: selected === false ? "2px solid #CC33AA" : "2px solid #ffffff15",
              background: selected === false ? "rgba(255,20,147,0.1)" : "transparent",
            }}
          >
            <div className="text-2xl mb-2">🖼️</div>
            <div className="font-semibold text-white">Not yet</div>
            <div className="text-sm text-white/50 mt-1">Just browsing — enable this later in Settings</div>
          </button>
        </div>

        {completeOnboarding.error && (
          <p className="text-sm text-red-400 text-center mb-4">{completeOnboarding.error.message}</p>
        )}

        <button
          onClick={handleContinue}
          disabled={selected === null || completeOnboarding.isPending}
          className="w-full py-3 rounded-xl font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #FF1493 0%, #CC33AA 50%, #AAFF00 100%)" }}
        >
          {completeOnboarding.isPending ? "Setting up your account..." : "Continue"}
        </button>
      </div>
    </div>
  )
}
