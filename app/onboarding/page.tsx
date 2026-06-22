"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { trpc } from "@/components/providers"

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, update, status } = useSession()

  // Step 1 (OAuth users only): pick a username + agree to terms
  const [username, setUsername] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [step, setStep] = useState<"loading" | "username" | "selling">("loading")

  useEffect(() => {
    if (status === "authenticated") {
      setStep(session?.user?.username ? "selling" : "username")
    }
  }, [status, session?.user?.username])

  // Step 2: selling preference
  const [selected, setSelected] = useState<boolean | null>(null)

  const { data: usernameCheck, isFetching: checkingUsername } = trpc.user.checkUsername.useQuery(
    { username },
    { enabled: username.length >= 3 }
  )

  const usernameValid =
    /^[a-zA-Z0-9_]+$/.test(username) &&
    username.length >= 3 &&
    username.length <= 30
  const usernameAvailable = usernameValid && usernameCheck?.available === true

  const changeUsername = trpc.user.changeUsername.useMutation({
    onSuccess: async () => {
      await update()
      setStep("selling")
    },
  })

  const completeOnboarding = trpc.user.completeOnboarding.useMutation({
    onSuccess: async () => {
      await update()
      router.push("/")
    },
  })

  function handleUsernameContinue() {
    if (!usernameAvailable || !agreedToTerms) return
    changeUsername.mutate({ username })
  }

  function handleContinue() {
    if (selected === null) return
    completeOnboarding.mutate({ sellingEnabled: selected })
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#784BA0", borderTopColor: "transparent" }} />
      </div>
    )
  }

  if (step === "username") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        <div className="w-full max-w-lg rounded-2xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-center mb-8">
            <h1 className="font-playfair text-2xl font-bold" style={{ color: "var(--text)" }}>One last thing</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Pick a username for your Gallery profile</p>
          </div>

          <div className="space-y-4">
            <div>
              <div
                className="flex items-center rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-purple-500 transition"
                style={{ background: "rgba(240,235,248,0.05)", border: "1px solid var(--border)" }}
              >
                <span className="pl-4 text-sm" style={{ color: "var(--muted)" }}>@</span>
                <input
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  }
                  maxLength={30}
                  className="flex-1 px-2 py-3 text-sm bg-transparent focus:outline-none"
                  style={{ color: "var(--text)" }}
                />
              </div>
              <div className="mt-1 h-4">
                {username.length >= 3 &&
                  (checkingUsername ? (
                    <p className="text-xs" style={{ color: "var(--muted)" }}>Checking…</p>
                  ) : usernameAvailable ? (
                    <p className="text-xs text-green-400">✓ Available</p>
                  ) : (
                    <p className="text-xs text-red-400">✗ Already taken</p>
                  ))}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 accent-purple-500"
              />
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                I agree to Gallery&apos;s{" "}
                <a href="/terms" target="_blank" className="underline hover:opacity-80" style={{ color: "#2B86C5" }}>
                  Terms of Service
                </a>
                . I confirm I am at least 13 years old.
              </span>
            </label>

            {changeUsername.error && (
              <p className="text-sm text-red-400">{changeUsername.error.message}</p>
            )}

            <button
              onClick={handleUsernameContinue}
              disabled={!usernameAvailable || !agreedToTerms || changeUsername.isPending}
              className="w-full py-3 rounded-xl font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
            >
              {changeUsername.isPending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-lg rounded-2xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-center mb-8">
          <h1 className="font-playfair text-2xl font-bold" style={{ color: "var(--text)" }}>
            Welcome{session?.user?.username ? `, @${session.user.username}` : ""}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>One quick question before we get started</p>
        </div>

        <p className="text-center font-medium mb-6" style={{ color: "var(--text)" }}>
          Do you want to sell art or take commissions?
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setSelected(true)}
            className="p-6 rounded-xl text-left transition-all"
            style={{
              border: selected === true ? "2px solid #784BA0" : "2px solid var(--border)",
              background: selected === true ? "rgba(120,75,160,0.15)" : "transparent",
            }}
          >
            <div className="text-2xl mb-2">🎨</div>
            <div className="font-semibold" style={{ color: "var(--text)" }}>Yes</div>
            <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>Enable shop and commission features</div>
          </button>

          <button
            onClick={() => setSelected(false)}
            className="p-6 rounded-xl text-left transition-all"
            style={{
              border: selected === false ? "2px solid #784BA0" : "2px solid var(--border)",
              background: selected === false ? "rgba(120,75,160,0.15)" : "transparent",
            }}
          >
            <div className="text-2xl mb-2">🖼️</div>
            <div className="font-semibold" style={{ color: "var(--text)" }}>Not yet</div>
            <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>Just browsing — enable this later in Settings</div>
          </button>
        </div>

        {completeOnboarding.error && (
          <p className="text-sm text-red-400 text-center mb-4">{completeOnboarding.error.message}</p>
        )}

        <button
          onClick={handleContinue}
          disabled={selected === null || completeOnboarding.isPending}
          className="w-full py-3 rounded-xl font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
        >
          {completeOnboarding.isPending ? "Setting up your account..." : "Continue"}
        </button>
      </div>
    </div>
  )
}
