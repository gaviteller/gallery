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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome{session?.user?.username ? `, @${session.user.username}` : ""}
          </h1>
          <p className="text-gray-500 mt-2">One quick question before we get started</p>
        </div>

        <p className="text-center text-gray-700 font-medium mb-6">
          Do you want to sell art or take commissions?
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setSelected(true)}
            className={`p-6 rounded-xl border-2 text-left transition-all ${
              selected === true ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-2xl mb-2">🎨</div>
            <div className="font-semibold text-gray-900">Yes</div>
            <div className="text-sm text-gray-500 mt-1">Enable shop and commission features</div>
          </button>

          <button
            onClick={() => setSelected(false)}
            className={`p-6 rounded-xl border-2 text-left transition-all ${
              selected === false ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-2xl mb-2">🖼️</div>
            <div className="font-semibold text-gray-900">Not yet</div>
            <div className="text-sm text-gray-500 mt-1">Just browsing — enable this later in Settings</div>
          </button>
        </div>

        {completeOnboarding.error && (
          <p className="text-sm text-red-500 text-center mb-4">{completeOnboarding.error.message}</p>
        )}

        <button
          onClick={handleContinue}
          disabled={selected === null || completeOnboarding.isPending}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {completeOnboarding.isPending ? "Setting up your account..." : "Continue"}
        </button>
      </div>
    </div>
  )
}
