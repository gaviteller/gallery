"use client"
/**
 * MESSAGES (Codex redesign): inbox list + open thread side by side (stacked on mobile).
 * Used by /messages (no thread selected) and /messages/[id]. Styling: app/redesign/messages.css.
 * Data: dm.getConversations (10s poll), dm.getConversation + dm.getMessages (8s poll), dm.send, dm.getOrCreate.
 */
import "@/app/redesign/messages.css"
import "@/app/redesign/shell.css"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowLeft, MessageCircle, Plus, Search, Send, X } from "lucide-react"
import { trpc } from "@/components/providers"
import RedesignShell, { GallerySidebar, Avatar } from "./RedesignShell"

function timeShort(date: Date | string): string {
  const d = new Date(date)
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return "now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  const days = Math.floor(seconds / 86400)
  if (days === 1) return "Yesterday"
  if (days < 7) return d.toLocaleDateString([], { weekday: "long" })
  return d.toLocaleDateString()
}

export default function MessagesView({ conversationId }: { conversationId: string | null }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  useEffect(() => { if (status === "unauthenticated") router.push("/signin") }, [status, router])
  if (status !== "authenticated") return null
  return (
    <RedesignShell wrapperClass="gx-messages">
      <div className="desktop-layout messages-layout">
        <GallerySidebar />
        <Inbox userId={session.user.id} conversationId={conversationId} />
      </div>
    </RedesignShell>
  )
}

function Inbox({ userId, conversationId }: { userId: string; conversationId: string | null }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [composing, setComposing] = useState(false)
  const { data: convos, isLoading } = trpc.dm.getConversations.useQuery(undefined, { refetchInterval: 10000, refetchIntervalInBackground: false })

  const list = convos ?? []
  const isUnread = (c: (typeof list)[number]) => !!(c.lastMsg && c.lastMsg.senderId !== userId && c.id !== conversationId)
  const unreadCount = list.filter(isUnread).length
  const q = query.trim().toLowerCase()
  const filtered = list.filter((c) => (!unreadOnly || isUnread(c)) && (!q || [c.other.name ?? "", c.other.username ?? "", c.lastMsg?.text ?? ""].some((v) => v.toLowerCase().includes(q))))

  return (
    <main className="messages-main">
      <header className="messages-heading"><h1>Messages</h1><button className="message-primary" onClick={() => setComposing(true)}><Plus size={17} /> New message</button></header>
      <div className={`inbox ${conversationId ? "thread-open" : ""}`}>
        <section className="inbox-list" aria-label="Inbox">
          <label className="inbox-search"><Search size={16} /><input placeholder="Search conversations" aria-label="Search conversations" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</label>
          <div className="inbox-filters"><button aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>All messages</button><button aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Unread <span>{unreadCount}</span></button></div>
          <div className="conversation-list">
            {isLoading && <p className="inbox-empty">Loading…</p>}
            {filtered.map((c) => (
              <button key={c.id} className="conversation" aria-pressed={conversationId === c.id} onClick={() => router.push(`/messages/${c.id}`)}>
                <Avatar src={c.other.image} name={c.other.name ?? c.other.username ?? "?"} className="" />
                <span className="conversation-copy"><strong>{c.other.name ?? `@${c.other.username ?? "unknown"}`}</strong><span>{c.lastMsg ? (c.lastMsg.senderId === userId ? "You: " : "") + c.lastMsg.text : "New conversation"}</span></span>
                <span className="conversation-meta">{c.lastMsg && timeShort(c.lastMsg.createdAt)}{isUnread(c) && <i aria-label="Unread" />}</span>
              </button>
            ))}
            {!isLoading && !filtered.length && <p className="inbox-empty">{list.length === 0 ? "No messages yet. Start a conversation with an artist." : unreadOnly && !q ? "You’re all caught up." : "No matching conversations."}</p>}
          </div>
        </section>
        <section className="message-thread" aria-label="Conversation">
          {conversationId ? <Thread key={conversationId} id={conversationId} userId={userId} /> : (
            <div className="thread-empty"><MessageCircle size={24} /><p>Choose a conversation, or start a new one.</p><button className="message-primary" onClick={() => setComposing(true)}><Plus size={16} />New message</button></div>
          )}
        </section>
      </div>
      {composing && <NewMessageDialog onClose={() => setComposing(false)} />}
    </main>
  )
}

function Thread({ id, userId }: { id: string; userId: string }) {
  const utils = trpc.useUtils()
  const endRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState("")
  const { data: convo } = trpc.dm.getConversation.useQuery({ conversationId: id }, { retry: 0 })
  const { data: messages, isLoading, isError } = trpc.dm.getMessages.useQuery({ conversationId: id }, { refetchInterval: 8000, refetchIntervalInBackground: false, retry: 0 })
  const sendMessage = trpc.dm.send.useMutation({
    onSuccess: () => { utils.dm.getMessages.invalidate({ conversationId: id }); utils.dm.getConversations.invalidate(); setText("") },
  })
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }) }, [messages?.length])

  function send() {
    const body = text.trim()
    if (!body || sendMessage.isPending) return
    sendMessage.mutate({ conversationId: id, text: body })
  }

  if (isError) return <div className="thread-empty"><MessageCircle size={24} /><p>Conversation not found.</p><Link className="message-primary" href="/messages">Back to inbox</Link></div>
  const other = convo?.other
  const name = other?.name ?? (other?.username ? `@${other.username}` : "…")

  return (
    <>
      <header className="thread-header">
        <Link className="icon-button thread-back" aria-label="Back to inbox" href="/messages"><ArrowLeft size={19} /></Link>
        {other && <Avatar src={other.image} name={other.name ?? other.username ?? "?"} className="" />}
        <div>{other?.username ? <Link href={`/@${other.username}`}><h2>{name}</h2></Link> : <h2>{name}</h2>}{other?.username && <p>@{other.username}</p>}</div>
      </header>
      <div className="thread-history" role="log" aria-label={`Messages with ${name}`}>
        {isLoading && <div className="thread-empty"><p>Loading…</p></div>}
        {messages && messages.length === 0 && <div className="thread-empty"><MessageCircle size={24} /><p>Send a message to start the conversation.</p></div>}
        {messages?.map((m) => (
          <div className={`message ${m.senderId === userId ? "message-own" : ""}`} key={m.id}><p>{m.text}</p><span>{timeShort(m.createdAt)}{m.hidden && " · Under review — not delivered yet"}</span></div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="message-composer" onSubmit={(e) => { e.preventDefault(); send() }}>
        <div className="composer-row">
          <textarea aria-label="Write a message" placeholder="Write a message…" rows={2} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }} />
          <button className="message-primary" type="submit" disabled={!text.trim() || sendMessage.isPending}><Send size={16} /><span>Send</span></button>
        </div>
        <p role="status">{sendMessage.error ? sendMessage.error.message : "Enter to send · Shift + Enter for a new line"}</p>
      </form>
    </>
  )
}

function NewMessageDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState("")
  const enabled = query.trim().length > 0
  const { data: users } = trpc.user.search.useQuery({ query }, { enabled })
  const getOrCreate = trpc.dm.getOrCreate.useMutation({ onSuccess: (convo) => { onClose(); router.push(`/messages/${convo.id}`) } })
  useEffect(() => { dialogRef.current?.showModal() }, [])

  return (
    <dialog className="message-dialog" ref={dialogRef} onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) dialogRef.current?.close() }}>
      <button className="icon-button close-message-dialog" aria-label="Close dialog" onClick={() => dialogRef.current?.close()}><X size={20} /></button>
      <h2>New message</h2>
      <label className="inbox-search"><Search size={16} /><input autoFocus placeholder="Search people…" aria-label="Search people" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <div className="contact-list">
        {users?.map((u) => (
          <button key={u.id} disabled={getOrCreate.isPending} onClick={() => getOrCreate.mutate({ otherUserId: u.id })}>
            <Avatar src={u.image} name={u.name ?? u.username ?? "?"} className="" /><span><strong>{u.name ?? `@${u.username}`}</strong><small>@{u.username}</small></span>
          </button>
        ))}
        {enabled && users && users.length === 0 && <p className="inbox-empty">No results for “{query}”</p>}
        {!enabled && <p className="inbox-empty">Search for someone to message</p>}
      </div>
    </dialog>
  )
}
