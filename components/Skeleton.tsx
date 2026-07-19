// Reusable shimmer skeleton primitives

const shimmer = "animate-pulse rounded"
const bg = "rgba(255,255,255,0.07)"

/** Single shimmer block — pass className for size/shape */
export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`${shimmer} ${className ?? ""}`}
      style={{ background: bg }}
    />
  )
}

/** 3-column grid of square post thumbnails */
export function PostGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square animate-pulse" style={{ background: bg }} />
      ))}
    </div>
  )
}

/** Full-page profile skeleton — banner + avatar + bio + post grid */
export function ProfileSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: "#0d0d0f" }}>
      {/* Banner */}
      <div className="w-full h-32 animate-pulse" style={{ background: bg }} />
      {/* Avatar + name */}
      <div className="px-4 -mt-10 mb-4 flex items-end gap-3">
        <div className="w-20 h-20 rounded-full flex-shrink-0 animate-pulse border-2 border-[#0d0d0f]" style={{ background: bg }} />
        <div className="flex flex-col gap-2 pb-1">
          <Shimmer className="h-4 w-32" />
          <Shimmer className="h-3 w-20" />
        </div>
      </div>
      {/* Bio lines */}
      <div className="px-4 flex flex-col gap-2 mb-5">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-3/4" />
      </div>
      {/* Post grid */}
      <PostGridSkeleton count={9} />
    </div>
  )
}

/** Feed skeleton — a few post card placeholders */
export function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="aspect-square w-full animate-pulse" style={{ background: bg }} />
      ))}
    </div>
  )
}

/** Generic full-page centered skeleton — for DMs, messages, settings etc */
export function PageSkeleton() {
  return (
    <div className="min-h-screen flex flex-col gap-3 px-4 pt-16" style={{ background: "#0d0d0f" }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex-shrink-0 animate-pulse" style={{ background: bg }} />
          <div className="flex flex-col gap-1.5 flex-1">
            <Shimmer className={`h-3 ${i % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
            <Shimmer className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Inline content skeleton — for loading within a tab/section */
export function InlineSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} className={`h-3 ${i % 3 === 2 ? "w-1/2" : "w-full"}`} />
      ))}
    </div>
  )
}
