"use client"
/** Open conversation (Codex redesign) — see components/redesign/MessagesView.tsx. */
import { use } from "react"
import MessagesView from "@/components/redesign/MessagesView"

export default function DMThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <MessagesView conversationId={id} />
}
