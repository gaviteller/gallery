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
      style={{ display: "flex", position: "sticky", top: 0, zIndex: 20, background: "var(--nav)", borderBottom: "1px solid var(--border)" }}
    >
      <Link
        href="/messages"
        role="tab"
        aria-selected={isMessages}
        style={{ flex: 1, padding: "13px 0 11px", textAlign: "center", position: "relative", fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 13, color: isMessages ? "var(--text)" : "var(--muted)", textDecoration: "none" }}
      >
        Messages
        {isMessages && (
          <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, borderRadius: 99, background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }} />
        )}
      </Link>
      <Link
        href="/professional-dms"
        role="tab"
        aria-selected={isCommissions}
        style={{ flex: 1, padding: "13px 0 11px", textAlign: "center", position: "relative", fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 13, color: isCommissions ? "var(--text)" : "var(--muted)", textDecoration: "none" }}
      >
        Commissions
        {isCommissions && (
          <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, borderRadius: 99, background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }} />
        )}
      </Link>
    </div>
  )
}
