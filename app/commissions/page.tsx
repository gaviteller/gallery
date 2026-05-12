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
    <div
      onClick={handleCardClick}
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:border-gray-300 hover:shadow-md transition-all"
    >
      {/* Photo grid */}
      <div className="aspect-square bg-gray-100 overflow-hidden">
        {photos.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-xs text-gray-400">No examples yet</p>
          </div>
        ) : photos.length === 1 ? (
          <img src={photos[0].image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full grid gap-0.5 ${photos.length >= 4 ? "grid-cols-2 grid-rows-2" : "grid-cols-2"}`}>
            {photos.slice(0, 4).map((p) => (
              <img key={p.id} src={p.image} alt="" className="w-full h-full object-cover" />
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-3 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-semibold text-gray-900 truncate">@{artist.username}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusBadge[artist.commissionStatus]}`}>
            {artist.commissionStatus === "LIMITED" ? "Limited" : "Open"}
          </span>
        </div>
        {artist.commissionDescription && (
          <p className="text-xs text-gray-500 leading-relaxed mb-1.5 line-clamp-2">{artist.commissionDescription}</p>
        )}
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs text-gray-400">{avgPrice(artist.priceRanges)}</p>
          {artist.commissionTurnaround && (
            <p className="text-xs text-gray-400">· {artist.commissionTurnaround}</p>
          )}
        </div>
        <button
          onClick={handleRequest}
          className="w-full py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Request commission
        </button>
      </div>
    </div>
  )
}

export default function CommissionsPage() {
  const [search, setSearch] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [requestTarget, setRequestTarget] = useState<DiscoveryUser | null>(null)

  const { data: artists, isLoading } = trpc.commission.getDiscovery.useQuery({
    search: search.trim() || undefined,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
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

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Commissions</h1>

        {/* Search + filters */}
        <div className="flex flex-col gap-2 mb-6">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by artist name or art style…"
            className="w-full px-4 py-3 bg-gray-100 rounded-xl text-sm text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
              placeholder="Min price ($)"
              min="0"
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              placeholder="Max price ($)"
              min="0"
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
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
          <div className="grid grid-cols-2 gap-3">
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
