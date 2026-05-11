"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { trpc } from "@/components/providers"

export default function AccountSettingsPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const { data: user } = trpc.user.me.useQuery()
  const updateSelling = trpc.user.updateSellingEnabled.useMutation({
    onSuccess: () => update(),
  })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
  }, [status, router])

  if (status === "loading" || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Account Settings</h1>

      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900">Selling &amp; Commissions</div>
            <div className="text-sm text-gray-500 mt-0.5">
              Enable your shop and commission features
            </div>
          </div>
          <button
            onClick={() =>
              updateSelling.mutate({ enabled: !user.sellingEnabled })
            }
            disabled={updateSelling.isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              user.sellingEnabled ? "bg-blue-600" : "bg-gray-200"
            }`}
            role="switch"
            aria-checked={user.sellingEnabled}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                user.sellingEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="p-6">
          <div className="font-medium text-gray-900">Email</div>
          <div className="text-sm text-gray-500 mt-0.5">{user.email}</div>
        </div>

        <div className="p-6">
          <button
            onClick={() => router.push("/api/auth/signout")}
            className="text-sm text-red-500 hover:text-red-600 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
