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
    <div className="absolute top-12 right-0 w-72 bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">Notifications</p>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {!notifications || notifications.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No notifications yet</p>
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
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${!n.read ? "bg-blue-50/50" : ""}`}
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
                <p className="text-sm text-gray-800">
                  <span className="font-semibold">{isSystem ? "Gallery" : `@${n.fromUser!.username}`}</span>{" "}
                  {getNotificationText()}
                  {isRemoval && (
                    <> · <a href="/appeal" style={{ color: "#a78bfa", textDecoration: "underline" }} onClick={e => e.stopPropagation()}>Appeal →</a></>
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const { data: unread } = trpc.notification.unreadCount.useQuery(undefined, {
    enabled: status === "authenticated",
    refetchInterval: 30000,
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  if (status === "loading" || status === "unauthenticated") return null

  const username = session?.user?.username

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      {/* Notification bell */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => { setNotifOpen(v => !v); setMenuOpen(false) }}
          className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
          aria-label="Notifications"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          {unread && unread.count > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread.count > 9 ? "9+" : unread.count}
            </span>
          )}
        </button>
        {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
      </div>

      {/* Hamburger */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => { setMenuOpen(v => !v); setNotifOpen(false) }}
          className="flex flex-col justify-center items-center w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors gap-1.5"
          aria-label="Menu"
        >
          <span className="block w-5 h-0.5 bg-gray-700 rounded" />
          <span className="block w-5 h-0.5 bg-gray-700 rounded" />
          <span className="block w-5 h-0.5 bg-gray-700 rounded" />
        </button>

        {menuOpen && (
          <div className="absolute top-12 right-0 w-52 bg-white rounded-2xl border border-gray-200 shadow-lg py-1 overflow-hidden">
            <button
              onClick={() => { setMenuOpen(false); router.push("/settings?tab=account") }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Account settings
            </button>
            <button
              onClick={() => { setMenuOpen(false); router.push("/appeal") }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Appeals
            </button>
            <button
              onClick={() => { setMenuOpen(false); router.push("/professional-profile") }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Artist Dashboard
            </button>
            <button
              onClick={() => { setMenuOpen(false); router.push("/professional-dms") }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Commission Chats
            </button>

            <div className="border-t border-gray-100 mx-3 my-1" />
            <p className="px-4 pt-1 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Site info</p>
            <button
              onClick={() => { setMenuOpen(false); router.push("/terms") }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Terms of Service
            </button>

            <div className="border-t border-gray-100 mx-3 my-1" />
            <button
              onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/signin" }) }}
              className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-gray-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
