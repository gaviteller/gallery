"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { trpc } from "@/components/providers"

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
  const [photoProcessing, setPhotoProcessing] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name ?? "")
      setBio(user.bio ?? "")
      setImage(user.image ?? null)
      setWebsiteUrl(user.websiteUrl ?? "")
      setTwitterHandle(user.twitterHandle ?? "")
      setInstagramHandle(user.instagramHandle ?? "")
      setArtstationHandle(user.artstationHandle ?? "")
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

  function handleSave() {
    updateProfile.mutate({
      name: name.trim() || (user?.name ?? "Artist"),
      bio: bio.trim() || null,
      image: image || null,
      websiteUrl: websiteUrl.trim() || null,
      twitterHandle: twitterHandle.trim() || null,
      instagramHandle: instagramHandle.trim() || null,
      artstationHandle: artstationHandle.trim() || null,
    })
  }

  const initials = (name || user?.username || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/40">Loading…</div>
      </div>
    )
  }

  const inputClass = "w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
  const inputStyle = { background: "#ffffff10", border: "1px solid #ffffff15" }

  return (
    <div className="max-w-lg mx-auto px-4 py-12 pb-24">
      <button
        onClick={() => router.push(username ? `/@${username}` : "/")}
        className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-6"
      >
        ← Back to profile
      </button>

      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: "#ffffff08" }}>
        {(["profile", "account"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
              tab === t ? "text-white" : "text-white/40 hover:text-white/70"
            }`}
            style={tab === t ? { background: "#0D1640" } : {}}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Profile tab ─────────────────────────────────────── */}
      {tab === "profile" && (
        <div className="rounded-2xl p-6 flex flex-col gap-6 mb-6" style={{ background: "#0D1640", border: "1px solid #ffffff15" }}>

          {/* Photo */}
          <div className="flex items-center gap-4">
            {image ? (
              <img src={image} alt="Profile" className="rounded-full object-cover flex-shrink-0" style={{ width: 72, height: 72 }} />
            ) : (
              <div className="rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0" style={{ width: 72, height: 72, background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}>
                {initials}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-white">Profile photo</p>
              <div className="flex gap-2 mt-2">
                <label className="cursor-pointer text-sm px-3 py-1.5 rounded-lg text-white transition-colors hover:opacity-80" style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}>
                  {photoProcessing ? "Processing…" : "Upload photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={photoProcessing} />
                </label>
                {image && (
                  <button onClick={() => setImage(null)} className="text-sm px-3 py-1.5 rounded-lg text-white/50 hover:text-white transition-colors" style={{ border: "1px solid #ffffff15" }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Display name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} style={inputStyle} />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              placeholder="Tell people about your work…"
              className={`${inputClass} resize-none`}
              style={inputStyle}
            />
            <p className="text-xs text-white/30 mt-1">{bio.length}/160</p>
          </div>

          {/* Links */}
          <div>
            <p className="text-sm font-medium text-white/60 mb-2">Links</p>
            <div className="flex flex-col gap-2">
              {(
                [
                  { icon: "🌐", placeholder: "Website  https://yoursite.com", value: websiteUrl, set: setWebsiteUrl },
                  { icon: "𝕏",  placeholder: "Twitter / X  @handle",         value: twitterHandle, set: setTwitterHandle },
                  { icon: "📸", placeholder: "Instagram  @handle",            value: instagramHandle, set: setInstagramHandle },
                  { icon: "🎨", placeholder: "ArtStation  username",          value: artstationHandle, set: setArtstationHandle },
                ] as const
              ).map(({ icon, placeholder, value, set }) => (
                <div key={placeholder} className="flex items-center gap-2">
                  <span className="w-6 text-center text-base select-none">{icon}</span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => (set as (v: string) => void)(e.target.value)}
                    placeholder={placeholder}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>

          {updateProfile.error && (
            <p className="text-sm text-red-400">{updateProfile.error.message}</p>
          )}

          <button
            onClick={handleSave}
            disabled={updateProfile.isPending || photoProcessing}
            className="w-full text-white py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}
          >
            {updateProfile.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}

      {/* ── Account tab ─────────────────────────────────────── */}
      {tab === "account" && (
        <div className="flex flex-col gap-3">

          {/* Commission toggle */}
          <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: "#0D1640", border: "1px solid #ffffff15" }}>
            <div>
              <div className="text-sm font-medium text-white">Commissions</div>
              <div className="text-xs text-white/40 mt-0.5">
                {user?.sellingEnabled ? "Visible on your profile" : "Not shown on your profile"}
              </div>
            </div>
            <button
              onClick={() => updateSelling.mutate({ enabled: !user?.sellingEnabled })}
              disabled={updateSelling.isPending}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                user?.sellingEnabled ? "bg-sky-600" : "bg-white/20"
              }`}
              role="switch"
              aria-checked={user?.sellingEnabled}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${user?.sellingEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {/* Change username */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#0D1640", border: "1px solid #ffffff15" }}>
            {accountSection !== "username" ? (
              <button
                onClick={() => setAccountSection("username")}
                className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
              >
                <div className="text-left">
                  <div className="text-sm font-medium text-white">Username</div>
                  <div className="text-xs text-white/40 mt-0.5">@{user?.username}</div>
                </div>
                <span className="text-white/30 text-lg">›</span>
              </button>
            ) : (
              <div className="p-5 flex flex-col gap-3">
                <button onClick={closeSection} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-1">
                  ← Back
                </button>
                <div className="text-sm font-medium text-white">Change username</div>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder={`Current: @${user?.username}`}
                  maxLength={30}
                  className={inputClass}
                  style={inputStyle}
                />
                {changeUsername.error && <p className="text-xs text-red-400">{changeUsername.error.message}</p>}
                {changeUsername.isSuccess && <p className="text-xs text-green-400">Username updated!</p>}
                <button
                  onClick={() => changeUsername.mutate({ username: newUsername.trim() })}
                  disabled={changeUsername.isPending || !newUsername.trim()}
                  className="w-full text-white py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}
                >
                  {changeUsername.isPending ? "Saving…" : "Save username"}
                </button>
              </div>
            )}
          </div>

          {/* Change password */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#0D1640", border: "1px solid #ffffff15" }}>
            {accountSection !== "password" ? (
              <button
                onClick={() => setAccountSection("password")}
                className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
              >
                <div className="text-sm font-medium text-white">Password</div>
                <span className="text-white/30 text-lg">›</span>
              </button>
            ) : (
              <div className="p-5 flex flex-col gap-3">
                <button onClick={closeSection} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-1">
                  ← Back
                </button>
                <div className="text-sm font-medium text-white">Change password</div>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className={inputClass} style={inputStyle} />
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 8 characters)" className={inputClass} style={inputStyle} />
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className={inputClass} style={inputStyle} />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-400">Passwords don&apos;t match.</p>
                )}
                {changePassword.error && <p className="text-xs text-red-400">{changePassword.error.message}</p>}
                {changePassword.isSuccess && <p className="text-xs text-green-400">Password updated!</p>}
                <button
                  onClick={() => changePassword.mutate({ currentPassword, newPassword })}
                  disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  className="w-full text-white py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #00D4FF 0%, #6B5EFF 50%, #FF5EE8 100%)" }}
                >
                  {changePassword.isPending ? "Saving…" : "Update password"}
                </button>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="rounded-2xl p-5" style={{ background: "#0D1640", border: "1px solid #ffffff15" }}>
            <div className="text-sm font-medium text-white">Email</div>
            <div className="text-sm text-white/40 mt-0.5">{user?.email}</div>
          </div>

          {/* Sign out */}
          <div className="rounded-2xl p-5" style={{ background: "#0D1640", border: "1px solid #ffffff15" }}>
            <button
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
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
