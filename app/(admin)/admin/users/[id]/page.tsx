"use client"

import { use, useState } from "react"
import { trpc } from "@/components/providers"
import { useSession } from "next-auth/react"

const LEVEL_COLORS: Record<string, string> = {
  MINOR: "#facc15",
  MODERATE: "#fb923c",
  SEVERE: "#f87171",
  ZERO_TOLERANCE: "#dc2626",
}

const ALL_VIOLATIONS = [
  "ARTIST_CANCEL", "FAKE_DELIVERY", "FALSE_ADVERTISING", "BAIT_AND_SWITCH",
  "OFF_PLATFORM_PAYMENT", "COMMISSION_FARMING", "SHOP_FALSE_ADVERTISING",
  "UNLABELLED_AI", "GORE", "HARASSMENT", "HATE_SPEECH", "SPAM",
  "DMCA_VIOLATION", "FTC_DISCLOSURE", "NCMEC_VIOLATION",
  "CHARGEBACK_FRAUD", "ZERO_TOLERANCE_CONDUCT",
]

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const { data: user, refetch } = trpc.admin.getUser.useQuery({ userId: id })

  const [showBanModal, setShowBanModal] = useState(false)
  const [banDuration, setBanDuration] = useState<"3d" | "14d" | "30d" | "permanent">("3d")
  const [banReason, setBanReason] = useState("")

  const [showStrikeModal, setShowStrikeModal] = useState(false)
  const [strikeLevel, setStrikeLevel] = useState<"MINOR" | "MODERATE" | "SEVERE" | "ZERO_TOLERANCE">("MINOR")
  const [strikeViolation, setStrikeViolation] = useState("SPAM")
  const [strikeContentId, setStrikeContentId] = useState("")
  const [strikeContentType, setStrikeContentType] = useState("")
  const [strikeNotes, setStrikeNotes] = useState("")

  const issueBan = trpc.admin.issueBan.useMutation({ onSuccess: () => { refetch(); setShowBanModal(false); setBanReason("") } })
  const liftBan = trpc.admin.liftBan.useMutation({ onSuccess: () => refetch() })
  const issueStrike = trpc.admin.issueStrike.useMutation({ onSuccess: () => { refetch(); setShowStrikeModal(false) } })
  const setModerator = trpc.admin.setModerator.useMutation({ onSuccess: () => refetch() })

  const me = session?.user

  if (!user) return <div style={{ color: "rgba(255,255,255,0.4)", padding: 24 }}>Loading…</div>

  const isBanned = user.bannedUntil && new Date(user.bannedUntil) > new Date()
  const isPermanent = user.bannedUntil && new Date(user.bannedUntil).getFullYear() >= 9999

  const MINOR_COUNT = user.receivedStrikes.filter(s => s.level === "MINOR" && !s.reversed).length
  const MODERATE_COUNT = user.receivedStrikes.filter(s => s.level === "MODERATE" && !s.reversed).length
  const SEVERE_COUNT = user.receivedStrikes.filter(s => s.level === "SEVERE" && !s.reversed).length

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: 700 }}>@{user.username ?? "—"}</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{user.email}</p>
        </div>
        {/* Admin only: mod toggle */}
        {me?.isAdmin && !user.isAdmin && (
          <button
            onClick={() => setModerator.mutate({ userId: user.id, isModerator: !user.isModerator })}
            disabled={setModerator.isPending}
            style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: user.isModerator ? "rgba(255,255,255,0.1)" : "rgba(96,165,250,0.2)",
              border: `1px solid ${user.isModerator ? "rgba(255,255,255,0.2)" : "rgba(96,165,250,0.4)"}`,
              color: user.isModerator ? "rgba(255,255,255,0.6)" : "#60a5fa", cursor: "pointer",
            }}
          >
            {user.isModerator ? "Remove Moderator" : "Make Moderator"}
          </button>
        )}
      </div>

      {/* Strike summary */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Strike Summary</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[["Minor", MINOR_COUNT, "#facc15", "6 = 3d ban"], ["Moderate", MODERATE_COUNT, "#fb923c", "4 = 14d ban"], ["Severe", SEVERE_COUNT, "#f87171", "1 = 30d ban / 2 = permanent"]].map(([label, count, color, threshold]) => (
            <div key={label as string}>
              <span style={{ color: color as string, fontSize: 20, fontWeight: 700 }}>{count as number}</span>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginLeft: 4 }}>{label as string}</span>
              {(count as number) >= (label === "Minor" ? 6 : label === "Moderate" ? 4 : 1) && (
                <span style={{ color: "#f87171", fontSize: 11, marginLeft: 6 }}>⚠ {threshold as string}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Ban status */}
      <div style={{ background: isBanned ? "rgba(127,29,29,0.3)" : "rgba(255,255,255,0.04)", border: `1px solid ${isBanned ? "rgba(153,27,27,0.5)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Ban Status</p>
          {isBanned ? (
            <p style={{ color: "#f87171", fontSize: 14, fontWeight: 600 }}>
              {isPermanent ? "Permanently banned" : `Banned until ${new Date(user.bannedUntil!).toLocaleDateString()}`}
            </p>
          ) : (
            <p style={{ color: "#4ade80", fontSize: 14 }}>Not banned</p>
          )}
          {user.banReason && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>{user.banReason}</p>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isBanned ? (
            <button onClick={() => liftBan.mutate({ userId: user.id })} disabled={liftBan.isPending}
              style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", cursor: "pointer" }}>
              Lift Ban
            </button>
          ) : (
            <button onClick={() => setShowBanModal(true)}
              style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", cursor: "pointer" }}>
              Issue Ban
            </button>
          )}
          <button onClick={() => setShowStrikeModal(true)}
            style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", color: "#facc15", cursor: "pointer" }}>
            Issue Strike
          </button>
        </div>
      </div>

      {/* Strike history */}
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Strike History</p>
      {user.receivedStrikes.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No strikes.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {user.receivedStrikes.map(s => (
            <div key={s.id} style={{ padding: "10px 12px", borderRadius: 10, background: s.reversed ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", opacity: s.reversed ? 0.5 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ color: LEVEL_COLORS[s.level] ?? "white", fontSize: 12, fontWeight: 700 }}>{s.level}</span>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginLeft: 8 }}>{s.violation.replace(/_/g, " ")}</span>
                  {s.reversed && <span style={{ color: "rgba(74,222,128,0.7)", fontSize: 11, marginLeft: 8 }}>REVERSED</span>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>by @{s.issuedBy.username ?? "—"}</p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              {s.notes && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>{s.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Ban modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowBanModal(false)}>
          <div style={{ background: "#1e0d3f", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "white", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Issue Ban</h3>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 12 }}>Duration</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {(["3d", "14d", "30d", "permanent"] as const).map(d => (
                <button key={d} onClick={() => setBanDuration(d)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: banDuration === d ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${banDuration === d ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)"}`, color: banDuration === d ? "#f87171" : "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                  {d === "permanent" ? "Permanent" : d}
                </button>
              ))}
            </div>
            <textarea value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Reason (shown to user)…" rows={3} style={{ width: "100%", borderRadius: 10, padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowBanModal(false)} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => issueBan.mutate({ userId: user.id, duration: banDuration, reason: banReason })} disabled={issueBan.isPending || !banReason.trim()} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#dc2626", color: "white", border: "none", cursor: "pointer", opacity: !banReason.trim() ? 0.5 : 1 }}>
                {issueBan.isPending ? "Issuing…" : "Issue Ban"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strike modal */}
      {showStrikeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowStrikeModal(false)}>
          <div style={{ background: "#1e0d3f", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "white", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Issue Strike</h3>
            <div style={{ marginBottom: 12 }}>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 6 }}>Level</p>
              <select value={strikeLevel} onChange={e => setStrikeLevel(e.target.value as any)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, outline: "none" }}>
                {["MINOR", "MODERATE", "SEVERE", "ZERO_TOLERANCE"].map(l => <option key={l} value={l} style={{ background: "#1e0d3f" }}>{l}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 6 }}>Violation</p>
              <select value={strikeViolation} onChange={e => setStrikeViolation(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, outline: "none" }}>
                {ALL_VIOLATIONS.map(v => <option key={v} value={v} style={{ background: "#1e0d3f" }}>{v.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <input value={strikeContentId} onChange={e => setStrikeContentId(e.target.value)} placeholder="Content ID (optional)" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
            <select value={strikeContentType} onChange={e => setStrikeContentType(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, outline: "none", marginBottom: 8 }}>
              <option value="" style={{ background: "#1e0d3f" }}>Content type (optional)</option>
              <option value="post" style={{ background: "#1e0d3f" }}>Post</option>
              <option value="commission" style={{ background: "#1e0d3f" }}>Commission</option>
              <option value="shop_item" style={{ background: "#1e0d3f" }}>Shop item</option>
            </select>
            <textarea value={strikeNotes} onChange={e => setStrikeNotes(e.target.value)} placeholder="Internal notes (optional)…" rows={2} style={{ width: "100%", borderRadius: 8, padding: "8px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowStrikeModal(false)} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => issueStrike.mutate({ userId: user.id, level: strikeLevel, violation: strikeViolation as any, contentId: strikeContentId || undefined, contentType: strikeContentType as any || undefined, notes: strikeNotes || undefined })} disabled={issueStrike.isPending} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#facc15", color: "#0D0D0F", border: "none", cursor: "pointer" }}>
                {issueStrike.isPending ? "Issuing…" : "Issue Strike"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
