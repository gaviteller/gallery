"use client"

import { use, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"
import { uploadImage } from "@/lib/upload"

export default function NewListingPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = use(params)
  const displayUsername = username.startsWith("@") ? username.slice(1) : username
  const { data: session, status } = useSession()
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [tags, setTags] = useState("")
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const createMutation = trpc.shop.create.useMutation({
    onSuccess: () => router.push(`/@${displayUsername}/shop`),
    onError: (err) => {
      setError(err.message)
      setUploading(false)
    },
  })

  if (
    status === "authenticated" &&
    session.user?.username?.toLowerCase() !== displayUsername.toLowerCase()
  ) {
    router.replace(`/@${displayUsername}/shop`)
    return null
  }
  if (status === "unauthenticated") {
    router.replace("/signin")
    return null
  }
  if (status === "loading") return null

  function handlePreviewChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPreviewDataUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!previewDataUrl) {
      setError("Please upload an image.")
      return
    }
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0.99) {
      setError("Price must be at least $0.99.")
      return
    }

    setUploading(true)
    setError("")

    try {
      const imageUrl = await uploadImage(previewDataUrl, "shop-previews")

      const tagList = tags
        .split(",")
        .map(t => t.trim())
        .filter(Boolean)
        .slice(0, 10)

      createMutation.mutate({
        image: imageUrl,
        fileUrl: imageUrl,
        title,
        description: description || undefined,
        price: priceNum,
        tags: tagList,
      })
    } catch {
      setError("Upload failed. Please try again.")
      setUploading(false)
    }
  }

  const inputStyle = {
    background: "#1a1a2e",
    border: "1px solid rgba(255,255,255,0.08)",
  }
  const inputClass =
    "w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-purple-500"

  return (
    <div className="min-h-screen pb-24 md:pl-16" style={{ background: "#0D0D0F" }}>
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-sm mb-2 transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-white">New listing</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Image */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Image *
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePreviewChange}
              required
              className="w-full text-sm text-white/50 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white/70 hover:file:bg-white/15"
            />
            {previewDataUrl && (
              <img
                src={previewDataUrl}
                alt="Preview"
                className="mt-2 rounded-xl object-cover"
                style={{ maxHeight: 200, maxWidth: "100%" }}
              />
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
              required
              placeholder="e.g. Watercolour brush pack"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Description{" "}
              <span className="font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>
                (optional)
              </span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Describe what buyers will receive…"
              className={`${inputClass} resize-none`}
              style={inputStyle}
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Price (USD) *
            </label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                $
              </span>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                min="0.99"
                step="0.01"
                required
                placeholder="9.99"
                className={`${inputClass} pl-6`}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Tags{" "}
              <span className="font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>
                comma-separated, up to 10
              </span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="brush pack, watercolour, digital art"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={uploading || createMutation.isPending}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}
          >
            {uploading || createMutation.isPending ? "Publishing…" : "Publish listing"}
          </button>
        </form>
      </div>
    </div>
  )
}
