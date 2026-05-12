"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { trpc } from "@/components/providers"
import CommissionRequestModal from "@/components/CommissionRequestModal"

type DiscoveryUser = {
  id: string
  username: string | null
  name: string | null
  image: string | null
  commissionStatus: "OPEN" | "LIMITED" | "CLOSED"
  commissionDescription: string | null
  commissionTurnaround: string | null
  priceRanges: { label: string; price: number }[] | null
  posts: { id: string; image: string }[]
  commissionCategories: { name: string; options: string[] }[]
}

const statusBadge = {
  OPEN: "bg-green-100 text-green-700",
  LIMITED: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-gray-100 text-gray-500",
}

function avgPrice(ranges: { label: string; price: number }[] | null): string {
  if (!ranges || ranges.length === 0) return "Price TBD"
  const avg = ranges.reduce((s, r) => s + r.price, 0) / ranges.length
  return `avg $${Math.round(avg)}`
}

function ArtistCard({
  artist,
  onRequest,
}: {
  artist: DiscoveryUser
  onRequest: (artist: DiscoveryUser) => void
}) {
  const router = useRouter()
  const { data: session } = useSession()
  function handleCardClick() {
    router.push(`/@${artist.username}?tab=Commissions`)
  }

  function handleRequest(e: React.MouseEvent) {
    e.stopPropagation()
    if (!session) { router.push("/signin"); return }
    onRequest(artist)
  }

  const photos = artist.posts.slice(0, 4)

  return (
    <div onClick={handleCardClick} className="cursor-pointer bg-white overflow-hidden">
      {/* Square image grid */}
      <div className="aspect-square bg-gray-100 overflow-hidden">
        {photos.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-xs text-gray-400">No examples</p>
          </div>
        ) : photos.length === 1 ? (
          <img src={photos[0].image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full grid gap-px ${photos.length >= 4 ? "grid-cols-2 grid-rows-2" : "grid-cols-2"}`}>
            {photos.slice(0, 4).map((p) => (
              <img key={p.id} src={p.image} alt="" className="w-full h-full object-cover" />
            ))}
          </div>
        )}
      </div>

      {/* Info row */}
      <div className="px-2 pt-2 pb-3">
        <div className="flex items-center gap-1.5 mb-1">
          {artist.image ? (
            <img src={artist.image} className="w-5 h-5 rounded-full object-cover flex-shrink-0" alt="" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-bold flex-shrink-0">
              {((artist.name ?? artist.username ?? "?")[0] ?? "?").toUpperCase()}
            </div>
          )}
          <p className="text-xs font-semibold text-gray-900 truncate flex-1">@{artist.username}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusBadge[artist.commissionStatus]}`}>
            {artist.commissionStatus === "LIMITED" ? "Limited" : "Open"}
          </span>
        </div>
        <p className="text-[10px] text-gray-400 mb-2">
          {avgPrice(artist.priceRanges)}{artist.commissionTurnaround ? ` · ${artist.commissionTurnaround}` : ""}
        </p>
        <button
          onClick={handleRequest}
          className="w-full py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Request
        </button>
      </div>
    </div>
  )
}

export default function CommissionsPage() {
  const [search, setSearch] = useState("")
  const [requestTarget, setRequestTarget] = useState<DiscoveryUser | null>(null)

  const { data: artists, isLoading } = trpc.commission.getDiscovery.useQuery({
    search: search.trim() || undefined,
  })

  return (
    <>
      {requestTarget && (
        <CommissionRequestModal
          artistId={requestTarget.id}
          artistUsername={requestTarget.username!}
          categories={requestTarget.commissionCategories}
          onClose={() => setRequestTarget(null)}
        />
      )}

      <div className="max-w-2xl mx-auto pb-24">
        {/* Search bar */}
        <div className="px-4 pt-4 pb-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search artists…"
            className="w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-400 text-sm">Loading artists…</p>
          </div>
        ) : !artists || artists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-gray-500 font-medium">No artists found</p>
            <p className="text-xs text-gray-400">
              {search ? "Try a different search term" : "No artists are currently open for commissions"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-px bg-gray-200">
            {artists.map(artist => (
              <ArtistCard
                key={artist.id}
                artist={artist as DiscoveryUser}
                onRequest={setRequestTarget}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
