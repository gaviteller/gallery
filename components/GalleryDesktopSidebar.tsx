"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"

type NavIcon = "home" | "explore" | "shop" | "commissions" | "notifications" | "messages" | "dashboard" | "profile"

function Icon({ type }: { type: NavIcon }) {
  const props = { width: 25, height: 25, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  if (type === "home") return <svg {...props}><path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-7h6v7"/></svg>
  if (type === "explore") return <svg {...props}><circle cx="11" cy="11" r="7.5"/><path d="m20 20-3.7-3.7"/></svg>
  if (type === "shop") return <svg {...props}><path d="M5 8h14l-1 13H6z"/><path d="M8 8a4 4 0 0 1 8 0"/></svg>
  if (type === "commissions") return <svg {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
  if (type === "notifications") return <svg {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9"/><path d="M10 21h4"/></svg>
  if (type === "messages") return <svg {...props}><path d="M4 5h16v12H8l-4 3z"/></svg>
  if (type === "dashboard") return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.8 3.4-7 8-7s7.2 2.2 8 7"/></svg>
}

/** Dropdown list of the viewer's notifications. Opening it marks them all read. */
export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data: notifications } = trpc.notification.getAll.useQuery()
  const markAllRead = trpc.notification.markAllRead.useMutation()
  const utils = trpc.useUtils()
  const router = useRouter()

  useEffect(() => {
    markAllRead.mutate(undefined, { onSuccess: () => utils.notification.unreadCount.invalidate() })
    // This panel intentionally marks the current notification list read when opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function textFor(n: NonNullable<typeof notifications>[number]) {
    if (n.message) return n.message
    const type = n.type.split(":")[0]
    const labels: Record<string, string> = {
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
      ban: "Your account has been suspended.",
      lift_ban: "Your account suspension has been lifted.",
      post_deleted: "A post was removed from your account.",
      post_removed_tos: "A post was removed for violating our Terms of Service.",
      post_removed_dmca: "A post was removed following a DMCA claim.",
      post_pending_review: "One of your posts is under review.",
      appeal_approved: "Your appeal has been approved.",
      appeal_denied: "Your appeal has been denied.",
      site_notice: "A message from the Gallery team.",
    }
    return labels[type ?? ""] ?? n.type
  }

  function linkFor(n: NonNullable<typeof notifications>[number]) {
    if (!n.fromUser) return null
    if (n.type === "follow") return `/@${n.fromUser.username}`
    const [prefix, id] = n.type.split(":")
    if (prefix === "dm") return `/messages/${id}`
    if (id) return `/professional-dms/${id}`
    return null
  }

  return (
    <div className="gallery-shell-notification-panel">
      <div className="gallery-shell-notification-head"><strong>Notifications</strong><button onClick={onClose}>×</button></div>
      <div className="gallery-shell-notification-list">
        {!notifications?.length ? <p>No notifications yet</p> : notifications.map(n => {
          const link = linkFor(n)
          return (
            <button key={n.id} className={!n.read ? "is-unread" : ""} onClick={() => { onClose(); if (link) router.push(link) }}>
              {n.fromUser ? <Avatar src={n.fromUser.image} name={n.fromUser.name} username={n.fromUser.username} size={34} /> : <span className="gallery-system-avatar">G</span>}
              <span><b>{n.fromUser ? `@${n.fromUser.username}` : "Gallery"}</b> {textFor(n)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function GalleryDesktopSidebar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)
  const { data: unread } = trpc.notification.unreadCount.useQuery(undefined, { enabled: status === "authenticated", refetchInterval: 30000 })
  const { data: dmUnread } = trpc.dm.getUnreadCount.useQuery(undefined, { enabled: status === "authenticated", refetchInterval: 30000 })

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setNotificationsOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  if (status !== "authenticated") return null
  const username = session?.user?.username ?? ""
  const profileHref = username ? `/@${username}` : "/"
  const itemClass = (active: boolean) => `gallery-shell-nav-item${active ? " is-active" : ""}`

  return (
    <aside className="gallery-shell-sidebar desktop-sidenav" aria-label="Gallery navigation">
      <nav className="gallery-shell-nav-list">
        <Link href="/" className={itemClass(pathname === "/")}><Icon type="home"/><span>Feed</span></Link>
        <Link href="/shop" className={itemClass(pathname.startsWith("/shop"))}><Icon type="shop"/><span>Shop</span></Link>
        <Link href="/commissions" className={itemClass(pathname.startsWith("/commissions"))}><Icon type="commissions"/><span>Commissions</span></Link>
        <Link href="/search" className={itemClass(pathname.startsWith("/search"))}><Icon type="explore"/><span>Explore</span></Link>

        <div ref={notificationRef} className="gallery-shell-notification-wrap">
          <button type="button" className={itemClass(notificationsOpen)} onClick={() => setNotificationsOpen(v => !v)}>
            <span className="gallery-shell-icon-wrap"><Icon type="notifications"/>{!!unread?.count && <i>{unread.count > 9 ? "9+" : unread.count}</i>}</span>
            <span>Notifications</span>
          </button>
          {notificationsOpen && <NotificationPanel onClose={() => setNotificationsOpen(false)} />}
        </div>

        <Link href="/messages" className={itemClass(pathname.startsWith("/messages"))}>
          <span className="gallery-shell-icon-wrap"><Icon type="messages"/>{!!dmUnread?.count && <i>{dmUnread.count > 9 ? "9+" : dmUnread.count}</i>}</span>
          <span>Messages</span>
        </Link>
        <Link href="/professional-profile" className={itemClass(pathname.startsWith("/professional-profile"))}><Icon type="dashboard"/><span>Dashboard</span></Link>
        <Link href={profileHref} className={itemClass(!!username && pathname.startsWith(`/@${username}`))}><Icon type="profile"/><span>Profile</span></Link>

        <div className="gallery-shell-nav-divider" />
        <Link href={profileHref} className="gallery-shell-create-post"><span>＋</span>Create Post</Link>
      </nav>

    </aside>
  )
}
