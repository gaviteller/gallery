"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { trpc } from "@/components/providers"

const ART_STYLES = [
  "Fantasy", "Anime", "Dark Art", "Portrait", "Concept Art",
  "Pixel Art", "Illustration", "Surreal", "Watercolor", "Sci-Fi",
  "Abstract", "Manga",
]

function Dots({ total, active }: { total: number; active: number }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", paddingTop: 14 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={i === active ? {
          width: 16, height: 5, borderRadius: 3,
          background: "linear-gradient(90deg, #FF3CAC, #2B86C5)",
        } : {
          width: 5, height: 5, borderRadius: "50%",
          background: "var(--border)",
        }} />
      ))}
    </div>
  )
}

type Step = "loading" | "username" | "welcome" | "role" | "styles" | "follow"

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, update, status } = useSession()
  const [step, setStep] = useState<Step>("loading")

  // username step (OAuth users)
  const [username, setUsername] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // role step
  const [role, setRole] = useState<"artist" | "collector" | null>(null)

  // styles step
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set())

  // follow step
  const [following, setFollowing] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
    if (status === "authenticated") {
      setStep(session?.user?.username ? "welcome" : "username")
    }
  }, [status, session?.user?.username, router])

  const { data: usernameCheck, isFetching: checkingUsername } = trpc.user.checkUsername.useQuery(
    { username },
    { enabled: username.length >= 3 }
  )
  const usernameValid = /^[a-zA-Z0-9_]+$/.test(username) && username.length >= 3 && username.length <= 30
  const usernameAvailable = usernameValid && usernameCheck?.available === true

  const changeUsername = trpc.user.changeUsername.useMutation({
    onSuccess: async () => { await update(); setStep("welcome") },
  })

  const completeOnboarding = trpc.user.completeOnboarding.useMutation({
    onSuccess: async () => { await update(); router.push("/") },
  })

  const followMutation = trpc.follow.follow.useMutation()

  const { data: risingStars } = trpc.discovery.risingStars.useQuery({}, {
    enabled: step === "follow",
  })
  const suggestedArtists = risingStars?.items

  function toggleStyle(s: string) {
    setSelectedStyles(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s); else next.add(s)
      return next
    })
  }

  function handleFollow(userId: string, username: string | null) {
    if (following.has(userId) || !username) return
    setFollowing(prev => new Set(prev).add(userId))
    followMutation.mutate({ username })
  }

  // gradient border style for selected cards
  const selectedCardStyle: React.CSSProperties = {
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "transparent",
    backgroundImage: "linear-gradient(var(--surface), var(--surface)), linear-gradient(90deg, #FF3CAC, #2B86C5)",
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
    background: "var(--surface)",
  }
  const unselectedCardStyle: React.CSSProperties = {
    border: "1.5px solid var(--border)",
    background: "transparent",
  }

  const gradBtn: React.CSSProperties = {
    width: "100%", padding: "12px 0", borderRadius: 10,
    background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)",
    color: "white", fontSize: 13, fontWeight: 600,
    border: "none", cursor: "pointer",
  }

  // ── LOADING ──
  if (step === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--border)", borderTopColor: "#784BA0" }} />
      </div>
    )
  }

  // ── USERNAME (OAuth users only) ──
  if (step === "username") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", background: "var(--bg)" }}>
        <div style={{ width: "100%", maxWidth: 400, background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "32px 24px" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--text)", textAlign: "center", marginBottom: 6 }}>One last thing</div>
          <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginBottom: 24 }}>Pick a username for your Gallery profile</div>

          <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
            <span style={{ padding: "10px 0 10px 12px", fontSize: 12, color: "rgba(240,235,248,0.3)" }}>@</span>
            <input
              type="text"
              placeholder="username"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              maxLength={30}
              style={{ flex: 1, background: "transparent", border: "none", padding: "10px 12px 10px 4px", fontSize: 12, color: "var(--text)", outline: "none", fontFamily: "Inter, sans-serif" }}
            />
            {username.length >= 3 && (
              <span style={{ paddingRight: 10, fontSize: 11, color: checkingUsername ? "var(--muted)" : usernameAvailable ? "#48C878" : "#f87171" }}>
                {checkingUsername ? "…" : usernameAvailable ? "✓" : "✗"}
              </span>
            )}
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 20 }}>
            <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} style={{ marginTop: 2, accentColor: "#784BA0" }} />
            <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
              I agree to Gallery's{" "}
              <Link href="/terms" target="_blank" style={{ color: "#2B86C5", textDecoration: "underline" }}>Terms of Service</Link>
              . I confirm I am at least 13 years old.
            </span>
          </label>

          {changeUsername.error && (
            <div style={{ fontSize: 11, color: "#f87171", textAlign: "center", marginBottom: 12 }}>{changeUsername.error.message}</div>
          )}

          <button
            onClick={() => changeUsername.mutate({ username })}
            disabled={!usernameAvailable || !agreedToTerms || changeUsername.isPending}
            style={{ ...gradBtn, opacity: !usernameAvailable || !agreedToTerms ? 0.4 : 1 }}
          >
            {changeUsername.isPending ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    )
  }

  // ── SCREEN 1: WELCOME ──
  if (step === "welcome") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #1A1030 0%, var(--bg) 55%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <Dots total={4} active={0} />
          <div style={{ textAlign: "center", padding: "32px 0 0" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 700, letterSpacing: "0.08em", background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: 10 }}>
              Gallery
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 26 }}>
              Art that moves you.<br />A home for artists and collectors.
            </div>

            {/* Art strip */}
            <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
              <div style={{ flex: 1, height: 90, borderRadius: 7, background: "linear-gradient(135deg, #2A1838, #3A2050)" }} />
              <div style={{ flex: 1, height: 90, borderRadius: 7, background: "linear-gradient(135deg, #1E2838, #2A3858)" }} />
              <div style={{ flex: 1, height: 90, borderRadius: 7, background: "linear-gradient(135deg, #2A1818, #3A2028)" }} />
              <div style={{ flex: 1, height: 90, borderRadius: 7, background: "linear-gradient(135deg, #181E28, #283040)" }} />
            </div>

            <button onClick={() => setStep("role")} style={gradBtn}>Get started</button>
            <Link
              href="/signin"
              style={{ display: "block", marginTop: 10, padding: "11px 0", borderRadius: 10, border: "1px solid var(--border)", color: "var(--muted)", fontSize: 13, fontWeight: 500, textAlign: "center", textDecoration: "none" }}
            >
              I have an account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── SCREEN 2: ROLE ──
  if (step === "role") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <Dots total={4} active={1} />
          <div style={{ paddingTop: 28 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "var(--text)", lineHeight: 1.2, marginBottom: 6 }}>
              What brings<br />you here?
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 22 }}>You can always change this later.</div>

            <button
              onClick={() => setRole("artist")}
              style={{ width: "100%", textAlign: "left", padding: "16px", borderRadius: 10, marginBottom: 12, cursor: "pointer", ...(role === "artist" ? selectedCardStyle : unselectedCardStyle) }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>🎨</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>I'm an Artist</div>
              <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>Share your work, take commissions, sell prints and digital files.</div>
            </button>

            <button
              onClick={() => setRole("collector")}
              style={{ width: "100%", textAlign: "left", padding: "16px", borderRadius: 10, marginBottom: 24, cursor: "pointer", ...(role === "collector" ? selectedCardStyle : unselectedCardStyle) }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>✦</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>I'm a Collector</div>
              <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>Discover new artists, follow their work, buy pieces you love.</div>
            </button>

            <button
              onClick={() => role && setStep("styles")}
              disabled={!role}
              style={{ ...gradBtn, opacity: role ? 1 : 0.4, cursor: role ? "pointer" : "not-allowed" }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── SCREEN 3: STYLES ──
  if (step === "styles") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <Dots total={4} active={2} />
          <div style={{ paddingTop: 28 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "var(--text)", lineHeight: 1.2, marginBottom: 6 }}>
              What styles<br />speak to you?
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 18 }}>Pick as many as you like.</div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {ART_STYLES.map(s => {
                const on = selectedStyles.has(s)
                return (
                  <button
                    key={s}
                    onClick={() => toggleStyle(s)}
                    style={{
                      fontSize: 11, fontWeight: 500, padding: "6px 14px",
                      borderRadius: 99, cursor: "pointer",
                      ...(on ? {
                        borderWidth: "1px", borderStyle: "solid", borderColor: "transparent",
                        backgroundImage: "linear-gradient(var(--bg), var(--bg)), linear-gradient(90deg, #FF3CAC, #2B86C5)",
                        backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box",
                        background: "var(--bg)", color: "var(--text)",
                      } : {
                        border: "1px solid var(--border)", background: "transparent", color: "var(--muted)",
                      }),
                    }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>

            {selectedStyles.size > 0 && (
              <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginBottom: 16 }}>
                {selectedStyles.size} selected
              </div>
            )}

            <button onClick={() => setStep("follow")} style={gradBtn}>Continue</button>
          </div>
        </div>
      </div>
    )
  }

  // ── SCREEN 4: FOLLOW ──
  const artists = suggestedArtists?.slice(0, 5) ?? []

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <Dots total={4} active={3} />
        <div style={{ paddingTop: 28 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "var(--text)", lineHeight: 1.2, marginBottom: 6 }}>
            Artists you<br />might love
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 20 }}>Based on your taste.</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
            {artists.length === 0 ? (
              // placeholders while loading
              Array.from({ length: 4 }, (_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--border)", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: 100, height: 10, borderRadius: 5, background: "var(--border)", marginBottom: 5 }} />
                    <div style={{ width: 70, height: 8, borderRadius: 5, background: "var(--border)" }} />
                  </div>
                  <div style={{ width: 60, height: 28, borderRadius: 6, background: "var(--border)" }} />
                </div>
              ))
            ) : (
              artists.map(a => {
                const isFollowing = following.has(a.id)
                return (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* gradient ring avatar */}
                    <Link href={`/@${a.username}`} style={{ padding: 2, background: "linear-gradient(135deg, #FF3CAC, #784BA0, #2B86C5)", borderRadius: "50%", flexShrink: 0, display: "block" }}>
                      {a.image ? (
                        <img src={a.image} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700 }}>
                          {(a.name ?? a.username ?? "?")[0].toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.name ?? a.username}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>@{a.username}</div>
                    </div>
                    <button
                      onClick={() => handleFollow(a.id, a.username)}
                      style={{
                        fontSize: 10, fontWeight: 600, padding: "5px 12px", borderRadius: 6, flexShrink: 0, cursor: "pointer",
                        ...(isFollowing
                          ? { background: "linear-gradient(90deg, #FF3CAC, #784BA0, #2B86C5)", color: "white", border: "none" }
                          : { background: "transparent", color: "var(--muted)", border: "1px solid var(--border)" }),
                      }}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {completeOnboarding.error && (
            <div style={{ fontSize: 11, color: "#f87171", textAlign: "center", marginBottom: 12 }}>{completeOnboarding.error.message}</div>
          )}

          <button
            onClick={() => completeOnboarding.mutate({ sellingEnabled: role === "artist" })}
            disabled={completeOnboarding.isPending}
            style={{ ...gradBtn, opacity: completeOnboarding.isPending ? 0.5 : 1 }}
          >
            {completeOnboarding.isPending ? "Setting up…" : "Enter Gallery →"}
          </button>
        </div>
      </div>
    </div>
  )
}
