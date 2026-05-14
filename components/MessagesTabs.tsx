"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function MessagesTabs() {
  const pathname = usePathname()

  const isMessages = pathname === "/messages" || pathname.startsWith("/messages/")
  const isCommissions = pathname === "/professional-dms" || pathname.startsWith("/professional-dms/")

  return (
    <div
      role="tablist"
      className="flex px-4 pt-5"
      style={{ borderBottom: "1px solid #ffffff10" }}
    >
      <Link
        href="/messages"
        role="tab"
        aria-selected={isMessages}
        className={`flex-1 pb-3 text-sm font-semibold text-center transition-colors border-b-2 ${
          isMessages
            ? "text-white border-purple-500"
            : "text-white/40 border-transparent hover:text-white/60"
        }`}
      >
        Messages
      </Link>
      <Link
        href="/professional-dms"
        role="tab"
        aria-selected={isCommissions}
        className={`flex-1 pb-3 text-sm font-semibold text-center transition-colors border-b-2 ${
          isCommissions
            ? "text-white border-purple-500"
            : "text-white/40 border-transparent hover:text-white/60"
        }`}
      >
        Commissions
      </Link>
    </div>
  )
}
