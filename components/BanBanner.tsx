"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"

export default function BanBanner() {
  const { data: session } = useSession()
  if (!session?.user?.bannedUntil) return null

  const bannedUntil = new Date(session.user.bannedUntil)
  const isPermanent = bannedUntil.getFullYear() >= 9999
  const isActive = bannedUntil > new Date()
  if (!isActive) return null

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: "#7f1d1d", borderBottom: "1px solid #991b1b",
      padding: "10px 16px", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 8,
    }}>
      <span style={{ color: "white", fontSize: 13, fontWeight: 500 }}>
        {isPermanent
          ? "Your account has been permanently suspended."
          : `Your account is suspended until ${bannedUntil.toLocaleDateString()}.`}
      </span>
      <Link
        href="/appeal"
        style={{
          color: "white", fontSize: 13, fontWeight: 700,
          textDecoration: "underline", whiteSpace: "nowrap",
        }}
      >
        Appeal
      </Link>
    </div>
  )
}
