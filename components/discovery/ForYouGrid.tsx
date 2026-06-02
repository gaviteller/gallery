"use client"
import Link from "next/link"
import { useState } from "react"
import { trpc } from "@/components/providers"

export default function ForYouGrid() {
  const [limit, setLimit] = useState(9)
  const { data } = trpc.discovery.forYou.useQuery({ limit })

  const items = data?.items ?? []
  if (items.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5 px-4">
        <span
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: "rgba(0,180,238,0.9)" }}
        >
          ❤ You Might Like
        </span>
      </div>

      <div className="grid grid-cols-3 gap-0.5 px-4">
        {items.map((post) => (
          <Link
            key={post.id}
            href={post.user.username ? `/@${post.user.username}` : "#"}
            className="aspect-square rounded-md overflow-hidden relative"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <img
              src={post.image}
              alt={post.description ?? ""}
              className="w-full h-full object-cover"
            />
          </Link>
        ))}
      </div>

      {items.length === limit && (
        <button
          onClick={() => setLimit(l => l + 9)}
          className="w-full py-2.5 mt-3 text-xs font-semibold text-white/40 hover:text-white/70 transition-colors"
        >
          Load more
        </button>
      )}
    </div>
  )
}
