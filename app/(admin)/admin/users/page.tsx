"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

export default function AdminUsersPage() {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const { data: users, isLoading } = trpc.admin.listUsers.useQuery({ query: debouncedQuery || undefined })

  return (
    <div>
      <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Users</h1>
      <input
        type="text"
        value={query}
        onChange={e => {
          const value = e.target.value
          setQuery(value)
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => setDebouncedQuery(value), 300)
        }}
        placeholder="Search by username or email…"
        style={{
          width: "100%", padding: "10px 14px", borderRadius: 10, marginBottom: 16,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
          color: "white", fontSize: 14, outline: "none", boxSizing: "border-box",
        }}
      />
      {isLoading ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {users?.map(u => (
            <button
              key={u.id}
              onClick={() => router.push(`/admin/users/${u.id}`)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 10, textAlign: "left",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
              }}
            >
              <div>
                <span style={{ color: "white", fontSize: 14, fontWeight: 600 }}>@{u.username ?? "—"}</span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginLeft: 8 }}>{u.email}</span>
                {u.isAdmin && <span style={{ color: "#facc15", fontSize: 11, marginLeft: 8, fontWeight: 700 }}>ADMIN</span>}
                {u.isModerator && <span style={{ color: "#60a5fa", fontSize: 11, marginLeft: 8, fontWeight: 700 }}>MOD</span>}
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {u.bannedUntil && new Date(u.bannedUntil) > new Date() && (
                  <span style={{ color: "#f87171", fontSize: 11, fontWeight: 700 }}>BANNED</span>
                )}
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{u._count.receivedStrikes} strikes</span>
              </div>
            </button>
          ))}
          {users?.length === 0 && (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No users found.</p>
          )}
        </div>
      )}
    </div>
  )
}
