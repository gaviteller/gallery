"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useState } from "react"
import type React from "react"
import { trpc } from "@/components/providers"
import Link from "next/link"
import Image from "next/image"
import Avatar from "@/components/Avatar"


function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data: notifications } = trpc.notification.getAll.useQuery()
  const markAllRead = trpc.notification.markAllRead.useMutation()
  const utils = trpc.useUtils()
  const router = useRouter()

  // On mobile: full-screen slide-up sheet. On desktop: fixed panel beside sidebar.
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 shadow-2xl overflow-hidden
          bottom-16 left-0 right-0 max-h-[70vh] rounded-t-2xl
          md:bottom-auto md:left-16 md:right-auto md:top-16 md:w-80 md:max-h-[70vh] md:rounded-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}
      >
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Notifications</p>
        <button onClick={onClose} className="text-xs hover:opacity-80 transition-colors" style={{ color: "var(--muted)" }}>Close</button>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 48px)" }}>
        {!notifications || notifications.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-8">No notifications yet</p>
        ) : (
          notifications.map((n) => {
            const isSystem = n.fromUserId === null || n.fromUser === null

            function getLink(): string | null {
              if (isSystem) return null
              if (n.type === "follow") return `/@${n.fromUser!.username}`
              const [prefix, id] = n.type.split(":")
              if (prefix === "dm") return `/messages/${id}`
              return `/professional-dms/${id}`
            }

            function getText(): string {
              if (n.message) return n.message
              const map: Record<string, string> = {
                follow: "started following you",
                dm: "sent you a message",
                commission_request: "sent you a commission request",
                commission_accepted: "accepted your commission",
                commission_declined: "declined your commission",
                commission_delivered: "delivered your commission",
                commission_complete: "marked commission complete",
                ban: "Your account has been suspended.",
                lift_ban: "Your account suspension has been lifted.",
                post_deleted: "A post was removed from your account.",
                appeal_approved: "Your appeal has been approved.",
                appeal_denied: "Your appeal has been denied.",
                strike_reversed: "A moderation action has been reversed.",
                post_pending_review: "Your post is under review by our moderation team.",
                post_removed_tos: "A post was removed for violating our Terms of Service.",
                post_removed_dmca: "A post was removed due to a DMCA copyright claim.",
                post_auto_removed: "A post was automatically removed after 14 days under review.",
                post_removed_moderator: "A post was removed by a moderator.",
              }
              const prefix = n.type.split(":")[0]
              return map[prefix] ?? n.type
            }

            const link = getLink()
            const isRemoval = ["post_removed_tos", "post_removed_moderator", "post_auto_removed"].includes(n.type)

            return (
              <button
                key={n.id}
                onClick={() => {
                  onClose()
                  markAllRead.mutate(undefined, { onSuccess: () => utils.notification.unreadCount.invalidate() })
                  if (link) router.push(link)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                style={{ background: !n.read ? "rgba(120,75,160,0.1)" : "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
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
                <p className="text-sm text-white/80 flex-1 min-w-0">
                  <span className="font-semibold text-white">
                    {isSystem ? "Gallery" : `@${n.fromUser!.username}`}
                  </span>{" "}
                  {getText()}
                  {isRemoval && (
                    <> · <Link href="/appeal" style={{ color: "#a78bfa", textDecoration: "underline" }} onClick={e => e.stopPropagation()}>Appeal →</Link></>
                  )}
                </p>
              </button>
            )
          })
        )}
      </div>
    </div>
    </>
  )
}

export default function BottomNav() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [notifOpen, setNotifOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const { data: dmUnread } = trpc.dm.getUnreadCount.useQuery(undefined, {
    enabled: status === "authenticated",
    refetchInterval: 30000,
  })
  const { data: unread } = trpc.notification.unreadCount.useQuery(undefined, {
    enabled: status === "authenticated",
    refetchInterval: 30000,
  })

  if (status === "loading" || status === "unauthenticated") return null

  const username = session?.user?.username
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/")

  // ── Shared nav items ──────────────────────────────────────────────────────
  const navItems: { label: string; href?: string; active: boolean; icon: React.ReactElement; badge?: number | null; onClick?: () => void }[] = [
    {
      label: "Feed",
      href: "/",
      active: pathname === "/",
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      label: "Search",
      href: "/search",
      active: pathname === "/search" || pathname.startsWith("/search/"),
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      ),
    },
    {
      label: "Shop",
      href: "/shop",
      active: isActive("/shop"),
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
      ),
    },
    {
      label: "Commissions",
      href: "/commissions",
      active: isActive("/commissions"),
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      ),
    },
    {
      label: "Messages",
      href: "/messages",
      active: isActive("/messages"),
      badge: dmUnread && dmUnread.count > 0 ? dmUnread.count : null,
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      ),
    },
    {
      label: "Profile",
      href: username ? `/@${username}` : "/",
      active: !!(username && isActive(`/@${username}`)),
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ]

  const notifNavItem = {
    label: "Activity",
    badge: unread && unread.count > 0 ? unread.count : null,
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
    ),
  }

  return (
    <>
{notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}

      {/* ── MOBILE bottom nav ─────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 h-16" style={{ background: "var(--nav)", borderTop: "1px solid var(--border)" }}>
        {navItems.map((item) => {
          const inner = (
            <div className={`flex flex-col items-center gap-0.5 px-2 py-2 ${item.active ? "text-white" : "text-white/40"}`}>
              <div className="relative">
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </div>
          )
          if (item.onClick) {
            return <button key={item.label} onClick={item.onClick}>{inner}</button>
          }
          return <Link key={item.label} href={item.href!}>{inner}</Link>
        })}
        {/* Notifications bell */}
        <button onClick={() => setNotifOpen(v => !v)}>
          <div className={`flex flex-col items-center gap-0.5 px-2 py-2 ${notifOpen ? "text-white" : "text-white/40"}`}>
            <div className="relative">
              {notifNavItem.icon}
              {notifNavItem.badge && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {notifNavItem.badge > 9 ? "9+" : notifNavItem.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{notifNavItem.label}</span>
          </div>
        </button>
      </nav>

      {/* ── DESKTOP left sidebar — collapses to icons, expands on hover ─── */}
      <nav
        className="group hidden md:flex flex-col fixed left-0 top-0 h-full z-40 py-6 px-3 transition-all duration-200 overflow-hidden"
        style={{ width: "64px", background: "var(--nav)", borderRight: "1px solid var(--border)" }}
        onMouseEnter={e => (e.currentTarget.style.width = "240px")}
        onMouseLeave={e => (e.currentTarget.style.width = "64px")}
      >
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center gap-3 flex-shrink-0">
          <Image src="/logo.png" alt="Gallery" width={36} height={36} className="rounded-lg flex-shrink-0" />
          <span className="text-lg font-bold tracking-tight whitespace-nowrap transition-opacity duration-200 opacity-0 group-hover:opacity-100 text-white">
            Gallery
          </span>
        </Link>

        {/* Main nav items */}
        <div className="flex flex-col gap-0.5 flex-1">
          {navItems.map((item) => {
            const label = (
              <span
                className="text-[15px] whitespace-nowrap transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
              >
                {item.label}
              </span>
            )
            const inner = (
              <div
                className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all w-full ${
                  item.active ? "bg-white/8" : "hover:bg-white/5"
                }`}
                style={item.active ? { background: "rgba(120,75,160,0.15)" } : {}}
              >
                <div className={`relative flex-shrink-0 transition-colors ${item.active ? "text-[#B090D8]" : "text-white/40 group-hover:text-[#B090D8]"}`}>
                  {item.icon}
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </div>
                {label}
              </div>
            )
            if (item.onClick) return <button key={item.label} onClick={item.onClick} className="w-full text-left">{inner}</button>
            return <Link key={item.label} href={item.href!} className="w-full">{inner}</Link>
          })}

          {/* Notifications */}
          <button
            onClick={() => setNotifOpen(v => !v)}
            className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all w-full ${notifOpen ? "bg-white/5" : "hover:bg-white/5"}`}
          >
            <div className={`relative flex-shrink-0 transition-colors ${notifOpen ? "text-[#B090D8]" : "text-white/40 group-hover:text-[#B090D8]"}`}>
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              {unread && unread.count > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unread.count > 9 ? "9+" : unread.count}
                </span>
              )}
            </div>
            <span
              className="text-[15px] whitespace-nowrap transition-opacity duration-200 opacity-0 group-hover:opacity-100"
              style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
            >
              Notifications
            </span>
          </button>

        </div>

        {/* Bottom section */}
        <div className="flex flex-col gap-0.5 pt-4 mt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <Link href="/professional-profile" className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-white/5 transition-all">
            <div className="text-white/40 group-hover:text-[#B090D8] flex-shrink-0 transition-colors">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <span
              className="text-[15px] whitespace-nowrap transition-opacity duration-200 opacity-0 group-hover:opacity-100"
              style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
            >
              Artist Dashboard
            </span>
          </Link>

          <div className="relative">
            <button onClick={() => setMoreOpen(v => !v)} className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-white/5 transition-all w-full">
              <div className="text-white/40 group-hover:text-[#B090D8] flex-shrink-0 transition-colors">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </div>
              <span
                className="text-[15px] whitespace-nowrap transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
              >
                More
              </span>
            </button>
            {moreOpen && (
              <div
                className="absolute bottom-full left-0 mb-2 w-52 rounded-2xl shadow-xl py-1 overflow-hidden z-50"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                onClick={() => setMoreOpen(false)}
              >
                <button onClick={() => router.push("/settings?tab=account")} className="w-full text-left px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">Account settings</button>
                <button onClick={() => router.push("/appeal")} className="w-full text-left px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">Appeals</button>
                <button onClick={() => router.push("/professional-dms")} className="w-full text-left px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">Commission Chats</button>
                <button onClick={() => router.push("/terms")} className="w-full text-left px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">Terms of Service</button>
                <div className="mx-3 my-1" style={{ borderTop: "1px solid var(--border)" }} />
                <button onClick={() => signOut({ callbackUrl: "/signin" })} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition-colors">Sign out</button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
