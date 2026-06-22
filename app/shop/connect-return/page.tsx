"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { trpc } from "@/components/providers"

export default function ConnectReturnPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const isRefresh = searchParams.get("refresh") === "1"

  const { data: connectStatus, isLoading: connectLoading } = trpc.shop.getConnectStatus.useQuery(
    undefined,
    { enabled: !isRefresh }
  )

  const shopHref = session?.user?.username ? `/@${session.user.username}/shop` : "/shop"

  return (
    <div
      className="min-h-screen md:pl-16 flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div className="max-w-md mx-auto px-6 text-center">
        {isRefresh ? (
          <>
            <h1 className="text-2xl font-bold text-white mb-3">Session expired</h1>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              Your Stripe Connect session timed out. Click below to try again.
            </p>
            <Link
              href={shopHref}
              className="inline-block py-3 px-6 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
            >
              Back to your shop
            </Link>
          </>
        ) : connectLoading ? (
          <>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Checking your account…
            </p>
          </>
        ) : connectStatus?.connected ? (
          <>
            <h1 className="text-2xl font-bold text-white mb-3">You&apos;re connected!</h1>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              Your Stripe account is set up. You can now receive payouts from sales.
            </p>
            <Link
              href={shopHref}
              className="inline-block py-3 px-6 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
            >
              Back to your shop
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-3">Almost there</h1>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              Your Stripe setup isn&apos;t complete yet. Head back to your shop to finish connecting.
            </p>
            <Link
              href={shopHref}
              className="inline-block py-3 px-6 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
            >
              Back to your shop
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
