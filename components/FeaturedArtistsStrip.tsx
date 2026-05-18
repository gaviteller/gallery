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

export default function FeaturedArtistsStrip() {
  const { data: session } = useSession()
  const [viewing, setViewing] = useState<StoryGroup | null>(null)
  const [uploading, setUploading] = useState(false)
  const utils = trpc.useUtils()

  const { data: groups = [] } = trpc.story.getFeed.useQuery(undefined, {
    enabled: !!session,
  })

  if (!session) return null

  const me = session.user.id

  function handleCardClick(group: StoryGroup) {
    if (group.userId === me && group.stories.length === 0) {
      setUploading(true)
    } else if (group.stories.length > 0) {
      setViewing(group)
    }
  }

  return (
    <>
      <div
        className="flex gap-3 px-3 py-3 overflow-x-auto"
        style={{ borderBottom: "1px solid #ffffff08", scrollbarWidth: "none" }}
      >
        {groups.map((group) => {
          const isMe = group.userId === me
          const hasStory = group.stories.length > 0
          const hasUnviewed = group.hasUnviewed
          // Preview: first story image if they have a story, otherwise avatar
          const previewSrc = hasStory ? group.stories[0].image : group.image

          // Gradient ring wrapper for active story
          const wrapperStyle: React.CSSProperties = hasUnviewed
            ? {
                padding: 2,
                background:
                  "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                borderRadius: 12,
              }
            : hasStory
            ? {
                padding: 1.5,
                background: "rgba(255,255,255,0.25)",
                borderRadius: 12,
              }
            : {}

          return (
            <button
              key={group.userId}
              onClick={() => handleCardClick(group)}
              className="flex-shrink-0 focus:outline-none"
            >
              <div style={wrapperStyle}>
                {/* Card: 64×80, image top 56px, label bottom 24px */}
                <div
                  className="relative overflow-hidden"
                  style={{
                    width: 64,
                    height: 80,
                    borderRadius: 10,
                    background: "#141414",
                    border:
                      !hasStory
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "none",
                  }}
                >
                  {/* Top 56px: preview image or gradient initial */}
                  <div
                    className="absolute top-0 left-0 w-full overflow-hidden"
                    style={{ height: 56 }}
                  >
                    {previewSrc ? (
                      <img
                        src={previewSrc}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white font-bold text-xl"
                        style={{
                          background:
                            "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                        }}
                      >
                        {(group.name ?? group.username ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                    {/* + overlay for own card with no story */}
                    {isMe && !hasStory && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="rounded-full flex items-center justify-center"
                          style={{
                            width: 22,
                            height: 22,
                            background:
                              "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)",
                          }}
                        >
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom 24px: username label */}
                  <div
                    className="absolute bottom-0 left-0 w-full flex items-center justify-center"
                    style={{ height: 24, background: "rgba(0,0,0,0.55)" }}
                  >
                    <span
                      className="text-[9px] text-white/80 truncate px-1"
                      style={{ maxWidth: 60 }}
                    >
                      {isMe ? "You" : (group.username ?? "")}
                    </span>
                  </div>
                </div>
              </div>
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
