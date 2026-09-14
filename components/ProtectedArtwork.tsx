"use client"

import { CSSProperties } from "react"

interface Props {
  src: string
  alt?: string
  style?: CSSProperties
  className?: string
  onClick?: () => void
}

export default function ProtectedArtwork({ src, alt = "", style, className, onClick }: Props) {
  return (
    <div
      style={{ position: "relative", lineHeight: 0 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{ display: "block", userSelect: "none", WebkitUserSelect: "none", ...style }}
        className={className}
        onClick={onClick}
      />
      {/* Transparent overlay — blocks long-press save on mobile, drag on desktop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={onClick}
        aria-hidden
      />
    </div>
  )
}
