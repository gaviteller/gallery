"use client"
/**
 * ONBOARDING (Codex redesign). Styling: app/redesign/onboarding.css (generated).
 * Steps: 1 username (only for Google sign-ups without one) / welcome, 2 role, 3 interests, 4 follow artists.
 * Saves via user.changeUsername and user.completeOnboarding({ sellingEnabled }); follows are real.
 */
import "../redesign/onboarding.css"
import "../redesign/shell.css"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { AtSign, CheckCircle2, LoaderCircle, AlertCircle, Sparkles, Users, Paintbrush, ArrowRight, ArrowLeft, ShieldCheck, Check, Plus, Castle, Moon, UserRound, Mountain, Grid2X2, PenTool, Orbit, Flower2, Rocket, Shapes, BookOpen } from "lucide-react"
import { trpc } from "@/components/providers"
import GalleryLogo from "@/components/redesign/GalleryLogo"
import GalleryPaintDrips from "@/components/redesign/GalleryPaintDrips"
import { galleryThemes, getActiveTheme } from "@/components/redesign/galleryThemes"
import { Avatar } from "@/components/redesign/RedesignShell"

const INTERESTS = [
  ["Fantasy", Castle], ["Anime", Sparkles], ["Dark Art", Moon], ["Portrait", UserRound], ["Concept Art", Mountain], ["Pixel Art", Grid2X2],
  ["Illustration", PenTool], ["Surreal", Orbit], ["Watercolor", Flower2], ["Sci-Fi", Rocket], ["Abstract", Shapes], ["Manga", BookOpen],
] as const
const STAGES = ["Identity", "Role", "Interests", "Artists"]

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, update, status } = useSession()
  const [theme, setTheme] = useState(galleryThemes[0])
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [role, setRole] = useState<"artist" | "collector" | null>(null)
  const [interests, setInterests] = useState<string[]>([])
  const [following, setFollowing] = useState<string[]>([])
  const [pending, setPending] = useState<string[]>([])
  const [error, setError] = useState("")

  useEffect(() => { setTheme(getActiveTheme()) }, [])
  useEffect(() => { if (status === "unauthenticated") router.push("/signin") }, [status, router])
  const hasUsername = !!session?.user?.username

  const usernameValid = /^[a-zA-Z0-9_]{3,30}$/.test(username)
  const { data: usernameCheck, isFetching: checkingUsername } = trpc.user.checkUsername.useQuery({ username }, { enabled: !hasUsername && usernameValid })
  const usernameStatus = !usernameValid ? "idle" : checkingUsername ? "checking" : usernameCheck?.available ? "available" : usernameCheck ? "unavailable" : "idle"

  const changeUsername = trpc.user.changeUsername.useMutation({ onSuccess: async () => { await update(); setStep(2) }, onError: (e) => setError(e.message) })
  const completeOnboarding = trpc.user.completeOnboarding.useMutation({ onSuccess: async () => { await update(); router.push("/") }, onError: (e) => setError(e.message) })
  const followMutation = trpc.follow.follow.useMutation()
  const unfollowMutation = trpc.follow.unfollow.useMutation()
  const { data: risingStars, isLoading: artistsLoading } = trpc.discovery.risingStars.useQuery({}, { enabled: step === 4 })
  const artists = risingStars?.items.slice(0, 6) ?? []

  async function toggleFollow(id: string, handle: string | null) {
    if (!handle || pending.includes(id)) return
    const shouldFollow = !following.includes(id)
    setPending((v) => [...v, id]); setError("")
    try {
      if (shouldFollow) await followMutation.mutateAsync({ username: handle })
      else await unfollowMutation.mutateAsync({ username: handle })
      setFollowing((v) => shouldFollow ? [...v, id] : v.filter((x) => x !== id))
    } catch { setError("We couldn’t update this follow. Please try again.") }
    finally { setPending((v) => v.filter((x) => x !== id)) }
  }

  const saving = changeUsername.isPending || completeOnboarding.isPending
  function next() {
    setError("")
    if (step === 1) { if (hasUsername) setStep(2); else changeUsername.mutate({ username }) }
    else if (step === 2 && role) setStep(3)
    else if (step === 3) setStep(4)
    else if (step === 4) completeOnboarding.mutate({ sellingEnabled: role === "artist" })
  }
  const invalid = step === 1 ? !hasUsername && (usernameStatus !== "available" || !agreedToTerms) : step === 2 ? !role : step === 4 && pending.length > 0

  if (status !== "authenticated") {
    return <div className="gx gx-onboarding"><main className="onboarding-main"><div className="loading-panel" role="status"><LoaderCircle className="spinner" size={24} />Getting your Gallery ready…</div></main></div>
  }

  const heading = step === 1 ? (hasUsername ? "Welcome to Gallery." : "Choose your Gallery name.") : step === 2 ? "What brings you here?" : step === 3 ? "What kind of art inspires you?" : "Start with artists you’ll love."
  const sub = step === 1 ? (hasUsername ? "Let’s personalize what you discover first." : "This is how artists and collectors will find you.") : step === 2 ? "You can always change this later." : step === 3 ? "Pick as many as you like." : "Follow a few creators to bring your new feed to life."
  const reassurance = step === 1 ? (hasUsername ? "A few small choices. A more personal Gallery." : "Your username must be unique.") : step === 2 ? "You can update this later in Settings." : step === 3 ? "A little inspiration, picked by you." : "You can discover and follow more artists anytime."

  return (
    <div className="gx gx-onboarding">
      <header className="onboarding-header">
        <GalleryPaintDrips theme={theme} />
        <Link href="/" className="gallery-brand" aria-label="Gallery"><GalleryLogo theme={theme} /></Link>
        <span className="header-note">A little setup. A world of possibility.</span>
      </header>
      <main className="onboarding-main">
        <section className="onboarding-panel">
          <div className="panel-top"><span>SET UP YOUR GALLERY</span><span>STEP {step} OF 4</span></div>
          <ol className="onboarding-progress" aria-label="Onboarding progress">
            {STAGES.map((name, i) => (
              <li className={i + 1 < step ? "complete" : i + 1 === step ? "current" : ""} key={name} aria-current={i + 1 === step ? "step" : undefined}>
                <span className="progress-marker">{i + 1 < step ? <Check size={15} /> : i + 1}</span><span>{name}</span>
              </li>
            ))}
          </ol>
          <div className="step-content" key={step}>
            <div className="step-heading"><h1>{heading}</h1><p>{sub}</p></div>

            {step === 1 && (hasUsername ? (
              <div className="welcome-benefits">
                {[{ icon: Sparkles, text: "A feed shaped around your interests" }, { icon: Users, text: "Artists selected for your taste" }, { icon: Paintbrush, text: "Tools that match how you use Gallery" }].map(({ icon: Icon, text }) => <div key={text}><span><Icon size={19} /></span><p>{text}</p></div>)}
              </div>
            ) : (
              <div className="identity-fields">
                <label htmlFor="username">Username</label>
                <div className={`username-input ${usernameStatus === "available" ? "valid" : ""}`}>
                  <AtSign size={20} />
                  <input id="username" value={username} autoComplete="username" maxLength={30} placeholder="your_gallery_name" aria-invalid={usernameStatus === "unavailable"} onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setError("") }} />
                  {usernameStatus === "checking" ? <LoaderCircle className="spinner" size={19} /> : usernameStatus === "available" ? <CheckCircle2 size={19} /> : null}
                </div>
                <div className="username-feedback">
                  <p>Letters, numbers, and underscores · 3–30 characters</p>
                  <span role="status" className={usernameStatus}>{usernameStatus === "checking" ? "Checking…" : usernameStatus === "available" ? "Available" : usernameStatus === "unavailable" ? "Already taken" : ""}</span>
                </div>
                <label className="identity-note" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                  <p>I agree to Gallery’s <Link href="/terms" target="_blank">Terms of Service</Link> and confirm I am at least 13 years old.</p>
                </label>
              </div>
            ))}

            {step === 2 && (
              <div className="role-grid" role="radiogroup" aria-label="How will you use Gallery?">
                {(["artist", "collector"] as const).map((r) => (
                  <button key={r} className={`role-card ${role === r ? "selected" : ""}`} role="radio" aria-checked={role === r} onClick={() => setRole(r)}>
                    <span className="selection-check">{role === r && <Check size={13} />}</span>
                    {r === "artist" ? <Paintbrush size={40} strokeWidth={1.4} /> : <Sparkles size={40} strokeWidth={1.4} />}
                    <strong>{r === "artist" ? "I’m an Artist" : "I’m a Collector"}</strong>
                    <p>{r === "artist" ? "Share your work, take commissions, and sell prints or digital files." : "Discover artists, follow their work, and collect pieces you love."}</p>
                  </button>
                ))}
              </div>
            )}

            {step === 3 && (
              <>
                <div className="interest-count" aria-live="polite"><span>{interests.length} selected</span><p>A little inspiration, picked by you</p></div>
                <div className="interests-grid">
                  {INTERESTS.map(([name, Icon]) => {
                    const on = interests.includes(name)
                    return <button key={name} className={`interest-card ${on ? "selected" : ""}`} aria-pressed={on} onClick={() => setInterests(on ? interests.filter((x) => x !== name) : [...interests, name])}><Icon size={21} /><span>{name}</span><i>{on && <Check size={12} />}</i></button>
                  })}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="artist-count"><span>{following.length} following</span><p>Rising artists on Gallery</p></div>
                <div className="artist-grid">
                  {artistsLoading && <div className="loading-panel" role="status"><LoaderCircle className="spinner" size={20} />Finding artists…</div>}
                  {!artistsLoading && artists.length === 0 && <p>No suggestions yet — you can find artists in Explore.</p>}
                  {artists.map((a) => {
                    const isFollowing = following.includes(a.id)
                    return (
                      <article key={a.id} className={`suggested-artist ${isFollowing ? "following" : ""}`}>
                        <Avatar src={a.image} name={a.name ?? a.username ?? "?"} className="" />
                        <div><strong>{a.name ?? a.username}</strong><span>@{a.username}</span></div>
                        <button className="follow-button" aria-pressed={isFollowing} disabled={pending.includes(a.id)} onClick={() => toggleFollow(a.id, a.username)}>
                          {pending.includes(a.id) ? <LoaderCircle size={13} className="spinner" /> : isFollowing ? <Check size={13} /> : <Plus size={13} />}<span>{isFollowing ? "Following" : "Follow"}</span>
                        </button>
                      </article>
                    )
                  })}
                </div>
              </>
            )}

            {error && <div className="inline-error" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}

            <div className="step-footer">
              <div className="step-actions">
                {step > 1 && <button className="back-button" onClick={() => setStep(step - 1)} disabled={saving}><ArrowLeft size={16} />Back</button>}
                <button className="continue-button" onClick={next} disabled={invalid || saving} aria-busy={saving}>
                  {saving ? <><LoaderCircle size={17} className="spinner" />Saving your Gallery…</> : <>{step === 4 ? "Enter Gallery" : step === 1 && hasUsername ? "Start Personalizing" : "Continue"}<ArrowRight size={17} /></>}
                </button>
              </div>
              <p>{reassurance}</p>
              {step === 4 && <button className="skip-button" disabled={saving} onClick={next}>Skip for now</button>}
            </div>
          </div>
        </section>
        <div className="onboarding-below"><p><ShieldCheck size={12} /> You can change all of this later in Settings.</p></div>
      </main>
    </div>
  )
}
