"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"

function timeShort(date: Date): string {
  const d = new Date(date)
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  const days = Math.floor(seconds / 86400)
  if (days === 1) return "Yesterday"
  return `${days}d`
}

function NewMessageModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("")
  const router = useRouter()
  const enabled = query.trim().length > 0

  const { data: users } = trpc.user.search.useQuery({ query }, { enabled })
  const getOrCreate = trpc.dm.getOrCreate.useMutation({
    onSuccess: (convo) => {
      onClose()
      router.push(`/messages/${convo.id}`)
    },
  })

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 512, borderRadius: "18px 18px 0 0", paddingBottom: 32, background: "var(--nav)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(240,235,248,0.07)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <p style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "var(--text)", fontFamily: "Inter,sans-serif" }}>New Message</p>
          <button onClick={onClose} style={{ fontSize: 13, color: "rgba(240,235,248,0.4)", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Cancel</button>
        </div>
        <div style={{ padding: "12px 16px 8px" }}>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search people…"
            style={{ width: "100%", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "var(--text)", background: "rgba(240,235,248,0.07)", border: "1px solid var(--border)", outline: "none", fontFamily: "Inter,sans-serif", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ maxHeight: 256, overflowY: "auto" }}>
          {users && users.length > 0 ? users.map(user => (
            <button
              key={user.id}
              onClick={() => getOrCreate.mutate({ otherUserId: user.id })}
              disabled={getOrCreate.isPending}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <Avatar src={user.image} name={user.name} username={user.username} size={40} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", fontFamily: "Inter,sans-serif" }}>@{user.username}</p>
                {user.name && <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>{user.name}</p>}
              </div>
            </button>
          )) : enabled ? (
            <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "24px 0", fontFamily: "Inter,sans-serif" }}>No results for &ldquo;{query}&rdquo;</p>
          ) : (
            <p style={{ fontSize: 11, color: "rgba(107,95,136,0.6)", textAlign: "center", padding: "24px 0", fontFamily: "Inter,sans-serif" }}>Search for someone to message</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
  }, [status, router])

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Loading…</p>
      </div>
    )
  }

  return <MessagesInner userId={session!.user.id} />
}

function MessagesInner({ userId }: { userId: string }) {
  const { data: convos, isLoading } = trpc.dm.getConversations.useQuery(undefined, {
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  })
  const router = useRouter()
  const [composing, setComposing] = useState(false)

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Loading…</p>
      </div>
    )
  }

  return (
    <>
      {composing && <NewMessageModal onClose={() => setComposing(false)} />}

      <div style={{ maxWidth: 512, margin: "0 auto", minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>

        {/* Sticky nav */}
        <div style={{ background: "var(--nav)", padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10 }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, background: "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Messages
          </span>
          <button
            onClick={() => setComposing(true)}
            aria-label="New message"
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(240,235,248,0.5)", padding: 4, display: "flex", alignItems: "center" }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>

        {/* Empty state */}
        {!convos || convos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px", fontFamily: "Inter,sans-serif" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", background: "rgba(240,235,248,0.06)" }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="rgba(240,235,248,0.25)" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>No messages yet</p>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>Start a conversation with an artist</p>
            <button
              onClick={() => setComposing(true)}
              style={{ padding: "10px 22px", borderRadius: 22, fontSize: 13, fontWeight: 600, color: "white", border: "none", cursor: "pointer", background: "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", fontFamily: "Inter,sans-serif" }}
            >
              Send message
            </button>
          </div>
        ) : (
          <div>
            {convos.map(c => {
              const isUnread = !!(c.lastMsg && c.lastMsg.senderId !== userId)
              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/messages/${c.id}`)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "left" }}
                >
                  {/* Gradient avatar ring */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ background: "linear-gradient(135deg,#FF3CAC,#784BA0,#2B86C5)", borderRadius: "50%", padding: 2, display: "inline-flex" }}>
                      <div style={{ background: "var(--bg)", borderRadius: "50%", overflow: "hidden", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Avatar src={c.other.image} name={c.other.name} username={c.other.username} size={38} />
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, marginRight: 8 }}>
                        {c.other.name ?? `@${c.other.username ?? "unknown"}`}
                      </span>
                      {c.lastMsg && (
                        <span style={{ fontSize: 9, color: "var(--muted)", flexShrink: 0, fontFamily: "Inter,sans-serif" }}>
                          {timeShort(c.lastMsg.createdAt)}
                        </span>
                      )}
                    </div>
                    {c.lastMsg && (
                      <p style={{ fontSize: 10, color: isUnread ? "rgba(240,235,248,0.65)" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "Inter,sans-serif", margin: 0 }}>
                        {c.lastMsg.senderId === userId ? "You: " : ""}{c.lastMsg.text}
                      </p>
                    )}
                  </div>

                  {/* Unread dot */}
                  {isUnread && (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg,#FF3CAC,#2B86C5)", flexShrink: 0 }} />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
