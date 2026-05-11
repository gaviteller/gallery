"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { trpc } from "@/components/providers"

export default function OnboardingPage() {
  const router = useRouter()
  const { update } = useSession()
  const [step, setStep] = useState<1 | 2>(1)
  const [username, setUsername] = useState("")
  const [selected, setSelected] = useState<boolean | null>(null)

  const { data: usernameCheck, isFetching: checkingUsername } = trpc.user.checkUsername.useQuery(
    { username },
    { enabled: username.length >= 3 }
  )

  const completeOnboarding = trpc.user.completeOnboarding.useMutation({
    onSuccess: async () => {
      await update()
      router.push("/")
    },
  })

  const usernameValid = /^[a-zA-Z0-9_]+$/.test(username) && username.length >= 3 && username.length <= 30
  const usernameAvailable = usernameValid && usernameCheck?.available === true

  function handleContinue() {
    if (selected === null) return
    completeOnboarding.mutate({ username, sellingEnabled: selected })
  }

  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Pick your username</h1>
            <p className="text-gray-500 mt-2">This is how people will find you on Gallery</p>
          </div>

          <div className="mb-6">
            <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
              <span className="pl-4 text-gray-400 text-sm select-none">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="yourname"
                maxLength={30}
                className="flex-1 px-2 py-3 text-sm text-gray-900 focus:outline-none bg-transparent"
              />
              <span className="pr-4 text-xs text-gray-400">{username.length}/30</span>
            </div>

            <div className="mt-2 h-5">
              {username.length >= 3 && (
                checkingUsername ? (
                  <p className="text-xs text-gray-400">Checking...</p>
                ) : usernameCheck?.available ? (
                  <p className="text-xs text-green-600">✓ Available</p>
                ) : (
                  <p className="text-xs text-red-500">✗ Already taken</p>
                )
              )}
              {username.length > 0 && username.length < 3 && (
                <p className="text-xs text-gray-400">At least 3 characters</p>
              )}
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!usernameAvailable}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <button
          onClick={() => setStep(1)}
          className="text-sm text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1"
        >
          ← Back
        </button>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, @{username}</h1>
          <p className="text-gray-500 mt-2">One more thing before we get started</p>
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
            <div className="text-sm text-gray-500 mt-1">Just browsing — I can enable this later</div>
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
