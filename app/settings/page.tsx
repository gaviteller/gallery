"use client"
/**
 * SETTINGS (Codex redesign). Styling: app/redesign/settings.css (generated, scope .gx-settings).
 *
 * Sections: Edit profile (cover, photo, name, username, bio, links) · Notifications (push on this
 * device, link to the inbox) · Privacy (real name, ad targeting, blocked accounts) · Account (selling,
 * password, email, legal, sign out). Codex's "Interests" and "Appearance" sections are left out until
 * there is somewhere real to save them (no fake settings).
 *
 * Profile fields save together with "Save changes"; switches apply straight away, as before.
 * Open a section directly with ?section=Notifications (also accepts the old ?tab=account).
 */
import "@/app/redesign/settings.css"
import "@/app/redesign/settings-extra.css"
import "@/app/redesign/shell.css"
import React, { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Bell, Check, CircleUserRound, ImagePlus, KeyRound, LockKeyhole } from "lucide-react"
import { trpc } from "@/components/providers"
import { uploadImage } from "@/lib/upload"
import RedesignShell, { GallerySidebar, Avatar } from "@/components/redesign/RedesignShell"

const SECTIONS = [
  { label: "Edit profile", icon: CircleUserRound },
  { label: "Notifications", icon: Bell },
  { label: "Privacy", icon: LockKeyhole },
  { label: "Account", icon: KeyRound },
] as const
type Section = typeof SECTIONS[number]["label"]

type Profile = {
  name: string; handle: string; bio: string; image: string | null; banner: string | null
  website: string; twitter: string; instagram: string; artstation: string
}

export default function SettingsPage() {
  return (
    <RedesignShell wrapperClass="gx-settings">
      <Suspense fallback={null}><SettingsView /></Suspense>
    </RedesignShell>
  )
}

/** Shrinks a chosen picture in the browser before upload (avatars 400px, covers 1200×400). */
function resizeImage(file: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("read"))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error("decode"))
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height)
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const raw = atob((base64String + padding).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

function SettingsView() {
  const { status, update } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const utils = trpc.useUtils()
  const { data: user } = trpc.user.me.useQuery(undefined, { enabled: status === "authenticated" })

  const initialSection = (): Section => {
    const asked = searchParams.get("section") ?? (searchParams.get("tab") === "account" ? "Account" : "")
    return SECTIONS.find((s) => s.label.toLowerCase() === asked.toLowerCase())?.label ?? "Edit profile"
  }
  const [section, setSection] = useState<Section>(initialSection)
  const [saved, setSaved] = useState<Profile | null>(null)
  const [draft, setDraft] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [readingPhoto, setReadingPhoto] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  useEffect(() => { if (status === "unauthenticated") router.push("/signin") }, [status, router])

  // Fill the form once the account loads (and again after a save refreshes it).
  useEffect(() => {
    if (!user) return
    const profile: Profile = {
      name: user.name ?? "", handle: user.username ?? "", bio: user.bio ?? "",
      image: user.image ?? null, banner: user.bannerImage ?? null,
      website: user.websiteUrl ?? "", twitter: user.twitterHandle ?? "",
      instagram: user.instagramHandle ?? "", artstation: user.artstationHandle ?? "",
    }
    setSaved(profile)
    setDraft(profile)
  }, [user])

  const updateProfile = trpc.user.updateProfile.useMutation()
  const changeUsername = trpc.user.changeUsername.useMutation()

  if (!draft || !saved || !user) {
    return <div className="desktop-layout settings-layout"><GallerySidebar /><main className="settings-main"><p className="settings-loading">Loading your settings…</p></main></div>
  }

  const changed = JSON.stringify(draft) !== JSON.stringify(saved)
  const change = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setDraft((d) => d && { ...d, [key]: value })
    setNotice(""); setError("")
  }

  async function pickPhoto(file: File | undefined, field: "image" | "banner") {
    if (!file) return
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) { setError("Choose an image up to 10 MB."); return }
    setReadingPhoto(true)
    try { change(field, field === "image" ? await resizeImage(file, 400, 400) : await resizeImage(file, 1200, 400)) }
    catch { setError("That photo couldn't be opened. Try another image.") }
    finally { setReadingPhoto(false) }
  }

  async function save() {
    if (!draft || !saved) return
    const name = draft.name.trim()
    const handle = draft.handle.trim().replace(/^@/, "")
    const website = draft.website.trim()
    if (!name) { setError("Enter a display name."); setSection("Edit profile"); return }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(handle)) { setError("Use 3 to 30 letters, numbers or underscores for your username."); setSection("Edit profile"); return }
    if (website) {
      try { const url = new URL(website); if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error() }
      catch { setError("Enter a website starting with https:// or http://."); setSection("Edit profile"); return }
    }
    setBusy(true); setError("")
    try {
      if (handle !== saved.handle) await changeUsername.mutateAsync({ username: handle })
      const image = draft.image?.startsWith("data:") ? await uploadImage(draft.image, "avatars") : draft.image
      const banner = draft.banner?.startsWith("data:") ? await uploadImage(draft.banner, "banners") : draft.banner
      await updateProfile.mutateAsync({
        name, bio: draft.bio.trim() || null, image: image || null, bannerImage: banner || null,
        websiteUrl: website || null, twitterHandle: draft.twitter.trim() || null,
        instagramHandle: draft.instagram.trim() || null, artstationHandle: draft.artstation.trim() || null,
      })
      await Promise.all([update(), utils.user.me.invalidate()])
      setNotice("Settings saved.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your settings couldn't be saved. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="desktop-layout settings-layout">
      <GallerySidebar />
      <main className="settings-main" style={{ "--settings-gradient": "linear-gradient(115deg, #dc4aa1, #8756d8, #50bddd)" } as React.CSSProperties}>
        <header className="settings-hero">
          <div aria-hidden="true" className="settings-art"><span /></div>
          <h1>Settings</h1>
          <Link className="settings-profile-link" href={`/@${user.username}`}>View profile</Link>
        </header>
        <div className="settings-grid">
          <div className="settings-menu">
            <nav aria-label="Settings sections">
              {SECTIONS.map(({ label, icon: Icon }) => (
                <button key={label} aria-pressed={section === label} onClick={() => { setSection(label); setNotice(""); setError("") }}><Icon size={17} />{label}</button>
              ))}
            </nav>
            <aside className="settings-preview" aria-label="Profile preview">
              <Avatar src={draft.image} name={draft.name || "You"} />
              <strong>{draft.name || "Your name"}</strong>
              <span>@{draft.handle || "username"}</span>
              {draft.bio && <p>{draft.bio}</p>}
            </aside>
          </div>

          {section === "Edit profile" ? (
            <form className="settings-card" onSubmit={(e) => { e.preventDefault(); void save() }} noValidate>
              <h2>Edit profile</h2>
              <section className="cover-editor" aria-labelledby="cover-heading">
                <h3 id="cover-heading">Profile cover</h3>
                <div className="cover-preview">
                  {draft.banner ? <img src={draft.banner} alt="Profile cover preview" /> : <div aria-hidden="true" className="settings-art"><span /></div>}
                </div>
                <div className="cover-actions">
                  <label className="photo-upload"><ImagePlus size={16} /> Change cover<input type="file" accept="image/*" disabled={readingPhoto || busy} onChange={(e) => { void pickPhoto(e.target.files?.[0], "banner"); e.target.value = "" }} /></label>
                  {draft.banner && <button type="button" className="settings-text-button" disabled={readingPhoto || busy} onClick={() => change("banner", null)}>Use default cover</button>}
                </div>
                <small>A wide image works best. Shown at the top of your profile.</small>
              </section>
              <div className="profile-photo">
                <Avatar src={draft.image} name={draft.name || "You"} />
                <div>
                  <label className="photo-upload"><ImagePlus size={16} /> Change photo<input type="file" accept="image/*" disabled={readingPhoto || busy} onChange={(e) => { void pickPhoto(e.target.files?.[0], "image"); e.target.value = "" }} /></label>
                  <small>Your public avatar</small>
                </div>
                {draft.image && <button type="button" className="settings-text-button" disabled={busy} onClick={() => change("image", null)}>Remove</button>}
              </div>
              <div className="settings-fields">
                <label>Display name<input value={draft.name} maxLength={100} required onChange={(e) => change("name", e.target.value)} /></label>
                <label>Username<input value={draft.handle} maxLength={30} required onChange={(e) => change("handle", e.target.value)} /></label>
                <label className="wide-field">Bio<textarea rows={3} maxLength={160} value={draft.bio} placeholder="Tell people about your work…" onChange={(e) => change("bio", e.target.value)} /><small>{draft.bio.length}/160</small></label>
                <label>Website<input type="url" value={draft.website} maxLength={240} placeholder="https://your-portfolio.com" onChange={(e) => change("website", e.target.value)} /></label>
                <label>Instagram<input value={draft.instagram} maxLength={50} placeholder="@handle" onChange={(e) => change("instagram", e.target.value)} /></label>
                <label>X / Twitter<input value={draft.twitter} maxLength={50} placeholder="@handle" onChange={(e) => change("twitter", e.target.value)} /></label>
                <label>ArtStation<input value={draft.artstation} maxLength={50} placeholder="handle" onChange={(e) => change("artstation", e.target.value)} /></label>
              </div>
              {error && <p className="settings-error" role="alert">{error}</p>}
              <div className="settings-footer">
                <p role="status">{notice ? <><Check size={15} />{notice}</> : changed ? "You have unsaved changes." : "Your profile is up to date."}</p>
                <div>
                  <button type="button" className="settings-secondary" disabled={!changed || busy || readingPhoto} onClick={() => { setDraft(saved); setError(""); setNotice("") }}>Discard</button>
                  <button className="settings-primary" disabled={!changed || busy || readingPhoto}>{busy ? "Saving…" : "Save changes"}</button>
                </div>
              </div>
            </form>
          ) : (
            <div className="settings-card">
              <h2>{section}</h2>
              {section === "Notifications" && <NotificationSettings />}
              {section === "Privacy" && <PrivacySettings showRealName={!!user.showRealName} adOptOut={!!user.adTargetingOptOut} />}
              {section === "Account" && <AccountSettings email={user.email} sellingEnabled={!!user.sellingEnabled} />}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

/** A labelled switch in Codex's style. */
function Toggle({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="setting-toggle">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function NotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const subscribe = trpc.push.subscribe.useMutation()
  const unsubscribe = trpc.push.unsubscribe.useMutation()
  const { data: vapid } = trpc.push.getPublicKey.useQuery()

  useEffect(() => {
    setPermission(typeof Notification === "undefined" || !("serviceWorker" in navigator) ? "unsupported" : Notification.permission)
  }, [])

  async function toggle(on: boolean) {
    setBusy(true); setError("")
    try {
      if (!on) {
        const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
        if (sub) { await sub.unsubscribe(); await unsubscribe.mutateAsync({ endpoint: sub.endpoint }) }
        setPermission("default")
        return
      }
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== "granted") { setError("Your browser blocked notifications. Allow them in the browser's site settings."); return }
      const reg = await navigator.serviceWorker.register("/sw.js")
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid?.publicKey ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "") })
      const json = sub.toJSON()
      await subscribe.mutateAsync({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" })
    } catch (err) {
      console.error("[push]", err)
      setError("Notifications couldn't be switched. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-toggles">
      <Toggle label="Push notifications on this device" description={permission === "unsupported" ? "This browser doesn't support push notifications." : "Likes, follows, messages and commission updates, even when Gallery is closed."}
        checked={permission === "granted"} disabled={busy || permission === "unsupported"} onChange={(on) => void toggle(on)} />
      {error && <p className="settings-error" role="alert">{error}</p>}
      <p className="settings-note">See everything that happened in your <Link href="/notifications">notifications inbox</Link>.</p>
    </div>
  )
}

function PrivacySettings({ showRealName, adOptOut }: { showRealName: boolean; adOptOut: boolean }) {
  const utils = trpc.useUtils()
  const refresh = () => utils.user.me.invalidate()
  const setRealName = trpc.user.updateShowRealName.useMutation({ onSuccess: refresh })
  const setAdOptOut = trpc.user.updateAdTargetingOptOut.useMutation({ onSuccess: refresh })
  const { data: blocked = [], refetch } = trpc.block.getMyBlocked.useQuery()
  const unblock = trpc.block.toggle.useMutation({ onSuccess: () => refetch() })

  return (
    <div className="settings-toggles">
      <Toggle label="Show real name" description="Show your display name on your public profile." checked={showRealName} disabled={setRealName.isPending}
        onChange={(on) => setRealName.mutate({ showRealName: on })} />
      <Toggle label="Location-based ad targeting" description="Turn off to stop ads chosen by your location." checked={!adOptOut} disabled={setAdOptOut.isPending}
        onChange={(on) => setAdOptOut.mutate({ optOut: !on })} />
      <h3 className="settings-subheading">Blocked accounts</h3>
      {!blocked.length && <p className="settings-note">You haven&apos;t blocked anyone.</p>}
      {blocked.map((u) => (
        <div className="settings-blocked" key={u.id}>
          <Avatar src={u.image} name={u.name ?? u.username ?? "?"} />
          <span><strong>{u.name ?? u.username}</strong><small>@{u.username}</small></span>
          <button type="button" className="settings-secondary" disabled={unblock.isPending} onClick={() => u.username && unblock.mutate({ username: u.username })}>Unblock</button>
        </div>
      ))}
    </div>
  )
}

function AccountSettings({ email, sellingEnabled }: { email: string | null; sellingEnabled: boolean }) {
  const { update } = useSession()
  const utils = trpc.useUtils()
  const setSelling = trpc.user.updateSellingEnabled.useMutation({ onSuccess: () => { void utils.user.me.invalidate(); void update() } })
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const changePassword = trpc.user.changePassword.useMutation({ onSuccess: () => { setCurrent(""); setNext(""); setConfirm("") } })
  const mismatch = !!confirm && next !== confirm

  return (
    <div className="settings-toggles">
      <Toggle label="Commissions" description={sellingEnabled ? "Shown on your profile — people can request work." : "Not shown on your profile."}
        checked={sellingEnabled} disabled={setSelling.isPending} onChange={(on) => setSelling.mutate({ enabled: on })} />
      <h3 className="settings-subheading">Email</h3>
      <p className="settings-note">{email ?? "No email on this account."}</p>
      <h3 className="settings-subheading">Change password</h3>
      <form className="settings-fields" onSubmit={(e) => { e.preventDefault(); if (!mismatch && next.length >= 8) changePassword.mutate({ currentPassword: current, newPassword: next }) }}>
        <label className="wide-field">Current password<input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
        <label>New password<input type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        {mismatch && <p className="settings-error wide-field" role="alert">Passwords don&apos;t match.</p>}
        {changePassword.error && <p className="settings-error wide-field" role="alert">{changePassword.error.message}</p>}
        {changePassword.isSuccess && <p className="settings-note wide-field" role="status"><Check size={14} /> Password updated.</p>}
        <div className="wide-field"><button className="settings-primary" disabled={!current || next.length < 8 || mismatch || changePassword.isPending}>{changePassword.isPending ? "Updating…" : "Update password"}</button></div>
      </form>
      <h3 className="settings-subheading">Legal</h3>
      <p className="settings-note"><Link href="/terms">Terms of Service</Link> · <Link href="/privacy">Privacy Policy</Link> · <Link href="/dmca">DMCA / Copyright</Link></p>
      <div><button type="button" className="settings-secondary" onClick={() => signOut({ callbackUrl: "/signin" })}>Sign out</button></div>
    </div>
  )
}
