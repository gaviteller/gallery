"use client"

import { usePathname, useRouter } from "next/navigation"

export default function MessagesTabs() {
  const pathname = usePathname()
  const router = useRouter()

  const isMessages = pathname === "/messages" || pathname.startsWith("/messages/")
  const isCommissions = pathname === "/professional-dms" || pathname.startsWith("/professional-dms/")

  return (
    <div
      className="flex px-4 pt-5"
      style={{ borderBottom: "1px solid #ffffff10" }}
    >
      <button
        onClick={() => router.push("/messages")}
        className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${
          isMessages
            ? "text-white border-purple-500"
            : "text-white/40 border-transparent hover:text-white/60"
        }`}
      >
        Messages
      </button>
      <button
        onClick={() => router.push("/professional-dms")}
        className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${
          isCommissions
            ? "text-white border-purple-500"
            : "text-white/40 border-transparent hover:text-white/60"
        }`}
      >
        Commissions
      </button>
    </div>
  )
}
