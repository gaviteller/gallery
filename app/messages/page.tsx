"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"
import MessagesTabs from "@/components/MessagesTabs"

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Modal for starting a new conversation — search users, pick one, open thread
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
      className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl pb-8"
        style={{ background: "#1e0d3f", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(240,235,248,0.07)" }} />
        </div>

        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="flex-1 text-sm font-semibold text-white">New Message</p>
          <button onClick={onClose} className="text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
        </div>

        <div className="px-4 pt-3 pb-2">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search people…"
            className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500 transition"
            style={{ background: "rgba(240,235,248,0.07)", border: "1px solid var(--border)" }}
          />
        </div>

        <div className="max-h-64 overflow-y-auto">
          {users && users.length > 0 ? (
            users.map(user => (
              <button
                key={user.id}
                onClick={() => getOrCreate.mutate({ otherUserId: user.id })}
                disabled={getOrCreate.isPending}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
              >
                <Avatar src={user.image} name={user.name} username={user.username} size={40} />
                <div>
                  <p className="text-sm font-semibold text-white">@{user.username}</p>
                  {user.name && <p className="text-xs text-white/50">{user.name}</p>}
                </div>
              </button>
            ))
          ) : enabled ? (
            <p className="text-sm text-white/40 text-center py-6">No results for &ldquo;{query}&rdquo;</p>
          ) : (
            <p className="text-xs text-white/40 text-center py-6">Search for someone to message</p>
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
    return <div className="min-h-screen flex items-center justify-center"><p className="text-white/40">Loading…</p></div>
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
    return <div className="min-h-screen flex items-center justify-center"><p className="text-white/40">Loading…</p></div>
  }

  return (
    <>
      {composing && <NewMessageModal onClose={() => setComposing(false)} />}

      <div className="max-w-lg mx-auto pb-24">
        <MessagesTabs />
        <div className="flex items-center justify-end px-4 pt-3 pb-2">
          <button
            onClick={() => setComposing(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors text-white/60"
            aria-label="New message"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>

        {!convos || convos.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(240,235,248,0.07)" }}>
              <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-white font-semibold mb-1">Your messages</p>
            <p className="text-sm text-white/40 mb-5">Send a message to start a conversation</p>
            <button
              onClick={() => setComposing(true)}
              className="px-5 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors"
              style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}
            >
              Send message
            </button>
          </div>
        ) : (
          <div style={{ borderTop: "1px solid var(--border)" }}>
            {convos.map(c => (
              <button
                key={c.id}
                onClick={() => router.push(`/messages/${c.id}`)}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors text-left"
                style={{ borderBottom: "1px solid #ffffff08" }}
              >
                <div className="relative flex-shrink-0">
                  <Avatar src={c.other.image} name={c.other.name} username={c.other.username} size={48} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-semibold text-white">
                    @{c.other.username ?? "unknown"}
                  </p>
                  {c.lastMsg && (
                    <p className="text-xs truncate mt-0.5 text-white/40">
                      {c.lastMsg.senderId === userId ? "You: " : ""}{c.lastMsg.text}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {c.lastMsg && (
                    <p className="text-[10px] text-white/30">{timeAgo(c.lastMsg.createdAt)}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
