"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { trpc } from "@/components/providers"

export default function SettingsPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const { data: user, isLoading } = trpc.user.me.useQuery()

  const [tab, setTab] = useState<"profile" | "account">("profile")
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
    onSuccess: () => update(),
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
        <div className="text-gray-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <button
        onClick={() => router.push(username ? `/${username}` : "/")}
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

        {/* Photo */}
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
          disabled={updateProfile.isPending || photoProcessing}
          className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateProfile.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
      )}

      {/* ── Account tab ─────────────────────────────────────── */}
      {tab === "account" && (
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">

        {/* Commission toggle */}
        <div className="p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Open for commissions</div>
            <div className="text-xs text-gray-500 mt-0.5">Let people know you're available</div>
          </div>
          <button
            onClick={() => updateSelling.mutate({ enabled: !user?.sellingEnabled })}
            disabled={updateSelling.isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              user?.sellingEnabled ? "bg-blue-600" : "bg-gray-200"
            }`}
            role="switch"
            aria-checked={user?.sellingEnabled}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${user?.sellingEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Email */}
        <div className="p-5">
          <div className="text-sm font-medium text-gray-900">Email</div>
          <div className="text-sm text-gray-500 mt-0.5">{user?.email}</div>
        </div>

        {/* Sign out */}
        <div className="p-5">
          <button
            onClick={() => router.push("/api/auth/signout")}
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
