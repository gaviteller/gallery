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

type SortBy = "default" | "top" | "new" | "affordable"

const FILTER_CHIPS: { label: string; value: SortBy }[] = [
  { label: "Top Rated", value: "top" },
  { label: "Hidden Gems", value: "new" },
  { label: "Affordable", value: "affordable" },
]

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
  const [sortBy, setSortBy] = useState<SortBy>("default")
  const [requestTarget, setRequestTarget] = useState<DiscoveryUser | null>(null)
  const { data: session } = useSession()
  const router = useRouter()

  const { data: artists, isLoading } = trpc.commission.getDiscovery.useQuery({
    search: search.trim() || undefined,
    sortBy: sortBy === "default" ? undefined : sortBy,
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
        {/* Search bar with avatar + filter icon */}
        <div className="px-3 pt-4 pb-2 flex items-center gap-2">
          {/* Avatar */}
          <button
            onClick={() => session ? router.push("/profile") : router.push("/signin")}
            className="flex-shrink-0"
          >
            {session?.user?.image ? (
              <img src={session.user.image} className="w-8 h-8 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </button>

          {/* Search input */}
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search artists…"
              className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Filter icon */}
          <button className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
          </button>
        </div>

        {/* Horizontal filter chips */}
        <div className="flex gap-2 px-3 pb-3 overflow-x-auto scrollbar-none">
          {FILTER_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => setSortBy(prev => prev === chip.value ? "default" : chip.value)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                sortBy === chip.value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
              }`}
            >
              {chip.label}
            </button>
          ))}
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
