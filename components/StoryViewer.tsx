"use client"
import { useEffect, useRef, useState } from "react"
import { trpc } from "@/components/providers"

const STORY_DURATION_MS = 10_000

type StoryItem = { id: string; image: string; createdAt: Date; viewed?: boolean }
type StoryUser = {
  userId: string
  username: string | null
  name: string | null
  image: string | null
  stories: StoryItem[]
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export default function StoryViewer({ user, onClose }: { user: StoryUser; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0) // 0–100
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const story = user.stories[index]
  const markViewed = trpc.story.markViewed.useMutation()

  // Mark viewed whenever the story changes
  useEffect(() => {
    if (story) markViewed.mutate({ storyId: story.id })
  }, [story?.id])

  // Auto-advance timer — resets on index change
  useEffect(() => {
    setProgress(0)
    startRef.current = null

    function tick(now: number) {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const pct = Math.min((elapsed / STORY_DURATION_MS) * 100, 100)
      setProgress(pct)
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // Advance to next or close
        setIndex(i => {
          if (i < user.stories.length - 1) return i + 1
          onClose()
          return i
        })
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [index, user.stories.length])

  function prev(e: React.MouseEvent) {
    e.stopPropagation()
    if (index > 0) setIndex(i => i - 1)
  }

  function next(e: React.MouseEvent) {
    e.stopPropagation()
    if (index < user.stories.length - 1) setIndex(i => i + 1)
    else onClose()
  }

  if (!story) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="relative w-full max-w-sm h-full" style={{ maxHeight: "100dvh" }}>
        {/* Image */}
        <img src={story.image} alt="" className="w-full h-full object-cover" />

        {/* Progress bars */}
        <div className="absolute top-3 left-0 right-0 flex gap-1 px-3">
          {user.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.3)" }}>
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: i < index ? "100%" : i === index ? `${progress}%` : "0%",
                  transition: i === index ? "none" : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-0 right-0 flex items-center gap-3 px-4">
          {user.image
            ? <img src={user.image} className="w-9 h-9 rounded-full object-cover" alt="" />
            : <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)" }}>
                {(user.name ?? user.username ?? "?")[0].toUpperCase()}
              </div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">@{user.username}</p>
            <p className="text-xs text-white/60">{timeAgo(story.createdAt)}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tap zones */}
        <button className="absolute left-0 top-0 w-1/3 h-full opacity-0" onClick={prev} aria-label="Previous" />
        <button className="absolute right-0 top-0 w-2/3 h-full opacity-0" onClick={next} aria-label="Next" />
      </div>
    </div>
  )
}
