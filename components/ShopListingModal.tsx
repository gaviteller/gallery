"use client"

import { useState } from "react"
import { trpc } from "@/components/providers"
import { uploadImage } from "@/lib/upload"
import { uploadFile } from "@/lib/uploadFile"

interface Props {
  username: string
  onClose: () => void
  onSuccess?: () => void
}

export default function ShopListingModal({ username, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [tags, setTags] = useState("")
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [digitalFile, setDigitalFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const createMutation = trpc.shop.create.useMutation({
    onSuccess: () => {
      onSuccess?.()
      onClose()
    },
    onError: (err) => {
      setError(err.message)
      setUploading(false)
    },
  })

  function handlePreviewChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPreviewDataUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!previewDataUrl || !digitalFile) {
      setError("Please provide a preview image and a digital file.")
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

      const fileDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target?.result as string)
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsDataURL(digitalFile!)
      })
      const filePublicId = await uploadFile(fileDataUrl, digitalFile!.name)

      const tagList = tags
        .split(",")
        .map(t => t.trim())
        .filter(Boolean)
        .slice(0, 10)

      createMutation.mutate({
        image: imageUrl,
        fileUrl: filePublicId,
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

  const inputStyle = { background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.08)" }
  const inputClass = "w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-purple-500"

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-y-auto"
        style={{ background: "#0D0D0F", border: "1px solid rgba(255,255,255,0.08)", maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h2 className="text-base font-semibold text-white">New shop listing</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          {/* Preview image */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Preview image *
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePreviewChange}
              required
              className="w-full text-sm text-white/50 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white/70 hover:file:bg-white/15"
            />
            {previewDataUrl && (
              <img src={previewDataUrl} alt="Preview" className="mt-2 rounded-xl object-cover" style={{ maxHeight: 160, maxWidth: "100%" }} />
            )}
          </div>

          {/* Digital file */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Digital file *{" "}
              <span className="font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>PNG, JPG, PDF, ZIP, PSD — max 50 MB</span>
            </label>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,.zip,.psd,.procreate,.webp,.gif"
              onChange={e => setDigitalFile(e.target.files?.[0] ?? null)}
              required
              className="w-full text-sm text-white/50 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white/70 hover:file:bg-white/15"
            />
            {digitalFile && (
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                {digitalFile.name} ({(digitalFile.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} required placeholder="e.g. Watercolour brush pack" className={inputClass} style={inputStyle} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Description{" "}
              <span className="font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>(what&apos;s included, format, resolution)</span>
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder="Describe what buyers will receive…" className={`${inputClass} resize-none`} style={inputStyle} />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>Price (USD) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>$</span>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0.99" step="0.01" required placeholder="9.99" className={`${inputClass} pl-6`} style={inputStyle} />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Tags{" "}
              <span className="font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>comma-separated, up to 10</span>
            </label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="brush pack, watercolour, digital art" className={inputClass} style={inputStyle} />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-colors" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              Cancel
            </button>
            <button type="submit" disabled={uploading || createMutation.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50" style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 100%)" }}>
              {uploading || createMutation.isPending ? "Publishing…" : "Publish listing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
