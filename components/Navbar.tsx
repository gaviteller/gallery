"use client"

import { useSession } from "next-auth/react"
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

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14" style={{ background: "var(--nav)", borderBottom: "1px solid var(--border)" }}>
      {/* Gallery wordmark */}
      <Link href="/" className="font-playfair text-lg font-bold tracking-wider" style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
        Gallery
      </Link>

      <div className="flex items-center gap-2">
        {/* Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative flex items-center justify-center w-9 h-9 rounded-full transition-colors"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
            aria-label="Notifications"
          >
            <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {unread && unread.count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {unread.count > 9 ? "9+" : unread.count}
              </span>
            )}
          </button>
          {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
        </div>

        {/* Search — gradient background */}
        <button
          onClick={() => router.push("/search")}
          className="flex items-center justify-center w-9 h-9 rounded-full transition-opacity hover:opacity-80"
          style={{ background: "linear-gradient(135deg, #FF3CAC, #2B86C5)" }}
          aria-label="Search"
        >
          <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
