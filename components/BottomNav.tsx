"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useState } from "react"
import { trpc } from "@/components/providers"
import Link from "next/link"

function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("")
  const enabled = query.trim().length > 0
  const { data: users } = trpc.user.search.useQuery({ query }, { enabled })
  const { data: tags } = trpc.hashtag.search.useQuery({ query }, { enabled })
  const router = useRouter()

  const hasResults = (users && users.length > 0) || (tags && tags.length > 0)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people or #tags…"
            className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none"
          />
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-900">Cancel</button>
        </div>

        {hasResults ? (
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {/* Hashtags */}
            {tags && tags.length > 0 && (
              <>
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => { onClose(); router.push(`/hashtag/${tag.tag}`) }}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-bold flex-shrink-0">#</div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">#{tag.tag}</p>
                      <p className="text-xs text-gray-500">{tag._count.posts} {tag._count.posts === 1 ? "post" : "posts"}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
            {/* People */}
            {users && users.length > 0 && (
              <>
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => { onClose(); router.push(`/@${user.username}`) }}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    {user.image ? (
                      <img src={user.image} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold flex-shrink-0">
                        {(user.name ?? user.username ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">@{user.username}</p>
                      {user.name && <p className="text-xs text-gray-500">{user.name}</p>}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        ) : enabled ? (
          <p className="text-sm text-gray-400 text-center py-4">No results for &ldquo;{query}&rdquo;</p>
        ) : null}
      </div>
    </div>
  )
}

export default function BottomNav() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)

  if (status === "loading" || status === "unauthenticated") return null

  const username = session?.user?.username

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/")

  return (
    <>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-center justify-around px-2 h-16 safe-area-pb">
        {/* Feed */}
        <Link href="/" className={`flex flex-col items-center gap-1 px-4 py-2 ${pathname === "/" ? "text-gray-900" : "text-gray-400"}`}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span className="text-[10px] font-medium">Feed</span>
        </Link>

        {/* Shop */}
        <Link href="/shop" className={`flex flex-col items-center gap-1 px-4 py-2 ${isActive("/shop") ? "text-gray-900" : "text-gray-400"}`}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <span className="text-[10px] font-medium">Shop</span>
        </Link>

        {/* Search — center */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center justify-center w-12 h-12 bg-gray-900 rounded-full text-white shadow-lg -mt-4"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>

        {/* Commissions */}
        <Link href="/commissions" className={`flex flex-col items-center gap-1 px-4 py-2 ${isActive("/commissions") ? "text-gray-900" : "text-gray-400"}`}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          <span className="text-[10px] font-medium">Commissions</span>
        </Link>

        {/* Profile */}
        <Link href={username ? `/@${username}` : "/"} className={`flex flex-col items-center gap-1 px-4 py-2 ${username && isActive(`/@${username}`) ? "text-gray-900" : "text-gray-400"}`}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </nav>
    </>
  )
}
