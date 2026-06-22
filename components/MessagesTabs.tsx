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
        className="flex-1 pb-3 text-sm font-semibold text-center transition-colors relative"
        style={{ color: isMessages ? "var(--text)" : "var(--muted)" }}
      >
        Messages
        {isMessages && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }} />
        )}
      </Link>
      <Link
        href="/professional-dms"
        role="tab"
        aria-selected={isCommissions}
        className="flex-1 pb-3 text-sm font-semibold text-center transition-colors relative"
        style={{ color: isCommissions ? "var(--text)" : "var(--muted)" }}
      >
        Commissions
        {isCommissions && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }} />
        )}
      </Link>
    </div>
  )
}
