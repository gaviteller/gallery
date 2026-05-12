"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/components/providers"

type Category = { name: string; options: string[] }

type Props = {
  artistId: string
  artistUsername: string
  categories: Category[]
  onClose: () => void
}

function processImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        const maxSize = 1200
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
          else { width = Math.round((width * maxSize) / height); height = maxSize }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width; canvas.height = height
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.85))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function CommissionRequestModal({ artistId, artistUsername, categories, onClose }: Props) {
  const router = useRouter()
  const [description, setDescription] = useState("")
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [refPhotos, setRefPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const submitRequest = trpc.commission.submitRequest.useMutation({
    onSuccess: (commission) => {
      onClose()
      router.push(`/professional-dms/${commission.id}`)
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  function setSelection(categoryName: string, value: string) {
    setSelections(prev => ({ ...prev, [categoryName]: value }))
  }

  async function handleRefPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    if (refPhotos.length + files.length > 5) {
      setError("Maximum 5 reference photos")
      return
    }
    setUploading(true)
    const processed = await Promise.all(files.map(f => processImage(f)))
    setRefPhotos(prev => [...prev, ...processed])
    setUploading(false)
  }

  function removeRefPhoto(i: number) {
    setRefPhotos(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit() {
    setError("")

    if (!description.trim()) {
      setError("Please describe what you want")
      return
    }

    // All dropdowns are mandatory
    for (const cat of categories) {
      if (!selections[cat.name]) {
        setError(`Please select an option for "${cat.name}"`)
        return
      }
    }

    submitRequest.mutate({
      artistId,
      description: description.trim(),
      dropdownSelections: selections,
      referencePhotos: refPhotos,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl flex flex-col max-h-screen sm:max-h-[90vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Request a commission</h2>
            <p className="text-xs text-gray-400 mt-0.5">@{artistUsername}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              Describe what you want <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Be as detailed as possible — character description, mood, setting, any specific requirements…"
              rows={5}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Artist-defined dropdowns */}
          {categories.map(cat => (
            <div key={cat.name}>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                {cat.name} <span className="text-red-400">*</span>
              </label>
              <select
                value={selections[cat.name] ?? ""}
                onChange={e => setSelection(cat.name, e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>Select {cat.name.toLowerCase()}…</option>
                {cat.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          ))}

          {/* Reference photos (optional) */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              Reference photos <span className="text-gray-400 font-normal">(optional, max 5)</span>
            </label>
            {refPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {refPhotos.map((photo, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeRefPhoto(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {refPhotos.length < 5 && (
              <label className="flex items-center gap-2 cursor-pointer px-4 py-3 border border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm text-gray-500">{uploading ? "Processing…" : "Add reference photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleRefPhotoUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-5 py-4">
          <button
            onClick={handleSubmit}
            disabled={submitRequest.isPending || uploading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitRequest.isPending ? "Sending request…" : "Send commission request"}
          </button>
        </div>
      </div>
    </div>
  )
}
