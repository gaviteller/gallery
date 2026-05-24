"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { trpc } from "@/components/providers"
import Link from "next/link"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  // Check mod/admin status via a lightweight query
  const { data: me } = trpc.user.me.useQuery(undefined, { enabled: !!session })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/")
    if (me && !me.isAdmin && !(me as any).isModerator) router.push("/")
  }, [status, me, router])

  if (status === "loading" || !me) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</p></div>
  }

  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/appeals", label: "Appeals" },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0F" }}>
      {/* Admin top bar */}
      <div style={{ background: "#1a0535", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 24 }}>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>Gallery Admin</span>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} style={{
            color: pathname === item.href ? "white" : "rgba(255,255,255,0.5)",
            fontSize: 13, fontWeight: pathname === item.href ? 600 : 400,
            textDecoration: "none",
          }}>
            {item.label}
          </Link>
        ))}
        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
          {(me as any).isAdmin ? "Admin" : "Moderator"} · @{me.username}
        </span>
      </div>
      <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
        {children}
      </div>
    </div>
  )
}
