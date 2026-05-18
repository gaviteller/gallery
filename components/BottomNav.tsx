"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useState } from "react"
import { trpc } from "@/components/providers"
import Link from "next/link"
import Image from "next/image"
import Avatar from "@/components/Avatar"

function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("")
  const enabled = query.trim().length > 0
  const { data: users } = trpc.user.search.useQuery({ query }, { enabled })
  const { data: tags } = trpc.hashtag.search.useQuery({ query }, { enabled })
  const router = useRouter()

  const hasResults = (users && users.length > 0) || (tags && tags.length > 0)

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl md:rounded-2xl p-5 pb-8" style={{ background: "#1a1a2e", border: "1px solid #ffffff15" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people or #tags…"
            className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500"
            style={{ background: "#ffffff10", border: "1px solid #ffffff15" }}
          />
          <button onClick={onClose} className="text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
        </div>

        {hasResults ? (
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {tags && tags.length > 0 && tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => { onClose(); router.push(`/hashtag/${tag.tag}`) }}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 text-sm font-bold flex-shrink-0" style={{ background: "#ffffff10" }}>#</div>
                <div>
                  <p className="text-sm font-semibold text-white">#{tag.tag}</p>
                  <p className="text-xs text-white/40">{tag._count.posts} {tag._count.posts === 1 ? "post" : "posts"}</p>
                </div>
              </button>
            ))}
            {users && users.length > 0 && users.map((user) => (
              <button
                key={user.id}
                onClick={() => { onClose(); router.push(`/@${user.username}`) }}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                {user.image ? (
                  <img src={user.image} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>
                    {(user.name ?? user.username ?? "?")[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-white">@{user.username}</p>
                  {user.name && <p className="text-xs text-white/40">{user.name}</p>}
                </div>
              </button>
            ))}
          </div>
        ) : enabled ? (
          <p className="text-sm text-white/40 text-center py-4">No results for &ldquo;{query}&rdquo;</p>
        ) : null}
      </div>
    </div>
  )
}

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
        style={{ background: "#1a1a2e", border: "1px solid #ffffff15" }}
        onClick={e => e.stopPropagation()}
      >
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid #ffffff10" }}>
        <p className="text-sm font-semibold text-white">Notifications</p>
        <button onClick={onClose} className="text-xs text-white/40 hover:text-white/80 transition-colors">Close</button>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 48px)" }}>
        {!notifications || notifications.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-8">No notifications yet</p>
        ) : (
          notifications.map((n) => {
            function getLink(type: string) {
              if (type === "follow") return `/@${n.fromUser.username}`
              const [prefix, id] = type.split(":")
              if (prefix === "dm") return `/messages/${id}`
              return `/professional-dms/${id}`
            }
            function getText(type: string) {
              const prefix = type.split(":")[0]
              const map: Record<string, string> = {
                follow: "started following you",
                dm: "sent you a message",
                commission_request: "sent you a commission request",
                commission_accepted: "accepted your commission",
                commission_declined: "declined your commission",
                commission_delivered: "delivered your commission",
                commission_complete: "marked commission complete",
              }
              return map[prefix] ?? type
            }
            return (
              <button
                key={n.id}
                onClick={() => {
                  onClose()
                  markAllRead.mutate(undefined, { onSuccess: () => utils.notification.unreadCount.invalidate() })
                  router.push(getLink(n.type))
                }}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                style={{ background: !n.read ? "rgba(176,68,248,0.08)" : "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = !n.read ? "rgba(176,68,248,0.08)" : "transparent")}
              >
                <Avatar src={n.fromUser.image} name={n.fromUser.name} username={n.fromUser.username} size={32} />
                <p className="text-sm text-white/80 flex-1 min-w-0">
                  <span className="font-semibold text-white">@{n.fromUser.username}</span> {getText(n.type)}
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
  const [searchOpen, setSearchOpen] = useState(false)
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
  const navItems = [
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
      href: null,
      active: false,
      onClick: () => setSearchOpen(true),
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
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
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}

      {/* ── MOBILE bottom nav ─────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 h-16" style={{ background: "#0D0D0F", borderTop: "1px solid #ffffff10" }}>
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
        className="group hidden md:flex flex-col fixed left-0 top-0 h-full z-40 py-6 px-3 transition-all duration-200"
        style={{ width: "64px", background: "#0D0D0F", borderRight: "1px solid #ffffff10" }}
        onMouseEnter={e => (e.currentTarget.style.width = "240px")}
        onMouseLeave={e => (e.currentTarget.style.width = "64px")}
      >
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center gap-3 flex-shrink-0 overflow-hidden">
          <Image src="/logo.png" alt="Gallery" width={36} height={36} className="rounded-lg flex-shrink-0" />
          <span
            className="text-lg font-bold tracking-tight whitespace-nowrap overflow-hidden transition-all duration-200 opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto text-white"
          >
            Gallery
          </span>
        </Link>

        {/* Main nav items */}
        <div className="flex flex-col gap-0.5 flex-1">
          {navItems.map((item) => {
            const label = (
              <span
                className="text-[15px] whitespace-nowrap overflow-hidden transition-all duration-200 opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto"
                style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
              >
                {item.label}
              </span>
            )
            const inner = (
              <div
                className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all w-full ${
                  item.active ? "bg-white/8" : "hover:bg-white/5"
                }`}
                style={item.active ? { background: "linear-gradient(135deg, #FF1CF720, #B044F820, #00B4EE20)" } : {}}
              >
                <div className={`relative flex-shrink-0 ${item.active ? "text-white" : "text-white/50 group-hover:text-white"}`}>
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
            <div className={`relative flex-shrink-0 ${notifOpen ? "text-white" : "text-white/50 group-hover:text-white"}`}>
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
              className="text-[15px] whitespace-nowrap overflow-hidden transition-all duration-200 opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
            >
              Notifications
            </span>
          </button>
        </div>

        {/* Bottom section */}
        <div className="flex flex-col gap-0.5 pt-4 mt-4" style={{ borderTop: "1px solid #ffffff10" }}>
          <Link href="/professional-profile" className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-white/5 transition-all">
            <div className="text-white/50 group-hover:text-white flex-shrink-0 transition-colors">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <span
              className="text-[15px] whitespace-nowrap overflow-hidden transition-all duration-200 opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto"
              style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
            >
              Artist Dashboard
            </span>
          </Link>

          <div className="relative">
            <button onClick={() => setMoreOpen(v => !v)} className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-white/5 transition-all w-full">
              <div className="text-white/50 group-hover:text-white flex-shrink-0 transition-colors">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </div>
              <span
                className="text-[15px] whitespace-nowrap overflow-hidden transition-all duration-200 opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto"
                style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
              >
                More
              </span>
            </button>
            {moreOpen && (
              <div
                className="absolute bottom-full left-0 mb-2 w-52 rounded-2xl shadow-xl py-1 overflow-hidden z-50"
                style={{ background: "#1a1a2e", border: "1px solid #ffffff15" }}
                onClick={() => setMoreOpen(false)}
              >
                <button onClick={() => router.push("/settings?tab=account")} className="w-full text-left px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">Account settings</button>
                <button onClick={() => router.push("/professional-dms")} className="w-full text-left px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">Commission Chats</button>
                <button onClick={() => router.push("/terms")} className="w-full text-left px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">Terms of Service</button>
                <div className="mx-3 my-1" style={{ borderTop: "1px solid #ffffff15" }} />
                <button onClick={() => signOut({ callbackUrl: "/signin" })} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition-colors">Sign out</button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
