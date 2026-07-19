"use client"

import { useState, useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Link from "next/link"
import Avatar from "@/components/Avatar"

// ── Desktop notification panel ─────────────────────────────────────────────

function DesktopNotifPanel({ onClose }: { onClose: () => void }) {
  const { data: notifications } = trpc.notification.getAll.useQuery()
  const markAllRead = trpc.notification.markAllRead.useMutation()
  const utils = trpc.useUtils()
  const router = useRouter()

  useEffect(() => {
    markAllRead.mutate(undefined, {
      onSuccess: () => utils.notification.unreadCount.invalidate(),
    })
  }, [])

  function getText(n: NonNullable<typeof notifications>[number]): string {
    if (n.message) return n.message
    const prefix = n.type.split(":")[0]
    const map: Record<string, string> = {
      follow: "started following you",
      dm: "sent you a message",
      commission_request: "sent you a commission request",
      commission_message: "sent you a message",
      commission_accepted: "accepted your commission request",
      commission_declined: "declined your commission request",
      commission_cancelled: "cancelled their commission",
      commission_paid: "confirmed payment for their commission",
      commission_delivered: "delivered your commission",
      commission_complete: "confirmed commission receipt",
      commission_deadline_set: "set a deadline for your commission",
      commission_deadline_updated: "updated the commission deadline",
      commission_deadline_approaching: "commission deadline is approaching",
      ban: "Your account has been suspended.",
      lift_ban: "Your account suspension has been lifted.",
      post_deleted: "A post was removed from your account.",
      post_removed_tos: "A post was removed for violating our Terms of Service.",
      post_removed_dmca: "A post was removed following a DMCA copyright claim.",
      post_removed_moderator: "A post was removed following a moderation review.",
      post_auto_removed: "A post was automatically removed after 14 days in pending review.",
      post_pending_review: "One of your posts has been flagged and is under review.",
      appeal_approved: "Your appeal has been approved.",
      appeal_denied: "Your appeal has been denied.",
      strike_reversed: "A moderation action has been reversed.",
      site_notice: n.message ?? "A message from the Gallery team.",
    }
    return map[prefix!] ?? n.type
  }

  function getLink(n: NonNullable<typeof notifications>[number]): string | null {
    const isSystem = n.fromUserId === null || n.fromUser === null
    if (isSystem) return null
    if (n.type === "follow") return `/@${n.fromUser!.username}`
    const [prefix, id] = n.type.split(":")
    if (prefix === "dm") return `/messages/${id}`
    return `/professional-dms/${id}`
  }

  return (
    <div style={{
      position: "fixed", left: 62, top: 0, bottom: 0, width: 288,
      background: "var(--surface)", borderRight: "1px solid var(--border)",
      zIndex: 200, display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Notifications</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 20, lineHeight: 1, padding: 2 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {!notifications || notifications.length === 0 ? (
          <p style={{ fontSize: 13, textAlign: "center", padding: "32px 0", color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>No notifications yet</p>
        ) : notifications.map((n) => {
          const isSystem = n.fromUserId === null || n.fromUser === null
          const link = getLink(n)
          return (
            <button
              key={n.id}
              onClick={() => { onClose(); if (link) router.push(link) }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: !n.read ? "rgba(120,75,160,0.1)" : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
              onMouseLeave={e => (e.currentTarget.style.background = !n.read ? "rgba(120,75,160,0.1)" : "transparent")}
            >
              {isSystem ? (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#4c1d95)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🛡</div>
              ) : (
                <Avatar src={n.fromUser!.image} name={n.fromUser!.name} username={n.fromUser!.username} size={32} />
              )}
              <p style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.4, fontFamily: "Inter,sans-serif" }}>
                <span style={{ fontWeight: 600 }}>{isSystem ? "Gallery" : `@${n.fromUser!.username}`}</span>{" "}{getText(n)}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Side nav icon button ───────────────────────────────────────────────────

function SideItem({ href, title, active, children, badge }: {
  href: string; title: string; active: boolean; children: React.ReactNode; badge?: number
}) {
  return (
    <Link href={href} title={title} style={{
      width: 46, height: 46, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
      color: active ? "white" : "var(--muted)",
      background: active ? "rgba(120,75,160,0.18)" : "transparent",
      textDecoration: "none", flexShrink: 0, position: "relative",
    }}>
      {children}
      {badge != null && badge > 0 && (
        <span style={{ position: "absolute", top: 4, right: 4, width: 14, height: 14, background: "#ef4444", color: "white", fontSize: 8, fontWeight: 700, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function BottomNav() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [notifOpen, setNotifOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const { data: dmUnread } = trpc.dm.getUnreadCount.useQuery(undefined, {
    enabled: status === "authenticated",
    refetchInterval: 30000,
  })
  const { data: unread } = trpc.notification.unreadCount.useQuery(undefined, {
    enabled: status === "authenticated",
    refetchInterval: 30000,
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const authPaths = ["/signin", "/signup", "/forgot-password", "/reset-password", "/onboarding"]
  if (status === "loading" || status === "unauthenticated") return null
  if (authPaths.some(p => pathname.startsWith(p))) return null

  const username = session?.user?.username
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/")
  const profileActive = !!(username && (pathname === `/@${username}` || pathname.startsWith(`/@${username}/`)))

  const menuLinks = [
    { href: "/", label: "Feed", d: "M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" },
    { href: "/shop", label: "Shop", d: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" },
    { href: "/commissions", label: "Commissions", d: "M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" },
    { href: "/search", label: "Discover", d: "M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" },
    { href: "/messages", label: "Messages", d: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  ]

  return (
    <>
      <style>{`
        .desktop-sidenav { display: none; }
        @media (min-width: 768px) {
          .mobile-topnav  { display: none !important; }
          .mobile-bottomnav { display: none !important; }
          .desktop-sidenav { display: flex !important; }
          .main-layout {
            max-width: 640px !important;
            margin-left: max(62px, calc(50% + 31px - 320px)) !important;
            margin-right: auto !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
        }
      `}</style>

      {/* ── Desktop side nav ──────────────────────────────────────────── */}
      <nav className="desktop-sidenav" aria-label="Main navigation" style={{
        position: "fixed", left: 0, top: 0, bottom: 0, width: 62,
        background: "var(--nav)", borderRight: "1px solid var(--border)",
        flexDirection: "column", alignItems: "center",
        padding: "12px 0", zIndex: 50,
      }}>
        {/* Gallery G — pinned top */}
        <Link href="/" title="Home" style={{
          width: 40, height: 40, borderRadius: 10,
          display: "block", textDecoration: "none", flexShrink: 0,
          backgroundImage: "url('/logo.png')",
          backgroundSize: "143%",
          backgroundPosition: "center top",
          mixBlendMode: "screen",
        }} />

        {/* Main nav — fills remaining space, items evenly distributed */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", width: "100%", paddingTop: 8, paddingBottom: 8 }}>
          <SideItem href="/" title="Home" active={pathname === "/"}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill={pathname === "/" ? "white" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
            </svg>
          </SideItem>

          <SideItem href="/search" title="Search" active={isActive("/search")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </SideItem>

          <SideItem href="/shop" title="Shop" active={isActive("/shop")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>
            </svg>
          </SideItem>

          <SideItem href="/commissions" title="Commissions" active={isActive("/commissions")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </SideItem>

          <SideItem href="/messages" title="Messages" active={isActive("/messages")} badge={dmUnread?.count}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </SideItem>

          <SideItem href={username ? `/@${username}` : "/"} title="Profile" active={profileActive}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </SideItem>

          {/* Bell */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              onClick={() => { setNotifOpen(v => !v); setMenuOpen(false) }}
              title="Notifications"
              style={{ width: 46, height: 46, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", position: "relative" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 24, height: 24 }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unread && unread.count > 0 && (
                <span style={{ position: "absolute", top: 4, right: 4, width: 14, height: 14, background: "#ef4444", color: "white", fontSize: 8, fontWeight: 700, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {unread.count > 9 ? "9+" : unread.count}
                </span>
              )}
            </button>
            {notifOpen && <DesktopNotifPanel onClose={() => setNotifOpen(false)} />}
          </div>
        </div>

        {/* Bottom group — pinned to bottom */}
        <div style={{ width: 28, height: 1, background: "var(--border)", margin: "0 0 4px" }} />

        <SideItem href="/professional-profile" title="Artist Dashboard" active={isActive("/professional-profile")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
        </SideItem>

        {/* Hamburger */}
        <button
          onClick={() => { setMenuOpen(v => !v); setNotifOpen(false) }}
          title="Menu"
          style={{ width: 46, height: 46, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, background: "transparent", border: "none", cursor: "pointer", marginTop: 2 }}
        >
          <span style={{ width: 20, height: 1.5, background: "var(--muted)", borderRadius: 1, display: "block" }} />
          <span style={{ width: 20, height: 1.5, background: "var(--muted)", borderRadius: 1, display: "block" }} />
          <span style={{ width: 20, height: 1.5, background: "var(--muted)", borderRadius: 1, display: "block" }} />
        </button>
      </nav>

      {/* ── Desktop slide-out menu ──────────────────────────────────────── */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)" }} className="desktop-sidenav" />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 70, width: 240, background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column" }} className="desktop-sidenav">
            <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Menu</div>
              <button onClick={() => setMenuOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 20, lineHeight: 1, padding: 2 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {menuLinks.map(({ href, label, d }) => (
                <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
                  {label}
                </Link>
              ))}

              <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />

              <Link href="/professional-profile" onClick={() => setMenuOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
                Artist Dashboard
              </Link>

              <Link href="/settings" onClick={() => setMenuOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                </svg>
                Settings
              </Link>

              <Link href="/appeal" onClick={() => setMenuOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Appeals
              </Link>
            </div>
            <div style={{ padding: "12px 18px 20px", borderTop: "1px solid var(--border)" }}>
              {username && (
                <Link href={`/@${username}`} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, textDecoration: "none" }}>
                  <Avatar src={session?.user?.image} name={session?.user?.name} username={username} size={32} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{session?.user?.name ?? username}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>@{username}</div>
                  </div>
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                style={{ width: "100%", padding: "8px 0", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 11, fontWeight: 500, cursor: "pointer" }}
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile bottom bar ─────────────────────────────────────────── */}
      <nav className="mobile-bottomnav" aria-label="Main navigation" style={{
        background: "var(--nav)", borderTop: "1px solid var(--border)",
        padding: "10px 16px 16px", display: "flex", justifyContent: "space-around",
        alignItems: "center", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
      }}>
        <Link href="/" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: pathname === "/" ? "white" : "var(--muted)", textDecoration: "none" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill={pathname === "/" ? "white" : "none"} stroke={pathname === "/" ? "none" : "currentColor"} strokeWidth="2">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
          </svg>
          {pathname === "/" && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "linear-gradient(135deg,#FF3CAC,#2B86C5)" }} />}
        </Link>

        <Link href="/search" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: isActive("/search") ? "white" : "var(--muted)", textDecoration: "none" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          {isActive("/search") && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "linear-gradient(135deg,#FF3CAC,#2B86C5)" }} />}
        </Link>

        <Link href={username ? `/@${username}` : "/"} style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#FF3CAC,#784BA0,#2B86C5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 22, fontWeight: 300, lineHeight: 1, textDecoration: "none", flexShrink: 0 }}>
          +
        </Link>

        <Link href="/messages" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: isActive("/messages") ? "white" : "var(--muted)", textDecoration: "none", position: "relative" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          {isActive("/messages") && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "linear-gradient(135deg,#FF3CAC,#2B86C5)" }} />}
          {dmUnread && dmUnread.count > 0 && (
            <span style={{ position: "absolute", top: -2, right: -4, width: 14, height: 14, background: "#ef4444", color: "white", fontSize: 8, fontWeight: 700, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {dmUnread.count > 9 ? "9+" : dmUnread.count}
            </span>
          )}
        </Link>

        <Link href={username ? `/@${username}` : "/"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: profileActive ? "white" : "var(--muted)", textDecoration: "none" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          {profileActive && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "linear-gradient(135deg,#FF3CAC,#2B86C5)" }} />}
        </Link>
      </nav>
    </>
  )
}
