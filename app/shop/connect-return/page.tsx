"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"

export default function ConnectReturnPage() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const isRefresh = searchParams.get("refresh") === "1"

  return (
    <div
      className="min-h-screen md:pl-16 flex items-center justify-center"
      style={{ background: "#0D0D0F" }}
    >
      <div className="max-w-md mx-auto px-6 text-center">
        {isRefresh ? (
          <>
            <h1 className="text-2xl font-bold text-white mb-3">Session expired</h1>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              Your Stripe Connect session timed out. Click below to try again.
            </p>
            <Link
              href={session?.user?.username ? `/@${session.user.username}/shop` : "/shop"}
              className="inline-block py-3 px-6 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
            >
              Back to your shop
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-3">You&apos;re connected!</h1>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              Your Stripe account is set up. You can now receive payouts from sales.
            </p>
            <Link
              href={session?.user?.username ? `/@${session.user.username}/shop` : "/shop"}
              className="inline-block py-3 px-6 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
            >
              Back to your shop
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
