"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import React, { useEffect, useState, Suspense } from "react"
import { trpc } from "@/components/providers"
import { uploadImage } from "@/lib/upload"

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

      // Only upload if the value is a new base64 data URL (user picked a new image)
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

  const initials = (name || user?.username || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  if (status === "loading" || isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-white/40">Loading…</p></div>
  }

  const rowCls = "grid gap-4 py-3 border-b items-center" as const
  const rowStyle = { gridTemplateColumns: "120px 1fr", borderColor: "var(--border)" }
  const rowTopStyle = { ...rowStyle, alignItems: "flex-start", paddingTop: 14, paddingBottom: 14 }
  const labelCls = "text-xs font-medium" as const
  const inputStyle = {
    width: "100%", background: "rgba(240,235,248,0.05)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text)", fontFamily: "inherit",
  }
  const ghostBtnStyle = {
    fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7,
    background: "rgba(240,235,248,0.06)", border: "1px solid var(--border)", color: "var(--muted)",
  }
  const gradBtnStyle = {
    fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7,
    background: "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", color: "#fff",
  }
  const toggleStyle = (on: boolean): React.CSSProperties => ({
    width: 42, height: 24, borderRadius: 99, display: "flex", alignItems: "center",
    padding: 2, flexShrink: 0, flexDirection: "row",
    background: on ? "linear-gradient(90deg,#FF3CAC,#784BA0)" : "rgba(240,235,248,0.1)",
    border: on ? "none" : "1px solid var(--border)",
  })

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <button
        onClick={() => router.push(username ? `/@${username}` : "/")}
        className="flex items-center gap-1.5 text-sm transition-colors mb-6"
        style={{ color: "var(--muted)" }}
      >
        ← Back to profile
      </button>

      <h1 className="font-playfair text-2xl font-bold mb-6" style={{ color: "var(--text)" }}>Settings</h1>

      {/* Tabs */}
      <div className="mb-6" style={{ borderBottom: "1px solid var(--border)" }}>
        <nav className="flex gap-6">
          {(["profile", "account"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="pb-3 text-sm font-medium transition-colors capitalize"
              style={{
                color: tab === t ? "var(--text)" : "var(--muted)",
                borderBottom: tab === t ? "2px solid" : "2px solid transparent",
                borderImage: tab === t ? "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5) 1" : undefined,
                marginBottom: -1,
              }}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Profile tab ─────────────────────────────────────── */}
      {tab === "profile" && (
      <div className="flex flex-col mb-6">

        {/* APPEARANCE section */}
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--muted)" }}>Appearance</p>

        {/* Photo row */}
        <div className={rowCls} style={rowStyle}>
          <div>
            <p className={labelCls} style={{ color: "var(--muted)" }}>Photo</p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(107,95,136,0.65)" }}>Your public avatar</p>
          </div>
          <div className="flex items-center gap-3">
            {image ? (
              <img src={image} alt="Profile" className="rounded-full object-cover flex-shrink-0" style={{ width: 44, height: 44, border: "2px solid var(--border)" }} />
            ) : (
              <div className="rounded-full flex items-center justify-center font-playfair font-bold flex-shrink-0 text-sm" style={{ width: 44, height: 44, background: "linear-gradient(135deg,#FF3CAC,#784BA0,#2B86C5)", padding: 2 }}>
                <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: "#2A1838", color: "rgba(240,235,248,0.6)" }}>{initials}</div>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="cursor-pointer" style={gradBtnStyle}>
                {photoProcessing ? "Processing…" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={photoProcessing} />
              </label>
              {image && (
                <button onClick={() => setImage(null)} style={ghostBtnStyle}>Remove</button>
              )}
            </div>
          </div>
        </div>

        {/* Banner row */}
        <div className={rowCls} style={rowTopStyle}>
          <div>
            <p className={labelCls} style={{ color: "var(--muted)" }}>Banner</p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(107,95,136,0.65)" }}>Top of your profile</p>
          </div>
          <div>
            {bannerImage ? (
              <div className="relative rounded-lg overflow-hidden mb-2" style={{ height: 52 }}>
                <img src={bannerImage} alt="Banner" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="rounded-lg mb-2 flex items-center justify-center text-[11px]" style={{ height: 52, border: "1px dashed var(--border)", color: "var(--muted)", background: "rgba(240,235,248,0.02)" }}>
                No banner — gradient will be used
              </div>
            )}
            <div className="flex gap-2">
              <label className="cursor-pointer" style={gradBtnStyle}>
                {bannerProcessing ? "Processing…" : "Upload banner"}
                <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} disabled={bannerProcessing} />
              </label>
              {bannerImage && (
                <button onClick={() => setBannerImage(null)} style={ghostBtnStyle}>Remove</button>
              )}
            </div>
          </div>
        </div>

        {/* IDENTITY section */}
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] mt-5 mb-2" style={{ color: "var(--muted)" }}>Identity</p>

        {/* Display name row */}
        <div className={rowCls} style={rowStyle}>
          <p className={labelCls} style={{ color: "var(--muted)" }}>Display name</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            style={inputStyle}
            className="focus:outline-none"
          />
        </div>

        {/* Show real name toggle */}
        {user?.name && (
          <div className={rowCls} style={rowStyle}>
            <div>
              <p className={labelCls} style={{ color: "var(--muted)" }}>Show real name</p>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(107,95,136,0.65)" }}>On your public profile</p>
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
        <div className={rowCls} style={rowTopStyle}>
          <div>
            <p className={labelCls} style={{ color: "var(--muted)" }}>Bio</p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(107,95,136,0.65)" }}>Up to 160 chars</p>
          </div>
          <div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              placeholder="Tell people about your work…"
              style={{ ...inputStyle, height: 72, resize: "none" }}
              className="focus:outline-none"
            />
            <p className="text-[10px] text-right mt-1" style={{ color: "var(--muted)" }}>{bio.length}/160</p>
          </div>
        </div>

        {/* LINKS section */}
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] mt-5 mb-2" style={{ color: "var(--muted)" }}>Links</p>

        {(
          [
            { icon: "🌐", label: "Website",    placeholder: "https://yoursite.com", value: websiteUrl,       set: setWebsiteUrl },
            { icon: "𝕏",  label: "Twitter / X", placeholder: "@handle",             value: twitterHandle,   set: setTwitterHandle },
            { icon: "📸", label: "Instagram",   placeholder: "@handle",             value: instagramHandle, set: setInstagramHandle },
            { icon: "🎨", label: "ArtStation",  placeholder: "username",            value: artstationHandle, set: setArtstationHandle },
          ] as const
        ).map(({ icon, label, placeholder, value, set }) => (
          <div key={label} className={rowCls} style={rowStyle}>
            <p className={labelCls} style={{ color: "var(--muted)" }}>{label}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm w-5 text-center flex-shrink-0">{icon}</span>
              <input
                type="text"
                value={value}
                onChange={(e) => (set as (v: string) => void)(e.target.value)}
                placeholder={placeholder}
                style={{ ...inputStyle, fontSize: 12 }}
                className="focus:outline-none flex-1"
              />
            </div>
          </div>
        ))}

        {updateProfile.error && (
          <p className="text-sm text-red-400 mt-4">{updateProfile.error.message}</p>
        )}
        {saveError && (
          <p className="text-sm text-red-400 mt-4">{saveError}</p>
        )}

        <button
          onClick={handleSave}
          disabled={updateProfile.isPending || photoProcessing || bannerProcessing || isUploading}
          className="w-full py-3 rounded-xl text-sm font-bold mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", color: "#fff" }}
        >
          {isUploading ? "Uploading…" : updateProfile.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
      )}

      {/* ── Account tab ─────────────────────────────────────── */}
      {tab === "account" && (
      <div className="flex flex-col">

        {/* PREFERENCES */}
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--muted)" }}>Preferences</p>

        {/* Commissions toggle */}
        <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Commissions</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
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
        <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Location-based ad targeting</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Opt out to stop location from personalising ads.</div>
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

        {/* ACCOUNT */}
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] mt-5 mb-2" style={{ color: "var(--muted)" }}>Account</p>

        {/* Change username */}
        <div className="border-b" style={{ borderColor: "var(--border)" }}>
          {accountSection !== "username" ? (
            <button
              onClick={() => setAccountSection("username")}
              className="w-full flex items-center justify-between py-3 transition-colors text-left"
            >
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Username</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>@{user?.username}</div>
              </div>
              <span className="text-lg" style={{ color: "var(--muted)" }}>›</span>
            </button>
          ) : (
            <div className="py-3 flex flex-col gap-3">
              <button onClick={closeSection} className="text-xs text-left" style={{ color: "var(--muted)" }}>← Back</button>
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Change username</div>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder={`Current: @${user?.username}`}
                maxLength={30}
                style={inputStyle}
                className="focus:outline-none"
              />
              {changeUsername.error && <p className="text-xs text-red-400">{changeUsername.error.message}</p>}
              {changeUsername.isSuccess && <p className="text-xs text-green-400">Username updated!</p>}
              <button
                onClick={() => changeUsername.mutate({ username: newUsername.trim() })}
                disabled={changeUsername.isPending || !newUsername.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", color: "#fff" }}
              >
                {changeUsername.isPending ? "Saving…" : "Save username"}
              </button>
            </div>
          )}
        </div>

        {/* Change password */}
        <div className="border-b" style={{ borderColor: "var(--border)" }}>
          {accountSection !== "password" ? (
            <button
              onClick={() => setAccountSection("password")}
              className="w-full flex items-center justify-between py-3 transition-colors text-left"
            >
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Password</div>
              <span className="text-lg" style={{ color: "var(--muted)" }}>›</span>
            </button>
          ) : (
            <div className="py-3 flex flex-col gap-3">
              <button onClick={closeSection} className="text-xs text-left" style={{ color: "var(--muted)" }}>← Back</button>
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Change password</div>
              {[
                { value: currentPassword, set: setCurrentPassword, placeholder: "Current password", type: "password" },
                { value: newPassword, set: setNewPassword, placeholder: "New password (min 8 characters)", type: "password" },
                { value: confirmPassword, set: setConfirmPassword, placeholder: "Confirm new password", type: "password" },
              ].map(({ value, set, placeholder, type }) => (
                <input key={placeholder} type={type} value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                  style={inputStyle} className="focus:outline-none" />
              ))}
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-400">Passwords don&apos;t match.</p>
              )}
              {changePassword.error && <p className="text-xs text-red-400">{changePassword.error.message}</p>}
              {changePassword.isSuccess && <p className="text-xs text-green-400">Password updated!</p>}
              <button
                onClick={() => changePassword.mutate({ currentPassword, newPassword })}
                disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: "linear-gradient(90deg,#FF3CAC,#784BA0,#2B86C5)", color: "#fff" }}
              >
                {changePassword.isPending ? "Saving…" : "Update password"}
              </button>
            </div>
          )}
        </div>

        {/* Email */}
        <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Email</div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>{user?.email}</div>
        </div>

        {/* Blocked accounts */}
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] mt-5 mb-2" style={{ color: "var(--muted)" }}>Blocked accounts</p>
        {blockedUsers.length === 0 ? (
          <p className="text-sm py-2" style={{ color: "var(--muted)" }}>You haven&apos;t blocked anyone.</p>
        ) : (
          <div>
            {blockedUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-3">
                  {user.image ? (
                    <img src={user.image} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                      {(user.name ?? user.username ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-gray-700">@{user.username}</span>
                  </div>
                  <button
                    onClick={() => unblockMutation.mutate({ username: user.username! })}
                    disabled={unblockMutation.isPending && unblockMutation.variables?.username === user.username}
                    className="text-xs transition disabled:opacity-30"
                    style={{ color: "var(--muted)", padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "rgba(240,235,248,0.04)" }}
                  >
                    Unblock
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* Sign out */}
        <div className="pt-6">
          <button
            onClick={() => signOut({ callbackUrl: "/signin" })}
            className="text-sm font-medium transition-colors text-red-400 hover:text-red-300"
          >
            Sign out
          </button>
        </div>
      </div>
      )}
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
