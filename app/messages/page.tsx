"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import Avatar from "@/components/Avatar"

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function MessagesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
  }, [status, router])

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  return <MessagesInner userId={session!.user.id} />
}

function MessagesInner({ userId }: { userId: string }) {
  const { data: convos, isLoading } = trpc.dm.getConversations.useQuery()
  const router = useRouter()

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-xl font-bold text-gray-900">Messages</h1>
      </div>

      {!convos || convos.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 font-medium">No messages yet</p>
          <p className="text-xs text-gray-400 mt-1">Visit someone's profile to start a conversation</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 bg-white">
          {convos.map(c => (
            <button
              key={c.id}
              onClick={() => router.push(`/messages/${c.id}`)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <Avatar src={c.other.image} name={c.other.name} username={c.other.username} size={44} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">@{c.other.username ?? "unknown"}</p>
                {c.lastMsg && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {c.lastMsg.senderId === userId ? "You: " : ""}{c.lastMsg.text}
                  </p>
                )}
              </div>
              {c.lastMsg && (
                <p className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(c.lastMsg.createdAt)}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
