"use client"
import { useState } from "react"
import { trpc } from "@/components/providers"
import ArtistDiscoveryCard from "./ArtistDiscoveryCard"

type Filter = "rising-stars" | "spotlight"

export default function FilteredArtistList({ filter }: { filter: Filter }) {
  const [limit, setLimit] = useState(20)

  // Both hooks must always be called — React rules of hooks
  const risingData = trpc.discovery.risingStars.useQuery(
    { limit },
    { enabled: filter === "rising-stars" }
  )
  const spotlightData = trpc.discovery.spotlight.useQuery(
    { limit },
    { enabled: filter === "spotlight" }
  )

  const data = filter === "rising-stars" ? risingData.data : spotlightData.data
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const isLoading = filter === "rising-stars" ? risingData.isLoading : spotlightData.isLoading

  if (!isLoading && items.length === 0) {
    return (
      <p className="text-sm text-white/40 text-center mt-12">
        No artists found yet.
      </p>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 px-4">
        {items.map((artist) => (
          <ArtistDiscoveryCard key={artist.id} artist={artist} />
        ))}
      </div>

      {items.length < total && limit < 50 && (
        <button
          onClick={() => setLimit(l => Math.min(l + 20, 50))}
          className="w-full py-2.5 mt-4 text-xs font-semibold text-white/40 hover:text-white/70 transition-colors rounded-xl"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Load more
        </button>
      )}
    </div>
  )
}
