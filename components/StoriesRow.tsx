"use client"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { trpc } from "@/components/providers"
import StoryViewer from "./StoryViewer"
import StoryUpload from "./StoryUpload"

type StoryGroup = {
  userId: string
  username: string | null
  name: string | null
  image: string | null
  stories: { id: string; image: string; createdAt: Date; viewed: boolean }[]
  hasUnviewed: boolean
}

export default function StoriesRow() {
  const { data: session } = useSession()
  const [viewing, setViewing] = useState<StoryGroup | null>(null)
  const [uploading, setUploading] = useState(false)
  const utils = trpc.useUtils()

  const { data: groups = [] } = trpc.story.getFeed.useQuery(undefined, {
    enabled: !!session,
  })

  if (!session) return null

  const me = session.user.id

  function handleBubbleClick(group: StoryGroup) {
    if (group.userId === me && group.stories.length === 0) {
      setUploading(true)
    } else if (group.stories.length > 0) {
      setViewing(group)
    } else {
      setUploading(true)
    }
  }

  return (
    <>
      <div
        className="flex gap-4 px-4 py-3 overflow-x-auto"
        style={{ borderBottom: "1px solid #ffffff08", scrollbarWidth: "none" }}
      >
        {groups.map((group) => {
          const isMe = group.userId === me
          const hasStory = group.stories.length > 0
          const ringColor = hasStory
            ? group.hasUnviewed
              ? "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)"
              : "rgba(255,255,255,0.25)"
            : "transparent"

          return (
            <button
              key={group.userId}
              onClick={() => handleBubbleClick(group)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
              style={{ minWidth: 60 }}
            >
              {/* Avatar with ring */}
              <div
                className="rounded-full p-0.5"
                style={{ background: ringColor, padding: hasStory ? 2 : 0 }}
              >
                <div
                  className="rounded-full overflow-hidden relative"
                  style={{ width: 52, height: 52, background: "#0D0D0F", padding: hasStory ? 2 : 0 }}
                >
                  {group.image ? (
                    <img src={group.image} className="w-full h-full rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}>
                      {(group.name ?? group.username ?? "?")[0].toUpperCase()}
                    </div>
                  )}
                  {/* + overlay for own empty avatar */}
                  {isMe && !hasStory && (
                    <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              {/* Label */}
              <span className="text-[10px] text-white/60 truncate" style={{ maxWidth: 60 }}>
                {isMe ? "Your story" : (group.username ?? "")}
              </span>
            </button>
          )
        })}
      </div>

      {viewing && (
        <StoryViewer
          user={viewing}
          onClose={() => {
            setViewing(null)
            utils.story.getFeed.invalidate()
          }}
        />
      )}

      {uploading && (
        <StoryUpload
          onClose={() => setUploading(false)}
          onSuccess={() => setUploading(false)}
        />
      )}
    </>
  )
}
