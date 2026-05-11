"use client"

import { useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { trpc } from "@/components/providers"

function SignUpForm() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", username: "", password: "" })
  const [agreed, setAgreed] = useState(false)
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gallery</h1>
        <p className="text-gray-500 mt-1 text-sm">Sign up to discover art from creators you love.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Full name"
          value={form.name}
          onChange={set("name")}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={set("email")}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div>
          <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <span className="pl-4 text-gray-400 text-sm">@</span>
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
              className="flex-1 px-2 py-3 text-sm bg-transparent focus:outline-none"
            />
          </div>
          <div className="mt-1 h-4">
            {form.username.length >= 3 &&
              (checkingUsername ? (
                <p className="text-xs text-gray-400">Checking...</p>
              ) : usernameAvailable ? (
                <p className="text-xs text-green-600">✓ Available</p>
              ) : (
                <p className="text-xs text-red-500">✗ Already taken</p>
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
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <label className="flex items-start gap-3 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 rounded"
          />
          <span className="text-xs text-gray-500">
            By signing up, you agree to our{" "}
            <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.
          </span>
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading || !form.name || !form.email || !form.password || !agreed}
          className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        Already have an account?{" "}
        <Link href="/signin" className="text-blue-600 font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  )
}
