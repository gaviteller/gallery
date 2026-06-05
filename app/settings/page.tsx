"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
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

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <button
        onClick={() => router.push(username ? `/@${username}` : "/")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
      >
        ← Back to profile
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {(["profile", "account"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Profile tab ─────────────────────────────────────── */}
      {tab === "profile" && (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-6 mb-6">

        {/* Profile photo */}
        <div className="flex items-center gap-4">
          {image ? (
            <img src={image} alt="Profile" className="rounded-full object-cover flex-shrink-0" style={{ width: 72, height: 72 }} />
          ) : (
            <div className="rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold flex-shrink-0" style={{ width: 72, height: 72 }}>
              {initials}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">Profile photo</p>
            <div className="flex gap-2 mt-2">
              <label className="cursor-pointer text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
                {photoProcessing ? "Processing…" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={photoProcessing} />
              </label>
              {image && (
                <button onClick={() => setImage(null)} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profile banner */}
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-2">Profile banner</p>
          <p className="text-xs text-gray-400 mb-3">Shown at the top of your profile. Recommended: wide landscape image.</p>
          {bannerImage ? (
            <div className="relative rounded-xl overflow-hidden mb-2" style={{ height: 80 }}>
              <img src={bannerImage} alt="Banner" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="rounded-xl mb-2 flex items-center justify-center text-xs text-gray-400"
              style={{ height: 80, background: "#f3f4f6", border: "2px dashed #d1d5db" }}
            >
              No banner set — a gradient will be used
            </div>
          )}
          <div className="flex gap-2">
            <label className="cursor-pointer text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
              {bannerProcessing ? "Processing…" : "Upload banner"}
              <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} disabled={bannerProcessing} />
            </label>
            {bannerImage && (
              <button onClick={() => setBannerImage(null)} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Display name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {user?.name && (
            <div className="flex items-center justify-between mt-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Show my real name on my profile</p>
                <p className="text-xs text-gray-400 mt-0.5">When on, your real name appears on your public profile page.</p>
              </div>
              <button
                onClick={() => {
                  const next = !showRealName
                  setShowRealName(next)
                  updateShowRealName.mutate({ showRealName: next })
                }}
                disabled={updateShowRealName.isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                  showRealName ? "bg-blue-600" : "bg-gray-200"
                }`}
                role="switch"
                aria-checked={showRealName}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showRealName ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          )}
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            placeholder="Tell people about your work…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">{bio.length}/160</p>
        </div>

        {/* Links */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Links</p>
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
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        {updateProfile.error && (
          <p className="text-sm text-red-500">{updateProfile.error.message}</p>
        )}

        <button
          onClick={handleSave}
          disabled={updateProfile.isPending || photoProcessing || bannerProcessing}
          className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateProfile.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
      )}

      {/* ── Account tab ─────────────────────────────────────── */}
      {tab === "account" && (
      <div className="flex flex-col gap-4">

        {/* Commission toggle */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Commissions</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {user?.sellingEnabled ? "Visible on your profile" : "Not shown on your profile"}
            </div>
          </div>
          <button
            onClick={() => updateSelling.mutate({ enabled: !user?.sellingEnabled })}
            disabled={updateSelling.isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
              user?.sellingEnabled ? "bg-blue-600" : "bg-gray-200"
            }`}
            role="switch"
            aria-checked={user?.sellingEnabled}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${user?.sellingEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Ad targeting opt-out */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Opt out of location-based ad targeting</div>
            <div className="text-xs text-gray-500 mt-0.5">
              When on, your location will not be used to personalise ads shown to you.
            </div>
          </div>
          <button
            onClick={() => {
              const next = !adTargetingOptOut
              setAdTargetingOptOut(next)
              updateAdTargeting.mutate({ optOut: next })
            }}
            disabled={updateAdTargeting.isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
              adTargetingOptOut ? "bg-blue-600" : "bg-gray-200"
            }`}
            role="switch"
            aria-checked={adTargetingOptOut}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${adTargetingOptOut ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Change username */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {accountSection !== "username" ? (
            <button
              onClick={() => setAccountSection("username")}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
            >
              <div className="text-left">
                <div className="text-sm font-medium text-gray-900">Username</div>
                <div className="text-xs text-gray-500 mt-0.5">@{user?.username}</div>
              </div>
              <span className="text-gray-400 text-lg">›</span>
            </button>
          ) : (
            <div className="p-5 flex flex-col gap-3">
              <button onClick={closeSection} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-1">
                ← Back
              </button>
              <div className="text-sm font-medium text-gray-900">Change username</div>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder={`Current: @${user?.username}`}
                maxLength={30}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {changeUsername.error && <p className="text-xs text-red-500">{changeUsername.error.message}</p>}
              {changeUsername.isSuccess && <p className="text-xs text-green-600">Username updated!</p>}
              <button
                onClick={() => changeUsername.mutate({ username: newUsername.trim() })}
                disabled={changeUsername.isPending || !newUsername.trim()}
                className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changeUsername.isPending ? "Saving…" : "Save username"}
              </button>
            </div>
          )}
        </div>

        {/* Change password */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {accountSection !== "password" ? (
            <button
              onClick={() => setAccountSection("password")}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
            >
              <div className="text-sm font-medium text-gray-900">Password</div>
              <span className="text-gray-400 text-lg">›</span>
            </button>
          ) : (
            <div className="p-5 flex flex-col gap-3">
              <button onClick={closeSection} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-1">
                ← Back
              </button>
              <div className="text-sm font-medium text-gray-900">Change password</div>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords don&apos;t match.</p>
              )}
              {changePassword.error && <p className="text-xs text-red-500">{changePassword.error.message}</p>}
              {changePassword.isSuccess && <p className="text-xs text-green-600">Password updated!</p>}
              <button
                onClick={() => changePassword.mutate({ currentPassword, newPassword })}
                disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changePassword.isPending ? "Saving…" : "Update password"}
              </button>
            </div>
          )}
        </div>

        {/* Email */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-900">Email</div>
          <div className="text-sm text-gray-500 mt-0.5">{user?.email}</div>
        </div>

        {/* Blocked accounts */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-900 mb-3">Blocked accounts</div>
          {blockedUsers.length === 0 ? (
            <p className="text-sm text-gray-400">You haven&apos;t blocked anyone.</p>
          ) : (
            <div className="space-y-3">
              {blockedUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      <img src={user.image} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold">
                        {(user.name ?? user.username ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-gray-700">@{user.username}</span>
                  </div>
                  <button
                    onClick={() => unblockMutation.mutate({ username: user.username! })}
                    disabled={unblockMutation.isPending && unblockMutation.variables?.username === user.username}
                    className="text-xs text-gray-400 hover:text-gray-600 transition disabled:opacity-30"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sign out */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <button
            onClick={() => signOut({ callbackUrl: "/signin" })}
            className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
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
