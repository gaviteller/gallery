"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import React, { useEffect, useState, Suspense } from "react"
import { trpc } from "@/components/providers"
import { uploadImage } from "@/lib/upload"

const GRADIENT = "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)"

function SettingsForm() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const utils = trpc.useUtils()
  const { data: user, isLoading } = trpc.user.me.useQuery()

  const [tab, setTab] = useState<"profile" | "account">(() =>
    searchParams.get("tab") === "account" ? "account" : "profile"
  )

  // Account tab state
  const [accountSection, setAccountSection] = useState<"username" | "password" | null>(null)
  const [newUsername, setNewUsername] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  function closeSection() {
    setAccountSection(null)
    setNewUsername("")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [twitterHandle, setTwitterHandle] = useState("")
  const [instagramHandle, setInstagramHandle] = useState("")
  const [artstationHandle, setArtstationHandle] = useState("")
  const [showRealName, setShowRealName] = useState(false)
  const [adTargetingOptOut, setAdTargetingOptOut] = useState(false)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default")
  const [notifLoading, setNotifLoading] = useState(false)
  const [photoProcessing, setPhotoProcessing] = useState(false)
  const [bannerImage, setBannerImage] = useState<string | null>(null)
  const [bannerProcessing, setBannerProcessing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name ?? "")
      setBio(user.bio ?? "")
      setImage(user.image ?? null)
      setBannerImage((user as { bannerImage?: string | null }).bannerImage ?? null)
      setWebsiteUrl(user.websiteUrl ?? "")
      setTwitterHandle(user.twitterHandle ?? "")
      setInstagramHandle(user.instagramHandle ?? "")
      setArtstationHandle(user.artstationHandle ?? "")
      setShowRealName((user as { showRealName?: boolean }).showRealName ?? false)
      setAdTargetingOptOut((user as { adTargetingOptOut?: boolean }).adTargetingOptOut ?? false)
    }
  }, [user])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin")
  }, [status, router])

  const username = user?.username ?? session?.user?.username

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: async () => {
      await update()
      router.push(username ? `/${username}` : "/")
    },
  })

  const updateSelling = trpc.user.updateSellingEnabled.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate()
      update()
    },
  })

  const updateShowRealName = trpc.user.updateShowRealName.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
    onError: () => setShowRealName(prev => !prev),
  })

  const updateAdTargeting = trpc.user.updateAdTargetingOptOut.useMutation({
    onError: () => setAdTargetingOptOut(prev => !prev),
  })

  const pushSubscribe = trpc.push.subscribe.useMutation()
  const pushUnsubscribe = trpc.push.unsubscribe.useMutation()
  const { data: vapidData } = trpc.push.getPublicKey.useQuery()

  useEffect(() => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
      setNotifPermission("unsupported")
    } else {
      setNotifPermission(Notification.permission)
    }
  }, [])

  const changeUsername = trpc.user.changeUsername.useMutation({
    onSuccess: async () => {
      await update()
      setNewUsername("")
    },
  })

  const changePassword = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    },
  })

  const { data: blockedUsers = [], refetch: refetchBlocked } = trpc.block.getMyBlocked.useQuery()
  const unblockMutation = trpc.block.toggle.useMutation({
    onSuccess: () => refetchBlocked(),
  })

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoProcessing(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new window.Image()
      img.onload = () => {
        const MAX = 400
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
          else { width = Math.round((width * MAX) / height); height = MAX }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
        setImage(canvas.toDataURL("image/jpeg", 0.85))
        setPhotoProcessing(false)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerProcessing(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new window.Image()
      img.onload = () => {
        const MAX_W = 1200
        const MAX_H = 400
        let { width, height } = img
        if (width > MAX_W) { height = Math.round((height * MAX_W) / width); width = MAX_W }
        if (height > MAX_H) { width = Math.round((width * MAX_H) / height); height = MAX_H }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
        setBannerImage(canvas.toDataURL("image/jpeg", 0.85))
        setBannerProcessing(false)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    setSaveError(null)
    setIsUploading(true)
    try {
      let imageUrl = image
      let bannerUrl = bannerImage

      if (image && image.startsWith("data:")) {
        imageUrl = await uploadImage(image, "avatars")
      }
      if (bannerImage && bannerImage.startsWith("data:")) {
        bannerUrl = await uploadImage(bannerImage, "banners")
      }

      updateProfile.mutate({
        name: name.trim() || (user?.name ?? "Artist"),
        bio: bio.trim() || null,
        image: imageUrl || null,
        bannerImage: bannerUrl || null,
        websiteUrl: websiteUrl.trim() || null,
        twitterHandle: twitterHandle.trim() || null,
        instagramHandle: instagramHandle.trim() || null,
        artstationHandle: artstationHandle.trim() || null,
      })
    } catch (err) {
      console.error("[settings] image upload failed:", err)
      setSaveError("Failed to upload image. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  async function handleNotifToggle() {
    if (notifPermission === "unsupported") return
    setNotifLoading(true)
    try {
      if (notifPermission === "granted") {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await pushUnsubscribe.mutateAsync({ endpoint: sub.endpoint })
        }
        setNotifPermission("default")
      } else {
        const permission = await Notification.requestPermission()
        setNotifPermission(permission)
        if (permission !== "granted") return
        const reg = await navigator.serviceWorker.register("/sw.js")
        const publicKey = vapidData?.publicKey ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
        const json = sub.toJSON()
        await pushSubscribe.mutateAsync({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        })
      }
    } catch (err) {
      console.error("[push]", err)
    } finally {
      setNotifLoading(false)
    }
  }

  const initials = (name || user?.username || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const raw = atob(base64)
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
  }

  if (status === "loading" || isLoading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}><p style={{ color: "var(--muted)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Loading…</p></div>
  }

  const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "120px 1fr", gap: 14, padding: "12px 0", borderBottom: "1px solid var(--border)", alignItems: "center" }
  const rowTopStyle: React.CSSProperties = { ...rowStyle, alignItems: "flex-start", padding: "14px 0" }
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "var(--muted)", lineHeight: 1.4, fontFamily: "Inter,sans-serif" }
  const hintStyle: React.CSSProperties = { fontSize: 10, color: "rgba(107,95,136,0.65)", marginTop: 3, fontFamily: "Inter,sans-serif" }
  const sectionLabelStyle: React.CSSProperties = { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)", padding: "14px 0 10px", fontFamily: "Inter,sans-serif" }
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", background: "rgba(240,235,248,0.08)", border: "1px solid rgba(240,235,248,0.18)",
    borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text)", fontFamily: "Inter,sans-serif", outline: "none",
  }
  const ghostBtnStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7, cursor: "pointer", fontFamily: "Inter,sans-serif",
    background: "rgba(240,235,248,0.06)", border: "1px solid var(--border)", color: "var(--muted)",
  }
  const gradBtnStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7, cursor: "pointer", fontFamily: "Inter,sans-serif",
    background: GRADIENT, color: "#fff", border: "none", display: "inline-block",
  }
  const toggleStyle = (on: boolean): React.CSSProperties => ({
    width: 42, height: 24, borderRadius: 99, display: "flex", alignItems: "center",
    padding: 2, flexShrink: 0, flexDirection: "row", cursor: "pointer", border: on ? "none" : "1px solid var(--border)",
    background: on ? "linear-gradient(90deg,#FF3CAC,#784BA0)" : "rgba(240,235,248,0.1)",
  })

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      {/* Sticky nav */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--nav)", borderBottom: "1px solid var(--border)", padding: "11px 14px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => router.push(username ? `/@${username}` : "/")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)", display: "flex", flexShrink: 0 }}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Settings
        </div>
      </div>

      <div style={{ maxWidth: 512, margin: "0 auto", padding: "20px 16px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 28, borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
          {(["profile", "account"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "0 0 11px", marginBottom: -1, background: "none", border: "none", cursor: "pointer",
                fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 15, textTransform: "capitalize",
                color: tab === t ? "var(--text)" : "var(--muted)", position: "relative",
              }}
            >
              {t}
              {tab === t && (
                <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, borderRadius: 99, background: GRADIENT }} />
              )}
            </button>
          ))}
        </div>

        {/* ── Profile tab ─────────────────────────────────────── */}
        {tab === "profile" && (
        <div style={{ display: "flex", flexDirection: "column" }}>

          <p style={sectionLabelStyle}>Appearance</p>

          {/* Photo row */}
          <div style={rowStyle}>
            <div>
              <p style={labelStyle}>Photo</p>
              <p style={hintStyle}>Your public avatar</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {image ? (
                <img src={image} alt="Profile" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid var(--border)" }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, background: GRADIENT, padding: 2 }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2A1838", color: "rgba(240,235,248,0.6)", fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 16 }}>{initials}</div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={gradBtnStyle}>
                  {photoProcessing ? "Processing…" : "Upload photo"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} disabled={photoProcessing} />
                </label>
                {image && (
                  <button onClick={() => setImage(null)} style={ghostBtnStyle}>Remove</button>
                )}
              </div>
            </div>
          </div>

          {/* Banner row */}
          <div style={rowTopStyle}>
            <div>
              <p style={labelStyle}>Banner</p>
              <p style={hintStyle}>Top of your profile</p>
            </div>
            <div>
              {bannerImage ? (
                <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", marginBottom: 8, height: 52 }}>
                  <img src={bannerImage} alt="Banner" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ) : (
                <div style={{ borderRadius: 10, marginBottom: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, height: 56, border: "1px dashed var(--border)", color: "var(--muted)", background: "rgba(240,235,248,0.02)", fontFamily: "Inter,sans-serif" }}>
                  No banner — gradient will be used
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <label style={gradBtnStyle}>
                  {bannerProcessing ? "Processing…" : "Upload banner"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerChange} disabled={bannerProcessing} />
                </label>
                {bannerImage && (
                  <button onClick={() => setBannerImage(null)} style={ghostBtnStyle}>Remove</button>
                )}
              </div>
            </div>
          </div>

          <p style={sectionLabelStyle}>Identity</p>

          {/* Display name row */}
          <div style={rowStyle}>
            <p style={labelStyle}>Display name</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              style={inputStyle}
            />
          </div>

          {/* Show real name toggle */}
          {user?.name && (
            <div style={rowStyle}>
              <div>
                <p style={labelStyle}>Show real name</p>
                <p style={hintStyle}>On your public profile</p>
              </div>
              <button
                onClick={() => { const next = !showRealName; setShowRealName(next); updateShowRealName.mutate({ showRealName: next }) }}
                disabled={updateShowRealName.isPending}
                style={toggleStyle(showRealName)}
                role="switch" aria-checked={showRealName}
              >
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,.4)", marginLeft: showRealName ? "auto" : 0 }} />
              </button>
            </div>
          )}

          {/* Bio row */}
          <div style={rowTopStyle}>
            <div>
              <p style={labelStyle}>Bio</p>
              <p style={hintStyle}>Up to 160 chars</p>
            </div>
            <div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={3}
                placeholder="Tell people about your work…"
                style={{ ...inputStyle, height: 72, resize: "none" }}
              />
              <p style={{ fontSize: 12, textAlign: "right", marginTop: 4, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>{bio.length}/160</p>
            </div>
          </div>

          <p style={sectionLabelStyle}>Links</p>

          {(
            [
              { icon: "🌐", label: "Website",    placeholder: "https://yoursite.com", value: websiteUrl,       set: setWebsiteUrl },
              { icon: "𝕏",  label: "Twitter / X", placeholder: "@handle",             value: twitterHandle,   set: setTwitterHandle },
              { icon: "📸", label: "Instagram",   placeholder: "@handle",             value: instagramHandle, set: setInstagramHandle },
              { icon: "🎨", label: "ArtStation",  placeholder: "username",            value: artstationHandle, set: setArtstationHandle },
            ] as const
          ).map(({ icon, label, placeholder, value, set }) => (
            <div key={label} style={rowStyle}>
              <p style={labelStyle}>{label}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 16, width: 20, textAlign: "center", flexShrink: 0 }}>{icon}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => (set as (v: string) => void)(e.target.value)}
                  placeholder={placeholder}
                  style={{ ...inputStyle, fontSize: 14, flex: 1 }}
                />
              </div>
            </div>
          ))}

          {updateProfile.error && (
            <p style={{ fontSize: 13, color: "#f87171", marginTop: 14, fontFamily: "Inter,sans-serif" }}>{updateProfile.error.message}</p>
          )}
          {saveError && (
            <p style={{ fontSize: 13, color: "#f87171", marginTop: 14, fontFamily: "Inter,sans-serif" }}>{saveError}</p>
          )}

          <button
            onClick={handleSave}
            disabled={updateProfile.isPending || photoProcessing || bannerProcessing || isUploading}
            style={{ width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, marginTop: 20, border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif", background: GRADIENT, color: "#fff", opacity: (updateProfile.isPending || photoProcessing || bannerProcessing || isUploading) ? 0.5 : 1 }}
          >
            {isUploading ? "Uploading…" : updateProfile.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
        )}

        {/* ── Account tab ─────────────────────────────────────── */}
        {tab === "account" && (
        <div style={{ display: "flex", flexDirection: "column" }}>

          <p style={sectionLabelStyle}>Preferences</p>

          {/* Commissions toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "Inter,sans-serif" }}>Commissions</div>
              <div style={{ fontSize: 11, marginTop: 3, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>
                {user?.sellingEnabled ? "Visible on your profile" : "Not shown on your profile"}
              </div>
            </div>
            <button
              onClick={() => updateSelling.mutate({ enabled: !user?.sellingEnabled })}
              disabled={updateSelling.isPending}
              style={toggleStyle(!!user?.sellingEnabled)}
              role="switch" aria-checked={user?.sellingEnabled}
            >
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,.4)", marginLeft: user?.sellingEnabled ? "auto" : 0 }} />
            </button>
          </div>

          {/* Ad targeting toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "Inter,sans-serif" }}>Location-based ad targeting</div>
              <div style={{ fontSize: 11, marginTop: 3, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>Opt out to disable location ads</div>
            </div>
            <button
              onClick={() => { const next = !adTargetingOptOut; setAdTargetingOptOut(next); updateAdTargeting.mutate({ optOut: next }) }}
              disabled={updateAdTargeting.isPending}
              style={toggleStyle(adTargetingOptOut)}
              role="switch" aria-checked={adTargetingOptOut}
            >
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,.4)", marginLeft: adTargetingOptOut ? "auto" : 0 }} />
            </button>
          </div>

          {/* Push notifications toggle */}
          {notifPermission !== "unsupported" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "Inter,sans-serif" }}>Push notifications</div>
                <div style={{ fontSize: 11, marginTop: 3, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>
                  {notifPermission === "denied" ? "Blocked by browser — allow in browser settings" : notifPermission === "granted" ? "Enabled for likes, comments, follows, DMs" : "Get notified for likes, comments, follows, DMs"}
                </div>
              </div>
              {notifPermission !== "denied" && (
                <button
                  onClick={handleNotifToggle}
                  disabled={notifLoading}
                  style={{ ...toggleStyle(notifPermission === "granted"), opacity: notifLoading ? 0.5 : 1 }}
                  role="switch" aria-checked={notifPermission === "granted"}
                >
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,.4)", marginLeft: notifPermission === "granted" ? "auto" : 0 }} />
                </button>
              )}
            </div>
          )}

          <p style={sectionLabelStyle}>Account</p>

          {/* Change username */}
          <div style={{ borderBottom: "1px solid var(--border)" }}>
            {accountSection !== "username" ? (
              <button
                onClick={() => setAccountSection("username")}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "Inter,sans-serif" }}>Username</div>
                  <div style={{ fontSize: 11, marginTop: 3, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>@{user?.username}</div>
                </div>
                <span style={{ fontSize: 17, color: "var(--muted)" }}>›</span>
              </button>
            ) : (
              <div style={{ padding: "14px 0", display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={closeSection} style={{ fontSize: 11, textAlign: "left", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif", padding: 0 }}>← Back</button>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", fontFamily: "Inter,sans-serif" }}>Change username</div>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder={`Current: @${user?.username}`}
                  maxLength={30}
                  style={inputStyle}
                />
                {changeUsername.error && <p style={{ fontSize: 13, color: "#f87171", fontFamily: "Inter,sans-serif" }}>{changeUsername.error.message}</p>}
                {changeUsername.isSuccess && <p style={{ fontSize: 13, color: "#4ade80", fontFamily: "Inter,sans-serif" }}>Username updated!</p>}
                <button
                  onClick={() => changeUsername.mutate({ username: newUsername.trim() })}
                  disabled={changeUsername.isPending || !newUsername.trim()}
                  style={{ width: "100%", padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif", background: GRADIENT, color: "#fff", opacity: (changeUsername.isPending || !newUsername.trim()) ? 0.5 : 1 }}
                >
                  {changeUsername.isPending ? "Saving…" : "Save username"}
                </button>
              </div>
            )}
          </div>

          {/* Change password */}
          <div style={{ borderBottom: "1px solid var(--border)" }}>
            {accountSection !== "password" ? (
              <button
                onClick={() => setAccountSection("password")}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "Inter,sans-serif" }}>Password</div>
                <span style={{ fontSize: 17, color: "var(--muted)" }}>›</span>
              </button>
            ) : (
              <div style={{ padding: "14px 0", display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={closeSection} style={{ fontSize: 11, textAlign: "left", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif", padding: 0 }}>← Back</button>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", fontFamily: "Inter,sans-serif" }}>Change password</div>
                {[
                  { value: currentPassword, set: setCurrentPassword, placeholder: "Current password", type: "password" },
                  { value: newPassword, set: setNewPassword, placeholder: "New password (min 8 characters)", type: "password" },
                  { value: confirmPassword, set: setConfirmPassword, placeholder: "Confirm new password", type: "password" },
                ].map(({ value, set, placeholder, type }) => (
                  <input key={placeholder} type={type} value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                    style={inputStyle} />
                ))}
                {confirmPassword && newPassword !== confirmPassword && (
                  <p style={{ fontSize: 13, color: "#f87171", fontFamily: "Inter,sans-serif" }}>Passwords don&apos;t match.</p>
                )}
                {changePassword.error && <p style={{ fontSize: 13, color: "#f87171", fontFamily: "Inter,sans-serif" }}>{changePassword.error.message}</p>}
                {changePassword.isSuccess && <p style={{ fontSize: 13, color: "#4ade80", fontFamily: "Inter,sans-serif" }}>Password updated!</p>}
                <button
                  onClick={() => changePassword.mutate({ currentPassword, newPassword })}
                  disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  style={{ width: "100%", padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif", background: GRADIENT, color: "#fff", opacity: (changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword) ? 0.5 : 1 }}
                >
                  {changePassword.isPending ? "Saving…" : "Update password"}
                </button>
              </div>
            )}
          </div>

          {/* Email */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "Inter,sans-serif" }}>Email</div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>{user?.email}</div>
          </div>

          {/* Blocked accounts */}
          <p style={sectionLabelStyle}>Blocked accounts</p>
          {blockedUsers.length === 0 ? (
            <p style={{ fontSize: 12, padding: "8px 0", color: "var(--muted)", fontFamily: "Inter,sans-serif" }}>You haven&apos;t blocked anyone.</p>
          ) : (
            <div>
              {blockedUsers.map((u) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                  {u.image ? (
                    <img src={u.image} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                      {(u.name ?? u.username ?? "?")[0].toUpperCase()}
                    </div>
                  )}
                  <span style={{ flex: 1, fontSize: 12, color: "var(--text)", fontFamily: "Inter,sans-serif", fontWeight: 500 }}>@{u.username}</span>
                  <button
                    onClick={() => unblockMutation.mutate({ username: u.username! })}
                    disabled={unblockMutation.isPending && unblockMutation.variables?.username === u.username}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "rgba(240,235,248,0.04)", color: "var(--muted)", cursor: "pointer", fontFamily: "Inter,sans-serif", opacity: (unblockMutation.isPending && unblockMutation.variables?.username === u.username) ? 0.3 : 1 }}
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Sign out */}
          <div style={{ paddingTop: 24 }}>
            <button
              onClick={() => signOut({ callbackUrl: "/signin" })}
              style={{ fontSize: 13, fontWeight: 600, color: "#f87171", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif", padding: 0 }}
            >
              Sign out
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsForm />
    </Suspense>
  )
}
