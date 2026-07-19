"use client"

import { use, useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"

function timeAgo(date: Date): string {
  const d = new Date(date)
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return d.toLocaleDateString()
}

const MOOD_GRADIENTS = [
  "radial-gradient(ellipse at 65% 35%, rgba(140,60,200,0.6), transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(255,60,172,0.25), transparent 50%), linear-gradient(160deg,#1E0D30,#120820)",
  "radial-gradient(ellipse at 70% 30%, rgba(220,130,40,0.5), transparent 55%), radial-gradient(ellipse at 10% 70%, rgba(30,160,140,0.3), transparent 55%), linear-gradient(160deg,#1A1208,#081818)",
  "radial-gradient(ellipse at 30% 30%, rgba(60,140,220,0.5), transparent 55%), radial-gradient(ellipse at 80% 75%, rgba(120,60,200,0.3), transparent 55%), linear-gradient(160deg,#0C1830,#100A20)",
  "radial-gradient(ellipse at 60% 25%, rgba(220,60,90,0.5), transparent 55%), radial-gradient(ellipse at 15% 75%, rgba(200,140,40,0.25), transparent 55%), linear-gradient(160deg,#20100C,#180A14)",
  "radial-gradient(ellipse at 40% 30%, rgba(40,180,140,0.45), transparent 55%), radial-gradient(ellipse at 85% 70%, rgba(60,100,220,0.3), transparent 55%), linear-gradient(160deg,#081C18,#0A1020)",
]

function moodFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return MOOD_GRADIENTS[hash % MOOD_GRADIENTS.length]!
}

export default function DMThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
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

  return <DMThread id={id} userId={session!.user.id} />
}

function DMThread({ id, userId }: { id: string; userId: string }) {
  const utils = trpc.useUtils()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: convos } = trpc.dm.getConversations.useQuery()
  const convo = convos?.find(c => c.id === id)

  const { data: messages, isLoading, isError } = trpc.dm.getMessages.useQuery(
    { conversationId: id },
    { refetchInterval: 8000, refetchIntervalInBackground: false, retry: 0 }
  )

  const [text, setText] = useState("")
  const sendMessage = trpc.dm.send.useMutation({
    onSuccess: () => {
      utils.dm.getMessages.invalidate({ conversationId: id })
      utils.dm.getConversations.invalidate()
      setText("")
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages?.length])

  function handleSend() {
    if (!text.trim()) return
    sendMessage.mutate({ conversationId: id, text: text.trim() })
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Loading…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Conversation not found.</p>
      </div>
    )
  }

  const heroBg = convo?.other.bannerImage
    ? `url(${convo.other.bannerImage})`
    : moodFor(convo?.other.id ?? id)

  return (
    <div style={{ position: "fixed", top: 56, bottom: 64, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 470, display: "flex", flexDirection: "column", background: "var(--bg)", zIndex: 1 }}>

      {/* Immersive backdrop header */}
      <div style={{ position: "relative", flexShrink: 0, height: 80, overflow: "hidden", background: heroBg, backgroundSize: "cover", backgroundPosition: "center" }}>
        {/* Fade overlay */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 50, background: "linear-gradient(transparent, rgba(8,6,15,0.98))", pointerEvents: "none" }} />

        {/* Back button */}
        <button
          onClick={() => router.push("/messages")}
          style={{ position: "absolute", top: 11, left: 12, background: "none", border: "none", cursor: "pointer", color: "rgba(240,235,248,0.65)", display: "flex", padding: 2 }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 3-dot menu */}
        <div style={{ position: "absolute", top: 11, right: 12, display: "flex", flexDirection: "column", gap: 3, padding: 2 }}>
          <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(240,235,248,0.5)" }} />
          <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(240,235,248,0.5)" }} />
          <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(240,235,248,0.5)" }} />
        </div>

        {/* Avatar + name at bottom */}
        {convo && (
          <button
            onClick={() => router.push(`/@${convo.other.username}`)}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 14px 9px", display: "flex", alignItems: "flex-end", gap: 9, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
          >
            <div style={{ background: "linear-gradient(135deg,#FF3CAC,#784BA0,#2B86C5)", borderRadius: "50%", padding: 1.5, display: "inline-flex", flexShrink: 0 }}>
              <div style={{ background: "var(--bg)", borderRadius: "50%", overflow: "hidden", width: 28, height: 28 }}>
                <Avatar src={convo.other.image} name={convo.other.name} username={convo.other.username} size={28} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 15, color: "white", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {convo.other.name ?? `@${convo.other.username}`}
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
        {messages && messages.length === 0 && (
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", padding: "32px 0", fontFamily: "Inter,sans-serif" }}>Send a message to start the conversation</p>
        )}
        {messages?.map(msg => {
          const isMe = msg.senderId === userId
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 2 }}>
              <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 4 }}>
                <div style={{
                  padding: "9px 14px", borderRadius: 18, fontSize: 13, fontFamily: "Inter,sans-serif", lineHeight: 1.4,
                  ...(isMe
                    ? { background: "linear-gradient(135deg,#2A1040,#1A1840)", color: "white", borderBottomRightRadius: 5 }
                    : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderBottomLeftRadius: 5 }),
                }}>
                  {msg.text}
                </div>
                <p style={{ fontSize: 9, color: "rgba(107,95,136,0.6)", padding: "0 3px", fontFamily: "Inter,sans-serif" }}>{timeAgo(msg.createdAt)}</p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={{ flexShrink: 0, padding: "8px 12px 14px", display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid var(--border)", background: "var(--nav)" }}>
        {/* Attach */}
        <button
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, flexShrink: 0, display: "flex", alignItems: "center", padding: 2 }}
          aria-label="Attach file"
        >
          📎
        </button>

        {/* Input */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Message…"
          rows={1}
          style={{ flex: 1, padding: "8px 14px", borderRadius: 18, fontSize: 13, color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)", outline: "none", resize: "none", maxHeight: 128, fontFamily: "Inter,sans-serif" }}
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || sendMessage.isPending}
          style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: text.trim() ? "pointer" : "default", background: "linear-gradient(135deg,#FF3CAC,#2B86C5)", color: "white", opacity: text.trim() ? 1 : 0.4 }}
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
