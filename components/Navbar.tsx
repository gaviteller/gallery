"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { trpc } from "@/components/providers"
import Link from "next/link"
import Avatar from "@/components/Avatar"

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data: notifications } = trpc.notification.getAll.useQuery()
  const markAllRead = trpc.notification.markAllRead.useMutation()
  const utils = trpc.useUtils()
  const router = useRouter()

  useEffect(() => {
    markAllRead.mutate(undefined, {
      onSuccess: () => utils.notification.unreadCount.invalidate(),
    })
  }, [])

  return (
    <div className="absolute top-12 right-0 w-72 rounded-2xl shadow-lg overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Notifications</p>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {!notifications || notifications.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--muted)" }}>No notifications yet</p>
        ) : (
          notifications.map((n) => {
            const isSystem = n.fromUserId === null || n.fromUser === null

            function getNotificationLink(): string | null {
              if (isSystem) return null
              if (n.type === "follow") return `/@${n.fromUser!.username}`
              const [prefix, id] = n.type.split(":")
              if (prefix === "dm") return `/messages/${id}`
              return `/professional-dms/${id}`
            }
            function getNotificationText(): string {
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
              return map[prefix] ?? n.type
            }

            const link = getNotificationLink()
            const isRemoval = ["post_removed_tos", "post_removed_moderator", "post_auto_removed"].includes(n.type)

            return (
              <button
                key={n.id}
                onClick={() => { onClose(); if (link) router.push(link) }}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                style={{ background: !n.read ? "rgba(120,75,160,0.1)" : "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = !n.read ? "rgba(120,75,160,0.1)" : "transparent")}
              >
                {isSystem ? (
                  <div
                    className="flex-shrink-0 flex items-center justify-center text-white font-bold text-base"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
                    }}
                  >
                    🛡
                  </div>
                ) : (
                  <Avatar src={n.fromUser!.image} name={n.fromUser!.name} username={n.fromUser!.username} size={32} />
                )}
                <p className="text-sm" style={{ color: "var(--text)" }}>
                  <span className="font-semibold">{isSystem ? "Gallery" : `@${n.fromUser!.username}`}</span>{" "}
                  {getNotificationText()}
                  {isRemoval && (
                    <> · <Link href="/appeal" className="text-violet-400 underline" onClick={e => e.stopPropagation()}>Appeal →</Link></>
                  )}
                </p>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export default function Navbar() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [notifOpen, setNotifOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

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

  if (status === "loading" || status === "unauthenticated") return null

  const username = session?.user?.username

  return (
    <>
      {/* Slide-out menu */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 70, width: 240, background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Menu</div>
              <button onClick={() => setMenuOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 20, lineHeight: 1, padding: 2 }}>×</button>
            </div>

            {/* Nav links */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {[
                { href: "/", label: "Feed", icon: "M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" },
                { href: "/shop", label: "Shop", icon: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" },
                { href: "/commissions", label: "Commissions", icon: "M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" },
                { href: "/search", label: "Discover", icon: "M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" },
                { href: "/messages", label: "Messages", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
              ].map(({ href, label, icon }) => (
                <Link key={href} href={href} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={icon} />
                  </svg>
                  {label}
                </Link>
              ))}

              <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />

              <Link href="/professional-profile" onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
                Artist Dashboard
              </Link>

              <Link href="/settings" onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                </svg>
                Settings
              </Link>

              <Link href="/appeal" onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,235,248,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Appeals
              </Link>
            </div>

            {/* Footer — profile + sign out */}
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

      {/* Top nav bar — hidden on desktop (side nav takes over) */}
      <div className="top-nav mobile-topnav" style={{ background: "var(--nav)", borderBottom: "1px solid var(--border)", padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Link href="/" style={{
          display: "block", width: 180, height: 22, textDecoration: "none",
          backgroundImage: "url('/logo.png')",
          backgroundSize: "220px",
          backgroundPosition: "center -166px",
          backgroundRepeat: "no-repeat",
          mixBlendMode: "screen",
        }} aria-label="Gallery" />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }} ref={notifRef}>
            <button onClick={() => setNotifOpen(v => !v)} style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }} aria-label="Notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unread && unread.count > 0 && (
                <span style={{ position: "absolute", top: -2, right: -2, width: 14, height: 14, background: "#ef4444", color: "white", fontSize: 8, fontWeight: 700, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {unread.count > 9 ? "9+" : unread.count}
                </span>
              )}
            </button>
            {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
          </div>
          <button onClick={() => router.push("/search")} style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #FF3CAC, #2B86C5)", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Search">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
          {/* Hamburger */}
          <button onClick={() => setMenuOpen(true)} style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: "none", cursor: "pointer" }} aria-label="Menu">
            <span style={{ width: 13, height: 1.5, background: "var(--muted)", borderRadius: 1, display: "block" }} />
            <span style={{ width: 13, height: 1.5, background: "var(--muted)", borderRadius: 1, display: "block" }} />
            <span style={{ width: 13, height: 1.5, background: "var(--muted)", borderRadius: 1, display: "block" }} />
          </button>
        </div>
      </div>
    </>
  )
}
