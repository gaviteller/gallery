import Link from "next/link"
import Avatar from "@/components/Avatar"

export type DiscoveryArtist = {
  id: string
  username: string | null
  name: string | null
  image: string | null
  commissionStatus: "OPEN" | "LIMITED" | "CLOSED"
  followerCount: number
}

export default function ArtistDiscoveryCard({ artist }: { artist: DiscoveryArtist }) {
  if (!artist.username) return null

  function formatFollowers(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  return (
    <Link
      href={`/@${artist.username}`}
      className="flex-shrink-0 w-[72px] text-center focus:outline-none"
    >
      {/* Card */}
      <div
        className="relative overflow-hidden mb-1.5"
        style={{
          width: 72,
          height: 88,
          borderRadius: 12,
          background: "#141414",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Top area: avatar */}
        <div className="absolute top-0 left-0 w-full" style={{ height: 60 }}>
          <Avatar
            src={artist.image}
            name={artist.name}
            username={artist.username}
            size={72}
          />
        </div>
        {/* Bottom label */}
        <div
          className="absolute bottom-0 left-0 w-full flex items-center justify-center"
          style={{ height: 28, background: "rgba(0,0,0,0.65)" }}
        >
          <span
            className="text-[9px] text-white/80 truncate px-1"
            style={{ maxWidth: 64 }}
          >
            @{artist.username}
          </span>
        </div>
      </div>
      {/* Follower count */}
      <span className="text-[8px] text-white/40">
        {formatFollowers(artist.followerCount)} followers
      </span>
    </Link>
  )
}
