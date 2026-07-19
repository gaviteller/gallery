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
        style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)", overflowX: "auto", scrollbarWidth: "none" }}
      >
        {/* Always-visible "Your story" add card */}
        <button
          onClick={() => setUploading(true)}
          style={{ flexShrink: 0, width: 64, height: 80, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}
        >
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #FF3CAC, #2B86C5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 18, fontWeight: 300, lineHeight: 1 }}>+</div>
          <span style={{ fontSize: 8, color: "var(--muted)" }}>Your story</span>
        </button>

        {groups.filter(g => g.userId !== me).map((group) => {
          const hasUnviewed = group.hasUnviewed
          const previewSrc = group.stories.length > 0 ? group.stories[0].image : group.image

          const ringStyle: React.CSSProperties = hasUnviewed
            ? { padding: 2, background: "linear-gradient(135deg, #FF3CAC, #784BA0, #2B86C5)", borderRadius: 12, flexShrink: 0 }
            : group.stories.length > 0
            ? { padding: 1.5, background: "var(--border)", borderRadius: 12, flexShrink: 0 }
            : { flexShrink: 0 }

          return (
            <button
              key={group.userId}
              onClick={() => handleCardClick(group)}
              style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <div style={ringStyle}>
                <div style={{ width: 64, height: 80, borderRadius: 10, background: "#141414", overflow: "hidden", position: "relative" }}>
                  {previewSrc ? (
                    <img src={previewSrc} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt="" />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #FF3CAC, #784BA0, #2B86C5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 18 }}>
                      {(group.name ?? group.username ?? "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.55)", padding: "3px 2px", fontSize: 7, color: "rgba(255,255,255,0.8)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {group.username ?? ""}
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
