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
  const menuRef = useRef<HTMLDivElement>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)

  const { data: convos } = trpc.dm.getConversations.useQuery()
  const convo = convos?.find(c => c.id === id)
  const otherUserId = convo?.other.id

  const { data: messages, isLoading } = trpc.dm.getMessages.useQuery(
    { conversationId: id },
    { refetchInterval: 8000, refetchIntervalInBackground: false }
  )

  const { data: blockStatus, refetch: refetchBlock } = trpc.dm.getBlockStatus.useQuery(
    { otherUserId: otherUserId! },
    { enabled: !!otherUserId }
  )

  const markRead = trpc.dm.markRead.useMutation({
    onSuccess: () => utils.dm.getUnreadCount.invalidate(),
  })

  const [text, setText] = useState("")
  const sendMessage = trpc.dm.send.useMutation({
    onSuccess: () => {
      utils.dm.getMessages.invalidate({ conversationId: id })
      utils.dm.getConversations.invalidate()
      setText("")
    },
  })

  const blockUser = trpc.dm.blockUser.useMutation({
    onSuccess: () => {
      refetchBlock()
      setConfirmBlock(false)
      setMenuOpen(false)
      utils.dm.getConversations.invalidate()
    },
  })

  const unblockUser = trpc.dm.unblockUser.useMutation({
    onSuccess: () => {
      refetchBlock()
      setMenuOpen(false)
    },
  })

  const deleteConvo = trpc.dm.deleteConversation.useMutation({
    onSuccess: () => {
      utils.dm.getConversations.invalidate()
      router.push("/messages")
    },
  })

  // Mark conversation as read on open and when new messages arrive
  useEffect(() => {
    markRead.mutate({ conversationId: id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, messages?.length])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages?.length])

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [menuOpen])

  function handleSend() {
    if (!text.trim()) return
    sendMessage.mutate({ conversationId: id, text: text.trim() })
  }

  const blocked = blockStatus?.iBlockedThem || blockStatus?.theyBlockedMe
  const canSend = !blocked

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col h-screen pb-16">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid #ffffff10", background: "#070C1C" }}>
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

        {/* ⋮ menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5"/>
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-52 rounded-2xl shadow-2xl py-1 z-50 overflow-hidden"
              style={{ background: "#0D1640", border: "1px solid #ffffff15" }}
            >
              {blockStatus?.iBlockedThem ? (
                <button
                  onClick={() => { if (otherUserId) unblockUser.mutate({ userId: otherUserId }) }}
                  disabled={unblockUser.isPending}
                  className="w-full text-left px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
                >
                  Unblock @{convo?.other.username}
                </button>
              ) : (
                <button
                  onClick={() => { setMenuOpen(false); setConfirmBlock(true) }}
                  className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition-colors"
                >
                  Block @{convo?.other.username}
                </button>
              )}
              <div className="mx-3 my-0.5" style={{ borderTop: "1px solid #ffffff15" }} />
              <button
                onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition-colors"
              >
                Delete conversation
              </button>
            </div>
          )}
        </div>
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
                }`} style={!isMe ? { background: "#0D1640" } : {}}>
                  {msg.text}
                </div>
                <p className="text-[10px] text-white/30 px-1">{timeAgo(msg.createdAt)}</p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Blocked banners */}
      {blockStatus?.iBlockedThem && (
        <div className="flex-shrink-0 mx-4 mb-3 px-4 py-3 rounded-xl text-center text-sm text-white/50" style={{ background: "#ffffff08", border: "1px solid #ffffff10" }}>
          You blocked this user.{" "}
          <button
            onClick={() => { if (otherUserId) unblockUser.mutate({ userId: otherUserId }) }}
            className="text-sky-400 hover:underline"
          >
            Unblock
          </button>
        </div>
      )}
      {blockStatus?.theyBlockedMe && (
        <div className="flex-shrink-0 mx-4 mb-3 px-4 py-3 rounded-xl text-center text-sm text-white/50" style={{ background: "#ffffff08", border: "1px solid #ffffff10" }}>
          You can&apos;t message this user.
        </div>
      )}

      {/* Input */}
      {canSend && (
        <div className="flex-shrink-0 px-4 py-3 flex gap-2 items-end" style={{ borderTop: "1px solid #ffffff10", background: "#070C1C" }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Message…"
            rows={1}
            className="flex-1 px-4 py-3 rounded-2xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-sky-500 resize-none max-h-32"
            style={{ background: "#ffffff10" }}
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
      )}

      {/* Confirm block modal */}
      {confirmBlock && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4" style={{ background: "#0D1640", border: "1px solid #ffffff15" }}>
            <h2 className="text-base font-bold text-white">Block @{convo?.other.username}?</h2>
            <p className="text-sm text-white/50">They won&apos;t be able to message you and their conversation will be hidden from your inbox.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmBlock(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors"
                style={{ border: "1px solid #ffffff20" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { if (otherUserId) blockUser.mutate({ userId: otherUserId }) }}
                disabled={blockUser.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {blockUser.isPending ? "Blocking…" : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4" style={{ background: "#0D1640", border: "1px solid #ffffff15" }}>
            <h2 className="text-base font-bold text-white">Delete conversation?</h2>
            <p className="text-sm text-white/50">This will permanently delete the entire conversation for both people. This can&apos;t be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors"
                style={{ border: "1px solid #ffffff20" }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteConvo.mutate({ conversationId: id })}
                disabled={deleteConvo.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteConvo.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
