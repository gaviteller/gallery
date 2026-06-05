"use client"
import { useRef, useState } from "react"
import { trpc } from "@/components/providers"
import { uploadImage } from "@/lib/upload"

function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.onload = (e) => {
      const img = new window.Image()
      img.onerror = () => reject(new Error("Failed to load image"))
      img.onload = () => {
        let { width, height } = img
        const maxSize = 800
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
          else { width = Math.round((width * maxSize) / height); height = maxSize }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("Canvas not available")); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.82))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function StoryUpload({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const utils = trpc.useUtils()

  const createStory = trpc.story.create.useMutation({
    onSuccess: () => {
      utils.story.getFeed.invalidate()
      onSuccess()
    },
    onError: (err) => setError(err.message ?? "Failed to share story"),
  })

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setProcessing(true)
    try {
      const dataUrl = await processImage(file)
      setPreview(dataUrl)
    } catch {
      setError("Failed to process image")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl pb-8"
        style={{ background: "#1e0d3f", border: "1px solid #ffffff15" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full" style={{ background: "#ffffff20" }} />
        </div>

        <p className="text-base font-bold text-white px-4 mb-4">Add to your story</p>

        {!preview ? (
          <div className="px-4">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={processing}
              className="w-full py-10 rounded-2xl flex flex-col items-center gap-3 transition-colors"
              style={{ border: "2px dashed #ffffff20", background: "#ffffff05" }}
            >
              <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-white/40">{processing ? "Processing…" : "Tap to choose a photo"}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        ) : (
          <div className="px-4">
            <div className="rounded-2xl overflow-hidden mb-4" style={{ maxHeight: 320 }}>
              <img src={preview} alt="Preview" className="w-full object-cover" style={{ maxHeight: 320 }} />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = "" }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors"
                style={{ border: "1px solid #ffffff20" }}
              >
                Choose different
              </button>
              <button
                onClick={async () => {
                  if (!preview) return
                  setUploading(true)
                  try {
                    const url = await uploadImage(preview, "stories")
                    createStory.mutate({ image: url })
                  } catch (err) {
                    setError("Failed to upload story image. Please try again.")
                  } finally {
                    setUploading(false)
                  }
                }}
                disabled={createStory.isPending || uploading}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
              >
                {createStory.isPending || uploading ? "Sharing…" : "Share story"}
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-400 text-center mt-3 px-4">{error}</p>}
      </div>
    </div>
  )
}
