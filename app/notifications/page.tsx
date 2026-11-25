"use client"
/**
 * NOTIFICATIONS INBOX (Codex redesign, from the Settings design set).
 * Styling: app/redesign/settings.css (shell) + app/redesign/notifications.module.css (inbox).
 * Data: notification.getAll (newest 50), setRead (dot button), markAllRead.
 */
import "@/app/redesign/settings.css"
import "@/app/redesign/shell.css"
import styles from "@/app/redesign/notifications.module.css"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Bell, Brush, CheckCheck, Circle, MessageCircle, Settings2, Sparkles, UserPlus } from "lucide-react"
import { trpc } from "@/components/providers"
import RedesignShell, { GallerySidebar, Avatar } from "@/components/redesign/RedesignShell"
import { timeAgo } from "@/components/redesign/FeedParts"
import { notificationLink, notificationText } from "@/lib/notification-text"

const FILTERS = ["All", "Unread", "Follows", "Messages", "Commissions", "Gallery"] as const
type Filter = typeof FILTERS[number]
type Kind = Exclude<Filter, "All" | "Unread">
const ICONS = { Follows: UserPlus, Messages: MessageCircle, Commissions: Brush, Gallery: Sparkles }

function kindOf(type: string): Kind {
  const prefix = type.split(":")[0]
  if (prefix === "follow") return "Follows"
  if (prefix === "dm" || prefix === "commission_message") return "Messages"
  if (prefix.startsWith("commission")) return "Commissions"
  return "Gallery"
}

export default function NotificationsPage() {
  return <RedesignShell wrapperClass="gx-settings"><Inbox /></RedesignShell>
}

function Inbox() {
  const { status } = useSession()
  const router = useRouter()
  const utils = trpc.useUtils()
  const [filter, setFilter] = useState<Filter>("All")
  useEffect(() => { if (status === "unauthenticated") router.push("/signin") }, [status, router])

  const { data: notifications, isLoading } = trpc.notification.getAll.useQuery(undefined, { enabled: status === "authenticated" })
  const refresh = () => Promise.all([utils.notification.getAll.invalidate(), utils.notification.unreadCount.invalidate()])
  const markAll = trpc.notification.markAllRead.useMutation({ onSuccess: refresh })
  // The dot flips straight away and rolls back if the server refuses.
  const setRead = trpc.notification.setRead.useMutation({
    onMutate: async ({ id, read }) => {
      await utils.notification.getAll.cancel()
      const previous = utils.notification.getAll.getData()
      utils.notification.getAll.setData(undefined, (old) => old?.map((n) => (n.id === id ? { ...n, read } : n)))
      return { previous }
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) utils.notification.getAll.setData(undefined, ctx.previous) },
    onSettled: () => utils.notification.unreadCount.invalidate(),
  })

  const all = notifications ?? []
  const unread = all.filter((n) => !n.read).length
  const visible = all.filter((n) => filter === "All" || (filter === "Unread" ? !n.read : kindOf(n.type) === filter))
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const groups = [
    { label: "Today", items: visible.filter((n) => new Date(n.createdAt) >= startOfToday) },
    { label: "Earlier", items: visible.filter((n) => new Date(n.createdAt) < startOfToday) },
  ]

  return (
    <div className="desktop-layout settings-layout">
      <GallerySidebar />
      <main className={`settings-main ${styles.main}`}>
        <div className={styles.content}>
          <section className={styles.hero} aria-labelledby="notifications-title">
            <div className={styles.heroIcon}><Bell size={27} aria-hidden="true" /></div>
            <div className={styles.title}>
              <h1 id="notifications-title">Notifications</h1>
              <p>Catch up on activity from your creative circle.</p>
            </div>
            <Link href="/settings?section=Notifications" className={styles.action}><Settings2 size={16} /> Preferences</Link>
          </section>
          <div className={styles.toolbar}>
            <div className={styles.filters} role="group" aria-label="Filter notifications">
              {FILTERS.map((label) => (
                <button key={label} aria-pressed={label === filter} onClick={() => setFilter(label)}>
                  {label}{label === "Unread" && <span>{unread}</span>}
                </button>
              ))}
            </div>
            <button className={styles.action} disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
              <CheckCheck size={17} /> Mark all as read
            </button>
          </div>
          <p role="status" className="sr-only">{unread} unread notifications</p>
          {isLoading && <p className={styles.notice}>Loading…</p>}
          {!isLoading && !visible.length && (
            <div className={styles.empty}>
              <Bell size={25} aria-hidden="true" />
              <h2>{filter === "Unread" ? "You’re all caught up" : all.length ? "No notifications of this kind" : "No notifications yet"}</h2>
              {filter !== "All" && <button className={styles.action} onClick={() => setFilter("All")}>View all notifications</button>}
            </div>
          )}
          {groups.map(({ label, items }) => !items.length ? null : (
            <section key={label} className={styles.group} aria-label={label}>
              <h2>{label}</h2>
              <ul>
                {items.map((n) => {
                  const kind = kindOf(n.type)
                  const Icon = ICONS[kind]
                  const link = notificationLink(n)
                  const name = n.fromUser ? (n.fromUser.name ?? `@${n.fromUser.username}`) : "Gallery"
                  const open = () => { if (!n.read) setRead.mutate({ id: n.id, read: true }); if (link) router.push(link) }
                  return (
                    <li key={n.id} data-unread={!n.read} className={styles.row}>
                      <div className={styles.avatar}>
                        {n.fromUser ? <Avatar src={n.fromUser.image} name={name} /> : <Sparkles size={23} aria-hidden="true" />}
                        <span data-kind={kind}><Icon size={12} aria-hidden="true" /></span>
                      </div>
                      <button type="button" className={styles.message} onClick={open} disabled={!link && n.read} style={{ textAlign: "left", cursor: link ? "pointer" : "default" }}>
                        <p><strong>{name}</strong> {notificationText(n)}</p>
                        <small>{timeAgo(n.createdAt)}</small>
                      </button>
                      <button className={styles.readButton} aria-label={`Mark notification from ${name} as ${n.read ? "unread" : "read"}`}
                        title={n.read ? "Mark as unread" : "Mark as read"} onClick={() => setRead.mutate({ id: n.id, read: !n.read })}>
                        <Circle size={10} fill={n.read ? "none" : "currentColor"} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
