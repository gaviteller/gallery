import type { HTMLAttributes } from "react"

/** Shared liquid-paint artwork. Color and glossy detail remain independent. */
export default function GalleryPaintDrips({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`gallery-paint-art ${className}`.trim()} aria-hidden="true" {...props}>
      <span className="gallery-paint-color" />
      <span className="gallery-paint-detail" />
    </div>
  )
}
