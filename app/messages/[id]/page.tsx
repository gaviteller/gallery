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

export default function DMThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
  }, [status, router])

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  return <DMThread id={id} userId={session!.user.id} />
}

function DMThread({ id, userId }: { id: string; userId: string }) {
  const utils = trpc.useUtils()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: convos } = trpc.dm.getConversations.useQuery()
  const convo = convos?.find(c => c.id === id)

  const { data: messages, isLoading } = trpc.dm.getMessages.useQuery(
    { conversationId: id },
    { refetchInterval: 8000, refetchIntervalInBackground: false }
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
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col h-screen pb-16">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
        <button onClick={() => router.push("/messages")} className="text-white/40 hover:text-white p-1 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {convo && (
          <button
            onClick={() => router.push(`/@${convo.other.username}`)}
            className="flex items-center gap-2 flex-1 min-w-0"
          >
            <Avatar src={convo.other.image} name={convo.other.name} username={convo.other.username} size={32} />
            <p className="text-sm font-semibold text-white truncate">@{convo.other.username}</p>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {messages && messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-8">Send a message to start the conversation</p>
        )}
        {messages?.map(msg => {
          const isMe = msg.senderId === userId
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
              <div className={`max-w-[80%] flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                  isMe
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "rounded-tl-sm text-white"
                }`} style={!isMe ? { background: "var(--surface)" } : {}}>
                  {msg.text}
                </div>
                <p className="text-[10px] text-white/30 px-1">{timeAgo(msg.createdAt)}</p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 flex gap-2 items-end" style={{ borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Message…"
          rows={1}
          className="flex-1 px-4 py-3 rounded-2xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500 resize-none max-h-32"
          style={{ background: "rgba(240,235,248,0.07)" }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sendMessage.isPending}
          className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-40 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
