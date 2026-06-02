import ArtistDiscoveryCard, { type DiscoveryArtist } from "./ArtistDiscoveryCard"
import Link from "next/link"

type Props = {
  label: string
  labelColor: string
  filterParam: "rising-stars" | "spotlight"
  items: DiscoveryArtist[]
  total: number
}

export default function ArtistScrollRow({ label, labelColor, filterParam, items, total }: Props) {
  if (items.length === 0) return null

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-2.5 px-4">
        <span
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: labelColor }}
        >
          {label}
        </span>
        <Link
          href={`/search?filter=${filterParam}`}
          className="text-[10px] text-white/35 hover:text-white/60 transition-colors"
        >
          See all →
        </Link>
      </div>

      {/* Scrollable row */}
      <div
        className="flex gap-2.5 px-4 pb-1 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((artist) => (
          <ArtistDiscoveryCard key={artist.id} artist={artist} />
        ))}
        {/* See all ghost card */}
        {total > items.length && (
          <Link
            href={`/search?filter=${filterParam}`}
            className="flex-shrink-0 w-[72px] flex flex-col items-center"
          >
            <div
              className="flex items-center justify-center mb-1.5"
              style={{
                width: 72,
                height: 88,
                borderRadius: 12,
                border: "1px dashed rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <span className="text-[9px] text-white/30 text-center leading-tight">
                See<br />all →
              </span>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
