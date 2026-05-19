"use client"

import { useRef, useState, useEffect, useCallback } from "react"

interface Props {
  src: string
  onConfirm: (croppedDataUrl: string) => void
  onCancel: () => void
}

export default function ImageCropEditor({ src, onConfirm, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState(0)
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (containerRef.current) setContainerSize(containerRef.current.offsetWidth)
  }, [])

  const baseScale =
    containerSize > 0 && naturalSize.w > 0
      ? Math.max(containerSize / naturalSize.w, containerSize / naturalSize.h)
      : 1

  const totalScale = baseScale * scale
  const displayW = naturalSize.w * totalScale
  const displayH = naturalSize.h * totalScale

  const clamp = useCallback(
    (ox: number, oy: number) => {
      const maxX = Math.max(0, (displayW - containerSize) / 2)
      const maxY = Math.max(0, (displayH - containerSize) / 2)
      return {
        x: Math.max(-maxX, Math.min(maxX, ox)),
        y: Math.max(-maxY, Math.min(maxY, oy)),
      }
    },
    [displayW, displayH, containerSize]
  )

  // Re-clamp when scale changes so image never leaves the frame
  useEffect(() => {
    setOffset((prev) => clamp(prev.x, prev.y))
  }, [scale, clamp])

  const startDrag = (x: number, y: number) => {
    dragging.current = true
    lastPos.current = { x, y }
  }
  const moveDrag = (x: number, y: number) => {
    if (!dragging.current) return
    const dx = x - lastPos.current.x
    const dy = y - lastPos.current.y
    lastPos.current = { x, y }
    setOffset((prev) => clamp(prev.x + dx, prev.y + dy))
  }
  const endDrag = () => { dragging.current = false }

  const handleConfirm = () => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const outSize = 1080
      const canvas = document.createElement("canvas")
      canvas.width = outSize
      canvas.height = outSize
      const ctx = canvas.getContext("2d")!

      const imgLeft = containerSize / 2 - displayW / 2 + offset.x
      const imgTop = containerSize / 2 - displayH / 2 + offset.y
      const srcX = -imgLeft / totalScale
      const srcY = -imgTop / totalScale
      const srcW = containerSize / totalScale
      const srcH = containerSize / totalScale

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outSize, outSize)
      onConfirm(canvas.toDataURL("image/jpeg", 0.92))
    }
    img.src = src
  }

  const imgLeft = containerSize > 0 ? containerSize / 2 - displayW / 2 + offset.x : 0
  const imgTop = containerSize > 0 ? containerSize / 2 - displayH / 2 + offset.y : 0

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-white/40 text-center">Drag to reposition · pinch or slide to zoom</p>

      {/* Square crop window */}
      <div
        ref={containerRef}
        style={{ position: "relative", width: "100%", aspectRatio: "1/1", overflow: "hidden", borderRadius: 12, background: "#000", cursor: dragging.current ? "grabbing" : "grab", touchAction: "none" }}
        onMouseDown={(e) => { startDrag(e.clientX, e.clientY); e.preventDefault() }}
        onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => { moveDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault() }}
        onTouchEnd={endDrag}
      >
        {containerSize > 0 && (
          <img
            src={src}
            alt="Crop preview"
            onLoad={(e) => {
              const el = e.currentTarget
              setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight })
            }}
            draggable={false}
            style={{ position: "absolute", width: displayW, height: displayH, left: imgLeft, top: imgTop, userSelect: "none", pointerEvents: "none" }}
          />
        )}
        {/* Rule-of-thirds grid */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {[33.33, 66.66].map((p) => (
            <div key={`v${p}`} style={{ position: "absolute", left: `${p}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.15)" }} />
          ))}
          {[33.33, 66.66].map((p) => (
            <div key={`h${p}`} style={{ position: "absolute", top: `${p}%`, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.15)" }} />
          ))}
        </div>
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-2 px-1">
        <button onClick={() => setScale((s) => Math.max(1, s - 0.1))} className="text-white/60 hover:text-white text-lg w-7 flex-shrink-0">−</button>
        <input
          type="range" min="1" max="3" step="0.01"
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          className="flex-1 accent-purple-500"
        />
        <button onClick={() => setScale((s) => Math.min(3, s + 0.1))} className="text-white/60 hover:text-white text-lg w-7 flex-shrink-0">+</button>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm text-white/60 hover:text-white transition-colors"
          style={{ background: "#ffffff10" }}
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #FF1CF7 0%, #B044F8 50%, #00B4EE 100%)" }}
        >
          Use photo
        </button>
      </div>
    </div>
  )
}
