"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
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
      <div className="gallery-functional-stories">
        <div className="gallery-section-title gallery-stories-heading">
          <h2>Stories</h2>
          <Link href="/search">See All</Link>
        </div>

        <div className="gallery-story-row gallery-story-row-functional">
          {groups.map((group) => {
            const isMe = group.userId === me
            const hasStory = group.stories.length > 0
            const muted = hasStory && !group.hasUnviewed

            return (
              <button
                key={group.userId}
                onClick={() => handleBubbleClick(group)}
                className="gallery-story"
                type="button"
              >
                <span className={`gallery-story-ring${muted ? " gallery-story-ring-viewed" : ""}${!hasStory ? " gallery-story-ring-empty" : ""}`}>
                  <span className="gallery-story-photo-wrap">
                    {group.image ? (
                      <img src={group.image} className="gallery-story-photo" alt="" />
                    ) : (
                      <span className="gallery-story-photo gallery-story-fallback">
                        {(group.name ?? group.username ?? "?")[0].toUpperCase()}
                      </span>
                    )}
                    {isMe && !hasStory && <span className="gallery-story-add-overlay">＋</span>}
                  </span>
                </span>
                <span>{isMe ? "Your Story" : (group.username ?? group.name ?? "Artist")}</span>
              </button>
            )
          })}
        </div>
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
          onSuccess={() => {
            setUploading(false)
            utils.story.getFeed.invalidate()
          }}
        />
      )}
    </>
  )
}
