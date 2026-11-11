"use client"
/**
 * Sign in / Sign up / Forgot password (Codex redesign) on the real auth system.
 * Styling: app/redesign/auth.css (generated). Left side shows real recent artwork
 * (discovery.forYou) as a spotlight carousel. Google button appears only when
 * Google sign-in is configured on the server.
 */
import "@/app/redesign/auth.css"
import "@/app/redesign/shell.css"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn, getProviders } from "next-auth/react"
import { Mail, ArrowRight, ArrowLeft, LoaderCircle, ShieldCheck, Paintbrush, Eye, EyeOff, LockKeyhole, UserRound, AtSign, CheckCircle2, XCircle, CalendarDays, Check, ArrowDown, KeyRound, AlertCircle, Sparkles, X, ArrowUpRight } from "lucide-react"
import { trpc } from "@/components/providers"
import TermsContent from "@/components/TermsContent"
import { isAtLeast13 } from "@/lib/age"
import GalleryLogo from "./GalleryLogo"
import GalleryPaintDrips from "./GalleryPaintDrips"
import { galleryThemes, getActiveTheme } from "./galleryThemes"
import { useAds, adStyle, AD_FONTS, AD_SIZES, type AdData } from "./AdCard"

type Mode = "signin" | "signup" | "forgot"
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AuthShell({ mode }: { mode: Mode }) {
  const [theme, setTheme] = useState(galleryThemes[0])
  const [googleEnabled, setGoogleEnabled] = useState(false)
  useEffect(() => {
    setTheme(getActiveTheme())
    getProviders().then((providers) => setGoogleEnabled(!!providers?.google)).catch(() => {})
  }, [])

  return (
    <div className="gx gx-auth">
      <header className="auth-header">
        <GalleryPaintDrips theme={theme} />
        <Link className="brand" href="/" aria-label="Gallery home"><GalleryLogo theme={theme} /></Link>
        <div className="header-note"><span />A home for every kind of artist.</div>
      </header>
      <main className={`auth-layout ${mode === "signup" ? "signup-layout" : ""}`}>
        <SpotlightCarousel />
        {mode === "signin" ? <SignInPanel googleEnabled={googleEnabled} /> : mode === "signup" ? <SignUpPanel googleEnabled={googleEnabled} /> : <ForgotPasswordPanel />}
      </main>
    </div>
  )
}

function StatusMessage({ kind, children }: { kind: "success" | "error"; children: React.ReactNode }) {
  const Icon = kind === "success" ? CheckCircle2 : AlertCircle
  return <div className={`status-message ${kind}`} role={kind === "error" ? "alert" : "status"}><Icon size={17} /><span>{children}</span></div>
}

function GoogleButton({ label, callbackUrl }: { label: string; callbackUrl: string }) {
  return (
    <>
      <button className="google-button" type="button" onClick={() => signIn("google", { callbackUrl })}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.3 2.9-7.5Z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.7A10.1 10.1 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.4 13.8a6 6 0 0 1 0-3.6V7.5H3a10 10 0 0 0 0 9l3.4-2.7Z" /><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10.1 10.1 0 0 0-9 5.5l3.4 2.7C7.2 7.8 9.4 6 12 6Z" /></svg>
        {label}
      </button>
      <div className="or-divider"><span />or<span /></div>
    </>
  )
}

function PasswordInput({ id, value, onChange, error, disabled, placeholder, autoComplete, icon = true }: {
  id: string; value: string; onChange: (v: string) => void; error?: string; disabled: boolean; placeholder: string; autoComplete: string; icon?: boolean
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={`input-wrap ${error ? "invalid" : ""}`}>
      {icon && <LockKeyhole size={16} />}
      <input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={!!error} />
      <button type="button" className="password-toggle" onClick={() => setVisible(!visible)} disabled={disabled} aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
    </div>
  )
}

function SignInPanel({ googleEnabled }: { googleEnabled: boolean }) {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"
  const justReset = searchParams.get("reset") === "success"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (loading) return
    const next: typeof errors = {}
    if (!EMAIL_PATTERN.test(email.trim())) next.email = "Enter a valid email address."
    if (!password) next.password = "Enter your password."
    setErrors(next)
    if (Object.keys(next).length) return
    setLoading(true)
    setFailed(false)
    const result = await signIn("credentials", { email: email.trim(), password, redirect: false })
    if (result?.error) { setFailed(true); setPassword(""); setLoading(false); return }
    window.location.href = callbackUrl
  }

  return (
    <aside className="signin-column">
      <div className="signin-panel">
        <span className="form-emblem"><Paintbrush size={22} /></span>
        <span className="panel-kicker">YOUR NEXT CHAPTER STARTS HERE</span>
        <h2>Sign in to Gallery</h2>
        <p className="form-tagline">ANYONE CAN BE AN ARTIST</p>
        {justReset && <StatusMessage kind="success">Password reset — sign in with your new password.</StatusMessage>}
        {googleEnabled && <GoogleButton label="Continue with Google" callbackUrl={callbackUrl} />}
        <form noValidate onSubmit={submit}>
          {failed && <StatusMessage kind="error">Email or password is incorrect.</StatusMessage>}
          <div className="field-group">
            <label htmlFor="email">Email address</label>
            <div className={`input-wrap ${errors.email ? "invalid" : ""}`}><Mail size={16} /><input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} disabled={loading} onChange={(e) => { setEmail(e.target.value); setErrors((v) => ({ ...v, email: undefined })) }} /></div>
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>
          <div className="field-group">
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" value={password} onChange={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })) }} error={errors.password} disabled={loading} placeholder="Enter your password" autoComplete="current-password" />
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>
          <Link className="forgot-link" href="/forgot-password">Forgot password?</Link>
          <button className="login-button" type="submit" disabled={loading} aria-busy={loading}>{loading ? <><LoaderCircle size={17} className="loading-spinner" />Signing in…</> : <>Log in<ArrowRight size={17} /></>}</button>
        </form>
        <p className="signup-copy">No account? <Link href="/signup">Sign up</Link></p>
      </div>
      <p className="signin-footnote"><ShieldCheck size={12} /> A little inspiration. A place to belong.</p>
    </aside>
  )
}

function SignUpPanel({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", username: "", password: "", dateOfBirth: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const usernameFormatOk = /^[a-zA-Z0-9_]{3,30}$/.test(form.username)
  const { data: usernameCheck, isFetching: checkingUsername } = trpc.user.checkUsername.useQuery({ username: form.username }, { enabled: usernameFormatOk })
  const usernameStatus = !usernameFormatOk ? "idle" : checkingUsername ? "checking" : usernameCheck?.available ? "available" : usernameCheck ? "unavailable" : "idle"
  const today = new Date().toISOString().slice(0, 10)

  const update = (field: keyof typeof form) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: "" }))
    setServerError("")
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (loading || !agreed) return
    const next: Record<string, string> = {}
    if (form.name.trim().length < 1) next.name = "Enter your name."
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = "Enter a valid email address."
    if (!usernameFormatOk) next.username = "Use 3–30 letters, numbers, or underscores."
    else if (usernameStatus === "unavailable") next.username = "Already taken"
    if (form.password.length < 8) next.password = "Use at least 8 characters."
    if (!form.dateOfBirth) next.dateOfBirth = "Enter your date of birth."
    else if (!isAtLeast13(form.dateOfBirth)) next.dateOfBirth = "You must be at least 13 years old to create an account."
    setErrors(next)
    if (Object.keys(next).length) return

    setLoading(true)
    const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) { setServerError(body.error ?? "We couldn’t create your account."); setLoading(false); return }
    const result = await signIn("credentials", { email: form.email.trim(), password: form.password, redirect: false })
    if (result?.error) { router.push("/signin"); return }
    router.push("/onboarding")
  }

  const textFields = [
    { id: "name", label: "Full name", icon: UserRound, placeholder: "What should we call you?", auto: "name", type: "text" },
    { id: "email", label: "Email address", icon: Mail, placeholder: "you@example.com", auto: "email", type: "email" },
  ] as const

  return (
    <aside className="signin-column signup-column">
      <div className="signin-panel signup-panel">
        <span className="form-emblem"><Paintbrush size={20} /></span>
        <span className="panel-kicker">THERE’S ROOM FOR YOUR KIND OF ART</span>
        <h2>Create your account</h2>
        <p className="form-tagline">ANYONE CAN BE AN ARTIST</p>
        {googleEnabled && <GoogleButton label="Sign up with Google" callbackUrl="/onboarding" />}
        <form noValidate onSubmit={submit}>
          {serverError && <StatusMessage kind="error">{serverError}</StatusMessage>}
          {textFields.map(({ id, label, icon: Icon, placeholder, auto, type }) => (
            <div className="field-group" key={id}>
              <label htmlFor={id}>{label}</label>
              <div className={`input-wrap ${errors[id] ? "invalid" : ""}`}><Icon size={15} /><input id={id} type={type} value={form[id]} onChange={(e) => update(id)(e.target.value)} placeholder={placeholder} autoComplete={auto} disabled={loading} /></div>
              {errors[id] && <p className="field-error">{errors[id]}</p>}
            </div>
          ))}
          <div className="field-group">
            <label htmlFor="username">Username</label>
            <div className={`input-wrap ${errors.username || usernameStatus === "unavailable" ? "invalid" : ""}`}>
              <AtSign size={15} /><input id="username" autoComplete="username" placeholder="your_creative_name" value={form.username} maxLength={30} disabled={loading} onChange={(e) => update("username")(e.target.value)} />
              {usernameStatus === "checking" && <LoaderCircle className="loading-spinner" size={15} />}
            </div>
            <div className="username-meta">
              <p>Letters, numbers, and underscores only</p>
              <span role="status" className={usernameStatus}>{usernameStatus === "checking" ? "Checking…" : usernameStatus === "available" ? <><CheckCircle2 size={12} />Available</> : usernameStatus === "unavailable" ? <><XCircle size={12} />Already taken</> : ""}</span>
            </div>
            {errors.username && <p className="field-error">{errors.username}</p>}
          </div>
          <div className="field-group">
            <label htmlFor="new-password">Password</label>
            <PasswordInput id="new-password" value={form.password} onChange={update("password")} error={errors.password} disabled={loading} placeholder="At least 8 characters" autoComplete="new-password" icon={false} />
            <p className={errors.password ? "field-error" : "password-guidance"}>{errors.password || "8+ characters. Longer passwords are stronger."}</p>
          </div>
          <div className="field-group">
            <label htmlFor="birthdate">Date of birth</label>
            <div className={`input-wrap ${errors.dateOfBirth ? "invalid" : ""}`}><CalendarDays size={15} /><input id="birthdate" type="date" autoComplete="bday" max={today} value={form.dateOfBirth} onChange={(e) => update("dateOfBirth")(e.target.value)} disabled={loading} /></div>
            {errors.dateOfBirth ? <p className="field-error">{errors.dateOfBirth}</p> : <p className="password-guidance">You must be 13 or older to join Gallery.</p>}
          </div>
          <div className={`terms-agreement ${agreed ? "accepted" : ""}`}>
            <button type="button" className="terms-checkbox" role="checkbox" aria-checked={agreed} aria-label="I agree to the Terms of Service and confirm I am 13 or older" disabled={loading} onClick={() => (agreed ? setAgreed(false) : setTermsOpen(true))}>{agreed && <Check size={13} />}</button>
            <span>I agree to the <button type="button" disabled={loading} onClick={() => setTermsOpen(true)}>Terms of Service</button> and confirm I am 13 or older</span>
          </div>
          <button className="login-button signup-submit" disabled={loading || !agreed || usernameStatus === "checking"} aria-busy={loading}>{loading ? <><LoaderCircle className="loading-spinner" size={17} />Creating your account…</> : <>Create account<ArrowRight size={17} /></>}</button>
        </form>
        <p className="signup-copy">Already have an account? <Link href="/signin">Sign in</Link></p>
      </div>
      <p className="signin-footnote"><ShieldCheck size={12} /> A home for every kind of artist.</p>
      {termsOpen && <TermsModal onClose={() => setTermsOpen(false)} onAccept={() => setAgreed(true)} />}
    </aside>
  )
}

/** The real Terms of Service; the agree button unlocks after scrolling to the end. */
function TermsModal({ onClose, onAccept }: { onClose: () => void; onAccept: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [reachedEnd, setReachedEnd] = useState(false)
  useEffect(() => { dialogRef.current?.showModal() }, [])
  return (
    <dialog className="terms-dialog" ref={dialogRef} onCancel={onClose} onClick={(e) => { if (e.target === dialogRef.current) onClose() }}>
      <div className="terms-header">
        <span className="eyebrow">GALLERY COMMUNITY</span><h2>Terms of Service</h2>
        <button aria-label="Close Terms of Service" className="close-modal" onClick={onClose}><X size={19} /></button>
      </div>
      <p className="terms-instruction"><ArrowDown size={13} />Read to the end to enable agreement.</p>
      <div className="terms-body" tabIndex={0} onScroll={(e) => { const el = e.currentTarget; if (el.scrollHeight - el.scrollTop - el.clientHeight < 8) setReachedEnd(true) }}>
        <TermsContent />
        <div className="terms-end">End of Terms of Service</div>
      </div>
      <div className="terms-footer">
        <button className="modal-primary" disabled={!reachedEnd} onClick={() => { onAccept(); onClose() }}><Check size={16} />I Agree to the Terms of Service</button>
        <span role="status">{reachedEnd ? "You’ve reached the end. You can now agree." : "Please scroll through the terms to continue."}</span>
      </div>
    </dialog>
  )
}

function ForgotPasswordPanel() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const forgotPassword = trpc.auth.forgotPassword.useMutation()
  const sent = forgotPassword.isSuccess

  return (
    <aside className="signin-column">
      <div className="signin-panel forgot-panel">
        <span className="form-emblem"><KeyRound size={23} /></span>
        <span className="panel-kicker">LET’S GET YOU BACK TO CREATING</span>
        <h2>Forgot your password?</h2>
        <p className="form-tagline">YOUR INSPIRATION IS STILL HERE</p>
        {sent ? (
          <div className="reset-sent">
            <StatusMessage kind="success">Check your inbox.</StatusMessage>
            <h3>A fresh start is on its way.</h3>
            <p>If <strong>{email}</strong> belongs to an account, we’ve sent a link to reset your password. It works for 1 hour.</p>
            <button className="text-action" onClick={() => forgotPassword.reset()}>Try another email</button>
          </div>
        ) : (
          <>
            <p className="reset-intro">It happens to the best of us. Enter your email and we’ll help you find your way back.</p>
            <form noValidate onSubmit={(e) => {
              e.preventDefault()
              if (!EMAIL_PATTERN.test(email.trim())) { setError("Enter a valid email address."); return }
              setError("")
              forgotPassword.mutate({ email: email.trim() })
            }}>
              <div className="field-group">
                <label htmlFor="reset-email">Email address</label>
                <div className={`input-wrap ${error ? "invalid" : ""}`}><Mail size={16} /><input id="reset-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setError("") }} disabled={forgotPassword.isPending} /></div>
                {error && <p className="field-error">{error}</p>}
              </div>
              {forgotPassword.error && <StatusMessage kind="error">Something went wrong. Please try again.</StatusMessage>}
              <button className="login-button reset-submit" disabled={forgotPassword.isPending}>{forgotPassword.isPending ? <><LoaderCircle size={17} className="loading-spinner" />Sending…</> : <>Send reset link<ArrowRight size={17} /></>}</button>
            </form>
          </>
        )}
        <Link className="back-to-signin" href="/signin"><ArrowLeft size={15} />Back to sign in</Link>
        <div className="reset-help"><span>New around here?</span><Link href="/signup">Find your creative home →</Link></div>
      </div>
      <p className="signin-footnote"><ShieldCheck size={12} /> A fresh start. The same creative you.</p>
    </aside>
  )
}

/** An ad in the spotlight: the picture fills the whole panel and the text sits on top of it. */
function SpotlightAd({ ad, external, onClick }: { ad: AdData; external: boolean; onClick: () => void }) {
  const look = adStyle(ad.style)
  return (
    <a className={`spotlight-slide spotlight-ad fit-${look.fit}`} href={ad.linkUrl} onClick={onClick}
      target={external ? "_blank" : undefined}
      rel={external ? (ad.preset === "PARTNER" ? "sponsored noopener noreferrer" : "noopener noreferrer") : undefined}>
      {ad.imageUrl && look.fit === "whole" && <img className="spotlight-ad-backdrop" src={ad.imageUrl} alt="" aria-hidden="true" />}
      {ad.imageUrl && <img className="spotlight-ad-image" src={ad.imageUrl} alt="" />}
      <span className="spotlight-ad-shade" aria-hidden="true" />
      <span className="spotlight-ad-copy">
        <span className="spotlight-ad-label">{AD_SLIDE_LABEL[ad.preset]}</span>
        <span className="spotlight-ad-headline" style={{ fontFamily: AD_FONTS[look.font], fontSize: `calc(clamp(30px, 3.2vw, 52px) * ${AD_SIZES[look.size]})` }}>{ad.headline}</span>
        {ad.body && <span className="spotlight-ad-body">{ad.body}</span>}
        <span className="spotlight-action">Take a look<ArrowUpRight size={16} /></span>
      </span>
    </a>
  )
}

/**
 * Left-hand spotlight: real recent artwork, rotating every 7 seconds. Ads placed on the
 * "Sign-up page" spot (admin Ads page) are mixed in as their own slides, labelled as such.
 */
type SpotlightSlide =
  | { kind: "art"; id: string; image: string; alt: string; username: string | null }
  | { kind: "ad"; id: string; ad: AdData }

const AD_SLIDE_LABEL = { ARTIST_SPOTLIGHT: "FEATURED ARTIST", PARTNER: "SPONSORED", GALLERY_PROMO: "FROM GALLERY" } as const

function SpotlightCarousel() {
  const { data } = trpc.discovery.forYou.useQuery({ limit: 5 })
  const ads = useAds("SIGNUP")
  const recordView = trpc.ad.recordView.useMutation()
  const recordClick = trpc.ad.recordClick.useMutation()
  const viewedAds = useRef(new Set<string>())

  const art: SpotlightSlide[] = (data?.items ?? []).map((p) => ({ kind: "art", id: p.id, image: p.image, alt: p.description ?? `Artwork by @${p.user.username}`, username: p.user.username }))
  // An ad after every second artwork (or on its own if there's no artwork yet).
  const slides: SpotlightSlide[] = []
  let adIndex = 0
  art.forEach((slide, i) => {
    slides.push(slide)
    if (i % 2 === 1 && adIndex < ads.length) slides.push({ kind: "ad", id: `ad-${ads[adIndex].id}`, ad: ads[adIndex++] })
  })
  while (adIndex < ads.length) slides.push({ kind: "ad", id: `ad-${ads[adIndex].id}`, ad: ads[adIndex++] })

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused || slides.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000)
    return () => clearInterval(timer)
  }, [paused, slides.length])
  const slide = slides[index % Math.max(slides.length, 1)]

  const shownAdId = slide?.kind === "ad" ? slide.ad.id : null
  useEffect(() => {
    if (shownAdId && !viewedAds.current.has(shownAdId)) { viewedAds.current.add(shownAdId); recordView.mutate({ id: shownAdId }) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownAdId])

  const adExternal = slide?.kind === "ad" && !slide.ad.linkUrl.startsWith("/")

  return (
    <section className={`spotlight ${slide?.kind === "ad" ? "has-ad" : ""}`} aria-label="Gallery Spotlight" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="spotlight-label"><span><Sparkles size={13} /> GALLERY SPOTLIGHT</span><span className="curated-label">A WORLD OF ORIGINALS</span></div>
      {slide?.kind === "ad" ? (
        <SpotlightAd ad={slide.ad} external={adExternal} onClick={() => recordClick.mutate({ id: slide.ad.id })} />
      ) : (
        <div className="spotlight-slide">
          <div className="slide-category"><span>FEATURED ARTWORK</span></div>
          <h1>Where imagination finds a home.</h1>
          <p className="slide-description">Discover new work from artists across Gallery.</p>
          {slide && (
            <div className="spotlight-art">
              <img src={slide.image} alt={slide.alt} />
              <span className="art-frame-corner" aria-hidden="true">✧</span>
              <span className="artwork-index">ORIGINAL PERSPECTIVES</span>
            </div>
          )}
          {slide && (
            <div className="slide-footer">
              <div className="attribution"><span className="attribution-dot" /><span>Artwork by @{slide.username}</span></div>
              <Link className="spotlight-action" href={`/@${slide.username}/${slide.id}`}>View artwork<ArrowUpRight size={16} /></Link>
            </div>
          )}
        </div>
      )}
      {slides.length > 1 && (
        <div className="carousel-controls">
          <div className="slide-arrows">
            <button aria-label="Previous spotlight" onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}><ArrowLeft size={17} /></button>
            <button aria-label="Next spotlight" onClick={() => setIndex((i) => (i + 1) % slides.length)}><ArrowRight size={17} /></button>
          </div>
          <div className="position-dots">{slides.map((s, i) => <button key={s.id} onClick={() => setIndex(i)} aria-label={`Go to slide ${i + 1}`} aria-pressed={i === index} className={i === index ? "active" : ""} />)}</div>
          <div className="carousel-position"><span>{String(index + 1).padStart(2, "0")}<i>/ {String(slides.length).padStart(2, "0")}</i></span></div>
        </div>
      )}
      <p className="spotlight-note">For the makers. The dreamers. The beautifully curious. <span>✦</span></p>
    </section>
  )
}
